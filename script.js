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
        search: '/search'
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
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    
    // Show selected page
    document.getElementById(`page${pageNumber}`).style.display = 'flex';
    
    // Scroll to top
    window.scrollTo(0, (pageNumber - 1) * window.innerHeight);
}

// Page 2: Dashboard initialization
async function initializeDashboard() {
    // Set route title
    document.getElementById('routeTitle').textContent = 
        `${routeData[0]} → ${routeData[routeData.length - 1]}`;
    
    // Create waypoints
    const waypointsList = document.getElementById('waypointsList');
    waypointsList.innerHTML = '';
    
    routeData.forEach(waypoint => {
        const waypointElement = document.createElement('div');
        waypointElement.className = 'waypoint';
        waypointElement.textContent = waypoint;
        waypointsList.appendChild(waypointElement);
    });
    
    // Animate progress bar
    setTimeout(() => {
        document.getElementById('progressBar').style.width = '75%';
    }, 500);
    
    // FETCH REAL WEATHER DATA FOR ROUTE
    await loadRouteWeatherData();
    
    // Update flight information
    updateFlightInfo();
}

// ====== ADD YOUR WEATHER DATA LOADING HERE ======
async function loadRouteWeatherData() {
    try {
        // Fetch weather data for each waypoint
        const weatherPromises = routeData.map(icao => fetchWeatherData(icao));
        const weatherData = await Promise.all(weatherPromises);
        
        // Process weather data and update widgets
        updateWeatherWidgets(weatherData);
        
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

// Smooth scrolling between pages
let currentPage = 1;

document.addEventListener('wheel', function(e) {
    e.preventDefault();
    
    if (e.deltaY > 0 && currentPage < 3) {
        // Scroll down
        currentPage++;
        showPage(currentPage);
    } else if (e.deltaY < 0 && currentPage > 1) {
        // Scroll up
        currentPage--;
        showPage(currentPage);
    }
}, { passive: false });

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    showPage(1);
});