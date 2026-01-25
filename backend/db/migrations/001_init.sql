-- Enable extensions needed for UUID generation.
create extension if not exists "pgcrypto";

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cash_balance numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('BUY', 'SELL')),
  quantity numeric(18, 4) not null check (quantity > 0),
  price numeric(18, 4) not null check (price > 0),
  executed_at timestamptz not null default now()
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  shares numeric(18, 4) not null check (shares >= 0),
  avg_cost numeric(18, 4) not null check (avg_cost >= 0),
  unique (user_id, symbol)
);

create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  net_worth numeric(18, 2) not null,
  timestamp timestamptz not null default now()
);

create index if not exists idx_accounts_user_id on public.accounts(user_id);
create index if not exists idx_trades_user_id on public.trades(user_id);
create index if not exists idx_trades_symbol on public.trades(symbol);
create index if not exists idx_positions_user_id on public.positions(user_id);
create index if not exists idx_positions_symbol on public.positions(symbol);
create index if not exists idx_snapshots_user_id on public.portfolio_snapshots(user_id);
create index if not exists idx_snapshots_timestamp on public.portfolio_snapshots(timestamp);

alter table public.accounts enable row level security;
alter table public.trades enable row level security;
alter table public.positions enable row level security;
alter table public.portfolio_snapshots enable row level security;

create policy "Accounts can be read by owner"
  on public.accounts for select
  using (auth.uid() = user_id);

create policy "Accounts can be inserted by owner"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "Accounts can be updated by owner"
  on public.accounts for update
  using (auth.uid() = user_id);

create policy "Trades can be read by owner"
  on public.trades for select
  using (auth.uid() = user_id);

create policy "Trades can be inserted by owner"
  on public.trades for insert
  with check (auth.uid() = user_id);

create policy "Positions can be read by owner"
  on public.positions for select
  using (auth.uid() = user_id);

create policy "Positions can be inserted by owner"
  on public.positions for insert
  with check (auth.uid() = user_id);

create policy "Positions can be updated by owner"
  on public.positions for update
  using (auth.uid() = user_id);

create policy "Positions can be deleted by owner"
  on public.positions for delete
  using (auth.uid() = user_id);

create policy "Snapshots can be read by owner"
  on public.portfolio_snapshots for select
  using (auth.uid() = user_id);

create policy "Snapshots can be inserted by owner"
  on public.portfolio_snapshots for insert
  with check (auth.uid() = user_id);
