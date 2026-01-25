const { supabaseAdmin } = require('./supabase');
const { toNumber, roundMoney, roundShares } = require('./finance');

async function getPositions(userId) {
  const { data, error } = await supabaseAdmin
    .from('positions')
    .select('id, user_id, symbol, shares, avg_cost')
    .eq('user_id', userId)
    .order('symbol', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    ...row,
    shares: toNumber(row.shares),
    avg_cost: toNumber(row.avg_cost),
  }));
}

async function getTrades(userId, limit = 100) {
  const { data, error } = await supabaseAdmin
    .from('trades')
    .select('id, user_id, symbol, side, quantity, price, executed_at')
    .eq('user_id', userId)
    .order('executed_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    ...row,
    quantity: toNumber(row.quantity),
    price: toNumber(row.price),
  }));
}

async function getLatestSnapshot(userId) {
  const { data, error } = await supabaseAdmin
    .from('portfolio_snapshots')
    .select('id, user_id, net_worth, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    net_worth: toNumber(data.net_worth),
  };
}

async function insertSnapshot(userId, netWorth, timestamp = new Date()) {
  const { data, error } = await supabaseAdmin
    .from('portfolio_snapshots')
    .insert({
      user_id: userId,
      net_worth: roundMoney(netWorth),
      timestamp: timestamp.toISOString(),
    })
    .select('id, user_id, net_worth, timestamp')
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    net_worth: toNumber(data.net_worth),
  };
}

async function getSnapshots(userId, fromTimestamp) {
  let query = supabaseAdmin
    .from('portfolio_snapshots')
    .select('id, user_id, net_worth, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: true });

  if (fromTimestamp) {
    query = query.gte('timestamp', fromTimestamp.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    ...row,
    net_worth: toNumber(row.net_worth),
  }));
}

function calculateHoldings(positions, quotesBySymbol) {
  return positions.map((position) => {
    const quote = quotesBySymbol[position.symbol];
    const currentPrice = quote ? toNumber(quote.current) : 0;
    const dailyPercent = quote ? toNumber(quote.percentChange) : 0;
    const marketValue = currentPrice * position.shares;
    const costBasis = position.avg_cost * position.shares;
    const gain = marketValue - costBasis;
    const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

    return {
      symbol: position.symbol,
      shares: roundShares(position.shares),
      avgCost: roundMoney(position.avg_cost),
      currentPrice: roundMoney(currentPrice),
      dailyPercent: roundMoney(dailyPercent),
      marketValue: roundMoney(marketValue),
      gain: roundMoney(gain),
      gainPercent: roundMoney(gainPercent),
    };
  });
}

function calculateNetWorth(cashBalance, holdings, quotesBySymbol) {
  const holdingsValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const netWorth = cashBalance + holdingsValue;

  const dailyChange = holdings.reduce((sum, holding) => {
    const quote = quotesBySymbol[holding.symbol];
    const change = quote ? toNumber(quote.change) : 0;
    return sum + change * holding.shares;
  }, 0);

  const priorNetWorth = netWorth - dailyChange;
  const dailyChangePercent = priorNetWorth > 0 ? (dailyChange / priorNetWorth) * 100 : 0;

  return {
    holdingsValue: roundMoney(holdingsValue),
    netWorth: roundMoney(netWorth),
    dailyChange: roundMoney(dailyChange),
    dailyChangePercent: roundMoney(dailyChangePercent),
  };
}

module.exports = {
  getPositions,
  getTrades,
  getLatestSnapshot,
  insertSnapshot,
  getSnapshots,
  calculateHoldings,
  calculateNetWorth,
};
