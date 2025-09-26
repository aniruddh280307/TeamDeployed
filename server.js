const express = require('express');
const cors = require('cors');
const axios = require('axios');
const OpenAI = require('openai');
const NodeCache = require('node-cache');
const { aviationAPI } = require('./api-integration');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize cache with 5-minute TTL
const cache = new NodeCache({ stdTTL: 300 });

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize OpenAI with better error handling
let openai;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your-openai-api-key-here') {
  try {
    openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });
    console.log('🧠 OpenAI configured: Yes');
  } catch (error) {
    console.warn('OpenAI initialization failed:', error.message);
    openai = null;
  }
} else {
  console.log('🧠 OpenAI configured: No (API key not set)');
  openai = null;
}

// Aviation Weather API Configuration
const AVIATION_BASE = 'https://aviationweather.gov/api/data';

// Enhanced utility functions
function buildParams(kind, params = {}) {
  const q = { ...params };
  
  // Enhanced parameter building with validation
  switch (kind) {
    case 'metar':
    case 'taf':
      q.format = 'json';
      q.hours = Math.min(q.hours || 2, 24); // Cap at 24 hours
      break;
    case 'pirep':
      q.format = 'json';
      q.hours = Math.min(q.hours || 4, 24);
      q.type = 'all';
      break;
    case 'sigmet':
      q.format = 'json';
      q.hours = Math.min(q.hours || 6, 24);
      q.type = 'all';
      break;
    case 'afd':
      q.format = 'json';
      q.hours = Math.min(q.hours || 6, 24);
      break;
    case 'stationinfo':
      q.format = 'json';
      break;
    default:
      q.format = 'json';
  }
  
  return q;
}

// Use the new API integration
async function fetchAviationData(kind, params = {}) {
  try {
    switch (kind) {
      case 'metar':
        return await aviationAPI.getMETAR(params.ids, params.hours);
      case 'taf':
        return await aviationAPI.getTAF(params.ids, params.hours);
      case 'pirep':
        return await aviationAPI.getPIREP(params.hours);
      case 'sigmet':
        return await aviationAPI.getSIGMET(params.hours);
      case 'stationinfo':
        return await aviationAPI.getStationInfo(params.ids);
      case 'afd':
        return await aviationAPI.getAFD(params.ids, params.hours);
      default:
        throw new Error(`Unknown API type: ${kind}`);
    }
  } catch (error) {
    console.error(`${kind.toUpperCase()} API Error:`, error.message);
    return [];
  }
}

// Enhanced METAR decoder with more features
function decodeMetar(metarData) {
  try {
    const stationId = metarData.icaoId || 'Unknown';
    const stationName = metarData.name || 'Unknown Airport';
    const reportTime = metarData.obsTime || 0;
    
    // Convert timestamp to readable format
    let timeStr = 'Unknown time';
    if (reportTime) {
      const dt = new Date(reportTime * 1000);
      timeStr = dt.toLocaleDateString('en-US', { day: 'numeric' }) + 
                ' at ' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' UTC';
    }
    
    return {
      station: stationId,
      airport_name: stationName,
      report_time: timeStr,
      temperature: decodeTemperature(metarData),
      wind: decodeWind(metarData),
      visibility: decodeVisibility(metarData),
      clouds: decodeClouds(metarData),
      pressure: decodePressure(metarData),
      weather: decodeWeatherConditions(metarData),
      summary: generateMetarSummary(metarData, stationName, timeStr),
      raw_metar: metarData.rawOb || 'Not available'
    };
  } catch (error) {
    return { 
      error: `Failed to decode METAR: ${error.message}`,
      station: metarData.icaoId || 'Unknown',
      raw_metar: metarData.rawOb || 'Not available'
    };
  }
}

function decodeTemperature(metarData) {
  const temp = metarData.temp;
  const dewp = metarData.dewp;
  
  if (temp !== null && temp !== undefined) {
    const tempC = Math.round(temp);
    const dewpC = dewp !== null && dewp !== undefined ? Math.round(dewp) : null;
    
    if (dewpC !== null) {
      return `Temperature ${tempC}°C, dew point ${dewpC}°C`;
    } else {
      return `Temperature ${tempC}°C`;
    }
  } else {
    return 'Temperature not available';
  }
}

