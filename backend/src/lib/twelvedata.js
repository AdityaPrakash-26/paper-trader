const NodeCache = require('node-cache');
const { config } = require('../config');

const cache = new NodeCache({ stdTTL: config.candleCacheTtlSeconds });

/**
 * Twelve Data API integration for free historical stock data
 * Docs: https://twelvedata.com/docs
 * 
 * Free tier includes:
 * - 800 API credits/day
 * - End of day data
 * - 8 API requests/minute
 */

function buildUrl(path, params = {}) {
  if (!config.twelveDataApiKey) {
    throw new Error('Twelve Data API key is missing.');
  }
  const baseUrl = config.twelveDataBaseUrl.endsWith('/') 
    ? config.twelveDataBaseUrl 
    : `${config.twelveDataBaseUrl}/`;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(cleanPath, baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set('apikey', config.twelveDataApiKey);
  return url;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Twelve Data error ${response.status}: ${text}`);
    error.status = response.status;
    error.isUpstream = true;
    throw error;
  }
  const data = await response.json();
  
  // Check for API error in response body
  if (data.status === 'error') {
    const error = new Error(data.message || 'Twelve Data API error');
    error.status = 400;
    error.isUpstream = true;
    throw error;
  }
  
  return data;
}

/**
 * Get historical time series data from Twelve Data
 * @param {Object} options
 * @param {string} options.symbol - Stock symbol (e.g., 'AAPL')
 * @param {string} options.interval - Interval: 1day, 1week, 1month
 * @param {number} options.outputsize - Number of data points (default 30, max 5000)
 * @returns {Promise<Object>} Candle data in Finnhub-compatible format
 */
async function getTimeSeries({ symbol, interval = '1day', outputsize = 100 }) {
  const cacheKey = `twelvedata:${symbol}:${interval}:${outputsize}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const url = buildUrl('/time_series', {
    symbol,
    interval,
    outputsize,
  });

  const data = await fetchJson(url);

  if (!data.values || data.values.length === 0) {
    return {
      symbol,
      status: 'no_data',
      timestamps: [],
      open: [],
      high: [],
      low: [],
      close: [],
      volume: [],
    };
  }

  // Convert Twelve Data format to Finnhub-compatible format
  // Twelve Data returns newest first, so we reverse for chronological order
  const values = data.values.reverse();
  
  const candles = {
    symbol,
    status: 'ok',
    timestamps: values.map(v => Math.floor(new Date(v.datetime).getTime() / 1000)),
    open: values.map(v => parseFloat(v.open)),
    high: values.map(v => parseFloat(v.high)),
    low: values.map(v => parseFloat(v.low)),
    close: values.map(v => parseFloat(v.close)),
    volume: values.map(v => parseInt(v.volume || 0, 10)),
  };

  cache.set(cacheKey, candles, config.candleCacheTtlSeconds);
  return candles;
}

/**
 * Check if Twelve Data is configured
 */
function isConfigured() {
  return !!config.twelveDataApiKey;
}

module.exports = {
  getTimeSeries,
  isConfigured,
};
