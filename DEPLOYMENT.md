# Deployment Guide (Vercel + Supabase)

This project deploys as two Vercel projects: one for the Express API (`backend/`) and one for the Next.js app (`frontend/`). Supabase hosts Postgres + Auth.

## Prerequisites
- Supabase project created
- Finnhub API key
- Vercel account
- Node.js 18+ for local builds

## Supabase Setup
1. In the Supabase SQL editor, run `backend/db/migrations/001_init.sql`.
2. In Supabase Auth settings:
   - Set the Site URL to your frontend domain (or `http://localhost:3000` for local).
   - Add redirect URLs for your Vercel frontend domains if needed.

## Backend (Express API) on Vercel
1. Create a new Vercel project.
2. Set the **Root Directory** to `backend/`.
3. Environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FINNHUB_API_KEY`
   - `CORS_ORIGIN` (set to your frontend URL, e.g. `https://your-frontend.vercel.app`)
   - Optional: `DEFAULT_CASH_BALANCE`, `QUOTE_CACHE_TTL_SECONDS`, `CANDLE_CACHE_TTL_SECONDS`, `PORTFOLIO_SNAPSHOT_MINUTES`
4. Deploy.

Notes:
- Vercel uses `backend/api/index.js` as the serverless entry point.
- `backend/vercel.json` rewrites all requests to the Express app.

## Frontend (Next.js) on Vercel
1. Create a new Vercel project.
2. Set the **Root Directory** to `frontend/`.
3. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_BASE_URL` (your deployed backend URL)
4. Deploy.

## Post-Deploy Checklist
- Update Supabase Auth Site URL to your production frontend URL.
- Add production and preview URLs to Supabase Auth redirect allowlist.
- Verify CORS: `CORS_ORIGIN` on backend matches the deployed frontend URL.
- Test auth, market data, and trades end-to-end.
