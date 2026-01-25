const express = require('express');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');
const { ensureAccount } = require('../lib/accounts');
const { buildPortfolioState } = require('../lib/portfolioService');
const { getLatestSnapshot, insertSnapshot, getSnapshots } = require('../lib/portfolio');
const { roundMoney } = require('../lib/finance');
const { config } = require('../config');

const router = express.Router();

function resolveRange(range) {
  const now = new Date();
  const start = new Date(now);

  switch (range) {
    case '1W':
      start.setDate(now.getDate() - 7);
      return start;
    case '1M':
      start.setMonth(now.getMonth() - 1);
      return start;
    case '6M':
      start.setMonth(now.getMonth() - 6);
      return start;
    case 'YTD':
      return new Date(now.getFullYear(), 0, 1);
    case '1Y':
      start.setFullYear(now.getFullYear() - 1);
      return start;
    case 'MAX':
      return null;
    default:
      return null;
  }
}

async function maybeCreateSnapshot(userId, netWorth) {
  const latest = await getLatestSnapshot(userId);
  if (!latest) {
    return insertSnapshot(userId, netWorth);
  }

  const lastTimestamp = new Date(latest.timestamp).getTime();
  const ageMinutes = (Date.now() - lastTimestamp) / (1000 * 60);

  if (ageMinutes >= config.snapshotEveryMinutes) {
    return insertSnapshot(userId, netWorth);
  }

  return latest;
}

router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const account = await ensureAccount(req.user.id);
    const { holdings, summary } = await buildPortfolioState({
      userId: req.user.id,
      cashBalance: account.cash_balance,
    });

    await maybeCreateSnapshot(req.user.id, summary.netWorth);

    return res.json({
      cashBalance: roundMoney(account.cash_balance),
      holdingsValue: summary.holdingsValue,
      netWorth: summary.netWorth,
      dailyChange: summary.dailyChange,
      dailyChangePercent: summary.dailyChangePercent,
      holdings,
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/holdings', requireAuth, async (req, res, next) => {
  try {
    const account = await ensureAccount(req.user.id);
    const { holdings } = await buildPortfolioState({
      userId: req.user.id,
      cashBalance: account.cash_balance,
    });

    return res.json({ holdings });
  } catch (err) {
    return next(err);
  }
});

router.get('/snapshots', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      range: z.string().optional(),
    });
    const { range } = schema.parse(req.query);
    const normalized = (range || '1M').toUpperCase();
    const from = resolveRange(normalized);

    if (!from && normalized !== 'MAX') {
      return res.status(400).json({ error: 'Invalid range.' });
    }

    const snapshots = await getSnapshots(req.user.id, from || undefined);

    if (snapshots.length === 0) {
      const account = await ensureAccount(req.user.id);
      const { summary } = await buildPortfolioState({
        userId: req.user.id,
        cashBalance: account.cash_balance,
      });

      const created = await insertSnapshot(req.user.id, summary.netWorth);
      snapshots.push(created);
    }

    return res.json({ snapshots });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
