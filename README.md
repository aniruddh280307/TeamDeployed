# 🌤️ Aviation Weather Dashboard

A real-time aviation weather dashboard with AI-powered weather summaries and user-friendly METAR decoding.

## 🚀 Quick Start

### 1. Start the Backend
```bash
node server.js
```

### 2. Open the Frontend
Open `index.html` in your web browser.

### 3. Enter Flight Route
Enter ICAO codes separated by commas (e.g., `KJFK,EGLL,LFPG,EDDF`)

## 📁 Project Structure

```
TeamDeployed/
├── server.js          # Node.js backend server
├── package.json       # Dependencies and scripts
├── index.html         # Frontend dashboard
├── script.js          # Frontend JavaScript
├── style.css          # Frontend styling
└── node_modules/      # Dependencies
```

## 🎯 Features

- **Real-time Weather Data** - METAR, TAF, PIREP, SIGMET
- **AI-Powered Summaries** - OpenAI GPT-4o-mini integration
- **User-Friendly METAR Decoder** - Plain English weather descriptions
- **Interactive Dashboard** - Visual flight route analysis
- **Response Caching** - High performance with 5-minute TTL
- **Error Handling** - Graceful fallbacks and user feedback

## 🔧 API Endpoints

- `GET /health` - Server health check
- `POST /aviation/summary` - AI weather summary
- `GET /weather/:icao` - Weather data for airport
- `GET /data/stationinfo?station=...` - Airport information
- `GET /data/metar?station=...` - Decoded METAR data
- `GET /route/stations/:route` - Multi-airport data
- `GET /search?query=...` - Weather data search

## 🌐 Frontend Integration

The dashboard automatically connects to the backend running on `http://localhost:8000`.

## 📊 Dashboard Widgets

- **Current Weather** - Decoded METAR with user-friendly descriptions
- **Visibility** - Real-time visibility conditions
- **Weather Score** - Comprehensive weather analysis
- **Wind Conditions** - Wind speed, direction, and gusts
- **TFR/Restricted Areas** - Temporary flight restrictions

## 🚀 Production Ready

- **High Performance** - Response caching and optimized API calls
- **Robust Error Handling** - Graceful degradation and user feedback
- **Input Validation** - Security and data quality
- **Monitoring** - Request logging and performance metrics

## 🎉 Ready to Use!

The aviation weather dashboard is now clean, optimized, and ready for production use! 🌤️✈️