function decodeWind(metarData) {
  const wdir = metarData.wdir;
  const wspd = metarData.wspd;
  const wgst = metarData.wgst;
  
  if (wdir !== null && wdir !== undefined && wspd !== null && wspd !== undefined) {
    // Convert wind direction to compass direction
    const compassDirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const dirIndex = Math.round((wdir + 11.25) / 22.5) % 16;
    const compassDir = compassDirs[dirIndex];
    
    let windStr = `Wind from ${wdir} degrees (${compassDir}) at ${wspd} knots`;
    
    if (wgst && wgst > wspd) {
      windStr += `, gusting to ${wgst} knots`;
    }
    
    return windStr;
  } else if (wdir !== null && wdir !== undefined) {
    return `Wind from ${wdir} degrees`;
  } else if (wspd !== null && wspd !== undefined) {
    return `Wind speed ${wspd} knots`;
  } else {
    return 'Wind information not available';
  }
}

function decodeVisibility(metarData) {
  const visib = metarData.visib || '';
  
  if (visib) {
    if (visib === '10+') {
      return 'Visibility 10+ miles (excellent)';
    } else if (visib.endsWith('SM')) {
      const miles = visib.slice(0, -2);
      if (miles === '10+') {
        return 'Visibility 10+ miles (excellent)';
      } else {
        try {
          const milesFloat = parseFloat(miles);
          const km = milesFloat * 1.609;
          return `Visibility ${miles} miles (${km.toFixed(1)} km)`;
        } catch {
          return `Visibility ${visib}`;
        }
      }
    } else {
      return `Visibility ${visib}`;
    }
  } else {
    return 'Visibility not available';
  }
}

function decodeClouds(metarData) {
  const clouds = metarData.clouds || [];
  
  if (!clouds || clouds.length === 0) {
    return 'No cloud information';
  }
  
  const cloudDescriptions = [];
  for (const cloud of clouds) {
    const cover = cloud.cover || '';
    const base = cloud.base || 0;
    
    // Convert cloud cover codes
    const coverMap = {
      'CLR': 'Clear',
      'FEW': 'Few clouds',
      'SCT': 'Scattered clouds',
      'BKN': 'Broken clouds',
      'OVC': 'Overcast'
    };
    
    const coverDesc = coverMap[cover] || cover;
    const baseFt = Math.round(base);
    const baseDesc = baseFt > 0 ? `at ${baseFt} feet` : '';
    
    cloudDescriptions.push(`${coverDesc} ${baseDesc}`.trim());
  }
  
  return cloudDescriptions.join('. ');
}

function decodePressure(metarData) {
  const altim = metarData.altim;
  const slp = metarData.slp;
  
  if (altim !== null && altim !== undefined) {
    return `Pressure ${altim.toFixed(1)} hPa`;
  } else if (slp !== null && slp !== undefined) {
    return `Sea level pressure ${slp.toFixed(1)} hPa`;
  } else {
    return 'Pressure not available';
  }
}

function decodeWeatherConditions(metarData) {
  const wxString = metarData.wxString || '';
  
  if (!wxString) {
    return 'No significant weather';
  }
  
  // Enhanced weather codes
  const weatherMap = {
    'RA': 'Rain',
    'SN': 'Snow',
    'FG': 'Fog',
    'HZ': 'Haze',
    'BR': 'Mist',
    'TS': 'Thunderstorm',
    'SH': 'Showers',
    'DZ': 'Drizzle',
    'GR': 'Hail',
    'GS': 'Small hail',
    'FU': 'Smoke',
    'DU': 'Dust',
    'SA': 'Sand',
    'VA': 'Volcanic ash',
    'SQ': 'Squalls',
    'FC': 'Funnel cloud',
    'SS': 'Sandstorm',
    'DS': 'Duststorm'
  };
  
  const conditions = [];
  for (const code of wxString.split(' ')) {
    if (weatherMap[code]) {
      conditions.push(weatherMap[code]);
    } else {
      conditions.push(code);
    }
  }
  
  return conditions.length > 0 ? conditions.join(', ') : 'No significant weather';
}

