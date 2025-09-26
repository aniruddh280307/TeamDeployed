const axios = require('axios');
const NodeCache = require('node-cache');

// Initialize cache for API responses
const apiCache = new NodeCache({ stdTTL: 300 }); // 5 minutes TTL

// Aviation Weather API Configuration
const AVIATION_BASE = 'https://aviationweather.gov/api/data';

// API Integration Class
class AviationAPI {
  constructor() {
    this.baseURL = AVIATION_BASE;
    this.timeout = 15000;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  // Generic API call method with retry logic
  async makeAPICall(endpoint, params = {}, retryCount = 0) {
    const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
    
    // Check cache first
    const cached = apiCache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${endpoint}`);
      return cached;
    }

    try {
      const url = `${this.baseURL}/${endpoint}`;
      console.log(`Fetching ${endpoint} from ${url} with params:`, params);
      
      const response = await axios.get(url, {
        params,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'AviationWeatherDashboard/2.0',
          'Accept': 'application/json'
        }
      });

      // Cache successful responses
      if (response.status === 200) {
        apiCache.set(cacheKey, response.data);
      }

      return response.data;
    } catch (error) {
      console.error(`${endpoint.toUpperCase()} API Error:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });

      // Handle specific error cases
      if (error.response?.status === 400) {
        console.log(`No ${endpoint} data available for the requested parameters`);
        return [];
      }

      // Retry logic for network errors
      if (retryCount < this.retryAttempts && this.shouldRetry(error)) {
        console.log(`Retrying ${endpoint} (attempt ${retryCount + 1}/${this.retryAttempts})`);
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.makeAPICall(endpoint, params, retryCount + 1);
      }

