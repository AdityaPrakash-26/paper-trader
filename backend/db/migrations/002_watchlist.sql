create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (char_length(symbol) > 0 and char_length(symbol) <= 10),
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists idx_watchlist_user_id on public.watchlist_items(user_id);
create index if not exists idx_watchlist_symbol on public.watchlist_items(symbol);

alter table public.watchlist_items enable row level security;

create policy "Watchlist readable by owner"
  on public.watchlist_items for select
  using (auth.uid() = user_id);

create policy "Watchlist insertable by owner"
  on public.watchlist_items for insert
  with check (auth.uid() = user_id);

create policy "Watchlist deletable by owner"
  on public.watchlist_items for delete
  using (auth.uid() = user_id);
