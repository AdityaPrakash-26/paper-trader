const express = require('express');
const { z } = require('zod');
const { getQuote, getCandles, getFundamentals, getBasicFinancials, searchSymbols } = require('../lib/finnhub');
const twelveData = require('../lib/twelvedata');
const { getQuotes } = require('../lib/quotes');
const { openFinnhubStream } = require('../lib/stream');
const { config } = require('../config');

const router = express.Router();
const symbolRegex = /^[A-Z0-9.\-]{1,10}$/;

router.get('/quote', async (req, res, next) => {
  try {
    const schema = z.object({
      symbol: z.string().min(1).max(10).transform((value) => value.toUpperCase()),
    });

    const { symbol } = schema.parse(req.query);
    if (!symbolRegex.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol.' });
    }
    const quote = await getQuote(symbol);
    return res.json(quote);
  } catch (err) {
    return next(err);
  }
});

router.get('/quotes', async (req, res, next) => {
  try {
    const schema = z.object({
      symbols: z.string().min(1),
    });

    const { symbols } = schema.parse(req.query);
    const symbolList = symbols
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);

    if (symbolList.length === 0) {
      return res.status(400).json({ error: 'No symbols provided.' });
    }

    const invalid = symbolList.find((symbol) => !symbolRegex.test(symbol));
    if (invalid) {
      return res.status(400).json({ error: `Invalid symbol: ${invalid}` });
    }

    const quotesBySymbol = await getQuotes(symbolList);
    const quotes = symbolList
      .map((symbol) => quotesBySymbol[symbol])
      .filter(Boolean);

    return res.json({ quotes });
  } catch (err) {
    return next(err);
  }
});

router.get('/candles', async (req, res, next) => {
  try {
    const schema = z.object({
      symbol: z.string().min(1).max(10).transform((value) => value.toUpperCase()),
      resolution: z.union([z.string(), z.coerce.number()]),
      from: z.coerce.number().int().min(0),
      to: z.coerce.number().int().min(0),
    });

    const { symbol, resolution, from, to } = schema.parse(req.query);
    if (!symbolRegex.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol.' });
    }
    const normalizedResolution = String(resolution).toUpperCase();
    const allowed = new Set(['1', '5', '15', '30', '60', 'D', 'W', 'M']);
    if (!allowed.has(normalizedResolution)) {
      return res.status(400).json({ error: 'Invalid resolution.' });
    }

    if (from >= to) {
      return res.status(400).json({ error: 'Invalid time range.' });
    }

    // Use Twelve Data for historical data (free)
    if (!twelveData.isConfigured()) {
      return res.status(503).json({ 
        error: 'Historical data is not available. Please configure Twelve Data API key.' 
      });
    }

    try {
      // Map Finnhub resolution to Twelve Data interval
      const intervalMap = {
        '1': '1min',
        '5': '5min',
        '15': '15min',
        '30': '30min',
        '60': '1h',
        'D': '1day',
        'W': '1week',
        'M': '1month',
      };
      const interval = intervalMap[normalizedResolution] || '1day';
      
      // Calculate approximate number of data points needed
      const timeRangeSeconds = to - from;
      const intervalSeconds = {
        '1min': 60,
        '5min': 300,
        '15min': 900,
        '30min': 1800,
        '1h': 3600,
        '1day': 86400,
        '1week': 604800,
        '1month': 2592000,
      };
      const outputsize = Math.min(
        Math.ceil(timeRangeSeconds / intervalSeconds[interval]) + 10,
        5000
      );
      
      const candles = await twelveData.getTimeSeries({
        symbol,
        interval,
        outputsize,
      });
      
      return res.json({
        ...candles,
        resolution: normalizedResolution,
        from,
        to,
      });
    } catch (err) {
      console.error('Twelve Data error:', err.message);
      return res.status(err.status || 502).json({ 
        error: 'Failed to fetch historical data: ' + err.message 
      });
    }
  } catch (err) {
    return next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const schema = z.object({
      q: z.string().optional(),
      query: z.string().optional(),
    });

    const { q, query } = schema.parse(req.query);
    const term = (q || query || '').trim();

    if (!term) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    const results = await searchSymbols(term);
    return res.json(results);
  } catch (err) {
    return next(err);
  }
});

router.get('/fundamentals', async (req, res, next) => {
  try {
    const schema = z.object({
      symbol: z.string().min(1).max(10).transform((value) => value.toUpperCase()),
    });

    const { symbol } = schema.parse(req.query);
    if (!symbolRegex.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol.' });
    }

    const fundamentals = await getFundamentals(symbol);
    return res.json(fundamentals);
  } catch (err) {
    return next(err);
  }
});

// Basic financials endpoint - provides key metrics like 52-week high/low, beta, P/E ratio, etc.
router.get('/metrics', async (req, res, next) => {
  try {
    const schema = z.object({
      symbol: z.string().min(1).max(10).transform((value) => value.toUpperCase()),
    });

    const { symbol } = schema.parse(req.query);
    if (!symbolRegex.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol.' });
    }

    const metrics = await getBasicFinancials(symbol);
    return res.json(metrics);
  } catch (err) {
    return next(err);
  }
});

router.get('/stream', async (req, res, next) => {
  try {
    if (!config.finnhubApiKey || !config.finnhubWsUrl) {
      return res.status(500).json({ error: 'Finnhub WebSocket not configured.' });
    }

    const schema = z.object({
      symbol: z.string().min(1).max(10).transform((value) => value.toUpperCase()),
    });
    const { symbol } = schema.parse(req.query);

    if (!symbolRegex.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const { ws, subscribe, unsubscribe } = openFinnhubStream([symbol]);

    const heartbeat = setInterval(() => {
      if (res.writableEnded) return;
      res.write(': ping\n\n');
    }, 25000);

    ws.on('open', () => {
      subscribe();
    });

    ws.on('message', (message) => {
      if (res.writableEnded) return;
      res.write(`data: ${message.toString()}\n\n`);
    });

    ws.on('error', (err) => {
      if (res.writableEnded) return;
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    });

    ws.on('close', () => {
      if (res.writableEnded) return;
      res.write('event: done\ndata: {}\n\n');
    });

    req.on('close', () => {
      clearInterval(heartbeat);
      try {
        unsubscribe();
        ws.close();
      } catch (err) {
        // ignore
      }
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