function generateMetarSummary(metarData, stationName, timeStr) {
  try {
    const stationId = metarData.icaoId || 'Unknown';
    const temp = metarData.temp;
    const dewp = metarData.dewp;
    const wdir = metarData.wdir;
    const wspd = metarData.wspd;
    const wgst = metarData.wgst;
    const visib = metarData.visib || '';
    const altim = metarData.altim;
    const clouds = metarData.clouds || [];
    const wxString = metarData.wxString || '';
    
    // Build summary
    const summaryParts = [`${stationName} (${stationId}), report issued on the ${timeStr}`];
    
    // Wind
    if (wdir !== null && wdir !== undefined && wspd !== null && wspd !== undefined) {
      let windStr = `Wind from ${wdir} degrees at ${wspd} knots`;
      if (wgst && wgst > wspd) {
        windStr += `, gusting to ${wgst} knots`;
      }
      summaryParts.push(windStr);
    }
    
    // Visibility
    if (visib) {
      if (visib === '10+') {
        summaryParts.push('Visibility 10+ miles');
      } else if (visib.endsWith('SM')) {
        const miles = visib.slice(0, -2);
        if (miles !== '10+') {
          summaryParts.push(`Visibility ${miles} miles`);
        }
      }
    }
    
    // Weather conditions
    if (wxString) {
      const weatherDesc = decodeWeatherConditions(metarData);
      if (weatherDesc !== 'No significant weather') {
        summaryParts.push(weatherDesc);
      }
    }
    
    // Clouds
    if (clouds && clouds.length > 0) {
      const cloudDesc = decodeClouds(metarData);
      if (cloudDesc !== 'No cloud information') {
        summaryParts.push(cloudDesc);
      }
    }
    
    // Temperature
    if (temp !== null && temp !== undefined) {
      const tempC = Math.round(temp);
      const dewpC = dewp !== null && dewp !== undefined ? Math.round(dewp) : null;
      if (dewpC !== null) {
        summaryParts.push(`Temperature ${tempC}°C, dew point ${dewpC}°C`);
      } else {
        summaryParts.push(`Temperature ${tempC}°C`);
      }
    }
    
    // Pressure
    if (altim !== null && altim !== undefined) {
      summaryParts.push(`Pressure ${altim.toFixed(1)} hPa`);
    }
    
    // Add forecast note
    summaryParts.push('No significant change expected');
    
    return summaryParts.join('. ') + '.';
    
  } catch (error) {
    return `Error generating summary: ${error.message}`;
  }
}

