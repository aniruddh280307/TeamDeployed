const axios = require('axios');

class AviationRiskScoringService {
    constructor() {
        this.baseUrl = 'https://aviationweather.gov/api/data';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        // Risk thresholds based on ICAO/FAA operational minima
        this.thresholds = {
            visibility: {
                safe: 6,      // ≥ 6 SM
                caution: 3,   // 3-6 SM
                hazard: 0    // < 3 SM
            },
            ceiling: {
                safe: 3000,  // ≥ 3000 ft AGL
                caution: 1000, // 1000-3000 ft AGL
                hazard: 0    // < 1000 ft AGL
            },
            wind: {
                caution: 20,  // 20 knots sustained
                cautionGust: 25, // 25 knots gust
                hazard: 35    // 35 knots
            },
            temperature: {
                fogRisk: 2    // ≤ 2°C temp/dew spread
            },
            turbulence: {
                light: 'light',
                moderate: 'moderate',
                severe: 'severe'
            },
            icing: {
                trace: 'trace',
                light: 'light',
                moderate: 'moderate',
                severe: 'severe'
            }
        };

        // Risk bands and actions
        this.riskBands = {
            low: { min: 0, max: 20, color: 'green', label: 'Low Risk', action: 'Routine operations' },
            amberLow: { min: 21, max: 45, color: 'amber', label: 'Amber-Low', action: 'Monitor conditions; prepare mitigations' },
            amberHigh: { min: 46, max: 70, color: 'amber', label: 'Amber-High', action: 'Likely operational impact; notify crew/dispatch' },
            high: { min: 71, max: 90, color: 'red', label: 'High Risk', action: 'Restrict operations; consider delay/diversion' },
            severe: { min: 91, max: 100, color: 'red', label: 'Severe Risk', action: 'Suspend operations; emergency procedures' }
        };
    }

