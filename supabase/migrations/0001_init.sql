drop table if exists transaction_lots cascade;
drop table if exists transactions cascade;
drop table if exists companies cascade;
drop table if exists profiles cascade;

-- Phase 2 schema
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  ticker text not null,
  sector text,
  description text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, ticker)
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('BUY','SELL')),
  transaction_date date not null,
  quantity numeric(18,4) not null check (quantity > 0),
  price_per_share numeric(18,4) not null check (price_per_share >= 0),
  gross_amount numeric(18,4) not null,
  total_fees numeric(18,4) not null default 0,
  net_amount numeric(18,4) not null,
  cost_basis numeric(18,4),
  realized_profit_loss numeric(18,4),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


create table if not exists transaction_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  buy_transaction_id uuid not null references transactions(id) on delete cascade,
  sell_transaction_id uuid references transactions(id) on delete cascade,
  quantity_allocated numeric(18,4) not null,
  allocated_cost numeric(18,4) not null,
  created_at timestamptz default now()
);

create index if not exists idx_companies_user on companies(user_id);
create index if not exists idx_transactions_user_company on transactions(user_id, company_id);
create index if not exists idx_transactions_date on transactions(transaction_date);

alter table profiles enable row level security;
alter table companies enable row level security;
alter table transactions enable row level security;
alter table transaction_lots enable row level security;

drop policy if exists "own profiles" on profiles; create policy "own profiles" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "own companies" on companies; create policy "own companies" on companies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own transactions" on transactions; create policy "own transactions" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own lots" on transaction_lots; create policy "own lots" on transaction_lots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);






