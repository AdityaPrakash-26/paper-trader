const { createClient } = require('@supabase/supabase-js');
const { config } = require('../config');

const supabaseAdmin = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'paper-trader-backend',
      },
    },
  }
);

module.exports = { supabaseAdmin };
