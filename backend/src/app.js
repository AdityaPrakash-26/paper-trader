const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { ZodError } = require('zod');
const { config } = require('./config');
const marketRoutes = require('./routes/market');
const tradesRoutes = require('./routes/trades');
const portfolioRoutes = require('./routes/portfolio');

const app = express();

const corsOrigin = config.corsOrigin.split(',').map((origin) => origin.trim());

app.use(helmet());
app.use(
  cors({
    origin: corsOrigin.includes('*') ? '*' : corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/market', marketRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/portfolio', portfolioRoutes);

app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Invalid request.', details: err.errors });
  }

  if (err?.isUpstream) {
    const status = err.status && Number.isFinite(err.status) ? 502 : 502;
    return res.status(status).json({ error: err.message });
  }

  const status = err?.status || err?.statusCode;
  if (status && Number.isFinite(status) && status >= 400 && status < 500) {
    return res.status(status).json({ error: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: 'Internal server error.' });
});

module.exports = { app };
