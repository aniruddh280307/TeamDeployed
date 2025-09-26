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
    baseUrl: 'http://localhost:3001',
    endpoints: {
        summary: '/aviation/summary',
        weather: '/weather',
        route: '/route',
        health: '/health',
        stationinfo: '/data/stationinfo',
        routeStations: '/route/stations',
        metarDecoded: '/data/metar'
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
            // Handle specific error cases
            if (response.status === 400) {
                console.warn(`${endpoint.toUpperCase()} API: Bad Request - Invalid parameters:`, params);
                return null; // Return null for bad requests instead of throwing
            }
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
        ids: icaoCode, 
        format: 'json', 
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
        ids: icaoCode, 
        format: 'json', 
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

// Station Information API Functions
async function fetchStationInfo(icaoCode) {
    try {
        const response = await fetch(`${BACKEND_API_CONFIG.baseUrl}${BACKEND_API_CONFIG.endpoints.stationinfo}?station=${icaoCode}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Station Info API Error for ${icaoCode}:`, error);
        return null;
    }
}

async function fetchRouteStations(routeIcaos) {
    try {
        const routeString = routeIcaos.join(',');
        const response = await fetch(`${BACKEND_API_CONFIG.baseUrl}${BACKEND_API_CONFIG.endpoints.routeStations}/${routeString}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Route Stations API Error:', error);
        return null;
    }
}

async function fetchDecodedMetar(stationCode) {
    try {
        const response = await fetch(`${BACKEND_API_CONFIG.baseUrl}${BACKEND_API_CONFIG.endpoints.metarDecoded}?station=${stationCode}&hours=1`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Decoded METAR API Error for ${stationCode}:`, error);
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
    
    // Initialize dynamic weather wallpaper
    initializeWeatherWallpaper();
}

// Create professional animated map visualization with real station data
async function createAnimatedMap() {
    const mapContainer = document.getElementById('flightMap');
    const waypointPins = document.getElementById('waypointPins');
    const weatherStops = document.getElementById('weatherStops');
    
    // Fetch real station information for the route
    const stationData = await fetchRouteStations(routeData);
    console.log('Station data:', stationData);
    const flightProgress = document.getElementById('flightProgress');
    
    // Clear existing content
    waypointPins.innerHTML = '';
    weatherStops.innerHTML = '';
    
    // Create professional pushpin waypoints with real station data
    routeData.forEach((waypoint, index) => {
        // Position pins along the route
        const leftPercent = 10 + (index * 80 / (routeData.length - 1));
        
        // Get real station information
        let stationInfo = null;
        let fullName = waypoint;
        let city = 'Unknown';
        let country = '';
        let elevation = '';
        
        if (stationData && stationData.stations && stationData.stations[waypoint]) {
            stationInfo = stationData.stations[waypoint];
            
            // Extract station information from API response
            if (Array.isArray(stationInfo) && stationInfo.length > 0) {
                const station = stationInfo[0];
                fullName = station.name || waypoint;
                city = station.city || 'Unknown';
                country = station.country || '';
                elevation = station.elevation ? `${station.elevation}ft` : '';
            } else if (stationInfo.name) {
                fullName = stationInfo.name;
                city = stationInfo.city || 'Unknown';
                country = stationInfo.country || '';
                elevation = stationInfo.elevation ? `${stationInfo.elevation}ft` : '';
            }
        }
        
        // Create display name with real data
        const displayName = `${fullName}${city !== 'Unknown' ? ` - ${city}` : ''}${country ? `, ${country}` : ''}`;
        
        // Determine pin type
        let pinType = 'waypoint';
        if (index === 0) {
            pinType = 'departure';
        } else if (index === routeData.length - 1) {
            pinType = 'destination';
        }
        
        // Create pin with real station data
        const pin = createWaypointPin(waypoint, displayName, leftPercent, 50, pinType, stationInfo);
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
            // Update all dashboard components
            updateDashboardComponents(data.data, data.stations);
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

// Format summary text with proper HTML formatting
function formatSummaryText(text) {
    if (!text) return '<div class="no-data">No data available</div>';
    
    // Convert line breaks to HTML and format bullet points
    return text
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
            if (line.startsWith('•')) {
                return `<div class="summary-bullet">${line}</div>`;
            } else {
                return `<div class="summary-text">${line}</div>`;
            }
        })
        .join('');
}

// Format weather briefing summary in original format with categories
function formatOriginalWeatherBriefing(text) {
    if (!text) return '<div class="no-data">No weather briefing summary available</div>';
    
    // Split the text into lines and process each line
    const lines = text.split('\n').filter(line => line.trim());
    let html = '';
    let currentCategory = '';
    
    for (const line of lines) {
        // Handle main title
        if (line.includes('🌤️ WEATHER BRIEFING SUMMARY')) {
            html += `<div class="weather-briefing-title">${line}</div>`;
        }
        // Handle Overview category
        else if (line.includes('📊 OVERVIEW:')) {
            currentCategory = 'overview';
            html += `<div class="category-header overview-header">📊 OVERVIEW</div>`;
        }
        // Handle Attention category
        else if (line.includes('⚠️ ATTENTION:')) {
            currentCategory = 'attention';
            html += `<div class="category-header attention-header">⚠️ ATTENTION</div>`;
        }
        // Handle bullet points with tags and "See why" links
        else if (line.startsWith('•')) {
            // Extract the main content, tags, and "See why" link
            const content = line.replace(/<[^>]*>/g, ''); // Remove HTML tags for processing
            const hasTags = line.includes('<span class="tag');
            const hasSeeWhy = line.includes('<a href="#" class="see-why"');
            
            let bulletHtml = `<div class="summary-bullet ${currentCategory}-bullet">`;
            bulletHtml += content;
            
            // Add tags and "See why" link if they exist in the original line
            if (hasTags || hasSeeWhy) {
                // Extract the HTML parts from the original line
                const tagMatch = line.match(/<span class="tag[^"]*"[^>]*>([^<]*)<\/span>/);
                const seeWhyMatch = line.match(/<a href="#" class="see-why"[^>]*>([^<]*)<\/a>/);
                
                if (tagMatch) {
                    bulletHtml += ` <span class="tag ${tagMatch[1].toLowerCase().replace(/\s+/g, '-')}">${tagMatch[1]}</span>`;
                }
                if (seeWhyMatch) {
                    // Extract data attributes for the "See why" link
                    const dataStation = line.match(/data-station="([^"]*)"/);
                    const dataType = line.match(/data-type="([^"]*)"/);
                    const dataAttrs = dataStation && dataType ? 
                        `data-station="${dataStation[1]}" data-type="${dataType[1]}"` : '';
                    bulletHtml += ` <a href="#" class="see-why" ${dataAttrs}>See why</a>`;
                }
            }
            
            bulletHtml += '</div>';
            html += bulletHtml;
        }
        // Handle other content
        else {
            html += `<div class="summary-text">${line}</div>`;
        }
    }
    
    return html;
}

// Format weather briefing summary with enhanced headings (legacy function)
function formatWeatherBriefing(text) {
    if (!text) return '<div class="no-data">No weather briefing summary available</div>';
    
    // Convert the weather briefing text to HTML with enhanced headings
    return text
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
            // Handle Overview heading
            if (line.includes('📊 OVERVIEW:')) {
                return `<div class="overview-heading">📊 OVERVIEW</div>`;
            }
            // Handle Attention heading
            else if (line.includes('⚠️ ATTENTION:')) {
                return `<div class="attention-heading">⚠️ ATTENTION</div>`;
            }
            // Handle bullet points
            else if (line.startsWith('•')) {
                return `<div class="summary-bullet">${line}</div>`;
            }
            // Handle numbered items
            else if (line.match(/^\d+\./)) {
                return `<div class="numbered-item">${line}</div>`;
            }
            // Handle regular text
            else {
                return `<div class="summary-text">${line}</div>`;
            }
        })
        .join('');
}

