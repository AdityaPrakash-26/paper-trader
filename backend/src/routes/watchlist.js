const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { getQuotes } = require('../lib/quotes');
const {
  getWatchlistItems,
  upsertWatchlistItem,
  removeWatchlistItem,
} = require('../lib/watchlist');

const router = express.Router();
const symbolRegex = /^[A-Z0-9.\-]{1,10}$/;

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const includeQuotes =
      String(req.query.quotes ?? req.query.includeQuotes ?? 'true').toLowerCase() !== 'false';
    const items = await getWatchlistItems(req.user.id);

    let quotes = [];
    if (includeQuotes && items.length > 0) {
      try {
        const quotesBySymbol = await getQuotes(items.map((item) => item.symbol));
        quotes = items
          .map((item) => quotesBySymbol[item.symbol])
          .filter(Boolean);
      } catch (err) {
        console.error('Watchlist quotes error:', err.message || err);
      }
    }

    return res.json({ items, quotes });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      symbol: z.string().trim().min(1).max(10).transform((value) => value.toUpperCase()),
    });

    const { symbol } = schema.parse(req.body);
    if (!symbolRegex.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol.' });
    }

    const item = await upsertWatchlistItem(req.user.id, symbol);
    const quotesBySymbol = await getQuotes([symbol]);

    return res.status(201).json({
      item,
      quote: quotesBySymbol[symbol] || null,
    });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:symbol', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      symbol: z.string().trim().min(1).max(10).transform((value) => value.toUpperCase()),
    });
    const { symbol } = schema.parse(req.params);

    if (!symbolRegex.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol.' });
    }

    await removeWatchlistItem(req.user.id, symbol);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
