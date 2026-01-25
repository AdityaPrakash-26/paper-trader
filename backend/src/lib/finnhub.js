const NodeCache = require('node-cache');
const { config } = require('../config');

const cache = new NodeCache({ stdTTL: config.quoteCacheTtlSeconds });

function buildUrl(path, params = {}) {
  if (!config.finnhubApiKey) {
    throw new Error('Finnhub API key is missing.');
  }
  // Ensure path doesn't have leading slash when concatenating with base URL
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl = config.finnhubBaseUrl.endsWith('/') 
    ? config.finnhubBaseUrl 
    : `${config.finnhubBaseUrl}/`;
  const url = new URL(cleanPath, baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set('token', config.finnhubApiKey);
  return url;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Finnhub error ${response.status}: ${text}`);
    error.status = response.status;
    error.isUpstream = true;
    throw error;
  }
  return response.json();
}

async function fetchFinnhub(path, params = {}) {
  const url = buildUrl(path, params);
  return fetchJson(url);
}

async function getQuote(symbol) {
  const cacheKey = `quote:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await fetchFinnhub('/quote', { symbol });

  const quote = {
    symbol,
    current: data.c,
    change: data.d,
    percentChange: data.dp,
    high: data.h,
    low: data.l,
    open: data.o,
    prevClose: data.pc,
    timestamp: data.t,
  };

  cache.set(cacheKey, quote, config.quoteCacheTtlSeconds);
  return quote;
}

async function getCandles({ symbol, resolution, from, to }) {
  const cacheKey = `candle:${symbol}:${resolution}:${from}:${to}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await fetchFinnhub('/stock/candle', {
    symbol,
    resolution,
    from,
    to,
  });
  const candles = {
    symbol,
    resolution,
    from,
    to,
    status: data.s,
    timestamps: data.t || [],
    open: data.o || [],
    high: data.h || [],
    low: data.l || [],
    close: data.c || [],
    volume: data.v || [],
  };

  cache.set(cacheKey, candles, config.candleCacheTtlSeconds);
  return candles;
}

async function searchSymbols(query) {
  const cleaned = query.trim();
  const normalized = cleaned.toUpperCase();
  const cacheKey = `search:${normalized}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const url = new URL('https://finnhub.io/api/v1/search');
  url.searchParams.set('q', cleaned);
  url.searchParams.set('token', config.finnhubApiKey);

  const data = await fetchJson(url.toString());
  const results = (data.result || []).map((item) => ({
    symbol: item.symbol,
    description: item.description,
    type: item.type,
  }));

  const payload = {
    query: cleaned,
    results,
  };

  cache.set(cacheKey, payload, config.searchCacheTtlSeconds);
  return payload;
}

async function getFundamentals(symbol) {
  const cacheKey = `fundamentals:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await fetchFinnhub('/stock/profile2', { symbol });
  const profile = {
    symbol,
    name: data.name,
    ticker: data.ticker,
    exchange: data.exchange,
    currency: data.currency,
    marketCap: data.marketCapitalization,
    shareOutstanding: data.shareOutstanding,
    ipo: data.ipo,
    country: data.country,
    finnhubIndustry: data.finnhubIndustry,
    weburl: data.weburl,
    logo: data.logo,
  };

  cache.set(cacheKey, profile, config.fundamentalsCacheTtlSeconds);
  return profile;
}

// Basic Financials endpoint - FREE on Finnhub
// Returns key metrics like 52-week high/low, beta, P/E ratio, etc.
async function getBasicFinancials(symbol) {
  const cacheKey = `metrics:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await fetchFinnhub('/stock/metric', { symbol, metric: 'all' });
  const metrics = data.metric || {};
  
  const result = {
    symbol,
    // Valuation metrics
    peRatio: metrics.peBasicExclExtraTTM || metrics.peNormalizedAnnual || null,
    pegRatio: metrics.pegRatio || null,
    pbRatio: metrics.pbAnnual || metrics.pbQuarterly || null,
    psRatio: metrics.psAnnual || metrics.psTTM || null,
    
    // Price metrics
    fiftyTwoWeekHigh: metrics['52WeekHigh'] || null,
    fiftyTwoWeekLow: metrics['52WeekLow'] || null,
    fiftyTwoWeekHighDate: metrics['52WeekHighDate'] || null,
    fiftyTwoWeekLowDate: metrics['52WeekLowDate'] || null,
    fiftyTwoWeekPriceReturn: metrics['52WeekPriceReturnDaily'] || null,
    
    // Risk/volatility
    beta: metrics.beta || null,
    
    // Trading metrics
    tenDayAverageTradingVolume: metrics['10DayAverageTradingVolume'] || null,
    threeMonthAverageTradingVolume: metrics['3MonthAverageTradingVolume'] || null,
    
    // Dividend metrics
    dividendYield: metrics.currentDividendYieldTTM || metrics.dividendYieldIndicatedAnnual || null,
    dividendPerShare: metrics.dividendPerShareAnnual || null,
    
    // Profitability metrics
    epsGrowth: metrics.epsGrowthTTMYoy || null,
    revenueGrowth: metrics.revenueGrowthTTMYoy || null,
    roeTTM: metrics.roeTTM || null,
    roaTTM: metrics.roaTTM || null,
    grossMarginTTM: metrics.grossMarginTTM || null,
    netMarginTTM: metrics.netProfitMarginTTM || null,
    
    // Debt metrics
    debtToEquity: metrics.totalDebt_totalEquityAnnual || null,
    currentRatio: metrics.currentRatioAnnual || null,
    quickRatio: metrics.quickRatioAnnual || null,
    
    // Market cap
    marketCap: metrics.marketCapitalization || null,
    
    // Per share data
    bookValuePerShare: metrics.bookValuePerShareAnnual || null,
    revenuePerShare: metrics.revenuePerShareTTM || null,
    
    // Moving averages
    tenDayEMA: metrics['10DayEMA'] || null,
    fiftyDayMA: metrics['50DaySMA'] || null,
    twoHundredDayMA: metrics['200DaySMA'] || null,
  };

  cache.set(cacheKey, result, config.fundamentalsCacheTtlSeconds);
  return result;
}

module.exports = {
  getQuote,
  getCandles,
  searchSymbols,
  getFundamentals,
  getBasicFinancials,
};
