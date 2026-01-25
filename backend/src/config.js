const dotenv = require('dotenv');

dotenv.config();

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FINNHUB_API_KEY',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseNumber(process.env.PORT, 4000),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  finnhubApiKey: process.env.FINNHUB_API_KEY,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  defaultCashBalance: parseNumber(process.env.DEFAULT_CASH_BALANCE, 100000),
  quoteCacheTtlSeconds: parseNumber(process.env.QUOTE_CACHE_TTL_SECONDS, 15),
  candleCacheTtlSeconds: parseNumber(process.env.CANDLE_CACHE_TTL_SECONDS, 300),
  snapshotEveryMinutes: parseNumber(process.env.PORTFOLIO_SNAPSHOT_MINUTES, 60),
};

module.exports = { config };