// "See why" functionality (same as Python version)
function handleSeeWhyClick(event) {
    event.preventDefault();
    
    const station = event.target.getAttribute('data-station');
    const type = event.target.getAttribute('data-type');
    
    if (!station || !type) {
        console.error('Missing station or type data');
        return;
    }
    
    // Show loading state
    showExplanationModal('Loading detailed analysis...', 'Please wait while we fetch detailed weather information...');
    
    // Fetch detailed explanation
    fetch(`${BACKEND_API_CONFIG.baseUrl}/see-why?station=${station}&type=${type}`)
        .then(response => response.json())
        .then(data => {
            if (data.detailedExplanation) {
                showExplanationModal(
                    `Detailed ${type.toUpperCase()} Analysis for ${station}`,
                    data.detailedExplanation,
                    data.rawData
                );
            } else {
                showExplanationModal(
                    'Analysis Unavailable',
                    'Detailed analysis is not available for this weather data.',
                    data.rawData || 'No raw data available'
                );
            }
        })
        .catch(error => {
            console.error('Error fetching detailed explanation:', error);
            showExplanationModal(
                'Error',
                'Unable to fetch detailed weather analysis. Please try again later.',
                ''
            );
        });
}

// Show explanation modal
function showExplanationModal(title, content, rawData = '') {
    const modal = document.getElementById('explanationModal');
    const titleElement = document.getElementById('explanationTitle');
    const bodyElement = document.getElementById('explanationBody');
    
    titleElement.textContent = title;
    
    let bodyContent = content;
    if (rawData) {
        bodyContent += `<div class="raw-data"><strong>Raw Data:</strong><br>${rawData}</div>`;
    }
    
    bodyElement.innerHTML = bodyContent;
    modal.style.display = 'block';
    
    // Add click outside to close
    modal.onclick = function(event) {
        if (event.target === modal) {
            closeExplanationModal();
        }
    };
}

// Close explanation modal
function closeExplanationModal() {
    const modal = document.getElementById('explanationModal');
    modal.style.display = 'none';
}

// Add event listeners for "See why" buttons
function addSeeWhyListeners() {
    // Use event delegation for dynamically added content
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('see-why')) {
            handleSeeWhyClick(event);
        }
    });
}

// Update professional widgets with real data
function updateProfessionalWidgets(weatherData) {
    console.log('🎯 Updating professional widgets with data:', weatherData);
    
    // Update Visibility Widget
    if (weatherData.metar && weatherData.metar.length > 0) {
        const metar = weatherData.metar[0];
        const visibility = metar.visib || 'N/A';
        let visibilityText = 'N/A';
        
        console.log('🔍 Visibility widget debug:', { visibility, metar: metar.icaoId });
        
        if (visibility === '10+') {
            visibilityText = '10+ miles';
        } else if (typeof visibility === 'string' && visibility.includes('SM')) {
            visibilityText = visibility;
        } else if (typeof visibility === 'number') {
            visibilityText = visibility >= 10 ? '10+ miles' : `${visibility} miles`;
        }
        
        console.log('🔍 Visibility text:', visibilityText);
        
        const visibilityElement = document.getElementById('visibilityValue');
        if (visibilityElement) {
            visibilityElement.textContent = visibilityText;
            console.log('✅ Visibility widget updated:', visibilityText);
        } else {
            console.error('❌ Visibility element not found!');
        }
    } else {
        console.log('❌ No METAR data available for visibility widget');
    }
    
    // Update Weather Score Widget
    let weatherScore = 85; // Default score
    if (weatherData.metar && weatherData.metar.length > 0) {
        const metar = weatherData.metar[0];
        const visibility = metar.visib || 'N/A';
        const windSpeed = metar.wspd || 0;
        
        // Calculate weather score based on conditions
        let visibilityValue = 0;
        if (visibility === '10+') {
            visibilityValue = 10;
        } else if (typeof visibility === 'string' && visibility.includes('SM')) {
            const match = visibility.match(/(\d+(?:\.\d+)?)/);
            visibilityValue = match ? parseFloat(match[1]) : 0;
        } else if (typeof visibility === 'number') {
            visibilityValue = visibility;
        }
        
        if (visibilityValue >= 10 && windSpeed < 20) weatherScore = 95;
        else if (visibilityValue >= 5 && windSpeed < 30) weatherScore = 80;
        else if (visibilityValue >= 3 && windSpeed < 40) weatherScore = 65;
        else weatherScore = 45;
    }
    
    const weatherScoreElement = document.getElementById('weatherScoreValue');
    if (weatherScoreElement) {
        weatherScoreElement.textContent = `${weatherScore}%`;
    }
    
    // Update TFR Status Widget
    const tfrElement = document.getElementById('tfrValue');
    if (tfrElement) {
        tfrElement.textContent = 'Clear'; // Default to clear
    }
    
    // Update Wind Conditions Widget
    const windConditionsElement = document.getElementById('windConditionsValue');
    if (windConditionsElement && weatherData.metar && weatherData.metar.length > 0) {
        const metar = weatherData.metar[0];
        const windSpeed = metar.windSpeed || 0;
        const windDirection = metar.windDir || 0;
        if (windSpeed > 0 && windDirection >= 0) {
            windConditionsElement.textContent = `${windSpeed}kt ${windDirection}°`;
        } else {
            windConditionsElement.textContent = 'Calm';
        }
    }
}

