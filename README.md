# Paper Trader MVP

A paper-trading brokerage simulator built with Next.js, Express, Supabase Auth/Postgres, and Finnhub market data.

## Architecture
- Frontend: Next.js app in `frontend/`
- Backend: Express API in `backend/`
- Database/Auth: Supabase Postgres + Auth
- Market data: Finnhub (proxied via backend)

## Local Setup

### 1) Supabase
1. Create a new Supabase project.
2. In the Supabase SQL editor, run the migration:
   - `backend/db/migrations/001_init.sql`
3. In Supabase Auth settings, configure the Site URL to `http://localhost:3000` for local dev.

### 2) Finnhub
Create a Finnhub API key at https://finnhub.io.

### 3) Backend env
Copy `backend/.env.example` to `backend/.env` and fill in values.

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FINNHUB_API_KEY`

### 4) Frontend env
Copy `frontend/.env.example` to `frontend/.env.local` and fill in values.

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL` (usually `http://localhost:4000`)

### 5) Run locally

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

Open http://localhost:3000.

## Deploy (Vercel)

### Backend
1. Create a new Vercel project pointing to `backend/` as the root.
2. Set env vars from `backend/.env.example`.
3. Deploy. The `vercel.json` rewrite sends all requests to the Express app in `backend/api/index.js`.

### Frontend
1. Create a new Vercel project pointing to `frontend/` as the root.
2. Set env vars from `frontend/.env.example`.
3. Update `NEXT_PUBLIC_API_BASE_URL` to the deployed backend URL.
4. Deploy.

## Notes
- The backend creates a portfolio snapshot at least once per hour (and after trades).
- Default virtual cash balance is $100,000. Override via `DEFAULT_CASH_BALANCE`.
- Educational simulation only. Not financial advice.
