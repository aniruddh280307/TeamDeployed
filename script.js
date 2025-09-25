let routeData = [];
let progressInterval;

// ====== AVIATION WEATHER API CONFIGURATION ======
const AVIATION_API_CONFIG = {
    baseUrl: 'https://aviationweather.gov/api/data',
    endpoints: {
        metar: '/metar',
        taf: '/taf',
        pirep: '/pirep',
        sigmet: '/sigmet',
        afd: '/afd',
        stationinfo: '/stationinfo',
        current: '/current',
        forecast: '/forecast',
        notam: '/notam',
        airmet: '/airmet',
        gairmet: '/gairmet',
        winds: '/winds',
        icing: '/icing',
        turbulence: '/turbulence'
    }
};

// Backend API Configuration
const BACKEND_API_CONFIG = {
    baseUrl: 'http://localhost:5000',
    endpoints: {
        summary: '/api/aviation/summary',
        weather: '/api/weather',
        route: '/api/route',
        health: '/api/health'
    }
};

// Aviation Weather API Helper Functions
async function fetchAviationData(endpoint, params = {}) {
    try {
        const url = `${AVIATION_API_CONFIG.baseUrl}${AVIATION_API_CONFIG.endpoints[endpoint]}`;
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        
        const response = await fetch(fullUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`${endpoint.toUpperCase()} API Error:`, error);
        return null;
    }
}

async function fetchWeatherData(icaoCode) {
    return await fetchAviationData('metar', { 
        stations: icaoCode, 
        format: 'JSON', 
        hours: 2 
    });
}

// Removed AQI integration

// ===== Optional: TFR Integration Stub =====
// Replace implementation when TFR/Restricted Areas API is available
async function fetchTfrForRoute(routeIcaos) {
    try {
        // Example target may accept polyline/route or list of ICAOs
        // const response = await fetch(`${WEATHER_API_CONFIG.baseUrl}${WEATHER_API_CONFIG.endpoints.tfr}`, { method: 'POST', body: JSON.stringify({ route: routeIcaos })});
        // const data = await response.json();
        // return data; // shape suggestion: { hasRestrictions: boolean, items: [...] }
        return null; // placeholder
    } catch (error) {
        console.error('TFR API Error:', error);
        return null;
    }
}

async function fetchMetarData(icaoCode) {
    return await fetchAviationData('metar', { 
        stations: icaoCode, 
        format: 'JSON', 
        hours: 2 
    });
}

