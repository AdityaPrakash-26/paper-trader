const NodeCache = require('node-cache');
const { config } = require('../config');

const cache = new NodeCache({ stdTTL: config.quoteCacheTtlSeconds });

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Finnhub error ${response.status}: ${text}`);
  }
  return response.json();
}

async function getQuote(symbol) {
  const cacheKey = `quote:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const url = new URL('https://finnhub.io/api/v1/quote');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('token', config.finnhubApiKey);

  const data = await fetchJson(url.toString());

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

  const url = new URL('https://finnhub.io/api/v1/stock/candle');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('resolution', String(resolution));
  url.searchParams.set('from', String(from));
  url.searchParams.set('to', String(to));
  url.searchParams.set('token', config.finnhubApiKey);

  const data = await fetchJson(url.toString());
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

module.exports = {
  getQuote,
  getCandles,
};
