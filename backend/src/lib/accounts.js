const { supabaseAdmin } = require('./supabase');
const { config } = require('../config');
const { toNumber, roundMoney } = require('./finance');

async function getAccount(userId) {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('id, user_id, cash_balance, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    cash_balance: toNumber(data.cash_balance),
  };
}

async function ensureAccount(userId) {
  const account = await getAccount(userId);
  if (account) {
    return account;
  }

  const { data, error } = await supabaseAdmin
    .from('accounts')
    .insert({
      user_id: userId,
      cash_balance: roundMoney(config.defaultCashBalance),
    })
    .select('id, user_id, cash_balance, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      const existing = await getAccount(userId);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }

  return {
    ...data,
    cash_balance: toNumber(data.cash_balance),
  };
}

module.exports = {
  getAccount,
  ensureAccount,
};
