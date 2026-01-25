const express = require('express');
const { z } = require('zod');
const { getQuote, getCandles } = require('../lib/finnhub');

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

router.get('/candles', async (req, res, next) => {
  try {
    const schema = z.object({
      symbol: z.string().min(1).max(10).transform((value) => value.toUpperCase()),
      resolution: z.coerce.number().int().min(1),
      from: z.coerce.number().int().min(0),
      to: z.coerce.number().int().min(0),
    });

    const { symbol, resolution, from, to } = schema.parse(req.query);
    if (!symbolRegex.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol.' });
    }
    const candles = await getCandles({ symbol, resolution, from, to });
    return res.json(candles);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
