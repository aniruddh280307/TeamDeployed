# Flask backend for aviation data aggregation and AI prioritization
# Requires: flask, flask-cors, httpx, python-dotenv, openai
# Environment variables: OPENAI_API_KEY

from __future__ import annotations

import os
import json
from typing import Any, Dict, List, Optional, Tuple

from flask import Flask, request, jsonify
from flask_cors import CORS
import httpx

# Optional: load .env if present
try:
	from dotenv import load_dotenv  # type: ignore
	load_dotenv()
except Exception:
	pass

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

app = Flask(__name__)
CORS(app)

AVIATION_BASE = "https://aviationweather.gov/api/data"

# Aviation Weather API Endpoints
ENDPOINTS = {
	"metar": f"{AVIATION_BASE}/metar",
	"taf": f"{AVIATION_BASE}/taf", 
	"pirep": f"{AVIATION_BASE}/pirep",
	"sigmet": f"{AVIATION_BASE}/sigmet",
	"afd": f"{AVIATION_BASE}/afd",
	"stationinfo": f"{AVIATION_BASE}/stationinfo",
}

# Additional weather APIs for comprehensive data
WEATHER_APIS = {
	"current": "https://aviationweather.gov/api/data/current",
	"forecast": "https://aviationweather.gov/api/data/forecast", 
	"notam": "https://aviationweather.gov/api/data/notam",
	"airmet": "https://aviationweather.gov/api/data/airmet",
	"gairmet": "https://aviationweather.gov/api/data/gairmet",
	"winds": "https://aviationweather.gov/api/data/winds",
	"icing": "https://aviationweather.gov/api/data/icing",
	"turbulence": "https://aviationweather.gov/api/data/turbulence"
}

# Utility: build query for each endpoint. These can be adjusted later.
# We leave flexible params and pass-through any query from frontend.

def build_params(kind: str, params: Dict[str, Any]) -> Dict[str, Any]:
	q: Dict[str, Any] = {}
	q.update(params or {})
	# Provide sane defaults if not specified by frontend
	if kind in ("metar", "taf"):
		q.setdefault("format", "JSON")
		q.setdefault("hours", 2)
	elif kind in ("pirep", "sigmet"):
		q.setdefault("format", "JSON")
		q.setdefault("hours", 4)
	elif kind == "afd":
		q.setdefault("format", "JSON")
		q.setdefault("hours", 6)
	elif kind == "stationinfo":
		q.setdefault("format", "JSON")
	return q


