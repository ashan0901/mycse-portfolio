create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movement_type text not null check (movement_type in ('DEPOSIT','WITHDRAWAL','ADJUSTMENT')),
  movement_date date not null,
  amount numeric(18,4) not null check (amount > 0),
  reference text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cash_movements_user_date on cash_movements(user_id, movement_date);

alter table cash_movements enable row level security;
drop policy if exists "own cash movements" on cash_movements;
create policy "own cash movements" on cash_movements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