async function searchWeatherReports(query) {
    // Use backend API for comprehensive search
    try {
        const response = await fetch(`${BACKEND_API_CONFIG.baseUrl}${BACKEND_API_CONFIG.endpoints.summary}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        return data.summary || [];
    } catch (error) {
        console.error('Search API Error:', error);
        return [];
    }
}

// Page 1: Form validation and submission
document.getElementById('routeForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const icaoInput = document.getElementById('icaoCodes').value.trim();
    const errorElement = document.getElementById('icaoError');
    
    // Validate ICAO codes
    if (!validateICAOCodes(icaoInput)) {
        return;
    }
    
    // Process and store route data
    routeData = icaoInput.split(',').map(code => code.trim().toUpperCase());
    
    // Navigate to page 2
    showPage(2);
    initializeDashboard();
});

function validateICAOCodes(input) {
    const errorElement = document.getElementById('icaoError');
    
    if (!input) {
        showError('Please enter ICAO codes');
        return false;
    }
    
    const codes = input.split(',').map(code => code.trim());
    
    if (codes.length < 2) {
        showError('Please enter at least 2 ICAO codes');
        return false;
    }
    
    const icaoPattern = /^[A-Z]{4}$/i;
    
    for (let code of codes) {
        if (!icaoPattern.test(code)) {
            showError(`Invalid ICAO code format: ${code}. ICAO codes must be 4 letters.`);
            return false;
        }
    }
    
    hideError();
    return true;
    
    function showError(message) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        document.getElementById('icaoCodes').style.borderColor = '#e74c3c';
    }
    
    function hideError() {
        errorElement.style.display = 'none';
        document.getElementById('icaoCodes').style.borderColor = '#e0e0e0';
    }
}

// Page navigation
function showPage(pageNumber) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    document.getElementById(`page${pageNumber}`).style.display = 'flex';

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    const activeMap = { 1: 'navPage1', 2: 'navPage2', 3: 'navPage3' };
    const activeBtn = document.getElementById(activeMap[pageNumber]);
    if (activeBtn) activeBtn.classList.add('active');
}

// Page 2: Dashboard initialization
async function initializeDashboard() {
    // Set route title
    document.getElementById('routeTitle').textContent = 
        `${routeData[0]} → ${routeData[routeData.length - 1]}`;
    
    // Create animated map visualization
    createAnimatedMap();
    
    // FETCH REAL WEATHER DATA FOR ROUTE
    await loadRouteWeatherData();
    
    // Update flight information
    updateFlightInfo();
}

// Create professional animated map visualization
function createAnimatedMap() {
    const mapContainer = document.getElementById('flightMap');
    const waypointPins = document.getElementById('waypointPins');
    const weatherStops = document.getElementById('weatherStops');
    const flightProgress = document.getElementById('flightProgress');
    
    // Clear existing content
    waypointPins.innerHTML = '';
    weatherStops.innerHTML = '';
    
    // Airport database for names
    const airportDatabase = {
        'KJFK': { name: 'John F. Kennedy Intl', city: 'New York' },
        'EGLL': { name: 'Heathrow Airport', city: 'London' },
        'LFPG': { name: 'Charles de Gaulle', city: 'Paris' },
        'EDDF': { name: 'Frankfurt Airport', city: 'Frankfurt' },
        'KLAX': { name: 'Los Angeles Intl', city: 'Los Angeles' },
        'EHAM': { name: 'Amsterdam Schiphol', city: 'Amsterdam' },
        'KORD': { name: 'O\'Hare International', city: 'Chicago' },
        'KDFW': { name: 'Dallas/Fort Worth', city: 'Dallas' },
        'KATL': { name: 'Hartsfield-Jackson', city: 'Atlanta' },
        'KSEA': { name: 'Seattle-Tacoma Intl', city: 'Seattle' }
    };
    
    // Create professional pushpin waypoints
    routeData.forEach((waypoint, index) => {
        const pin = document.createElement('div');
        pin.className = 'waypoint-pin';
        
        // Position pins along the route
        const leftPercent = 10 + (index * 80 / (routeData.length - 1));
        pin.style.left = `${leftPercent}%`;
        pin.style.top = '50%';
        
        // Add airport data attributes
        const airportInfo = airportDatabase[waypoint] || { name: waypoint, city: 'Unknown' };
        pin.setAttribute('data-code', waypoint);
        pin.setAttribute('data-name', `${airportInfo.name}\n${airportInfo.city}`);
        
        // Add departure/destination classes
        if (index === 0) {
            pin.classList.add('departure');
        } else if (index === routeData.length - 1) {
            pin.classList.add('destination');
        } else {
            pin.classList.add('waypoint');
        }
        
        waypointPins.appendChild(pin);
    });
    
    // Create weather stops with precipitation
    createWeatherStops();
    
    // Animate flight progress
    setTimeout(() => {
        flightProgress.style.left = '90%';
    }, 1000);
    
    // Load aviation weather summary
    loadAviationSummary();
}

// Create professional weather stops with precipitation
function createWeatherStops() {
    const weatherStops = document.getElementById('weatherStops');
    const weatherTypes = [
        { symbol: '🌤️', label: 'Clear', class: 'clear' },
        { symbol: '⚡', label: 'Turbulence', class: 'turbulence' },
        { symbol: '🌩️', label: 'Storm', class: 'storm' },
        { symbol: '🌧️', label: 'Precipitation', class: 'precipitation' }
    ];
    
    // Create stops between waypoints
    for (let i = 0; i < routeData.length - 1; i++) {
        const stop = document.createElement('div');
        stop.className = 'weather-stop';
        
        // Random weather type for demo (including precipitation)
        const weatherIndex = Math.floor(Math.random() * weatherTypes.length);
        const weatherType = weatherTypes[weatherIndex];
        
        stop.textContent = weatherType.symbol;
        stop.classList.add(weatherType.class);
        
        // Position between waypoints
        const leftPercent = 10 + ((i + 0.5) * 80 / (routeData.length - 1));
        stop.style.left = `${leftPercent}%`;
        stop.style.top = '50%';
        
        // Add tooltip
        stop.title = weatherType.label;
        
        // Add hover tooltip
        stop.addEventListener('mouseenter', (e) => {
            showTooltip(e.target, weatherType.label);
        });
        
        stop.addEventListener('mouseleave', () => {
            hideTooltip();
        });
        
        weatherStops.appendChild(stop);
    }
}

// Tooltip functions
function showTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'weather-tooltip show';
    tooltip.textContent = text;
    tooltip.id = 'weatherTooltip';
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 40}px`;
}

function hideTooltip() {
    const tooltip = document.getElementById('weatherTooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Load aviation weather summary from backend
async function loadAviationSummary() {
    const summaryPoints = document.getElementById('summaryPoints');
    
    try {
        // Prepare query with route stations
        const query = {
            stations: routeData.join(','),
            metar: { hours: 2 },
            taf: { hours: 6 },
            pirep: { hours: 4 },
            sigmet: { hours: 6 },
            afd: { hours: 6 }
        };
        
        // Call backend API
        const response = await fetch(`${BACKEND_API_CONFIG.baseUrl}${BACKEND_API_CONFIG.endpoints.summary}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(query)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.summary && data.summary.length > 0) {
            displaySummaryPoints(data.summary);
        } else {
            summaryPoints.innerHTML = '<div class="loading">No weather data available for this route</div>';
        }
        
    } catch (error) {
        console.error('Failed to load aviation summary:', error);
        summaryPoints.innerHTML = `
            <div class="loading">
                Backend unavailable. Using sample data...
                <br><small>Start the Flask server: python python.py</small>
            </div>
        `;
        
        // Fallback: Show sample aviation points
        setTimeout(() => {
            displaySummaryPoints([
                "SIGMET: Convective activity over KJFK area - Severe turbulence and icing possible",
                "PIREP: Moderate to severe turbulence reported at FL350 - Expect rough ride",
                "METAR: KJFK visibility 2SM with thunderstorms - Monitor closely",
                "TAF: KLAX deteriorating conditions expected 18Z - Plan fuel reserves",
                "AFD: High pressure system moving east - Generally favorable conditions",
                "NOTAM: KORD Runway 10L/28R closed for maintenance - Expect delays"
            ]);
        }, 2000);
    }
}

// Display summary points with simple bullet points and red priority indicators
function displaySummaryPoints(points) {
    const summaryPoints = document.getElementById('summaryPoints');
    summaryPoints.innerHTML = '';
    
    points.forEach((point, index) => {
        const pointElement = document.createElement('div');
        pointElement.className = 'summary-bullet';
        
        // Determine priority based on content
        let priority = 'low';
        let priorityDot = '🟢';
        
        if (point.includes('SIGMET') || point.includes('severe') || point.includes('thunderstorm') || point.includes('hazardous')) {
            priority = 'high';
            priorityDot = '🔴';
        } else if (point.includes('PIREP') || point.includes('turbulence') || point.includes('icing') || point.includes('moderate')) {
            priority = 'medium';
            priorityDot = '🟡';
        }
        
        pointElement.classList.add(priority);
        pointElement.innerHTML = `
            <div class="bullet-content">
                <span class="priority-dot">${priorityDot}</span>
                <span class="bullet-text">${point}</span>
            </div>
        `;
        
        summaryPoints.appendChild(pointElement);
    });
}

// Get visibility from METAR/TAF data
async function getVisibilityFromMetarTaf(icaoCode) {
    try {
        // Try METAR first (current conditions)
        const metarData = await fetchAviationData('metar', { 
            stations: icaoCode, 
            format: 'JSON', 
            hours: 2 
        });
        
        if (metarData && Array.isArray(metarData) && metarData.length > 0) {
            const metar = metarData[0];
            if (metar.visibility) {
                return normalizeVisibility(metar.visibility);
            }
        }
        
        // Fallback to TAF (forecast)
        const tafData = await fetchAviationData('taf', { 
            stations: icaoCode, 
            format: 'JSON', 
            hours: 6 
        });
        
        if (tafData && Array.isArray(tafData) && tafData.length > 0) {
            const taf = tafData[0];
            if (taf.forecast && taf.forecast.length > 0) {
                const firstForecast = taf.forecast[0];
                if (firstForecast.visibility) {
                    return normalizeVisibility(firstForecast.visibility);
                }
            }
        }
        
        return { display: 'N/A', km: null, badge: 'unknown' };
        
    } catch (error) {
        console.error('Visibility fetch error:', error);
        return { display: 'N/A', km: null, badge: 'unknown' };
    }
}

// Removed formatSummaryPoint function - now using simple bullet points

// ====== ADD YOUR WEATHER DATA LOADING HERE ======
async function loadRouteWeatherData() {
    try {
        // Fetch weather data for each waypoint
        const weatherPromises = routeData.map(icao => fetchWeatherData(icao));
        const weatherData = await Promise.all(weatherPromises);

        // Optional parallel stubs for later integration
        const [tfrData] = await Promise.all([
            routeData && routeData.length ? fetchTfrForRoute(routeData) : Promise.resolve(null)
        ]);
        
        // Process weather data and update widgets
        updateWeatherWidgets(weatherData);
        updateAdditionalWidgets(weatherData, { tfrData });
        
        // Update route analysis
        analyzeRouteConditions(weatherData);
        
    } catch (error) {
        console.error('Failed to load route weather data:', error);
        // Show error state in widgets
        updateWeatherWidgetsError();
    }
}

function updateWeatherWidgets(weatherDataArray) {
    // UPDATE WIDGETS WITH REAL DATA HERE
    const widgets = document.querySelectorAll('.widget');
    
    // Current Weather Widget (First widget)
    if (weatherDataArray[0]) {
        const currentWeather = weatherDataArray[0];
        widgets[0].querySelector('.widget-content').innerHTML = `
            Temperature: ${currentWeather.temperature || 'N/A'}°C<br>
            Wind: ${currentWeather.wind || 'N/A'}<br>
            Visibility: ${currentWeather.visibility || 'N/A'}
        `;
    }
}

function updateWeatherWidgetsError() {
    // HANDLE API ERRORS HERE
    const widgets = document.querySelectorAll('.widget');
    widgets.forEach(widget => {
        widget.querySelector('.widget-content').innerHTML = 'Weather data unavailable';
    });
}

// ===== Additional Widgets Logic =====
async function updateAdditionalWidgets(weatherDataArray, extras = {}) {
    const first = weatherDataArray && weatherDataArray[0] ? weatherDataArray[0] : {};

    // Removed AQI widget

    // Visibility from METAR/TAF data
    const visibility = await getVisibilityFromMetarTaf(routeData[0]);
    setText('visibilityValue', visibility.display);
    setBadge('visibilityBadge', visibility.badge);

    // Weather Score (simple composite)
    const score = computeWeatherScore({
        windKts: extractWindSpeedKts(first.wind),
        visKm: visibility.km,
        aqi: null // Removed AQI from score calculation
    });
    setRingPercent('weatherScoreValue', 'weatherScoreBadge', score);

    // TFR/Restricted (placeholder until integrated)
    const hasRestrictions = Boolean(extras.tfrData?.hasRestrictions);
    const tfrStatusText = extras.tfrData
        ? (hasRestrictions ? 'Restrictions detected on route' : 'No active TFRs along route')
        : 'No active TFRs along route';
    setText('tfrStatus', tfrStatusText);
    setBadge('tfrBadge', hasRestrictions ? 'poor' : 'good');

    // Wind Conditions
    const windInfo = parseWind(first.wind);
    setText('windDirection', windInfo.direction ?? 'N/A');
    setText('windSpeed', windInfo.speedDisplay ?? 'N/A');
    setText('windGusts', windInfo.gustsDisplay ?? 'N/A');
    setBadge('windBadge', windInfo.badge);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function setBadge(id, category) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('good', 'moderate', 'poor');
    if (category === 'good' || category === 'moderate' || category === 'poor') {
        el.classList.add(category);
    }
    el.textContent = category === 'good' ? 'Good' : category === 'moderate' ? 'Moderate' : category === 'poor' ? 'Poor' : 'Unknown';
}

function setRingPercent(valueId, badgeId, score) {
    const percent = Math.max(0, Math.min(100, Math.round(score.percent)));
    const ring = document.querySelector('#widgetWeatherScore .score-ring');
    if (ring) {
        ring.style.background = `conic-gradient(#667eea 0deg ${percent * 3.6}deg, #e0e0e0 ${percent * 3.6}deg 360deg)`;
    }
    setText(valueId, `${percent}`);
    setBadge(badgeId, score.badge);
}

function normalizeAQI(raw) {
    if (raw == null) return { value: null, category: 'unknown' };
    const value = Number(raw);
    if (Number.isNaN(value)) return { value: null, category: 'unknown' };
    if (value <= 50) return { value, category: 'good' };
    if (value <= 100) return { value, category: 'moderate' };
    return { value, category: 'poor' };
}

function normalizeVisibility(raw) {
    // Parse METAR visibility data
    if (raw == null) return { display: 'N/A', km: null, badge: 'unknown' };
    let km = null;
    
    if (typeof raw === 'number') {
        km = raw > 100 ? raw / 1000 : raw; // if meters, convert
    } else if (typeof raw === 'string') {
        // METAR format: "10SM", "6SM", "9999" (meters), "1/2SM"
        const smMatch = raw.match(/([0-9]+(?:\/[0-9]+)?)\s*SM/i);
        const meterMatch = raw.match(/^([0-9]+)$/);
        const fractionMatch = raw.match(/([0-9]+)\/([0-9]+)\s*SM/i);
        
        if (fractionMatch) {
            const numerator = parseInt(fractionMatch[1]);
            const denominator = parseInt(fractionMatch[2]);
            km = (numerator / denominator) * 1.60934;
        } else if (smMatch) {
            km = parseFloat(smMatch[1]) * 1.60934;
        } else if (meterMatch) {
            km = parseInt(meterMatch[1], 10) / 1000;
        }
    }
    
    const display = km == null ? 'N/A' : `${km.toFixed(1)} km`;
    const badge = km == null ? 'unknown' : km >= 8 ? 'good' : km >= 5 ? 'moderate' : 'poor';
    return { display, km, badge };
}

function parseWind(raw) {
    // Accept '10kt NE', '09015G25KT', or structured {dir:90,speedKt:15,gustKt:25}
    let direction = null, speedKt = null, gustKt = null;
    if (typeof raw === 'string') {
        const metar = raw.match(/(\d{3}|VRB)(\d{2})(G(\d{2}))?KT/i);
        if (metar) {
            direction = metar[1] === 'VRB' ? 'VRB' : `${metar[1]}°`;
            speedKt = parseInt(metar[2], 10);
            gustKt = metar[4] ? parseInt(metar[4], 10) : null;
        } else {
            const simple = raw.match(/(\d+)\s*kt\s*([NSEW]{1,2})?/i);
            if (simple) {
                speedKt = parseInt(simple[1], 10);
                direction = simple[2] || null;
            }
        }
    } else if (raw && typeof raw === 'object') {
        direction = raw.dir != null ? `${raw.dir}°` : null;
        speedKt = raw.speedKt ?? raw.speed ?? null;
        gustKt = raw.gustKt ?? raw.gust ?? null;
    }
    const badge = speedKt == null ? 'unknown' : speedKt <= 12 ? 'good' : speedKt <= 20 ? 'moderate' : 'poor';
    return {
        direction,
        speedKt,
        gustKt,
        speedDisplay: speedKt != null ? `${speedKt} kt` : null,
        gustsDisplay: gustKt != null ? `${gustKt} kt` : '—',
        badge
    };
}

function extractWindSpeedKts(raw) {
    const info = parseWind(raw);
    return info.speedKt ?? null;
}

function computeWeatherScore({ windKts, visKm, aqi }) {
    // 0-100 simple composite: weights wind 50, visibility 50 (removed AQI)
    let windScore = 100;
    if (windKts != null) {
        if (windKts <= 10) windScore = 100;
        else if (windKts <= 20) windScore = 70;
        else if (windKts <= 30) windScore = 40;
        else windScore = 20;
    }
    let visScore = visKm == null ? 60 : visKm >= 8 ? 100 : visKm >= 5 ? 70 : 30;
    const percent = 0.5 * windScore + 0.5 * visScore;
    const badge = percent >= 80 ? 'good' : percent >= 60 ? 'moderate' : 'poor';
    return { percent, badge };
}

// Removed route alerts and fuel planning functions

function analyzeRouteConditions(weatherData) {
    // ANALYZE OVERALL ROUTE CONDITIONS HERE
    // Update the flight information based on weather data
}

function updateFlightInfo() {
    // ====== REPLACE WITH REAL API DATA ======
    // You can call your APIs here to get real flight calculations
    setTimeout(async () => {
        try {
            // EXAMPLE: Call distance calculation API
            // const distanceData = await calculateFlightDistance(routeData);
            // document.getElementById('totalDistance').textContent = `${distanceData.distance} NM`;
            
            // EXAMPLE: Call flight time estimation API  
            // const timeData = await estimateFlightTime(routeData);
            // document.getElementById('flightTime').textContent = timeData.formattedTime;
            
            // For now, showing simulated data
            document.getElementById('totalDistance').textContent = `${Math.floor(Math.random() * 3000 + 1000)} NM`;
            document.getElementById('flightTime').textContent = `${Math.floor(Math.random() * 8 + 2)}h ${Math.floor(Math.random() * 60)}m`;
            document.getElementById('weatherStatus').textContent = 'Favorable';
            document.getElementById('routeComplexity').textContent = routeData.length > 3 ? 'Complex' : 'Standard';
        } catch (error) {
            console.error('Failed to update flight info:', error);
        }
    }, 1000);
}

// Page 3: Search functionality
document.getElementById('searchInput').addEventListener('input', function(e) {
    const query = e.target.value.trim();
    
    if (query.length > 2) {
        performSearch(query);
    } else {
        clearSearchResults();
    }
});

function searchShortcut(query) {
    document.getElementById('searchInput').value = query;
    performSearch(query);
}

// ====== REAL SEARCH USING AVIATION APIS ======
async function performSearch(query) {
    const resultsContainer = document.getElementById('searchResults');
    
    // Show loading state
    resultsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Searching aviation weather data...</p>';
    
    try {
        // Search across multiple aviation APIs
        const searchResults = await searchAviationData(query);
        
        if (searchResults && searchResults.length > 0) {
            resultsContainer.innerHTML = '';
            
            searchResults.forEach(result => {
                const resultElement = document.createElement('div');
                resultElement.className = 'result-item';
                resultElement.innerHTML = `
                    <h4>${result.title}</h4>
                    <p>${result.description}</p>
                    <div class="result-meta">
                        <span class="result-source">${result.source}</span>
                        <span class="result-time">${result.time}</span>
                    </div>
                `;
                resultsContainer.appendChild(resultElement);
            });
        } else {
            resultsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">No aviation weather data found for your search</p>';
        }
        
    } catch (error) {
        console.error('Search failed:', error);
        resultsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Search unavailable. Please try again later.</p>';
    }
}

// Search across all aviation APIs
async function searchAviationData(query) {
    const results = [];
    
    try {
        // Search METAR data
        const metarData = await fetchAviationData('metar', { 
            format: 'JSON', 
            hours: 6 
        });
        if (metarData && Array.isArray(metarData)) {
            metarData.forEach(metar => {
                if (metar.rawOb && metar.rawOb.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        title: `METAR - ${metar.stationId}`,
                        description: metar.rawOb,
                        source: 'METAR',
                        time: new Date(metar.obsTime).toLocaleString()
                    });
                }
            });
        }
        
        // Search TAF data
        const tafData = await fetchAviationData('taf', { 
            format: 'JSON', 
            hours: 12 
        });
        if (tafData && Array.isArray(tafData)) {
            tafData.forEach(taf => {
                if (taf.rawTAF && taf.rawTAF.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        title: `TAF - ${taf.stationId}`,
                        description: taf.rawTAF,
                        source: 'TAF',
                        time: new Date(taf.issueTime).toLocaleString()
                    });
                }
            });
        }
        
        // Search PIREP data
        const pirepData = await fetchAviationData('pirep', { 
            format: 'JSON', 
            hours: 6 
        });
        if (pirepData && Array.isArray(pirepData)) {
            pirepData.forEach(pirep => {
                if (pirep.rawPirep && pirep.rawPirep.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        title: `PIREP - ${pirep.aircraftRef}`,
                        description: pirep.rawPirep,
                        source: 'PIREP',
                        time: new Date(pirep.obsTime).toLocaleString()
                    });
                }
            });
        }
        
        // Search SIGMET data
        const sigmetData = await fetchAviationData('sigmet', { 
            format: 'JSON', 
            hours: 6 
        });
        if (sigmetData && Array.isArray(sigmetData)) {
            sigmetData.forEach(sigmet => {
                if (sigmet.rawSigmet && sigmet.rawSigmet.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        title: `SIGMET - ${sigmet.hazard}`,
                        description: sigmet.rawSigmet,
                        source: 'SIGMET',
                        time: new Date(sigmet.validTime).toLocaleString()
                    });
                }
            });
        }
        
        // Search NOTAM data
        const notamData = await fetchAviationData('notam', { 
            format: 'JSON', 
            hours: 24 
        });
        if (notamData && Array.isArray(notamData)) {
            notamData.forEach(notam => {
                if (notam.rawNotam && notam.rawNotam.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        title: `NOTAM - ${notam.icaoId}`,
                        description: notam.rawNotam,
                        source: 'NOTAM',
                        time: new Date(notam.issueTime).toLocaleString()
                    });
                }
            });
        }
        
        return results.slice(0, 10); // Limit to 10 results
        
    } catch (error) {
        console.error('Aviation search error:', error);
        return [];
    }
}

function clearSearchResults() {
    document.getElementById('searchResults').innerHTML = `
        <p style="color: #666; text-align: center; padding: 40px;">
            Enter a search term or click a shortcut button to find weather reports
        </p>
    `;
}

// Remove wheel-based navigation and add click-based nav
let currentPage = 1;

function attachNavHandlers() {
    const toPage = (n) => {
        currentPage = n;
        showPage(n);
    };
    const btn1 = document.getElementById('navPage1');
    const btn2 = document.getElementById('navPage2');
    const btn3 = document.getElementById('navPage3');
    if (btn1) btn1.addEventListener('click', () => toPage(1));
    if (btn2) btn2.addEventListener('click', () => toPage(2));
    if (btn3) btn3.addEventListener('click', () => toPage(3));
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    attachNavHandlers();
    showPage(1);
});