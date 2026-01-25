const { supabaseAdmin } = require('./supabase');

async function getWatchlistItems(userId) {
  const { data, error } = await supabaseAdmin
    .from('watchlist_items')
    .select('id, user_id, symbol, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

async function upsertWatchlistItem(userId, symbol) {
  const { data, error } = await supabaseAdmin
    .from('watchlist_items')
    .upsert(
      { user_id: userId, symbol },
      { onConflict: 'user_id,symbol' }
    )
    .select('id, user_id, symbol, created_at')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function removeWatchlistItem(userId, symbol) {
  const { error } = await supabaseAdmin
    .from('watchlist_items')
    .delete()
    .eq('user_id', userId)
    .eq('symbol', symbol);

  if (error) {
    throw error;
  }
}

module.exports = {
  getWatchlistItems,
  upsertWatchlistItem,
  removeWatchlistItem,
};