// Enhanced AI Summary Generation with better error handling
async function generateAISummary(weatherData) {
  console.log('🔍 generateAISummary called with openai:', !!openai);
  
  // If OpenAI is not available, generate a manual summary from the data
  if (!openai) {
    console.log('🧠 OpenAI not available, using manual summary');
    return generateManualSummary(weatherData);
  }

  try {
    console.log('🧠 OpenAI available, generating AI summary');
    const prompt = `You are an aviation weather expert. Analyze the following comprehensive weather data and provide a detailed overview for pilots:

METAR Data (Current Conditions): ${JSON.stringify(weatherData.metar || [])}
TAF Data (Forecasts): ${JSON.stringify(weatherData.taf || [])}
PIREP Data (Pilot Reports): ${JSON.stringify(weatherData.pirep || [])}
SIGMET Data (Significant Weather): ${JSON.stringify(weatherData.sigmet || [])}
AFD Data (Area Forecasts): ${JSON.stringify(weatherData.afd || [])}
NOTAM Data (Notices): ${JSON.stringify(weatherData.notam || [])}
AIRMET Data (Airmen's Info): ${JSON.stringify(weatherData.airmet || [])}

Please provide a comprehensive weather briefing that includes:

1. **Current Weather Conditions** - Based on METAR data
2. **Forecast Information** - Based on TAF data  
3. **Pilot Observations** - Based on PIREP data
4. **Significant Weather Alerts** - Based on SIGMET data
5. **Area Forecasts** - Based on AFD data
6. **Important Notices** - Based on NOTAM data
7. **Meteorological Information** - Based on AIRMET data

Format the response as a comprehensive weather briefing with clear sections and bullet points. Focus on:
- Flight safety considerations
- Weather hazards and their locations
- Current and forecast conditions
- Recommendations for pilots
- Any significant weather that could affect flight operations

Provide detailed, actionable information that pilots can use for flight planning and decision making.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7
    });

    const response = completion.choices[0].message.content;
    console.log('🧠 OpenAI generated response:', response.substring(0, 200) + '...');
    return response;
  } catch (error) {
    console.error('OpenAI API Error:', error.message);
    console.log('🔄 Falling back to manual summary due to OpenAI error');
    return generateManualSummary(weatherData);
  }
}

// Manual summary generation with concise 5-6 line format and categories
function generateManualSummary(weatherData) {
  console.log('🚨 generateManualSummary CALLED - CONCISE FORMAT!');
  console.log('🔍 Generating manual summary with data:', {
    metar: weatherData.metar ? weatherData.metar.length : 0,
    taf: weatherData.taf ? weatherData.taf.length : 0,
    pirep: weatherData.pirep ? weatherData.pirep.length : 0,
    sigmet: weatherData.sigmet ? weatherData.sigmet.length : 0
  });
  
  const weatherBriefing = [];
  
  // CONCISE WEATHER BRIEFING (5-6 lines only)
  weatherBriefing.push('🌤️ WEATHER BRIEFING SUMMARY');
  weatherBriefing.push('='.repeat(40));
  
  // Overview Category (METAR, TAF, PIREP)
  weatherBriefing.push('\n📊 OVERVIEW:');
  
  // Current Weather (METAR) - 1 line
  if (weatherData.metar && weatherData.metar.length > 0) {
    const metar = weatherData.metar[0];
    const decodedMetar = decodeMETAR(metar);
    weatherBriefing.push(`• ${metar.icaoId}: ${decodedMetar.summary} <span class="tag pilot-advice">pilot advice</span> <a href="#" class="see-why" data-station="${metar.icaoId}" data-type="metar">See why</a>`);
  }
  
  // Forecast (TAF) - 1 line
  if (weatherData.taf && weatherData.taf.length > 0) {
    const taf = weatherData.taf[0];
    const decodedTAF = decodeTAF(taf);
    weatherBriefing.push(`• ${taf.icaoId}: ${decodedTAF.summary} <span class="tag expert">expert</span> <a href="#" class="see-why" data-station="${taf.icaoId}" data-type="taf">See why</a>`);
  }
  
  // Pilot Reports (PIREP) - 1 line
  if (weatherData.pirep && weatherData.pirep.length > 0) {
    const pirep = weatherData.pirep[0];
    const decodedPIREP = decodePIREP(pirep);
    weatherBriefing.push(`• Pilot Report: ${decodedPIREP.summary} <span class="tag pilot-advice">pilot advice</span> <a href="#" class="see-why" data-station="${pirep.icaoId || 'Unknown'}" data-type="pirep">See why</a>`);
  } else {
    weatherBriefing.push(`• Pilot Reports: No recent observations <span class="tag pilot-advice">pilot advice</span>`);
  }
  
  // Attention Category (SIGMET, AFD, NOTAM)
  weatherBriefing.push('\n⚠️ ATTENTION:');
  
  // Weather Alerts (SIGMET) - 1 line
  if (weatherData.sigmet && weatherData.sigmet.length > 0) {
    const sigmet = weatherData.sigmet[0];
    const decodedSIGMET = decodeSIGMET(sigmet);
    weatherBriefing.push(`• Weather Alert: ${decodedSIGMET.summary} <span class="tag expert">expert</span> <a href="#" class="see-why" data-station="${sigmet.icaoId || 'Unknown'}" data-type="sigmet">See why</a>`);
  } else {
    weatherBriefing.push(`• Weather Alerts: No active warnings <span class="tag expert">expert</span>`);
  }
  
  // Flight Safety - 1 line
  weatherBriefing.push(`• Flight Safety: Monitor conditions, check updates, be prepared for changes <span class="tag expert">expert</span>`);
  
  const result = weatherBriefing.join('\n');
  
  console.log('📝 Generated concise weather briefing (5-6 lines):', result.substring(0, 200) + '...');
  return result;
}

// METAR Decoding Functions (same as Python version)
function decodeMETAR(metar) {
  const rawMetar = metar.rawOb || '';
  const icaoId = metar.icaoId || 'Unknown';
  
  // Extract basic information
  const windDir = metar.windDir || 0;
  const windSpeed = metar.windSpeed || 0;
  const windGust = metar.windGust || 0;
  const visibility = metar.vis || 0;
  const temperature = metar.temp || 0;
  const dewPoint = metar.dewp || 0;
  const pressure = metar.altim || 0;
  
  // Create readable summary
  let summary = `${icaoId} Airport - `;
  
  // Wind information
  if (windDir && windSpeed) {
    const windDirection = getWindDirection(windDir);
    summary += `Wind from ${windDirection} at ${windSpeed} knots`;
    if (windGust) {
      summary += `, gusts to ${windGust} knots`;
    }
    summary += '. ';
  }
  
  // Visibility
  if (visibility) {
    const visMiles = visibility >= 10 ? '10+ miles' : `${visibility} miles`;
    summary += `Visibility ${visMiles}. `;
  }
  
  // Temperature
  if (temperature && dewPoint) {
    summary += `Temperature ${temperature}°C, dew point ${dewPoint}°C. `;
  }
  
  // Pressure
  if (pressure) {
    summary += `Pressure ${pressure} hPa. `;
  }
  
  // Weather conditions
  const weatherConditions = getWeatherConditions(rawMetar);
  if (weatherConditions) {
    summary += weatherConditions;
  }
  
  return {
    summary: summary.trim(),
    wind: windDir && windSpeed ? `${getWindDirection(windDir)} at ${windSpeed} kts${windGust ? `, gusts ${windGust} kts` : ''}` : 'No wind data',
    visibility: visibility ? `${visibility} miles` : 'No visibility data',
    temperature: temperature ? `${temperature}°C (dew point: ${dewPoint}°C)` : 'No temperature data',
    pressure: pressure ? `${pressure} hPa` : 'No pressure data',
    raw: rawMetar
  };
}

function decodeTAF(taf) {
  const rawTAF = taf.rawOb || '';
  const icaoId = taf.icaoId || 'Unknown';
  
  // Extract TAF information
  const validFrom = taf.validFrom || '';
  const validTo = taf.validTo || '';
  
  let summary = `${icaoId} Terminal Forecast - `;
  
  if (validFrom && validTo) {
    summary += `Valid from ${validFrom} to ${validTo}. `;
  }
  
  // Basic forecast summary
  summary += 'Terminal aerodrome forecast available for flight planning.';
  
  return {
    summary: summary.trim(),
    validFrom: validFrom,
    validTo: validTo,
    raw: rawTAF
  };
}

function decodePIREP(pirep) {
  const rawPIREP = pirep.rawOb || '';
  
  let summary = 'Pilot Report - ';
  
  // Extract basic PIREP information
  if (rawPIREP.includes('TURB')) {
    summary += 'Turbulence reported. ';
  }
  if (rawPIREP.includes('ICE')) {
    summary += 'Icing conditions reported. ';
  }
  if (rawPIREP.includes('WX')) {
    summary += 'Weather conditions observed. ';
  }
  
  if (summary === 'Pilot Report - ') {
    summary += 'Pilot weather observation available.';
  }
  
  return {
    summary: summary.trim(),
    raw: rawPIREP
  };
}

function decodeSIGMET(sigmet) {
  const rawSIGMET = sigmet.rawOb || '';
  
  let summary = 'Significant Weather Alert - ';
  
  // Extract SIGMET information
  if (rawSIGMET.includes('TURB')) {
    summary += 'Turbulence warning. ';
  }
  if (rawSIGMET.includes('ICE')) {
    summary += 'Icing warning. ';
  }
  if (rawSIGMET.includes('TS')) {
    summary += 'Thunderstorm warning. ';
  }
  if (rawSIGMET.includes('MT')) {
    summary += 'Mountain wave warning. ';
  }
  
  if (summary === 'Significant Weather Alert - ') {
    summary += 'Active weather warning in effect.';
  }
  
  return {
    summary: summary.trim(),
    raw: rawSIGMET
  };
}

function getWindDirection(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function getWeatherConditions(rawMetar) {
  let conditions = '';
  
  if (rawMetar.includes('RA')) conditions += 'Rain. ';
  if (rawMetar.includes('SN')) conditions += 'Snow. ';
  if (rawMetar.includes('FG')) conditions += 'Fog. ';
  if (rawMetar.includes('BR')) conditions += 'Mist. ';
  if (rawMetar.includes('HZ')) conditions += 'Haze. ';
  if (rawMetar.includes('TS')) conditions += 'Thunderstorms. ';
  if (rawMetar.includes('SH')) conditions += 'Showers. ';
  
  return conditions.trim();
}

// Input validation middleware
function validateICAO(icao) {
  if (!icao || typeof icao !== 'string') {
    return false;
  }
  return /^[A-Z]{4}$/.test(icao.toUpperCase());
}

function validateRoute(route) {
  if (!route || typeof route !== 'string') {
    return false;
  }
  const icaos = route.split(',').map(code => code.trim().toUpperCase());
  return icaos.every(icao => /^[A-Z]{4}$/.test(icao));
}

// Enhanced Routes with better error handling
app.get('/', (req, res) => {
  res.json({ 
    message: 'Aviation Weather AI API', 
    version: '2.0.0',
    status: 'operational',
    endpoints: [
      'GET /health',
      'GET /search?query=...',
      'GET /weather/:icao',
      'POST /aviation/summary',
      'GET /stations?ids=...',
      'GET /data/stationinfo?station=...',
      'GET /route/stations/:route',
      'GET /data/metar?station=...'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: {
      keys: cache.keys().length,
      hits: cache.getStats().hits,
      misses: cache.getStats().misses
    }
  });
});

app.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query parameter is required and must be at least 2 characters' });
    }

    const searchResults = await aviationAPI.searchWeatherData(query, {
      metarHours: 2,
      pirepHours: 6
    });

    res.json(searchResults);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

app.get('/weather/:icao', async (req, res) => {
  try {
    const { icao } = req.params;
    
    if (!validateICAO(icao)) {
      return res.status(400).json({ error: 'Invalid ICAO code format. Must be 4 letters (e.g., KJFK)' });
    }

    const metarData = await fetchAviationData('metar', { ids: icao, format: 'json', hours: 2 });
    res.json(metarData);
  } catch (error) {
    console.error('Weather fetch error:', error);
    res.status(500).json({ error: 'Weather fetch failed', details: error.message });
  }
});

app.post('/aviation/summary', async (req, res) => {
  try {
    const { stations } = req.body;
    if (!stations) {
      return res.status(400).json({ error: 'Stations parameter is required' });
    }

    // Validate stations format
    const stationList = Array.isArray(stations) ? stations : stations.split(',');
    const invalidStations = stationList.filter(station => !validateICAO(station.trim()));
    
    if (invalidStations.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid ICAO codes', 
        invalid: invalidStations 
      });
    }

    // Use the new API integration for comprehensive weather data
    const weatherData = await aviationAPI.getComprehensiveWeatherData(stationList.join(','), {
      metarHours: 2,
      tafHours: 6,
      pirepHours: 6,
      sigmetHours: 6
    });

    // Generate AI summary
    console.log('🔍 About to call generateAISummary with weatherData:', {
      metar: weatherData.metar ? weatherData.metar.length : 0,
      taf: weatherData.taf ? weatherData.taf.length : 0,
      pirep: weatherData.pirep ? weatherData.pirep.length : 0,
      sigmet: weatherData.sigmet ? weatherData.sigmet.length : 0
    });
    
    const summaryResult = await generateAISummary(weatherData);
    console.log('📝 Generated summary result:', summaryResult);

    // Handle weather briefing summary format (same as Python version)
    let summary;
    if (typeof summaryResult === 'string') {
      // Direct string format from OpenAI (same as Python)
      summary = [summaryResult];
    } else {
      // Fallback
      summary = ['Weather briefing summary unavailable'];
    }

    res.json({
      summary: summary,
      data: weatherData,
      stations: stationList,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Aviation summary error:', error);
    res.status(500).json({ error: 'Summary generation failed', details: error.message });
  }
});

app.get('/stations', async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'IDs parameter is required' });
    }

    const stationData = await fetchAviationData('stationinfo', { ids, format: 'json' });
    res.json(stationData);
  } catch (error) {
    console.error('Stations fetch error:', error);
    res.status(500).json({ error: 'Stations fetch failed', details: error.message });
  }
});

app.get('/data/stationinfo', async (req, res) => {
  try {
    const { station } = req.query;
    if (!station) {
      return res.status(400).json({ error: 'Station parameter is required' });
    }

    if (!validateICAO(station)) {
      return res.status(400).json({ error: 'Invalid ICAO code format' });
    }

    const stationData = await fetchAviationData('stationinfo', { ids: station, format: 'json' });
    res.json(stationData);
  } catch (error) {
    console.error('Station info error:', error);
    res.status(500).json({ error: 'Station info fetch failed', details: error.message });
  }
});

app.get('/route/stations/:route', async (req, res) => {
  try {
    const { route } = req.params;
    
    if (!validateRoute(route)) {
      return res.status(400).json({ error: 'Invalid route format. Use comma-separated ICAO codes (e.g., KJFK,KLAX)' });
    }

    const icaos = route.split(',').map(code => code.trim().toUpperCase());
    
    // Use the new API integration for multiple stations
    const result = await aviationAPI.getMultipleStations(icaos);
    res.json(result);
  } catch (error) {
    console.error('Route stations error:', error);
    res.status(500).json({ error: 'Route stations fetch failed', details: error.message });
  }
});

app.get('/data/metar', async (req, res) => {
  try {
    const { station, hours = 1 } = req.query;
    if (!station) {
      return res.status(400).json({ error: 'Station parameter is required' });
    }

    if (!validateICAO(station)) {
      return res.status(400).json({ error: 'Invalid ICAO code format' });
    }

    const hoursNum = parseInt(hours);
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 24) {
      return res.status(400).json({ error: 'Hours must be between 1 and 24' });
    }

    // Use the enhanced API integration for METAR decoding
    const result = await aviationAPI.getDecodedMETAR(station, hoursNum);
    res.json(result);
  } catch (error) {
    console.error('METAR decoder error:', error);
    res.status(500).json({ error: 'METAR decoder failed', details: error.message });
  }
});

// Cache management endpoints
app.get('/cache/stats', (req, res) => {
  res.json({
    stats: cache.getStats(),
    keys: cache.keys().length,
    timestamp: new Date().toISOString()
  });
});

app.delete('/cache', (req, res) => {
  cache.flushAll();
  res.json({ message: 'Cache cleared successfully' });
});

// API Integration endpoints
app.get('/api/health', async (req, res) => {
  try {
    const healthStatus = await aviationAPI.healthCheck();
    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({ error: 'Health check failed', details: error.message });
  }
});

app.get('/api/cache/stats', (req, res) => {
  try {
    const stats = aviationAPI.getCacheStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Cache stats failed', details: error.message });
  }
});

app.delete('/api/cache', (req, res) => {
  try {
    const result = aviationAPI.clearCache();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Cache clear failed', details: error.message });
  }
});

// "See why" endpoint for detailed explanations
app.get('/see-why', async (req, res) => {
  try {
    const { station, type } = req.query;
    
    if (!station || !type) {
      return res.status(400).json({ error: 'Station and type required' });
    }

    let detailedExplanation = '';
    let rawData = '';

    switch (type.toLowerCase()) {
      case 'metar':
        const metarData = await fetchAviationData('metar', { ids: station, hours: 1, format: 'json' });
        if (metarData && metarData.length > 0) {
          const metar = metarData[0];
          const decoded = decodeMETAR(metar);
          rawData = metar.rawOb || '';
          detailedExplanation = `Detailed METAR Analysis for ${station}:

Raw METAR: ${rawData}

Decoded Information:
• Airport: ${station}
• Wind: ${decoded.wind}
• Visibility: ${decoded.visibility}
• Temperature: ${decoded.temperature}
• Pressure: ${decoded.pressure}

This METAR provides current weather conditions at ${station} airport. The wind direction and speed are crucial for runway selection and approach planning. Visibility affects landing minimums, while temperature and pressure are important for aircraft performance calculations.`;
        }
        break;

      case 'taf':
        const tafData = await fetchAviationData('taf', { ids: station, hours: 6, format: 'json' });
        if (tafData && tafData.length > 0) {
          const taf = tafData[0];
          const decoded = decodeTAF(taf);
          rawData = taf.rawOb || '';
          detailedExplanation = `Detailed TAF Analysis for ${station}:

Raw TAF: ${rawData}

Decoded Information:
• Airport: ${station}
• Valid From: ${decoded.validFrom}
• Valid To: ${decoded.validTo}

This TAF provides forecast weather conditions for ${station} airport. TAFs are essential for flight planning as they predict weather changes over the next 24-30 hours. They help pilots anticipate conditions at their destination and plan alternate routes if necessary.`;
        }
        break;

      case 'pirep':
        const pirepData = await fetchAviationData('pirep', { hours: 6, format: 'json', type: 'all' });
        if (pirepData && pirepData.length > 0) {
          const pirep = pirepData[0];
          const decoded = decodePIREP(pirep);
          rawData = pirep.rawOb || '';
          detailedExplanation = `Detailed PIREP Analysis:

Raw PIREP: ${rawData}

Decoded Information:
• Report: ${decoded.summary}

This PIREP (Pilot Report) provides real-time weather observations from pilots in flight. PIREPs are invaluable because they offer current conditions that may not be reflected in METARs or TAFs. They help other pilots understand what to expect along their route.`;
        }
        break;

      case 'sigmet':
        const sigmetData = await fetchAviationData('sigmet', { hours: 6, format: 'json', type: 'all' });
        if (sigmetData && sigmetData.length > 0) {
          const sigmet = sigmetData[0];
          const decoded = decodeSIGMET(sigmet);
          rawData = sigmet.rawOb || '';
          detailedExplanation = `Detailed SIGMET Analysis:

Raw SIGMET: ${rawData}

Decoded Information:
• Alert: ${decoded.summary}

This SIGMET (Significant Meteorological Information) warns of hazardous weather conditions that could affect flight safety. SIGMETs are issued for severe turbulence, icing, volcanic ash, and other significant weather phenomena that pose a threat to aircraft.`;
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid type specified' });
    }

    res.json({
      station: station,
      type: type,
      detailedExplanation: detailedExplanation,
      rawData: rawData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('See why error:', error);
    res.status(500).json({ error: 'Detailed explanation failed', details: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Aviation Weather Backend v2.0 running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/`);
  console.log(`🧠 OpenAI configured: ${openai ? 'Yes' : 'No'}`);
  console.log(`💾 Cache enabled: Yes (TTL: 5 minutes)`);
});

module.exports = app;
