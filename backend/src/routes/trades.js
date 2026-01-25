const express = require('express');
const { z } = require('zod');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { ensureAccount } = require('../lib/accounts');
const { getQuote } = require('../lib/finnhub');
const { getTrades, insertSnapshot } = require('../lib/portfolio');
const { buildPortfolioState } = require('../lib/portfolioService');
const { roundMoney, roundShares, toNumber } = require('../lib/finance');

const router = express.Router();

const symbolRegex = /^[A-Z0-9.\-]{1,10}$/;

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const trades = await getTrades(req.user.id);
    return res.json({ trades });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      symbol: z.string().trim().min(1).max(10).transform((value) => value.toUpperCase()),
      side: z.enum(['BUY', 'SELL']),
      quantity: z.coerce.number().positive(),
    });

    const payload = schema.parse(req.body);

    if (!symbolRegex.test(payload.symbol)) {
      return res.status(400).json({ error: 'Invalid symbol.' });
    }

    const userId = req.user.id;
    const account = await ensureAccount(userId);

    const quote = await getQuote(payload.symbol);
    if (!quote || !quote.current || quote.current <= 0) {
      return res.status(400).json({ error: 'Quote unavailable for symbol.' });
    }

    const quantity = roundShares(payload.quantity);
    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity too small.' });
    }
    const price = roundMoney(toNumber(quote.current));
    const notional = roundMoney(price * quantity);

    const { data: existingPosition, error: positionError } = await supabaseAdmin
      .from('positions')
      .select('id, shares, avg_cost')
      .eq('user_id', userId)
      .eq('symbol', payload.symbol)
      .maybeSingle();

    if (positionError) {
      throw positionError;
    }

    const existingShares = existingPosition ? toNumber(existingPosition.shares) : 0;
    const existingAvgCost = existingPosition ? toNumber(existingPosition.avg_cost) : 0;

    if (payload.side === 'BUY') {
      if (account.cash_balance < notional) {
        return res.status(400).json({ error: 'Insufficient cash balance.' });
      }

      const updatedCash = roundMoney(account.cash_balance - notional);
      const updatedShares = roundShares(existingShares + quantity);
      const updatedAvgCost = roundMoney(
        (existingShares * existingAvgCost + quantity * price) / updatedShares
      );

      // In production, move this logic into a DB transaction or stored procedure.
      const { error: cashError } = await supabaseAdmin
        .from('accounts')
        .update({ cash_balance: updatedCash })
        .eq('user_id', userId);

      if (cashError) {
        throw cashError;
      }

      if (existingPosition) {
        const { error: updateError } = await supabaseAdmin
          .from('positions')
          .update({
            shares: updatedShares,
            avg_cost: updatedAvgCost,
          })
          .eq('id', existingPosition.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabaseAdmin
          .from('positions')
          .insert({
            user_id: userId,
            symbol: payload.symbol,
            shares: updatedShares,
            avg_cost: updatedAvgCost,
          });

        if (insertError) {
          throw insertError;
        }
      }
    } else {
      if (!existingPosition || existingShares < quantity) {
        return res.status(400).json({ error: 'Insufficient shares to sell.' });
      }

      const updatedCash = roundMoney(account.cash_balance + notional);
      const updatedShares = roundShares(existingShares - quantity);

      const { error: cashError } = await supabaseAdmin
        .from('accounts')
        .update({ cash_balance: updatedCash })
        .eq('user_id', userId);

      if (cashError) {
        throw cashError;
      }

      if (updatedShares <= 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('positions')
          .delete()
          .eq('id', existingPosition.id);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const { error: updateError } = await supabaseAdmin
          .from('positions')
          .update({
            shares: updatedShares,
          })
          .eq('id', existingPosition.id);

        if (updateError) {
          throw updateError;
        }
      }
    }

    const { data: trade, error: tradeError } = await supabaseAdmin
      .from('trades')
      .insert({
        user_id: userId,
        symbol: payload.symbol,
        side: payload.side,
        quantity,
        price,
      })
      .select('id, user_id, symbol, side, quantity, price, executed_at')
      .single();

    if (tradeError) {
      throw tradeError;
    }

    const { summary } = await buildPortfolioState({
      userId,
      cashBalance:
        payload.side === 'BUY'
          ? account.cash_balance - notional
          : account.cash_balance + notional,
    });

    await insertSnapshot(userId, summary.netWorth);

    return res.status(201).json({
      trade: {
        ...trade,
        quantity: toNumber(trade.quantity),
        price: toNumber(trade.price),
      },
      summary,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