async def fetch_json(client: httpx.AsyncClient, url: str, params: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
	try:
		resp = await client.get(url, params=params, timeout=20.0)
		resp.raise_for_status()
		# Many aviationweather endpoints can return text; attempt JSON first
		try:
			data = resp.json()
		except Exception:
			# best-effort parse for non-JSON; wrap as text
			data = {"text": resp.text}
		return data, None
	except Exception as e:
		return None, str(e)


async def gather_aviation_data(query: Dict[str, Any]) -> Dict[str, Any]:
	result: Dict[str, Any] = {"errors": {}}
	async with httpx.AsyncClient() as client:
		# Fetch all aviation weather endpoints
		for kind, url in ENDPOINTS.items():
			params = build_params(kind, query.get(kind, query))
			data, err = await fetch_json(client, url, params)
			if err:
				result["errors"][kind] = err
			else:
				result[kind] = data
		
		# Fetch additional weather data for comprehensive analysis
		for kind, url in WEATHER_APIS.items():
			params = build_params(kind, query.get(kind, query))
			data, err = await fetch_json(client, url, params)
			if err:
				result["errors"][kind] = err
			else:
				result[kind] = data
	return result


def build_openai_prompt(payload: Dict[str, Any]) -> str:
	# Provide the model with a deterministic instruction to prioritize.
	# Priority rules (seed; model can refine):
	# 1) SIGMET convective/severe > PIREP severe > METAR hazardous (LLWS, TS, VIS<3SM) > TAF worsening > AFD remarks > stationinfo.
	# 2) Summarize high-priority into bullet points with ICAO references and impacts.
	# 3) Include confidence when possible and recommended actions.
	return (
		"You are an aviation weather assistant for pilots. Prioritize and summarize aviation data.\n"
		"Higher priority: SIGMET (especially CONVECTIVE/SEV), PIREP severe icing/turbulence, METAR hazards (TS, LLWS, VIS<3SM),\n"
		"then TAF indicating deterioration within ETA window, then AFD key notes, then station info.\n"
		"Output: concise bullet points suitable for a cockpit briefing. Each bullet: [Source/ICAO] Finding — Impact — Action.\n"
		"Keep to 6 bullets max. Use plain text.\n\n"
		f"DATA:\n{json.dumps(payload)[:15000]}\n"
	)


async def openai_summarize(payload: Dict[str, Any]) -> List[str]:
	if not OPENAI_API_KEY:
		# Fallback summary without OpenAI
		return [
			"[SIGMET] No OpenAI key configured — cannot generate AI summary.",
			"Review SIGMET/PIREP/METAR/TAF in dashboard for details.",
		]
	try:
		prompt = build_openai_prompt(payload)
		# Call OpenAI Responses API (new style)
		openai_url = "https://api.openai.com/v1/chat/completions"
		headers = {
			"Authorization": f"Bearer {OPENAI_API_KEY}",
			"Content-Type": "application/json",
		}
		body = {
			"model": "gpt-4o-mini",
			"messages": [
				{"role": "system", "content": "You are an aviation weather assistant for pilots."},
				{"role": "user", "content": prompt},
			],
			"temperature": 0.2,
			"max_tokens": 400,
		}
		async with httpx.AsyncClient() as client:
			resp = await client.post(openai_url, headers=headers, json=body, timeout=30.0)
			resp.raise_for_status()
			data = resp.json()
			text = data["choices"][0]["message"]["content"]
			# Split into bullets (lines starting with - or *)
			topics = [ln.strip(" -*\t") for ln in text.splitlines() if ln.strip().startswith(("-", "*"))]
			return topics[:6] if topics else [text.strip()]
	except Exception as e:
		return [f"AI summarization failed: {e}"]


@app.get("/api/health")
def health() -> Any:
	return {"status": "ok"}


@app.post("/api/aviation/summary")
async def aviation_summary() -> Any:
	"""
	Body (JSON) optional fields to scope queries (passed through to each endpoint unless overridden):
	{
		"stations": "KJFK,KLAX",  # typical filter
		"metar": {...}, "taf": {...}, "pirep": {...}, "sigmet": {...}, "afd": {...}, "stationinfo": {...}
	}
	"""
	try:
		query: Dict[str, Any] = request.get_json(silent=True) or {}
		data = await gather_aviation_data(query)
		bullets = await openai_summarize(data)
		return jsonify({
			"summary": bullets,
			"errors": data.get("errors", {}),
			"raw": {k: v for k, v in data.items() if k != "errors"}
		})
	except Exception as e:
		return jsonify({"error": str(e)}), 500

@app.get("/api/weather/<icao>")
async def get_weather_for_icao(icao: str) -> Any:
	"""Get comprehensive weather data for a specific ICAO code"""
	try:
		query = {"stations": icao.upper()}
		data = await gather_aviation_data(query)
		return jsonify({
			"icao": icao.upper(),
			"data": data,
			"errors": data.get("errors", {})
		})
	except Exception as e:
		return jsonify({"error": str(e)}), 500

@app.get("/api/route/<path:route>")
async def get_route_weather(route: str) -> Any:
	"""Get weather data for a route (comma-separated ICAO codes)"""
	try:
		icaos = [code.strip().upper() for code in route.split(',')]
		query = {"stations": ','.join(icaos)}
		data = await gather_aviation_data(query)
		return jsonify({
			"route": icaos,
			"data": data,
			"errors": data.get("errors", {})
		})
	except Exception as e:
		return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
	app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
