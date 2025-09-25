let routeData = [];
let progressInterval;

// ====== API CONFIGURATION ======
// ADD YOUR WEATHER API DETAILS HERE
const WEATHER_API_CONFIG = {
    apiKey: 'YOUR_API_KEY_HERE',
    baseUrl: 'YOUR_API_BASE_URL_HERE',
    endpoints: {
        weather: '/weather',
        metar: '/metar',
        taf: '/taf',
        search: '/search',
        // ===== Add your additional endpoints here =====
        aqi: '/aqi', // Replace with actual AQI endpoint when available
        tfr: '/tfr'  // Replace with actual TFR endpoint when available
    }
};

// API Helper Functions
async function fetchWeatherData(icaoCode) {
    // REPLACE THIS WITH YOUR ACTUAL API CALL
    try {
        const response = await fetch(`${WEATHER_API_CONFIG.baseUrl}${WEATHER_API_CONFIG.endpoints.weather}?icao=${icaoCode}&key=${WEATHER_API_CONFIG.apiKey}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Weather API Error:', error);
        return null;
    }
}

// ===== Optional: AQI Integration Stub =====
// Replace implementation when AQI API is available
async function fetchAQIForIcao(icaoCode) {
    try {
        // Example target: `${WEATHER_API_CONFIG.baseUrl}${WEATHER_API_CONFIG.endpoints.aqi}?icao=${icaoCode}&key=${WEATHER_API_CONFIG.apiKey}`
        // const response = await fetch(url);
        // const data = await response.json();
        // return data;
        return null; // placeholder: return null to trigger graceful fallback
    } catch (error) {
        console.error('AQI API Error:', error);
        return null;
    }
}

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
    // REPLACE THIS WITH YOUR ACTUAL METAR API CALL
    try {
        const response = await fetch(`${WEATHER_API_CONFIG.baseUrl}${WEATHER_API_CONFIG.endpoints.metar}?icao=${icaoCode}&key=${WEATHER_API_CONFIG.apiKey}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('METAR API Error:', error);
        return null;
    }
}

async function searchWeatherReports(query) {
    // REPLACE THIS WITH YOUR ACTUAL SEARCH API CALL
    try {
        const response = await fetch(`${WEATHER_API_CONFIG.baseUrl}${WEATHER_API_CONFIG.endpoints.search}?q=${encodeURIComponent(query)}&key=${WEATHER_API_CONFIG.apiKey}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Search API Error:', error);
        return null;
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

// ====== ADD YOUR WEATHER DATA LOADING HERE ======
async function loadRouteWeatherData() {
    try {
        // Fetch weather data for each waypoint
        const weatherPromises = routeData.map(icao => fetchWeatherData(icao));
        const weatherData = await Promise.all(weatherPromises);

        // Optional parallel stubs for later integration
        const [aqiDataFirst, tfrData] = await Promise.all([
            routeData[0] ? fetchAQIForIcao(routeData[0]) : Promise.resolve(null),
            routeData && routeData.length ? fetchTfrForRoute(routeData) : Promise.resolve(null)
        ]);
        
        // Process weather data and update widgets
        updateWeatherWidgets(weatherData);
        updateAdditionalWidgets(weatherData, { aqiDataFirst, tfrData });
        
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
    
    // Route Alerts Widget (Second widget)
    const alerts = analyzeWeatherAlerts(weatherDataArray);
    widgets[1].querySelector('.widget-content').innerHTML = alerts;
    
    // Fuel Planning Widget (Third widget) - can integrate fuel calculation API here
    widgets[2].querySelector('.widget-content').innerHTML = `
        Recommended fuel: ${calculateFuelRequirement()}<br>
        Alternate airports: ${findAlternateAirports()}<br>
        Reserve: Standard
    `;
}

function updateWeatherWidgetsError() {
    // HANDLE API ERRORS HERE
    const widgets = document.querySelectorAll('.widget');
    widgets.forEach(widget => {
        widget.querySelector('.widget-content').innerHTML = 'Weather data unavailable';
    });
}

// ===== Additional Widgets Logic =====
function updateAdditionalWidgets(weatherDataArray, extras = {}) {
    const first = weatherDataArray && weatherDataArray[0] ? weatherDataArray[0] : {};

    // AQI
    const rawAqi = extras.aqiDataFirst?.aqi ?? first.aqi;
    const aqi = normalizeAQI(rawAqi);
    setText('aqiValue', aqi.value !== null ? aqi.value : 'N/A');
    setBadge('aqiBadge', aqi.category);

    // Visibility
    const visibility = normalizeVisibility(first.visibility);
    setText('visibilityValue', visibility.display);
    setBadge('visibilityBadge', visibility.badge);

    // Weather Score (simple composite)
    const score = computeWeatherScore({
        windKts: extractWindSpeedKts(first.wind),
        visKm: visibility.km,
        aqi: aqi.value
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
    // Accept km number, meters, or string like '10km'/'6SM'
    if (raw == null) return { display: 'N/A', km: null, badge: 'unknown' };
    let km = null;
    if (typeof raw === 'number') {
        km = raw > 100 ? raw / 1000 : raw; // if meters, convert
    } else if (typeof raw === 'string') {
        const smMatch = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*SM/i);
        const kmMatch = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*km/i);
        const mMatch = raw.match(/([0-9]+)\s*m(?![a-z])/i);
        if (smMatch) km = parseFloat(smMatch[1]) * 1.60934;
        else if (kmMatch) km = parseFloat(kmMatch[1]);
        else if (mMatch) km = parseInt(mMatch[1], 10) / 1000;
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
    // 0-100 simple composite: weights wind 40, visibility 40, AQI 20
    let windScore = 100;
    if (windKts != null) {
        if (windKts <= 10) windScore = 100;
        else if (windKts <= 20) windScore = 70;
        else if (windKts <= 30) windScore = 40;
        else windScore = 20;
    }
    let visScore = visKm == null ? 60 : visKm >= 8 ? 100 : visKm >= 5 ? 70 : 30;
    let aqiScore = aqi == null ? 60 : aqi <= 50 ? 100 : aqi <= 100 ? 70 : 30;
    const percent = 0.4 * windScore + 0.4 * visScore + 0.2 * aqiScore;
    const badge = percent >= 80 ? 'good' : percent >= 60 ? 'moderate' : 'poor';
    return { percent, badge };
}

function analyzeWeatherAlerts(weatherData) {
    // ANALYZE WEATHER DATA AND RETURN ALERTS
    // Replace with your logic based on API response structure
    return "No active weather warnings<br>Clear conditions expected";
}

function calculateFuelRequirement() {
    // ADD FUEL CALCULATION LOGIC OR API CALL HERE
    return "TBD";
}

function findAlternateAirports() {
    // ADD ALTERNATE AIRPORT FINDING LOGIC OR API CALL HERE  
    return "3";
}

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

// ====== REPLACE WITH REAL SEARCH API ======
async function performSearch(query) {
    const resultsContainer = document.getElementById('searchResults');
    
    // Show loading state
    resultsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Searching...</p>';
    
    try {
        // CALL YOUR REAL SEARCH API HERE
        const searchResults = await searchWeatherReports(query);
        
        // REPLACE THE MOCK RESULTS BELOW WITH YOUR API DATA
        if (searchResults && searchResults.length > 0) {
            resultsContainer.innerHTML = '';
            
            searchResults.forEach(result => {
                const resultElement = document.createElement('div');
                resultElement.className = 'result-item';
                resultElement.innerHTML = `
                    <h4>${result.title}</h4>
                    <p>${result.description}</p>
                `;
                resultsContainer.appendChild(resultElement);
            });
        } else {
            resultsContainer.innerHTML = '<p style="text-align: center; padding: 20px;">No results found</p>';
        }
        
    } catch (error) {
        console.error('Search failed:', error);
        
        // FALLBACK: Show simulated results (REMOVE THIS WHEN YOU ADD REAL API)
        const mockResults = [
            {
                title: `METAR Report - ${query}`,
                description: `Current weather conditions related to ${query}. Visibility 10SM, wind calm, temperature 22°C.`
            },
            {
                title: `TAF Forecast - ${query}`,
                description: `Terminal aerodrome forecast showing ${query} conditions for the next 24 hours.`
            },
            {
                title: `Weather Analysis - ${query}`,
                description: `Detailed meteorological analysis focusing on ${query} patterns and trends.`
            }
        ];
        
        resultsContainer.innerHTML = '';
        
        mockResults.forEach(result => {
            const resultElement = document.createElement('div');
            resultElement.className = 'result-item';
            resultElement.innerHTML = `
                <h4>${result.title}</h4>
                <p>${result.description}</p>
            `;
            resultsContainer.appendChild(resultElement);
        });
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