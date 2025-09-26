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
    
    // Initialize dynamic weather wallpaper
    initializeWeatherWallpaper();
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
    
    // Create professional pushpin waypoints with 📍
    routeData.forEach((waypoint, index) => {
        // Position pins along the route
        const leftPercent = 10 + (index * 80 / (routeData.length - 1));
        
        // Add airport data attributes
        const airportInfo = airportDatabase[waypoint] || { name: waypoint, city: 'Unknown' };
        const fullName = `${airportInfo.name} - ${airportInfo.city}`;
        
        // Determine pin type
        let pinType = 'waypoint';
        if (index === 0) {
            pinType = 'departure';
        } else if (index === routeData.length - 1) {
            pinType = 'destination';
        }
        
        // Create pin using the new function
        const pin = createWaypointPin(waypoint, fullName, leftPercent, 50, pinType);
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
        
        // Fallback: Show sample aviation points with various data sources
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

// Function to categorize data source
function categorizeDataSource(point) {
    const pointLower = point.toLowerCase();
    
    // Overview category: SIGMET, METAR, TAF, PIREP
    if (pointLower.includes('sigmet') || pointLower.includes('significant weather') ||
        pointLower.includes('metar') || pointLower.includes('current weather') || pointLower.includes('observation') ||
        pointLower.includes('taf') || pointLower.includes('forecast') || pointLower.includes('terminal forecast') ||
        pointLower.includes('pirep') || pointLower.includes('pilot report') || pointLower.includes('aircraft report')) {
        return 'overview';
    }
    
    // Attention category: AFD, NOTAM, and everything else
    return 'attention';
}

// Function to detect data source and return appropriate tag
function detectDataSource(point) {
    const pointLower = point.toLowerCase();
    
    // PIREP detection - pilot reports
    if (pointLower.includes('pirep') || pointLower.includes('pilot report') || pointLower.includes('aircraft report')) {
        return { tag: 'pilot-advice', label: 'PILOT ADVICE' };
    }
    
    // AFD detection - Area Forecast Discussion (expert analysis)
    if (pointLower.includes('afd') || pointLower.includes('area forecast') || pointLower.includes('forecast discussion')) {
        return { tag: 'expert', label: 'EXPERT' };
    }
    
    // SIGMET detection - significant meteorological information
    if (pointLower.includes('sigmet') || pointLower.includes('significant weather')) {
        return { tag: 'alert', label: 'ALERT' };
    }
    
    // NOTAM detection - notices to airmen
    if (pointLower.includes('notam') || pointLower.includes('notice to airmen')) {
        return { tag: 'alert', label: 'ALERT' };
    }
    
    // No tag for METAR, TAF, or other sources
    return null;
}

// Function to clean the point text by removing data source prefixes
function cleanPointText(point) {
    // Remove common data source prefixes
    return point
        .replace(/^(PIREP|SIGMET|METAR|TAF|AFD|NOTAM):\s*/i, '')
        .replace(/^(Pilot Report|Aircraft Report|Area Forecast|Terminal Forecast|Notice to Airmen):\s*/i, '')
        .trim();
}

// Display summary points split into Overview and Attention categories
function displaySummaryPoints(points) {
    const summaryPoints = document.getElementById('summaryPoints');
    summaryPoints.innerHTML = '';
    
    // Separate points into categories
    const overviewPoints = [];
    const attentionPoints = [];
    
    points.forEach(point => {
        const category = categorizeDataSource(point);
        if (category === 'overview') {
            overviewPoints.push(point);
        } else {
            attentionPoints.push(point);
        }
    });
    
    // Create Overview section
    if (overviewPoints.length > 0) {
        const overviewSection = document.createElement('div');
        overviewSection.className = 'summary-section';
        overviewSection.innerHTML = `
            <h4 class="section-title overview-title">📊 Overview</h4>
            <div class="section-content overview-content"></div>
        `;
        summaryPoints.appendChild(overviewSection);
        
        const overviewContent = overviewSection.querySelector('.overview-content');
        overviewPoints.forEach(point => {
            const pointElement = createSummaryBullet(point);
            overviewContent.appendChild(pointElement);
        });
    }
    
    // Create Attention section
    if (attentionPoints.length > 0) {
        const attentionSection = document.createElement('div');
        attentionSection.className = 'summary-section';
        attentionSection.innerHTML = `
            <h4 class="section-title attention-title">⚠️ Attention</h4>
            <div class="section-content attention-content"></div>
        `;
        summaryPoints.appendChild(attentionSection);
        
        const attentionContent = attentionSection.querySelector('.attention-content');
        attentionPoints.forEach(point => {
            const pointElement = createSummaryBullet(point);
            attentionContent.appendChild(pointElement);
        });
    }
    
    // Update weather wallpaper based on new summary points
    setTimeout(() => {
        const weatherConditions = analyzeWeatherConditions();
        applyWeatherWallpaper(weatherConditions);
    }, 100);
}

// Helper function to create individual summary bullets
function createSummaryBullet(point) {
    const pointElement = document.createElement('div');
    pointElement.className = 'summary-bullet';
    
    // Clean the point text by removing data source prefixes
    const cleanedPoint = cleanPointText(point);
    
    // Detect data source and get appropriate tag (use original point for detection)
    const dataSource = detectDataSource(point);
    
    // Generate unique ID for this bullet point
    const bulletId = `bullet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Build the HTML content
    let tagHtml = '';
    if (dataSource) {
        tagHtml = `<span class="data-source-tag ${dataSource.tag}">${dataSource.label}</span>`;
    }
    
    pointElement.innerHTML = `
        <div class="bullet-content">
            <span class="bullet-text">${cleanedPoint}</span>
            ${tagHtml}
            <a href="#" class="explanation-link" data-bullet-id="${bulletId}" data-original-text="${encodeURIComponent(point)}">🔍 See why</a>
        </div>
    `;
    
    // Add click event listener for explanation
    const explanationLink = pointElement.querySelector('.explanation-link');
    explanationLink.addEventListener('click', (e) => {
        e.preventDefault();
        showDetailedExplanation(point, bulletId);
    });
    
    return pointElement;
}

// Function to show detailed technical data from API
async function showDetailedExplanation(originalText, bulletId) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('explanationModal');
    if (!modal) {
        modal = createExplanationModal();
        document.body.appendChild(modal);
    }
    
    // Show modal with loading state
    modal.style.display = 'flex';
    modal.querySelector('.modal-content').innerHTML = `
        <div class="modal-header">
            <h3>Technical Weather Data</h3>
            <span class="close-modal">&times;</span>
        </div>
        <div class="modal-body">
            <div class="loading-explanation">
                <div class="spinner"></div>
                <p>Fetching detailed technical data from aviation APIs...</p>
            </div>
        </div>
    `;
    
    // Add close functionality
    modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    try {
        // Get detailed technical data from APIs
        const technicalData = await getTechnicalWeatherData(originalText);
        
        // Update modal with technical data
        modal.querySelector('.modal-body').innerHTML = `
            <div class="explanation-content">
                <div class="original-statement">
                    <h4>Related to:</h4>
                    <p class="statement-text">${originalText}</p>
                </div>
                <div class="technical-data">
                    <h4>Detailed Technical Information:</h4>
                    <div class="data-content">${technicalData}</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to get technical data:', error);
        modal.querySelector('.modal-body').innerHTML = `
            <div class="error-message">
                <h4>Unable to fetch technical data</h4>
                <p>Please try again later or contact support if the issue persists.</p>
            </div>
        `;
    }
}

// Function to create the explanation modal
function createExplanationModal() {
    const modal = document.createElement('div');
    modal.id = 'explanationModal';
    modal.className = 'explanation-modal';
    modal.style.display = 'none';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Detailed Weather Analysis</h3>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <!-- Content will be dynamically loaded -->
            </div>
        </div>
    `;
    
    return modal;
}

// Function to get technical weather data from APIs
async function getTechnicalWeatherData(originalText) {
    try {
        // Determine what type of data to fetch based on the statement
        const dataType = determineDataType(originalText);
        
        // Fetch comprehensive technical data
        const technicalData = await fetchComprehensiveWeatherData(dataType);
        
        return formatTechnicalData(technicalData, dataType);
        
    } catch (error) {
        console.error('Failed to get technical data:', error);
        return generateFallbackTechnicalData(originalText);
    }
}

// Function to determine what type of technical data to fetch
function determineDataType(statement) {
    const text = statement.toLowerCase();
    
    if (text.includes('turbulence') || text.includes('pirep')) {
        return 'pirep';
    } else if (text.includes('sigmet') || text.includes('severe')) {
        return 'sigmet';
    } else if (text.includes('metar') || text.includes('visibility') || text.includes('wind')) {
        return 'metar';
    } else if (text.includes('taf') || text.includes('forecast')) {
        return 'taf';
    } else if (text.includes('afd') || text.includes('area forecast')) {
        return 'afd';
    } else if (text.includes('notam')) {
        return 'notam';
    } else {
        return 'comprehensive';
    }
}

// Function to fetch comprehensive weather data
async function fetchComprehensiveWeatherData(dataType) {
    const results = {};
    
    try {
        // Fetch multiple data sources in parallel
        const promises = [];
        
        if (dataType === 'comprehensive' || dataType === 'pirep') {
            promises.push(fetchAviationData('pirep', { format: 'JSON', hours: 6 }));
        }
        if (dataType === 'comprehensive' || dataType === 'sigmet') {
            promises.push(fetchAviationData('sigmet', { format: 'JSON', hours: 6 }));
        }
        if (dataType === 'comprehensive' || dataType === 'metar') {
            promises.push(fetchAviationData('metar', { format: 'JSON', hours: 2 }));
        }
        if (dataType === 'comprehensive' || dataType === 'taf') {
            promises.push(fetchAviationData('taf', { format: 'JSON', hours: 12 }));
        }
        if (dataType === 'comprehensive' || dataType === 'afd') {
            promises.push(fetchAviationData('afd', { format: 'JSON', hours: 6 }));
        }
        if (dataType === 'comprehensive' || dataType === 'notam') {
            promises.push(fetchAviationData('notam', { format: 'JSON', hours: 24 }));
        }
        
        const dataResults = await Promise.all(promises);
        
        // Organize results by data type
        let index = 0;
        if (dataType === 'comprehensive' || dataType === 'pirep') {
            results.pirep = dataResults[index++];
        }
        if (dataType === 'comprehensive' || dataType === 'sigmet') {
            results.sigmet = dataResults[index++];
        }
        if (dataType === 'comprehensive' || dataType === 'metar') {
            results.metar = dataResults[index++];
        }
        if (dataType === 'comprehensive' || dataType === 'taf') {
            results.taf = dataResults[index++];
        }
        if (dataType === 'comprehensive' || dataType === 'afd') {
            results.afd = dataResults[index++];
        }
        if (dataType === 'comprehensive' || dataType === 'notam') {
            results.notam = dataResults[index++];
        }
        
        return results;
        
    } catch (error) {
        console.error('Error fetching comprehensive data:', error);
        return {};
    }
}

// Function to format technical data for display
function formatTechnicalData(data, dataType) {
    let html = '';
    
    // Format PIREP data
    if (data.pirep && Array.isArray(data.pirep) && data.pirep.length > 0) {
        html += '<div class="data-section"><h5>📊 Pilot Reports (PIREP)</h5>';
        data.pirep.slice(0, 5).forEach((pirep, index) => {
            html += `
                <div class="data-item">
                    <strong>Report ${index + 1}:</strong><br>
                    <span class="data-label">Aircraft:</span> ${pirep.aircraftRef || 'N/A'}<br>
                    <span class="data-label">Location:</span> ${pirep.obsTime ? new Date(pirep.obsTime).toLocaleString() : 'N/A'}<br>
                    <span class="data-label">Altitude:</span> ${pirep.fltlvl || 'N/A'}<br>
                    <span class="data-label">Raw Report:</span> ${pirep.rawPirep || 'N/A'}<br>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Format SIGMET data
    if (data.sigmet && Array.isArray(data.sigmet) && data.sigmet.length > 0) {
        html += '<div class="data-section"><h5>⚠️ Significant Weather (SIGMET)</h5>';
        data.sigmet.slice(0, 3).forEach((sigmet, index) => {
            html += `
                <div class="data-item">
                    <strong>SIGMET ${index + 1}:</strong><br>
                    <span class="data-label">Hazard:</span> ${sigmet.hazard || 'N/A'}<br>
                    <span class="data-label">Valid Time:</span> ${sigmet.validTime ? new Date(sigmet.validTime).toLocaleString() : 'N/A'}<br>
                    <span class="data-label">Raw SIGMET:</span> ${sigmet.rawSigmet || 'N/A'}<br>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Format METAR data
    if (data.metar && Array.isArray(data.metar) && data.metar.length > 0) {
        html += '<div class="data-section"><h5>🌤️ Current Weather (METAR)</h5>';
        data.metar.slice(0, 3).forEach((metar, index) => {
            html += `
                <div class="data-item">
                    <strong>Station ${index + 1}:</strong><br>
                    <span class="data-label">Station:</span> ${metar.stationId || 'N/A'}<br>
                    <span class="data-label">Temperature:</span> ${metar.temp ? `${metar.temp}°C` : 'N/A'}<br>
                    <span class="data-label">Wind:</span> ${metar.wdir ? `${metar.wdir}°` : 'N/A'} ${metar.wspd ? `${metar.wspd}kt` : ''} ${metar.wgst ? `G${metar.wgst}` : ''}<br>
                    <span class="data-label">Visibility:</span> ${metar.vis ? `${metar.vis} SM` : 'N/A'}<br>
                    <span class="data-label">Raw METAR:</span> ${metar.rawOb || 'N/A'}<br>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Format TAF data
    if (data.taf && Array.isArray(data.taf) && data.taf.length > 0) {
        html += '<div class="data-section"><h5>📈 Terminal Forecast (TAF)</h5>';
        data.taf.slice(0, 2).forEach((taf, index) => {
            html += `
                <div class="data-item">
                    <strong>TAF ${index + 1}:</strong><br>
                    <span class="data-label">Station:</span> ${taf.stationId || 'N/A'}<br>
                    <span class="data-label">Issue Time:</span> ${taf.issueTime ? new Date(taf.issueTime).toLocaleString() : 'N/A'}<br>
                    <span class="data-label">Valid Period:</span> ${taf.validTime ? new Date(taf.validTime).toLocaleString() : 'N/A'}<br>
                    <span class="data-label">Raw TAF:</span> ${taf.rawTAF || 'N/A'}<br>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Format AFD data
    if (data.afd && Array.isArray(data.afd) && data.afd.length > 0) {
        html += '<div class="data-section"><h5>📋 Area Forecast Discussion (AFD)</h5>';
        data.afd.slice(0, 2).forEach((afd, index) => {
            html += `
                <div class="data-item">
                    <strong>AFD ${index + 1}:</strong><br>
                    <span class="data-label">Issue Time:</span> ${afd.issueTime ? new Date(afd.issueTime).toLocaleString() : 'N/A'}<br>
                    <span class="data-label">Valid Time:</span> ${afd.validTime ? new Date(afd.validTime).toLocaleString() : 'N/A'}<br>
                    <span class="data-label">Content:</span> ${afd.rawAfd ? afd.rawAfd.substring(0, 200) + '...' : 'N/A'}<br>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Format NOTAM data
    if (data.notam && Array.isArray(data.notam) && data.notam.length > 0) {
        html += '<div class="data-section"><h5>📢 Notices to Airmen (NOTAM)</h5>';
        data.notam.slice(0, 3).forEach((notam, index) => {
            html += `
                <div class="data-item">
                    <strong>NOTAM ${index + 1}:</strong><br>
                    <span class="data-label">ICAO ID:</span> ${notam.icaoId || 'N/A'}<br>
                    <span class="data-label">Issue Time:</span> ${notam.issueTime ? new Date(notam.issueTime).toLocaleString() : 'N/A'}<br>
                    <span class="data-label">Raw NOTAM:</span> ${notam.rawNotam || 'N/A'}<br>
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (!html) {
        html = '<div class="no-data">No additional technical data available for this statement.</div>';
    }
    
    return html;
}

// Fallback technical data when APIs are not available
function generateFallbackTechnicalData(originalText) {
    return `
        <div class="no-data">
            <h5>⚠️ API Data Unavailable</h5>
            <p>Unable to fetch additional technical data from aviation weather APIs. This could be due to:</p>
            <ul>
                <li>Network connectivity issues</li>
                <li>Aviation weather service maintenance</li>
                <li>API rate limiting</li>
            </ul>
            <p><strong>Recommendation:</strong> Check official aviation weather sources directly or try again later.</p>
        </div>
    `;
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

// Dynamic Weather Wallpaper System
function initializeWeatherWallpaper() {
    // Analyze current weather conditions to determine wallpaper
    const weatherConditions = analyzeWeatherConditions();
    applyWeatherWallpaper(weatherConditions);
}

function analyzeWeatherConditions() {
    // Analyze weather data to determine conditions
    const summaryPoints = document.getElementById('summaryPoints');
    const points = summaryPoints.querySelectorAll('.summary-bullet');
    
    let conditions = {
        hasStorms: false,
        hasTurbulence: false,
        hasClear: false,
        hasClouds: false
    };
    
    points.forEach(point => {
        const text = point.textContent.toLowerCase();
        if (text.includes('storm') || text.includes('thunderstorm') || text.includes('severe')) {
            conditions.hasStorms = true;
        }
        if (text.includes('turbulence') || text.includes('rough')) {
            conditions.hasTurbulence = true;
        }
        if (text.includes('clear') || text.includes('good')) {
            conditions.hasClear = true;
        }
        if (text.includes('cloud') || text.includes('overcast')) {
            conditions.hasClouds = true;
        }
    });
    
    return conditions;
}

function applyWeatherWallpaper(conditions) {
    const body = document.body;
    
    // Remove existing weather classes
    body.classList.remove('clear-weather', 'cloudy-weather', 'stormy-weather', 'turbulent-weather');
    
    // Apply appropriate weather class based on conditions
    if (conditions.hasStorms) {
        body.classList.add('stormy-weather');
    } else if (conditions.hasTurbulence) {
        body.classList.add('turbulent-weather');
    } else if (conditions.hasClouds) {
        body.classList.add('cloudy-weather');
    } else if (conditions.hasClear) {
        body.classList.add('clear-weather');
    }
}

// Update waypoint pins to use 📍
function createWaypointPin(icaoCode, fullName, x, y, type = 'waypoint') {
    const pin = document.createElement('div');
    pin.className = `waypoint-pin ${type}`;
    pin.style.left = `${x}%`;
    pin.style.top = `${y}%`;
    pin.setAttribute('data-code', icaoCode);
    pin.setAttribute('data-name', fullName);
    pin.innerHTML = '📍';
    
    // Add hover tooltip
    pin.addEventListener('mouseenter', () => {
        pin.title = `${icaoCode} - ${fullName}`;
    });
    
    return pin;
}

// Removed formatSummaryPoint function - now using simple bullet points

// ====== ADD YOUR WEATHER DATA LOADING HERE ======
async function loadRouteWeatherData() {
    // Show loading state for Current Weather widget
    const currentWeatherWidget = document.getElementById('widgetCurrentWeather');
    if (currentWeatherWidget) {
        currentWeatherWidget.querySelector('.widget-content').innerHTML = `
            Temperature: Loading...<br>
            Wind: Loading...<br>
            Visibility: Loading...
        `;
    }
    
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
    
    // Current Weather Widget (First widget) - Parse METAR data
    if (weatherDataArray && weatherDataArray[0]) {
        const metarData = weatherDataArray[0];
        const currentWeatherWidget = widgets[0];
        
        if (currentWeatherWidget) {
            const weatherInfo = parseMetarData(metarData);
            currentWeatherWidget.querySelector('.widget-content').innerHTML = `
                Temperature: ${weatherInfo.temperature}<br>
                Wind: ${weatherInfo.wind}<br>
                Visibility: ${weatherInfo.visibility}
            `;
        }
    }
}

// Function to parse METAR data and extract weather information
function parseMetarData(metarData) {
    if (!metarData || !Array.isArray(metarData) || metarData.length === 0) {
        return {
            temperature: 'N/A',
            wind: 'N/A',
            visibility: 'N/A'
        };
    }
    
    const metar = metarData[0];
    
    // Extract temperature
    let temperature = 'N/A';
    if (metar.temp && metar.temp !== null) {
        const tempC = Math.round(metar.temp);
        temperature = `${tempC}°C`;
    }
    
    // Extract wind information
    let wind = 'N/A';
    if (metar.wdir && metar.wspd !== null) {
        const direction = metar.wdir || 'VRB';
        const speed = metar.wspd || 0;
        const gust = metar.wgst ? `G${metar.wgst}` : '';
        wind = `${speed}${gust}kt ${direction}°`;
    } else if (metar.rawOb) {
        // Try to parse wind from raw METAR
        const windMatch = metar.rawOb.match(/(\d{3}|VRB)(\d{2})(G(\d{2}))?KT/);
        if (windMatch) {
            const direction = windMatch[1] === 'VRB' ? 'VRB' : `${windMatch[1]}°`;
            const speed = windMatch[2];
            const gust = windMatch[4] ? `G${windMatch[4]}` : '';
            wind = `${speed}${gust}kt ${direction}`;
        }
    }
    
    // Extract visibility
    let visibility = 'N/A';
    if (metar.vis && metar.vis !== null) {
        if (metar.vis >= 10) {
            visibility = '10+ SM';
        } else {
            visibility = `${metar.vis} SM`;
        }
    } else if (metar.rawOb) {
        // Try to parse visibility from raw METAR
        const visMatch = metar.rawOb.match(/(\d+)\s*SM/);
        if (visMatch) {
            const vis = parseInt(visMatch[1]);
            visibility = vis >= 10 ? '10+ SM' : `${vis} SM`;
        }
    }
    
    return {
        temperature,
        wind,
        visibility
    };
}

function updateWeatherWidgetsError() {
    // HANDLE API ERRORS HERE
    const widgets = document.querySelectorAll('.widget');
    
    // Update Current Weather widget specifically
    const currentWeatherWidget = document.getElementById('widgetCurrentWeather');
    if (currentWeatherWidget) {
        currentWeatherWidget.querySelector('.widget-content').innerHTML = `
            Temperature: N/A<br>
            Wind: N/A<br>
            Visibility: N/A
        `;
    }
    
    // Update other widgets with generic error
    widgets.forEach(widget => {
        if (widget.id !== 'widgetCurrentWeather') {
            widget.querySelector('.widget-content').innerHTML = 'Weather data unavailable';
        }
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