    /**
     * Main risk scoring function
     * @param {Array} stations - Array of ICAO station codes
     * @returns {Object} Risk assessment with scores and recommendations
     */
    async calculateRiskScore(stations) {
        try {
            console.log('🎯 Starting risk assessment for stations:', stations);
            
            // Fetch all weather data
            const weatherData = await this.fetchWeatherData(stations);
            
            // Preprocess and standardize data
            const processedData = this.preprocessWeatherData(weatherData);
            
            // Calculate individual risk scores
            const riskScores = this.calculateIndividualRisks(processedData);
            
            // Calculate overall risk score
            const overallRisk = this.calculateOverallRisk(riskScores);
            
            // Categorize risk and get recommendations
            const riskCategory = this.categorizeRisk(overallRisk);
            
            return {
                overallRisk,
                riskCategory,
                individualRisks: riskScores,
                recommendations: this.getRecommendations(riskCategory, riskScores),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Risk scoring error:', error);
            return {
                overallRisk: 0,
                riskCategory: this.riskBands.low,
                error: 'Unable to calculate risk score',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Calculate risk score from existing weather data
     */
    async calculateRiskScoreFromData(weatherData) {
        try {
            console.log('🎯 Calculating risk score from existing weather data');
            
            // Preprocess and standardize data
            const processedData = this.preprocessWeatherData(weatherData);
            
            // Calculate individual risk scores
            const riskScores = this.calculateIndividualRisks(processedData);
            
            // Calculate overall risk score
            const overallRisk = this.calculateOverallRisk(riskScores);
            
            // Categorize risk and get recommendations
            const riskCategory = this.categorizeRisk(overallRisk);
            
            return {
                overallRisk,
                riskCategory,
                individualRisks: riskScores,
                recommendations: this.getRecommendations(riskCategory, riskScores),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Risk scoring from data error:', error);
            return {
                overallRisk: 0,
                riskCategory: this.riskBands.low,
                error: 'Unable to calculate risk score from data',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Fetch weather data from multiple sources
     */
    async fetchWeatherData(stations) {
        const stationString = stations.join(',');
        const weatherData = {};

        try {
            // Fetch METAR data
            const metarResponse = await axios.get(`${this.baseUrl}/metar`, {
                params: { ids: stationString, hours: 2, format: 'json' }
            });
            weatherData.metar = metarResponse.data || [];

            // Fetch TAF data
            const tafResponse = await axios.get(`${this.baseUrl}/taf`, {
                params: { ids: stationString, hours: 6, format: 'json' }
            });
            weatherData.taf = tafResponse.data || [];

            // Fetch PIREP data
            try {
                const pirepResponse = await axios.get(`${this.baseUrl}/pirep`, {
                    params: { hours: 6, format: 'json', type: 'all' }
                });
                weatherData.pirep = pirepResponse.data || [];
            } catch (pirepError) {
                console.log('⚠️ PIREP data not available');
                weatherData.pirep = [];
            }

            // Fetch SIGMET data
            const sigmetResponse = await axios.get(`${this.baseUrl}/sigmet`, {
                params: { hours: 6, format: 'json', type: 'all' }
            });
            weatherData.sigmet = sigmetResponse.data || [];

            // Fetch AFD data
            const afdResponse = await axios.get(`${this.baseUrl}/afd`, {
                params: { ids: stationString, hours: 6, format: 'json' }
            });
            weatherData.afd = afdResponse.data || [];

            console.log('📊 Weather data fetched:', {
                metar: weatherData.metar.length,
                taf: weatherData.taf.length,
                pirep: weatherData.pirep.length,
                sigmet: weatherData.sigmet.length,
                afd: weatherData.afd.length
            });

            return weatherData;

        } catch (error) {
            console.error('❌ Error fetching weather data:', error);
            throw error;
        }
    }

    /**
     * Preprocess and standardize weather data
     */
    preprocessWeatherData(weatherData) {
        const processed = {
            metar: [],
            taf: [],
            pirep: [],
            sigmet: [],
            afd: []
        };

        // Process METAR data
        if (weatherData.metar) {
            processed.metar = weatherData.metar.map(metar => ({
                station: metar.icaoId,
                visibility: this.standardizeVisibility(metar.visib),
                ceiling: this.standardizeCeiling(metar.ceil),
                windSpeed: this.standardizeWindSpeed(metar.wspd),
                windGust: this.standardizeWindSpeed(metar.wgst),
                temperature: metar.temp,
                dewpoint: metar.dewp,
                pressure: metar.altim,
                weather: metar.wxString,
                flightCategory: metar.fltcat,
                raw: metar.rawOb,
                timestamp: metar.obsTime
            }));
        }

        // Process TAF data
        if (weatherData.taf) {
            processed.taf = weatherData.taf.map(taf => ({
                station: taf.icaoId,
                forecast: taf.rawTAF,
                timestamp: taf.issueTime
            }));
        }

        // Process PIREP data
        if (weatherData.pirep) {
            processed.pirep = weatherData.pirep.map(pirep => ({
                station: pirep.icaoId,
                turbulence: this.extractTurbulence(pirep.rawOb),
                icing: this.extractIcing(pirep.rawOb),
                altitude: pirep.alt,
                timestamp: pirep.obsTime
            }));
        }

        // Process SIGMET data
        if (weatherData.sigmet) {
            processed.sigmet = weatherData.sigmet.map(sigmet => ({
                station: sigmet.icaoId,
                type: sigmet.hazard,
                severity: 'hazard', // SIGMET is always hazard
                raw: sigmet.rawSigmet,
                timestamp: sigmet.issueTime
            }));
        }

        // Process AFD data
        if (weatherData.afd) {
            processed.afd = weatherData.afd.map(afd => ({
                station: afd.icaoId,
                text: afd.rawAFD,
                keywords: this.extractAFDKeywords(afd.rawAFD),
                timestamp: afd.issueTime
            }));
        }

        return processed;
    }

    /**
     * Standardize visibility units (meters to statute miles)
     */
    standardizeVisibility(visibility) {
        if (!visibility) return null;
        
        // If already in SM, return as is
        if (typeof visibility === 'string' && visibility.includes('SM')) {
            return parseFloat(visibility.replace('SM', ''));
        }
        
        // Convert meters to statute miles
        return visibility * 0.000621371;
    }

    /**
     * Standardize ceiling height
     */
    standardizeCeiling(ceiling) {
        if (!ceiling) return null;
        return ceiling; // Already in feet AGL
    }

    /**
     * Standardize wind speed (m/s to knots)
     */
    standardizeWindSpeed(windSpeed) {
        if (!windSpeed) return null;
        
        // If already in knots, return as is
        if (windSpeed < 50) return windSpeed;
        
        // Convert m/s to knots
        return windSpeed * 1.94384;
    }

    /**
     * Extract turbulence level from PIREP
     */
    extractTurbulence(rawOb) {
        if (!rawOb) return null;
        
        const turbulenceKeywords = {
            light: ['light turbulence', 'lt turb'],
            moderate: ['moderate turbulence', 'mod turb'],
            severe: ['severe turbulence', 'sev turb']
        };

        const text = rawOb.toLowerCase();
        for (const [level, keywords] of Object.entries(turbulenceKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return level;
            }
        }
        return null;
    }

    /**
     * Extract icing level from PIREP
     */
    extractIcing(rawOb) {
        if (!rawOb) return null;
        
        const icingKeywords = {
            trace: ['trace icing', 'tr ice'],
            light: ['light icing', 'lt ice'],
            moderate: ['moderate icing', 'mod ice'],
            severe: ['severe icing', 'sev ice']
        };

        const text = rawOb.toLowerCase();
        for (const [level, keywords] of Object.entries(icingKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return level;
            }
        }
        return null;
    }

    /**
     * Extract keywords from AFD
     */
    extractAFDKeywords(afdText) {
        if (!afdText) return [];
        
        const keywords = ['ifr', 'convection', 'low ceiling', 'turbulence', 'icing', 'fog', 'thunderstorm'];
        const foundKeywords = [];
        
        const text = afdText.toLowerCase();
        keywords.forEach(keyword => {
            if (text.includes(keyword)) {
                foundKeywords.push(keyword);
            }
        });
        
        return foundKeywords;
    }

    /**
     * Calculate individual risk scores for each parameter
     */
    calculateIndividualRisks(processedData) {
        const risks = {
            visibility: 0,
            ceiling: 0,
            wind: 0,
            temperature: 0,
            turbulence: 0,
            icing: 0,
            sigmet: 0,
            afd: 0
        };

        // Calculate visibility risk
        if (processedData.metar.length > 0) {
            const avgVisibility = processedData.metar.reduce((sum, metar) => 
                sum + (metar.visibility || 0), 0) / processedData.metar.length;
            risks.visibility = this.calculateVisibilityRisk(avgVisibility);
        }

        // Calculate ceiling risk
        if (processedData.metar.length > 0) {
            const avgCeiling = processedData.metar.reduce((sum, metar) => 
                sum + (metar.ceiling || 0), 0) / processedData.metar.length;
            risks.ceiling = this.calculateCeilingRisk(avgCeiling);
        }

        // Calculate wind risk
        if (processedData.metar.length > 0) {
            const maxWind = Math.max(...processedData.metar.map(metar => 
                Math.max(metar.windSpeed || 0, metar.windGust || 0)));
            risks.wind = this.calculateWindRisk(maxWind);
        }

        // Calculate temperature risk (fog risk)
        if (processedData.metar.length > 0) {
            const tempSpread = processedData.metar.reduce((sum, metar) => 
                sum + Math.abs((metar.temperature || 0) - (metar.dewpoint || 0)), 0) / processedData.metar.length;
            risks.temperature = this.calculateTemperatureRisk(tempSpread);
        }

        // Calculate turbulence risk
        if (processedData.pirep.length > 0) {
            const turbulenceLevels = processedData.pirep.map(pirep => pirep.turbulence).filter(Boolean);
            risks.turbulence = this.calculateTurbulenceRisk(turbulenceLevels);
        }

        // Calculate icing risk
        if (processedData.pirep.length > 0) {
            const icingLevels = processedData.pirep.map(pirep => pirep.icing).filter(Boolean);
            risks.icing = this.calculateIcingRisk(icingLevels);
        }

        // Calculate SIGMET risk (always high if present)
        risks.sigmet = processedData.sigmet.length > 0 ? 100 : 0;

        // Calculate AFD risk
        if (processedData.afd.length > 0) {
            const allKeywords = processedData.afd.flatMap(afd => afd.keywords);
            risks.afd = this.calculateAFDRisk(allKeywords);
        }

        return risks;
    }

    /**
     * Calculate visibility risk score
     */
    calculateVisibilityRisk(visibility) {
        if (visibility >= this.thresholds.visibility.safe) return 0;
        if (visibility >= this.thresholds.visibility.caution) return 30;
        return 80;
    }

    /**
     * Calculate ceiling risk score
     */
    calculateCeilingRisk(ceiling) {
        if (ceiling >= this.thresholds.ceiling.safe) return 0;
        if (ceiling >= this.thresholds.ceiling.caution) return 40;
        return 90;
    }

    /**
     * Calculate wind risk score
     */
    calculateWindRisk(windSpeed) {
        if (windSpeed >= this.thresholds.wind.hazard) return 100;
        if (windSpeed >= this.thresholds.wind.caution) return 50;
        return 0;
    }

    /**
     * Calculate temperature risk score (fog risk)
     */
    calculateTemperatureRisk(tempSpread) {
        if (tempSpread <= this.thresholds.temperature.fogRisk) return 70;
        return 0;
    }

    /**
     * Calculate turbulence risk score
     */
    calculateTurbulenceRisk(turbulenceLevels) {
        if (turbulenceLevels.includes('severe')) return 100;
        if (turbulenceLevels.includes('moderate')) return 60;
        if (turbulenceLevels.includes('light')) return 20;
        return 0;
    }

    /**
     * Calculate icing risk score
     */
    calculateIcingRisk(icingLevels) {
        if (icingLevels.includes('severe') || icingLevels.includes('moderate')) return 100;
        if (icingLevels.includes('light') || icingLevels.includes('trace')) return 40;
        return 0;
    }

    /**
     * Calculate AFD risk score
     */
    calculateAFDRisk(keywords) {
        if (keywords.length === 0) return 0;
        
        const riskKeywords = ['ifr', 'convection', 'low ceiling', 'turbulence', 'icing'];
        const highRiskKeywords = ['thunderstorm', 'severe weather'];
        
        let riskScore = keywords.length * 10;
        
        if (keywords.some(keyword => highRiskKeywords.includes(keyword))) {
            riskScore += 30;
        }
        
        return Math.min(riskScore, 80);
    }

    /**
     * Calculate overall risk score
     */
    calculateOverallRisk(individualRisks) {
        const weights = {
            visibility: 0.20,
            ceiling: 0.20,
            wind: 0.15,
            temperature: 0.10,
            turbulence: 0.15,
            icing: 0.10,
            sigmet: 0.05,
            afd: 0.05
        };

        let overallRisk = 0;
        for (const [parameter, risk] of Object.entries(individualRisks)) {
            overallRisk += risk * (weights[parameter] || 0);
        }

        return Math.round(overallRisk);
    }

    /**
     * Categorize risk into bands
     */
    categorizeRisk(riskScore) {
        for (const [bandName, band] of Object.entries(this.riskBands)) {
            if (riskScore >= band.min && riskScore <= band.max) {
                return { ...band, bandName };
            }
        }
        return this.riskBands.low;
    }

    /**
     * Get specific recommendations based on risk category and individual risks
     */
    getRecommendations(riskCategory, individualRisks) {
        const recommendations = [];

        // General recommendation based on risk category
        recommendations.push({
            type: 'general',
            priority: 'high',
            message: riskCategory.action,
            category: riskCategory.label
        });

        // Specific recommendations based on individual risks
        if (individualRisks.visibility > 50) {
            recommendations.push({
                type: 'visibility',
                priority: 'high',
                message: 'Low visibility conditions detected. Consider instrument approach procedures.',
                category: 'Visibility Risk'
            });
        }

        if (individualRisks.ceiling > 50) {
            recommendations.push({
                type: 'ceiling',
                priority: 'high',
                message: 'Low ceiling conditions. Monitor for approach minimums.',
                category: 'Ceiling Risk'
            });
        }

        if (individualRisks.wind > 50) {
            recommendations.push({
                type: 'wind',
                priority: 'medium',
                message: 'High wind conditions. Review crosswind limits and runway selection.',
                category: 'Wind Risk'
            });
        }

        if (individualRisks.turbulence > 50) {
            recommendations.push({
                type: 'turbulence',
                priority: 'medium',
                message: 'Turbulence reported. Secure loose items and prepare for rough air.',
                category: 'Turbulence Risk'
            });
        }

        if (individualRisks.icing > 50) {
            recommendations.push({
                type: 'icing',
                priority: 'high',
                message: 'Icing conditions reported. Ensure anti-ice systems are operational.',
                category: 'Icing Risk'
            });
        }

        if (individualRisks.sigmet > 0) {
            recommendations.push({
                type: 'sigmet',
                priority: 'critical',
                message: 'SIGMET active. Severe weather conditions. Consider flight cancellation.',
                category: 'SIGMET Alert'
            });
        }

        return recommendations;
    }

    /**
     * Get risk assessment for dashboard display
     */
    async getDashboardRiskAssessment(stations) {
        const riskAssessment = await this.calculateRiskScore(stations);
        
        return {
            riskScore: riskAssessment.overallRisk,
            riskLevel: riskAssessment.riskCategory.label,
            riskColor: riskAssessment.riskCategory.color,
            recommendations: riskAssessment.recommendations,
            needsAttention: riskAssessment.overallRisk >= 46, // Amber-High and above
            timestamp: riskAssessment.timestamp
        };
    }
}

module.exports = AviationRiskScoringService;