// Update takeoff and landing weather conditions section
function updateCurrentWeatherConditions(weatherData) {
    console.log('🌤️ Updating takeoff and landing weather conditions with data:', weatherData);
    
    const currentWeatherContent = document.getElementById('currentWeatherContent');
    if (!currentWeatherContent) return;
    
    if (weatherData.metar && weatherData.metar.length >= 2) {
        // Get takeoff (first) and landing (last) airports
        const takeoffMetar = weatherData.metar[0];
        const landingMetar = weatherData.metar[weatherData.metar.length - 1];
        
        const takeoffDecoded = decodeMETAR(takeoffMetar);
        const landingDecoded = decodeMETAR(landingMetar);
        
        currentWeatherContent.innerHTML = `
            <div class="weather-airport">
                <div class="weather-airport-title">✈️ Takeoff - ${takeoffMetar.icaoId}</div>
                <div class="weather-parameters">
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Temperature</div>
                        <div class="weather-parameter-value">${takeoffDecoded.temperature || 'N/A'}</div>
                    </div>
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Wind</div>
                        <div class="weather-parameter-value">${takeoffDecoded.wind || 'N/A'}</div>
                    </div>
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Visibility</div>
                        <div class="weather-parameter-value">${takeoffDecoded.visibility || 'N/A'}</div>
                    </div>
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Pressure</div>
                        <div class="weather-parameter-value">${takeoffDecoded.pressure || 'N/A'}</div>
                    </div>
                </div>
                <div class="weather-summary">
                    <div class="weather-summary-text">${formatWeatherSummary(takeoffMetar, takeoffDecoded)}</div>
                </div>
            </div>
            
            <div class="weather-airport">
                <div class="weather-airport-title">🛬 Landing - ${landingMetar.icaoId}</div>
                <div class="weather-parameters">
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Temperature</div>
                        <div class="weather-parameter-value">${landingDecoded.temperature || 'N/A'}</div>
                    </div>
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Wind</div>
                        <div class="weather-parameter-value">${landingDecoded.wind || 'N/A'}</div>
                    </div>
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Visibility</div>
                        <div class="weather-parameter-value">${landingDecoded.visibility || 'N/A'}</div>
                    </div>
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Pressure</div>
                        <div class="weather-parameter-value">${landingDecoded.pressure || 'N/A'}</div>
                    </div>
                </div>
                <div class="weather-summary">
                    <div class="weather-summary-text">${formatWeatherSummary(landingMetar, landingDecoded)}</div>
                </div>
            </div>
        `;
    } else if (weatherData.metar && weatherData.metar.length === 1) {
        // Only one airport available
        const metar = weatherData.metar[0];
        const decoded = decodeMETAR(metar);
        
        currentWeatherContent.innerHTML = `
            <div class="weather-airport">
                <div class="weather-airport-title">✈️ Airport - ${metar.icaoId}</div>
                <div class="weather-parameters">
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Temperature</div>
                        <div class="weather-parameter-value">${decoded.temperature || 'N/A'}</div>
                    </div>
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Wind</div>
                        <div class="weather-parameter-value">${decoded.wind || 'N/A'}</div>
                    </div>
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Visibility</div>
                        <div class="weather-parameter-value">${decoded.visibility || 'N/A'}</div>
                    </div>
                    <div class="weather-parameter">
                        <div class="weather-parameter-label">Pressure</div>
                        <div class="weather-parameter-value">${decoded.pressure || 'N/A'}</div>
                    </div>
                </div>
                <div class="weather-summary">
                    <div class="weather-summary-text">${formatWeatherSummary(metar, decoded)}</div>
                </div>
            </div>
        `;
    } else {
        currentWeatherContent.innerHTML = `
            <div class="weather-airport">
                <div class="weather-airport-title">No Weather Data</div>
                <div class="weather-summary">
                    <div class="weather-summary-text">No weather data available for this route</div>
                </div>
            </div>
        `;
    }
}

// Format weather summary with proper text wrapping
function formatWeatherSummary(metar, decoded) {
    const airportName = metar.icaoId || 'Unknown';
    const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'UTC', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    
    const wind = decoded.wind || 'No wind data';
    const visibility = decoded.visibility || 'No visibility data';
    const temperature = decoded.temperature || 'No temperature data';
    const pressure = decoded.pressure || 'No pressure data';
    
    return `${airportName}, report issued on ${timestamp} UTC. ${wind}. ${visibility}. ${temperature}. ${pressure}. No significant change expected.`;
}