      throw error;
    }
  }

  // Check if error is retryable
  shouldRetry(error) {
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      (error.response && error.response.status >= 500)
    );
  }

  // Delay utility for retries
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Build parameters for different API types
  buildParams(kind, params = {}) {
    const q = { ...params };
    
    switch (kind) {
      case 'metar':
      case 'taf':
        q.format = 'json';
        q.hours = Math.min(q.hours || 2, 24);
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

  // METAR API Integration
  async getMETAR(stations, hours = 2) {
    const params = this.buildParams('metar', { ids: stations, hours });
    return this.makeAPICall('metar', params);
  }

  // TAF API Integration
  async getTAF(stations, hours = 6) {
    const params = this.buildParams('taf', { ids: stations, hours });
    return this.makeAPICall('taf', params);
  }

  // PIREP API Integration
  async getPIREP(hours = 6) {
    const params = this.buildParams('pirep', { hours });
    return this.makeAPICall('pirep', params);
  }

  // SIGMET API Integration
  async getSIGMET(hours = 6) {
    const params = this.buildParams('sigmet', { hours });
    return this.makeAPICall('sigmet', params);
  }

  // Station Info API Integration
  async getStationInfo(stations) {
    const params = this.buildParams('stationinfo', { ids: stations });
    return this.makeAPICall('stationinfo', params);
  }

  // AFD API Integration
  async getAFD(stations, hours = 6) {
    const params = this.buildParams('afd', { ids: stations, hours });
    return this.makeAPICall('afd', params);
  }

  // Comprehensive weather data fetch
  async getComprehensiveWeatherData(stations, options = {}) {
    const {
      metarHours = 2,
      tafHours = 6,
      pirepHours = 6,
      sigmetHours = 6
    } = options;

    try {
      const [metarData, tafData, pirepData, sigmetData] = await Promise.all([
        this.getMETAR(stations, metarHours).catch(() => []),
        this.getTAF(stations, tafHours).catch(() => []),
        this.getPIREP(pirepHours).catch(() => []),
        this.getSIGMET(sigmetHours).catch(() => [])
      ]);

      return {
        metar: metarData,
        taf: tafData,
        pirep: pirepData,
        sigmet: sigmetData,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Comprehensive weather data fetch error:', error);
      throw error;
    }
  }

  // Search weather data
  async searchWeatherData(query, options = {}) {
    const { metarHours = 2, pirepHours = 6 } = options;
    
    try {
      const [metarData, pirepData] = await Promise.all([
        this.getMETAR('', metarHours).catch(() => []),
        this.getPIREP(pirepHours).catch(() => [])
      ]);

      const results = [];
      const queryLower = query.toLowerCase();

      // Search METAR data
      if (Array.isArray(metarData)) {
        metarData.forEach(metar => {
          if (metar.rawOb && metar.rawOb.toLowerCase().includes(queryLower)) {
            results.push({
              title: `METAR - ${metar.icaoId}`,
              content: metar.rawOb,
              timestamp: metar.obsTime,
              type: 'metar'
            });
          }
        });
      }

      // Search PIREP data
      if (Array.isArray(pirepData)) {
        pirepData.forEach(pirep => {
          if (pirep.rawPirep && pirep.rawPirep.toLowerCase().includes(queryLower)) {
            results.push({
              title: `PIREP - ${pirep.aircraftRef || 'Unknown'}`,
              content: pirep.rawPirep,
              timestamp: pirep.obsTime,
              type: 'pirep'
            });
          }
        });
      }

      return {
        query,
        results,
        total: results.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Weather search error:', error);
      throw error;
    }
  }

  // Get multiple station information
  async getMultipleStations(icaoCodes) {
    const stationData = {};
    
    try {
      const stationPromises = icaoCodes.map(async (icao) => {
        try {
          const data = await this.getStationInfo(icao);
          return { icao, data, success: true };
        } catch (error) {
          return { icao, error: error.message, success: false };
        }
      });

      const results = await Promise.all(stationPromises);
      
      results.forEach(result => {
        if (result.success) {
          stationData[result.icao] = result.data;
        } else {
          stationData[result.icao] = { error: result.error };
        }
      });

      return {
        route: icaoCodes,
        stations: stationData,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Multiple stations fetch error:', error);
      throw error;
    }
  }

  // Cache management
  getCacheStats() {
    return {
      stats: apiCache.getStats(),
      keys: apiCache.keys().length,
      timestamp: new Date().toISOString()
    };
  }

  clearCache() {
    apiCache.flushAll();
    return { message: 'Cache cleared successfully' };
  }

  // Health check for all APIs
  async healthCheck() {
    const healthStatus = {
      timestamp: new Date().toISOString(),
      apis: {}
    };

    try {
      // Test METAR API
      await this.getMETAR('KJFK', 1);
      healthStatus.apis.metar = 'healthy';
    } catch (error) {
      healthStatus.apis.metar = `unhealthy: ${error.message}`;
    }

    try {
      // Test Station Info API
      await this.getStationInfo('KJFK');
      healthStatus.apis.stationinfo = 'healthy';
    } catch (error) {
      healthStatus.apis.stationinfo = `unhealthy: ${error.message}`;
    }

    try {
      // Test TAF API
      await this.getTAF('KJFK', 1);
      healthStatus.apis.taf = 'healthy';
    } catch (error) {
      healthStatus.apis.taf = `unhealthy: ${error.message}`;
    }

    try {
      // Test PIREP API
      await this.getPIREP(1);
      healthStatus.apis.pirep = 'healthy';
    } catch (error) {
      healthStatus.apis.pirep = `unhealthy: ${error.message}`;
    }

    try {
      // Test SIGMET API
      await this.getSIGMET(1);
      healthStatus.apis.sigmet = 'healthy';
    } catch (error) {
      healthStatus.apis.sigmet = `unhealthy: ${error.message}`;
    }

    try {
      // Test AFD API
      await this.getAFD('KJFK', 1);
      healthStatus.apis.afd = 'healthy';
    } catch (error) {
      healthStatus.apis.afd = `unhealthy: ${error.message}`;
    }

    return healthStatus;
  }

  // Enhanced METAR decoder with user-friendly output
  async getDecodedMETAR(station, hours = 1) {
    try {
      const metarData = await this.getMETAR(station, hours);
      
      if (!Array.isArray(metarData) || metarData.length === 0) {
        return {
          station,
          hours,
          raw_data: [],
          decoded: [],
          timestamp: new Date().toISOString(),
          error: 'No METAR data available'
        };
      }

      // Decode METAR data into user-friendly format
      const decodedMetars = [];
      for (const metar of metarData) {
        const decoded = this.decodeMetar(metar);
        decodedMetars.push(decoded);
      }

      return {
        station,
        hours,
        raw_data: metarData,
        decoded: decodedMetars,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('METAR decoder error:', error);
      return {
        station,
        hours,
        raw_data: [],
        decoded: [],
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // METAR decoder helper function
  decodeMetar(metarData) {
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
        temperature: this.decodeTemperature(metarData),
        wind: this.decodeWind(metarData),
        visibility: this.decodeVisibility(metarData),
        clouds: this.decodeClouds(metarData),
        pressure: this.decodePressure(metarData),
        weather: this.decodeWeatherConditions(metarData),
        summary: this.generateMetarSummary(metarData, stationName, timeStr),
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

  decodeTemperature(metarData) {
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

  decodeWind(metarData) {
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

  decodeVisibility(metarData) {
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

  decodeClouds(metarData) {
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

  decodePressure(metarData) {
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

  decodeWeatherConditions(metarData) {
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

  generateMetarSummary(metarData, stationName, timeStr) {
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
        const weatherDesc = this.decodeWeatherConditions(metarData);
        if (weatherDesc !== 'No significant weather') {
          summaryParts.push(weatherDesc);
        }
      }
      
      // Clouds
      if (clouds && clouds.length > 0) {
        const cloudDesc = this.decodeClouds(metarData);
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
}

// Create singleton instance
const aviationAPI = new AviationAPI();

// Export the API instance and class
module.exports = {
  AviationAPI,
  aviationAPI,
  // Legacy function exports for backward compatibility
  getMETAR: (stations, hours) => aviationAPI.getMETAR(stations, hours),
  getTAF: (stations, hours) => aviationAPI.getTAF(stations, hours),
  getPIREP: (hours) => aviationAPI.getPIREP(hours),
  getSIGMET: (hours) => aviationAPI.getSIGMET(hours),
  getStationInfo: (stations) => aviationAPI.getStationInfo(stations),
  getAFD: (stations, hours) => aviationAPI.getAFD(stations, hours),
  getComprehensiveWeatherData: (stations, options) => aviationAPI.getComprehensiveWeatherData(stations, options),
  searchWeatherData: (query, options) => aviationAPI.searchWeatherData(query, options),
  getMultipleStations: (icaoCodes) => aviationAPI.getMultipleStations(icaoCodes),
  getDecodedMETAR: (station, hours) => aviationAPI.getDecodedMETAR(station, hours),
  getCacheStats: () => aviationAPI.getCacheStats(),
  clearCache: () => aviationAPI.clearCache(),
  healthCheck: () => aviationAPI.healthCheck()
};