// Enhanced route map with hover tooltips showing full airport names
function createEnhancedRouteMap(stations) {
    console.log('🗺️ Creating enhanced route map for stations:', stations);
    
    const routeMapContainer = document.querySelector('.route-map-container');
    if (!routeMapContainer) return;
    
    const routeProgress = routeMapContainer.querySelector('.route-progress');
    if (!routeProgress) return;
    
    // Clear existing stops
    routeProgress.innerHTML = '';
    
    // Create route stops with comprehensive tooltips
    stations.forEach((station, index) => {
        const stop = document.createElement('div');
        stop.className = 'route-stop';
        stop.style.left = `${(index / (stations.length - 1)) * 90}%`;
        stop.textContent = station.substring(0, 3); // Show first 3 characters
        
        // Get full airport information
        const airportInfo = getFullAirportInfo(station);
        
        // Create comprehensive tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'route-stop-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-header">
                <div class="tooltip-title">${airportInfo.name}</div>
                <div class="tooltip-icao">${station}</div>
            </div>
            <div class="tooltip-content">
                <div class="tooltip-line"><strong>IATA:</strong> ${airportInfo.iata || 'N/A'}</div>
                <div class="tooltip-line"><strong>Location:</strong> ${airportInfo.location}</div>
                <div class="tooltip-line"><strong>Country:</strong> ${airportInfo.country}</div>
                <div class="tooltip-line"><strong>Type:</strong> ${airportInfo.type}</div>
            </div>
        `;
        stop.appendChild(tooltip);
        
        // Add hover effects
        stop.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-50%) scale(1.2)';
            this.style.zIndex = '20';
        });
        
        stop.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(-50%) scale(1)';
            this.style.zIndex = '10';
        });
        
        routeProgress.appendChild(stop);
    });
}

// Get comprehensive airport information
function getFullAirportInfo(icaoCode) {
    const airportDatabase = {
        'KJFK': {
            name: 'John F. Kennedy International Airport',
            iata: 'JFK',
            location: 'New York, NY',
            country: 'United States',
            type: 'International Hub'
        },
        'EGLL': {
            name: 'London Heathrow Airport',
            iata: 'LHR',
            location: 'London, England',
            country: 'United Kingdom',
            type: 'International Hub'
        },
        'LFPG': {
            name: 'Charles de Gaulle Airport',
            iata: 'CDG',
            location: 'Paris, France',
            country: 'France',
            type: 'International Hub'
        },
        'EDDF': {
            name: 'Frankfurt Airport',
            iata: 'FRA',
            location: 'Frankfurt, Germany',
            country: 'Germany',
            type: 'International Hub'
        },
        'KORD': {
            name: 'Chicago O\'Hare International Airport',
            iata: 'ORD',
            location: 'Chicago, IL',
            country: 'United States',
            type: 'International Hub'
        },
        'KLAX': {
            name: 'Los Angeles International Airport',
            iata: 'LAX',
            location: 'Los Angeles, CA',
            country: 'United States',
            type: 'International Hub'
        },
        'KDFW': {
            name: 'Dallas/Fort Worth International Airport',
            iata: 'DFW',
            location: 'Dallas, TX',
            country: 'United States',
            type: 'International Hub'
        },
        'KATL': {
            name: 'Hartsfield-Jackson Atlanta International Airport',
            iata: 'ATL',
            location: 'Atlanta, GA',
            country: 'United States',
            type: 'International Hub'
        },
        'EHAM': {
            name: 'Amsterdam Airport Schiphol',
            iata: 'AMS',
            location: 'Amsterdam, Netherlands',
            country: 'Netherlands',
            type: 'International Hub'
        },
        'LIRF': {
            name: 'Leonardo da Vinci International Airport',
            iata: 'FCO',
            location: 'Rome, Italy',
            country: 'Italy',
            type: 'International Hub'
        },
        'LEMD': {
            name: 'Adolfo Suárez Madrid-Barajas Airport',
            iata: 'MAD',
            location: 'Madrid, Spain',
            country: 'Spain',
            type: 'International Hub'
        },
        'EGKK': {
            name: 'London Gatwick Airport',
            iata: 'LGW',
            location: 'London, England',
            country: 'United Kingdom',
            type: 'International'
        },
        'KSEA': {
            name: 'Seattle-Tacoma International Airport',
            iata: 'SEA',
            location: 'Seattle, WA',
            country: 'United States',
            type: 'International Hub'
        },
        'KIAH': {
            name: 'George Bush Intercontinental Airport',
            iata: 'IAH',
            location: 'Houston, TX',
            country: 'United States',
            type: 'International Hub'
        },
        'KPHX': {
            name: 'Phoenix Sky Harbor International Airport',
            iata: 'PHX',
            location: 'Phoenix, AZ',
            country: 'United States',
            type: 'International Hub'
        }
    };
    
    return airportDatabase[icaoCode] || {
        name: `${icaoCode} Airport`,
        iata: 'N/A',
        location: 'Unknown',
        country: 'Unknown',
        type: 'Airport'
    };
}

// METAR decoding function for current weather
function decodeMETAR(metar) {
    const rawMetar = metar.rawOb || '';
    const icaoId = metar.icaoId || 'Unknown';
    
    // Extract basic information
    const windDir = metar.windDir || 0;
    const windSpeed = metar.windSpeed || 0;
    const windGust = metar.windGust || 0;
    const visibility = metar.visib || 'N/A';
    const temperature = metar.temp || 0;
    const dewPoint = metar.dewp || 0;
    const pressure = metar.altim || 0;
    
    return {
        wind: windDir && windSpeed ? `${getWindDirection(windDir)} at ${windSpeed} kts${windGust ? `, gusts ${windGust} kts` : ''}` : 'No wind data',
        visibility: visibility && visibility !== 'N/A' ? `${visibility}` : 'No visibility data',
        temperature: temperature ? `${temperature}°C (dew point: ${dewPoint}°C)` : 'No temperature data',
        pressure: pressure ? `${pressure} hPa` : 'No pressure data'
    };
}

function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

// Display weather briefing summary with enhanced features
function displaySummaryPoints(points) {
    const summaryPoints = document.getElementById('summaryPoints');
    const overviewCategory = document.getElementById('overviewCategory');
    const attentionCategory = document.getElementById('attentionCategory');
    
    // Hide the category sections for weather briefing summary
    overviewCategory.style.display = 'none';
    attentionCategory.style.display = 'none';
    
    // Show the main summary points for weather briefing
    summaryPoints.style.display = 'block';
    
    if (Array.isArray(points) && points.length > 0) {
        // Display weather briefing summary in original format
        const weatherBriefing = points[0];
        summaryPoints.innerHTML = formatOriginalWeatherBriefing(weatherBriefing);
    } else if (typeof points === 'string') {
        // Single string format
        summaryPoints.innerHTML = formatOriginalWeatherBriefing(points);
    } else {
        // Fallback
        summaryPoints.innerHTML = '<div class="no-data">No weather briefing summary available</div>';
    }
    
    // Update weather wallpaper based on new summary points
    setTimeout(() => {
        const weatherConditions = analyzeWeatherConditions();
        applyWeatherWallpaper(weatherConditions);
    }, 100);
}

// Enhanced function to update all dashboard components
function updateDashboardComponents(weatherData, stations) {
    console.log('🚀 Updating all dashboard components with data:', weatherData);
    console.log('🔍 Weather data structure:', {
        hasMetar: !!(weatherData.metar && weatherData.metar.length > 0),
        metarCount: weatherData.metar ? weatherData.metar.length : 0,
        firstMetar: weatherData.metar && weatherData.metar.length > 0 ? weatherData.metar[0] : null
    });
    
    // Update professional widgets
    updateProfessionalWidgets(weatherData);
    
    // Update current weather conditions
    updateCurrentWeatherConditions(weatherData);
    
    // Update flight information
    updateFlightInformation(weatherData, stations);
    
    // Create enhanced route map with hover tooltips
    if (stations && stations.length > 0) {
        createEnhancedRouteMap(stations);
    }
}

// Update flight information with comprehensive data
function updateFlightInformation(weatherData, stations) {
    console.log('✈️ Updating flight information with data:', weatherData, stations);
    
    if (!stations || stations.length < 2) return;
    
    // Calculate flight distance and time
    const distance = calculateFlightDistance(stations);
    const flightTime = calculateFlightTime(distance);
    const route = `${stations[0]} → ${stations[stations.length - 1]}`;
    
    // Update route
    const routeElement = document.getElementById('flightRoute');
    if (routeElement) {
        routeElement.textContent = route;
    }
    
    // Update distance
    const distanceElement = document.getElementById('totalDistance');
    if (distanceElement) {
        distanceElement.textContent = `${distance.toFixed(0)} nm`;
    }
    
    // Update flight time
    const timeElement = document.getElementById('flightTime');
    if (timeElement) {
        timeElement.textContent = `${flightTime.hours}h ${flightTime.minutes}m`;
    }
    
    // Update weather status
    const weatherStatusElement = document.getElementById('weatherStatus');
    if (weatherStatusElement) {
        const weatherStatus = analyzeWeatherStatus(weatherData);
        weatherStatusElement.textContent = weatherStatus.text;
        
        // Update status badge
        const statusBadge = weatherStatusElement.parentElement.querySelector('.flight-info-status');
        if (statusBadge) {
            statusBadge.className = `flight-info-status ${weatherStatus.status}`;
            statusBadge.textContent = weatherStatus.status.toUpperCase();
        }
    }
    
    // Update departure airport
    const departureElement = document.getElementById('departureAirport');
    if (departureElement) {
        departureElement.textContent = `${stations[0]} - ${getAirportName(stations[0])}`;
    }
    
    // Update arrival airport
    const arrivalElement = document.getElementById('arrivalAirport');
    if (arrivalElement) {
        arrivalElement.textContent = `${stations[stations.length - 1]} - ${getAirportName(stations[stations.length - 1])}`;
    }
    
    // Update flight level
    const flightLevelElement = document.getElementById('flightLevel');
    if (flightLevelElement) {
        const optimalLevel = calculateOptimalFlightLevel(distance);
        flightLevelElement.textContent = `FL${optimalLevel}`;
    }
    
    // Update aircraft type
    const aircraftElement = document.getElementById('aircraftType');
    if (aircraftElement) {
        const aircraftType = determineAircraftType(distance);
        aircraftElement.textContent = aircraftType;
    }
}

// Calculate flight distance between airports
function calculateFlightDistance(stations) {
    // Simplified distance calculation (in nautical miles)
    // In a real application, this would use proper geographic calculations
    const baseDistance = 3000; // Base distance for transatlantic flights
    const stationCount = stations.length;
    const distancePerStation = baseDistance / stationCount;
    return baseDistance + (stationCount * distancePerStation);
}

// Calculate flight time based on distance
function calculateFlightTime(distance) {
    const averageSpeed = 500; // knots
    const totalMinutes = (distance / averageSpeed) * 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    return { hours, minutes };
}

// Analyze weather status
function analyzeWeatherStatus(weatherData) {
    if (!weatherData.metar || weatherData.metar.length === 0) {
        return { text: 'No weather data', status: 'unknown' };
    }
    
    let goodConditions = 0;
    let totalConditions = 0;
    
    weatherData.metar.forEach(metar => {
        const visibility = metar.visib || 'N/A';
        const windSpeed = metar.wspd || 0;
        
        let visibilityValue = 0;
        if (visibility === '10+') {
            visibilityValue = 10;
        } else if (typeof visibility === 'string' && visibility.includes('SM')) {
            const match = visibility.match(/(\d+(?:\.\d+)?)/);
            visibilityValue = match ? parseFloat(match[1]) : 0;
        } else if (typeof visibility === 'number') {
            visibilityValue = visibility;
        }
        
        if (visibilityValue >= 5 && windSpeed < 30) {
            goodConditions++;
        }
        totalConditions++;
    });
    
    const goodPercentage = (goodConditions / totalConditions) * 100;
    
    if (goodPercentage >= 80) {
        return { text: 'Excellent conditions', status: 'good' };
    } else if (goodPercentage >= 60) {
        return { text: 'Good conditions', status: 'good' };
    } else if (goodPercentage >= 40) {
        return { text: 'Fair conditions', status: 'fair' };
    } else {
        return { text: 'Poor conditions', status: 'poor' };
    }
}

// Get airport name from ICAO code
function getAirportName(icaoCode) {
    const airportNames = {
        'KJFK': 'New York',
        'EGLL': 'London',
        'LFPG': 'Paris',
        'EDDF': 'Frankfurt',
        'KORD': 'Chicago',
        'KLAX': 'Los Angeles',
        'KDFW': 'Dallas',
        'KATL': 'Atlanta'
    };
    return airportNames[icaoCode] || 'Unknown';
}

// Calculate optimal flight level
function calculateOptimalFlightLevel(distance) {
    if (distance > 2000) return 350;
    if (distance > 1000) return 300;
    if (distance > 500) return 250;
    return 200;
}

// Determine aircraft type based on distance
function determineAircraftType(distance) {
    if (distance > 3000) return 'Wide-body';
    if (distance > 1500) return 'Narrow-body';
    return 'Regional';
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
            promises.push(fetchAviationData('pirep', { format: 'JSON', hours: 6, type: 'all' }));
        }
        if (dataType === 'comprehensive' || dataType === 'sigmet') {
            promises.push(fetchAviationData('sigmet', { format: 'JSON', hours: 6, type: 'all' }));
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
                    <span class="data-label">Visibility:</span> ${metar.visib ? `${metar.visib}` : 'N/A'}<br>
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
            if (metar.visib) {
                return normalizeVisibility(metar.visib);
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
function createWaypointPin(icaoCode, fullName, x, y, type = 'waypoint', stationInfo = null) {
    const pin = document.createElement('div');
    pin.className = `waypoint-pin ${type}`;
    pin.style.left = `${x}%`;
    pin.style.top = `${y}%`;
    pin.setAttribute('data-code', icaoCode);
    pin.setAttribute('data-name', fullName);
    pin.innerHTML = '📍';
    
    // Add station information attributes
    if (stationInfo) {
        if (Array.isArray(stationInfo) && stationInfo.length > 0) {
            const station = stationInfo[0];
            pin.setAttribute('data-city', station.city || '');
            pin.setAttribute('data-country', station.country || '');
            pin.setAttribute('data-elevation', station.elevation || '');
            pin.setAttribute('data-latitude', station.latitude || '');
            pin.setAttribute('data-longitude', station.longitude || '');
        } else if (stationInfo.name) {
            pin.setAttribute('data-city', stationInfo.city || '');
            pin.setAttribute('data-country', stationInfo.country || '');
            pin.setAttribute('data-elevation', stationInfo.elevation || '');
            pin.setAttribute('data-latitude', stationInfo.latitude || '');
            pin.setAttribute('data-longitude', stationInfo.longitude || '');
        }
    }
    
    // Add enhanced hover tooltip with station information
    pin.addEventListener('mouseenter', () => {
        let tooltip = `${icaoCode} - ${fullName}`;
        if (stationInfo) {
            const city = pin.getAttribute('data-city');
            const country = pin.getAttribute('data-country');
            const elevation = pin.getAttribute('data-elevation');
            
            if (city) tooltip += `\nCity: ${city}`;
            if (country) tooltip += `\nCountry: ${country}`;
            if (elevation) tooltip += `\nElevation: ${elevation}ft`;
        }
        pin.title = tooltip;
    });
    
    return pin;
}

// Removed formatSummaryPoint function - now using simple bullet points

// ====== ADD YOUR WEATHER DATA LOADING HERE ======
async function loadRouteWeatherData() {
    // Show loading states for all widgets
    showLoadingStates();
    
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

async function updateWeatherWidgets(weatherDataArray) {
    // UPDATE WIDGETS WITH REAL DATA HERE
    const widgets = document.querySelectorAll('.widget');
    
    // Current Weather Widget (First widget) - Use backend METAR decoder
    if (weatherDataArray && weatherDataArray[0]) {
        const metarData = weatherDataArray[0];
        const currentWeatherWidget = widgets[0];
        
        if (currentWeatherWidget) {
            try {
                // Use backend METAR decoder for enhanced display
                const stationCode = metarData.icaoId || 'KJFK';
                const response = await fetch(`${BACKEND_API_CONFIG.baseUrl}${BACKEND_API_CONFIG.endpoints.metarDecoded}?station=${stationCode}&hours=1`);
                
                if (response.ok) {
                    const decodedData = await response.json();
                    
                    if (decodedData && decodedData.decoded && decodedData.decoded.length > 0) {
                        const decoded = decodedData.decoded[0];
                        currentWeatherWidget.querySelector('.widget-content').innerHTML = `
                            <div class="decoded-weather">
                                <div class="weather-summary">${decoded.summary}</div>
                                <div class="weather-details">
                                    <div><strong>Temperature:</strong> ${decoded.temperature}</div>
                                    <div><strong>Wind:</strong> ${decoded.wind}</div>
                                    <div><strong>Visibility:</strong> ${decoded.visibility}</div>
                                    <div><strong>Clouds:</strong> ${decoded.clouds}</div>
                                    <div><strong>Pressure:</strong> ${decoded.pressure}</div>
                                    <div><strong>Weather:</strong> ${decoded.weather}</div>
                                </div>
                                <div class="raw-metar">
                                    <strong>Raw METAR:</strong> ${decoded.raw_metar}
                                </div>
                            </div>
                        `;
                    } else {
                        // Fallback to parsed data
                        const weatherInfo = parseMetarData(metarData);
                        currentWeatherWidget.querySelector('.widget-content').innerHTML = `
                            <div class="parsed-weather">
                                <div><strong>Temperature:</strong> ${weatherInfo.temperature}°C</div>
                                <div><strong>Wind:</strong> ${weatherInfo.wind}</div>
                                <div><strong>Visibility:</strong> ${weatherInfo.visibility}</div>
                            </div>
                        `;
                    }
                } else {
                    throw new Error(`Backend METAR decoder failed: ${response.status}`);
                }
            } catch (error) {
                console.error('Error fetching decoded METAR:', error);
                // Fallback to parsed data
                const weatherInfo = parseMetarData(metarData);
                currentWeatherWidget.querySelector('.widget-content').innerHTML = `
                    <div class="fallback-weather">
                        <div><strong>Temperature:</strong> ${weatherInfo.temperature}°C</div>
                        <div><strong>Wind:</strong> ${weatherInfo.wind}</div>
                        <div><strong>Visibility:</strong> ${weatherInfo.visibility}</div>
                        <div class="error-note">Using fallback data</div>
                    </div>
                `;
            }
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
    if (metar.visib && metar.visib !== null) {
        if (metar.visib === '10+') {
            visibility = '10+ SM';
        } else {
            visibility = `${metar.visib}`;
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
    try {
        // Get comprehensive weather data for all widgets
        const comprehensiveData = await fetchComprehensiveWeatherDataForWidgets();
        
        // Update Visibility Widget with real METAR data
        await updateVisibilityWidget(comprehensiveData);
        
        // Update Weather Score Widget with real data
        await updateWeatherScoreWidget(comprehensiveData);
        
        // Update Wind Conditions Widget with real METAR data
        await updateWindWidget(comprehensiveData);
        
        // Keep TFR widget as placeholder (not integrated per request)
        updateTfrWidget();
        
    } catch (error) {
        console.error('Failed to update additional widgets:', error);
        // Set error states for all widgets
        setText('visibilityValue', 'N/A');
        setBadge('visibilityBadge', 'unknown');
        setText('weatherScoreValue', '--');
        setBadge('weatherScoreBadge', 'unknown');
        setText('windDirection', 'N/A');
        setText('windSpeed', 'N/A');
        setText('windGusts', 'N/A');
        setBadge('windBadge', 'unknown');
    }
}

// Function to fetch comprehensive weather data for widgets
async function fetchComprehensiveWeatherDataForWidgets() {
    const results = {};
    
    try {
        // Use backend API integration for comprehensive weather data
        const response = await fetch(`${BACKEND_API_CONFIG.baseUrl}${BACKEND_API_CONFIG.endpoints.summary}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stations: 'KJFK,EGLL,LFPG,EDDF' // Default route for comprehensive data
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Extract weather data from backend response
        if (data.data) {
            results.metar = data.data.metar || [];
            results.taf = data.data.taf || [];
            results.pirep = data.data.pirep || [];
            results.sigmet = data.data.sigmet || [];
        }
        
        // Log successful data fetches
        console.log('Weather data fetched from backend:', {
            metar: results.metar ? results.metar.length + ' records' : 'failed',
            taf: results.taf ? results.taf.length + ' records' : 'failed',
            pirep: results.pirep ? results.pirep.length + ' records' : 'failed',
            sigmet: results.sigmet ? results.sigmet.length + ' records' : 'failed'
        });
        
        return results;
    } catch (error) {
        console.error('Error fetching comprehensive weather data from backend:', error);
        return {};
    }
}

// Update Visibility Widget with real METAR/TAF data
async function updateVisibilityWidget(data) {
    try {
        let visibility = { display: 'N/A', km: null, badge: 'unknown' };
        
        // Try METAR first (current conditions)
        if (data.metar && Array.isArray(data.metar) && data.metar.length > 0) {
            const metar = data.metar[0];
            if (metar.visib !== null && metar.visib !== undefined) {
                visibility = normalizeVisibility(metar.visib);
            }
        }
        
        // Fallback to TAF if METAR visibility not available
        if (visibility.display === 'N/A' && data.taf && Array.isArray(data.taf) && data.taf.length > 0) {
            const taf = data.taf[0];
            if (taf.forecast && taf.forecast.length > 0) {
                const firstForecast = taf.forecast[0];
                if (firstForecast.visibility !== null && firstForecast.visibility !== undefined) {
                    visibility = normalizeVisibility(firstForecast.visibility);
                }
            }
        }
        
    setText('visibilityValue', visibility.display);
    setBadge('visibilityBadge', visibility.badge);

    } catch (error) {
        console.error('Error updating visibility widget:', error);
        setText('visibilityValue', 'N/A');
        setBadge('visibilityBadge', 'unknown');
    }
}

// Update Weather Score Widget with real data
async function updateWeatherScoreWidget(data) {
    try {
        let windKts = null;
        let visKm = null;
        let turbulenceScore = 100;
        
        // Get wind data from METAR
        if (data.metar && Array.isArray(data.metar) && data.metar.length > 0) {
            const metar = data.metar[0];
            if (metar.wspd !== null && metar.wspd !== undefined) {
                windKts = metar.wspd;
            }
        }
        
        // Get visibility data
        if (data.metar && Array.isArray(data.metar) && data.metar.length > 0) {
            const metar = data.metar[0];
            if (metar.visib !== null && metar.visib !== undefined) {
                const visData = normalizeVisibility(metar.visib);
                visKm = visData.km;
            }
        }
        
        // Check for turbulence from PIREP data
        if (data.pirep && Array.isArray(data.pirep) && data.pirep.length > 0) {
            const turbulenceReports = data.pirep.filter(pirep => 
                pirep.rawPirep && pirep.rawPirep.toLowerCase().includes('turbulence')
            );
            if (turbulenceReports.length > 0) {
                turbulenceScore = 60; // Reduce score for turbulence
            }
        }
        
        // Check for severe weather from SIGMET
        if (data.sigmet && Array.isArray(data.sigmet) && data.sigmet.length > 0) {
            const severeWeather = data.sigmet.filter(sigmet => 
                sigmet.hazard && (
                    sigmet.hazard.toLowerCase().includes('severe') ||
                    sigmet.hazard.toLowerCase().includes('convective')
                )
            );
            if (severeWeather.length > 0) {
                turbulenceScore = Math.min(turbulenceScore, 40); // Further reduce for severe weather
            }
        }
        
        // Calculate composite weather score
    const score = computeWeatherScore({
            windKts: windKts,
            visKm: visKm,
            turbulenceScore: turbulenceScore
        });
        
    setRingPercent('weatherScoreValue', 'weatherScoreBadge', score);

    } catch (error) {
        console.error('Error updating weather score widget:', error);
        setText('weatherScoreValue', '--');
        setBadge('weatherScoreBadge', 'unknown');
    }
}

// Update Wind Conditions Widget with real METAR data
async function updateWindWidget(data) {
    try {
        let windInfo = {
            direction: 'N/A',
            speedDisplay: 'N/A',
            gustsDisplay: 'N/A',
            badge: 'unknown'
        };
        
        if (data.metar && Array.isArray(data.metar) && data.metar.length > 0) {
            const metar = data.metar[0];
            
            // Extract wind information
            if (metar.wdir !== null && metar.wspd !== null) {
                const direction = metar.wdir === 'VRB' ? 'VRB' : `${metar.wdir}°`;
                const speed = metar.wspd;
                const gusts = metar.wgst ? `G${metar.wgst}` : '';
                
                windInfo = {
                    direction: direction,
                    speedDisplay: `${speed} kt`,
                    gustsDisplay: gusts || 'N/A',
                    badge: speed <= 12 ? 'good' : speed <= 20 ? 'moderate' : 'poor'
                };
            }
        }
        
        setText('windDirection', windInfo.direction);
        setText('windSpeed', windInfo.speedDisplay);
        setText('windGusts', windInfo.gustsDisplay);
    setBadge('windBadge', windInfo.badge);
        
    } catch (error) {
        console.error('Error updating wind widget:', error);
        setText('windDirection', 'N/A');
        setText('windSpeed', 'N/A');
        setText('windGusts', 'N/A');
        setBadge('windBadge', 'unknown');
    }
}

// Keep TFR widget as placeholder
function updateTfrWidget() {
    setText('tfrStatus', 'TFR data not integrated');
    setBadge('tfrBadge', 'unknown');
}

// Show loading states for all widgets
function showLoadingStates() {
    // Current Weather Widget
    const currentWeatherWidget = document.getElementById('widgetCurrentWeather');
    if (currentWeatherWidget) {
        currentWeatherWidget.querySelector('.widget-content').innerHTML = `
            Temperature: Loading...<br>
            Wind: Loading...<br>
            Visibility: Loading...
        `;
    }
    
    // Visibility Widget
    setText('visibilityValue', 'Loading...');
    setBadge('visibilityBadge', 'unknown');
    
    // Weather Score Widget
    setText('weatherScoreValue', '--');
    setBadge('weatherScoreBadge', 'calculating');
    
    // Wind Widget
    setText('windDirection', 'Loading...');
    setText('windSpeed', 'Loading...');
    setText('windGusts', 'Loading...');
    setBadge('windBadge', 'unknown');
    
    // TFR Widget (keep as is)
    setText('tfrStatus', 'TFR data not integrated');
    setBadge('tfrBadge', 'unknown');
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
        // Handle special cases first
        if (raw === '10+') {
            km = 10 * 1.60934; // 10+ miles = 16+ km
        } else {
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
    }
    
    const display = km == null ? 'N/A' : raw === '10+' ? '10+ miles' : `${km.toFixed(1)} km`;
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

function computeWeatherScore({ windKts, visKm, turbulenceScore = 100 }) {
    // 0-100 composite: weights wind 30, visibility 30, turbulence 40
    let windScore = 100;
    if (windKts != null) {
        if (windKts <= 10) windScore = 100;
        else if (windKts <= 20) windScore = 70;
        else if (windKts <= 30) windScore = 40;
        else windScore = 20;
    }
    
    let visScore = visKm == null ? 60 : visKm >= 8 ? 100 : visKm >= 5 ? 70 : 30;
    
    // Use turbulence score (already calculated based on PIREP/SIGMET data)
    const turbulenceAdjustedScore = turbulenceScore;
    
    const percent = 0.3 * windScore + 0.3 * visScore + 0.4 * turbulenceAdjustedScore;
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
        // Use backend search API for comprehensive results
        const response = await fetch(`${BACKEND_API_CONFIG.baseUrl}/search?query=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const searchData = await response.json();
        
        if (searchData.results && searchData.results.length > 0) {
            resultsContainer.innerHTML = '';
            
            // Display search results with enhanced formatting
            searchData.results.forEach(result => {
                const resultElement = document.createElement('div');
                resultElement.className = 'result-item';
                
                // Enhanced result display with decoded METAR and raw data
                let resultHTML = `
                    <div class="result-header">
                        <h4>${result.title}</h4>
                        <span class="result-type-badge ${result.type.toLowerCase()}">${result.type}</span>
                    </div>
                    <div class="result-content">
                        <div class="decoded-metar">
                            <h5>📋 Decoded METAR Report</h5>
                            <pre class="metar-decoded-content">${result.content}</pre>
                        </div>
                `;
                
                // Add raw METAR data if available
                if (result.rawMetar) {
                    resultHTML += `
                        <div class="raw-metar">
                            <h5>📄 Raw METAR Data</h5>
                            <pre class="metar-raw-content">${result.rawMetar}</pre>
                        </div>
                    `;
                }
                
                resultHTML += `
                        <div class="result-meta">
                            <span class="result-source">${result.type}</span>
                            <span class="result-time">${new Date(result.timestamp * 1000).toLocaleString()}</span>
                        </div>
                    </div>
                `;
                
                resultElement.innerHTML = resultHTML;
                resultsContainer.appendChild(resultElement);
            });
            
            // Add search summary
            const summaryElement = document.createElement('div');
            summaryElement.className = 'search-summary';
            summaryElement.innerHTML = `
                <p>Found ${searchData.results.length} result(s) for "${query}"</p>
            `;
            resultsContainer.insertBefore(summaryElement, resultsContainer.firstChild);
            
        } else {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <h3>No Results Found</h3>
                    <p>No aviation weather data found for "${query}"</p>
                    <div class="search-suggestions">
                        <h4>Try searching for:</h4>
                        <ul>
                            <li>Weather conditions: "humidity", "temperature", "wind", "visibility"</li>
                            <li>Airport codes: "KJFK", "EGLL", "LFPG"</li>
                            <li>Weather phenomena: "thunderstorm", "fog", "turbulence"</li>
                            <li>Flight conditions: "VFR", "IFR", "MVFR"</li>
                        </ul>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = `
            <div class="search-error">
                <h3>Search Unavailable</h3>
                <p>Unable to search aviation weather data. Please try again later.</p>
                <p><small>Error: ${error.message}</small></p>
            </div>
        `;
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
            hours: 6,
            type: 'all'
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
    
    // Add "See why" functionality
    addSeeWhyListeners();
});