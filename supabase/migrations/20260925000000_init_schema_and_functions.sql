-- =============================================================================
-- 20260925000000_init_schema_and_functions.sql
-- AI US Stock & ETF Portfolio Analytics - Full Initial Schema & RPC Functions
-- =============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Helper: keep `updated_at` fresh on every UPDATE
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. portfolios
-- -----------------------------------------------------------------------------
create table if not exists public.portfolios (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid           not null references auth.users (id) on delete cascade,
  name          text           not null,
  description   text,
  base_currency text           not null default 'USD',
  cash_balance  numeric(20, 4) not null default 0,
  is_default    boolean        not null default false,
  created_at    timestamptz    not null default now(),
  updated_at    timestamptz    not null default now(),

  constraint portfolios_name_not_blank  check (length(btrim(name)) between 1 and 120),
  constraint portfolios_currency_iso   check (base_currency ~ '^[A-Z]{3}$'),
  constraint portfolios_cash_non_neg   check (cash_balance >= 0)
);

comment on table  public.portfolios is 'User owned container for a set of stock / ETF holdings.';
comment on column public.portfolios.cash_balance is 'Uninvested cash, same unit as base_currency.';

create unique index if not exists portfolios_user_name_uidx
  on public.portfolios (user_id, lower(name));

create index if not exists portfolios_user_id_idx
  on public.portfolios (user_id);

create unique index if not exists portfolios_one_default_per_user_uidx
  on public.portfolios (user_id)
  where is_default;

drop trigger if exists portfolios_set_updated_at on public.portfolios;
create trigger portfolios_set_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. assets - one row per ticker held inside a portfolio
-- -----------------------------------------------------------------------------
create table if not exists public.assets (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid           not null references public.portfolios (id) on delete cascade,
  user_id       uuid           not null references auth.users (id) on delete cascade,
  symbol        text           not null,
  name          text           not null,
  asset_type    text           not null default 'stock',
  exchange      text,
  sector        text,
  currency      text           not null default 'USD',
  quantity      numeric(24, 10) not null default 0,
  average_cost  numeric(24, 10) not null default 0,
  current_price numeric(24, 10),
  notes         text,
  created_at    timestamptz    not null default now(),
  updated_at    timestamptz    not null default now(),

  constraint assets_symbol_format         check (symbol ~ '^[A-Z0-9][A-Z0-9.\-]{0,14}$'),
  constraint assets_type_allowed          check (
    asset_type in ('stock', 'etf', 'mutual_fund', 'bond', 'reit', 'crypto', 'cash', 'option')
  ),
  constraint assets_currency_iso          check (currency ~ '^[A-Z]{3}$'),
  constraint assets_quantity_non_negative check (quantity >= 0),
  constraint assets_avg_cost_non_negative check (average_cost >= 0),
  constraint assets_price_non_negative    check (current_price is null or current_price >= 0)
);

comment on table  public.assets is 'A single stock / ETF / crypto position held in a portfolio.';
comment on column public.assets.average_cost is 'Volume weighted average purchase price per unit.';
comment on column public.assets.current_price is 'Last known market price; NULL until a quote is fetched.';

create unique index if not exists assets_portfolio_symbol_uidx
  on public.assets (portfolio_id, symbol);

create index if not exists assets_user_id_idx    on public.assets (user_id);
create index if not exists assets_symbol_idx    on public.assets (symbol);
create index if not exists assets_type_idx      on public.assets (asset_type);
create index if not exists assets_sector_idx    on public.assets (sector) where sector is not null;

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. transactions - append only ledger of every movement in a portfolio
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  portfolio_id     uuid           not null references public.portfolios (id) on delete cascade,
  asset_id         uuid           references public.assets (id) on delete cascade,
  user_id          uuid           not null references auth.users (id) on delete cascade,
  transaction_type text           not null,
  quantity         numeric(24, 10),
  price            numeric(24, 10),
  total_amount     numeric(24, 10) not null default 0,
  fees             numeric(24, 10) not null default 0,
  trade_date       date           not null default current_date,
  settled_at       date,
  notes            text,
  created_at       timestamptz    not null default now(),
  updated_at       timestamptz    not null default now(),

  constraint transactions_type_allowed check (
    transaction_type in ('BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'FEE',
                         'DEPOSIT', 'WITHDRAWAL', 'SPLIT')
  ),
  constraint transactions_amount_non_negative check (total_amount >= 0),
  constraint transactions_optional_non_negative check (
    coalesce(quantity, 0) >= 0 and coalesce(price, 0) >= 0 and fees >= 0
  ),
  constraint transactions_trade_fields check (
    transaction_type not in ('BUY', 'SELL')
    or (asset_id is not null and quantity > 0 and price > 0)
  ),
  constraint transactions_split_fields check (
    transaction_type <> 'SPLIT'
    or (asset_id is not null and quantity > 0 and total_amount = 0)
  ),
  constraint transactions_settled_after_trade check (
    settled_at is null or settled_at >= trade_date
  )
);

comment on table  public.transactions is 'Append only ledger of BUY / SELL / dividend / cash movements.';
comment on column public.transactions.total_amount is 'Cash value of the movement, positive number; fees are separate.';

create index if not exists transactions_portfolio_trade_date_uidx
  on public.transactions (portfolio_id, trade_date desc);

create index if not exists transactions_user_id_idx
  on public.transactions (user_id);

create index if not exists transactions_asset_id_idx
  on public.transactions (asset_id)
  where asset_id is not null;

create index if not exists transactions_type_idx
  on public.transactions (portfolio_id, transaction_type, trade_date desc);

create index if not exists transactions_trade_date_idx
  on public.transactions (trade_date desc);

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Cross table integrity
-- -----------------------------------------------------------------------------
create or replace function public.derive_user_id_from_portfolio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  select p.user_id into owner
  from public.portfolios p
  where p.id = new.portfolio_id;

  if owner is null then
    raise exception 'Portfolio % does not exist', new.portfolio_id
      using errcode = 'foreign_key_violation';
  end if;

  new.user_id := owner;
  return new;
end;
$$;

create or replace function public.enforce_asset_portfolio_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.asset_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.assets a
    where a.id = new.asset_id
      and a.portfolio_id = new.portfolio_id
  ) then
    raise exception 'Asset % does not belong to portfolio %', new.asset_id, new.portfolio_id
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

create or replace function public.guard_transaction_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'transactions.user_id is immutable'
      using errcode = 'insufficient_privilege';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'transactions.created_at is immutable'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists assets_derive_user_id on public.assets;
create trigger assets_derive_user_id
  before insert or update of portfolio_id on public.assets
  for each row execute function public.derive_user_id_from_portfolio();

drop trigger if exists transactions_derive_user_id on public.transactions;
create trigger transactions_derive_user_id
  before insert or update of portfolio_id on public.transactions
  for each row execute function public.derive_user_id_from_portfolio();

drop trigger if exists transactions_enforce_asset_portfolio on public.transactions;
create trigger transactions_enforce_asset_portfolio
  before insert or update of asset_id, portfolio_id on public.transactions
  for each row execute function public.enforce_asset_portfolio_match();

drop trigger if exists transactions_guard_immutable on public.transactions;
create trigger transactions_guard_immutable
  before update on public.transactions
  for each row execute function public.guard_transaction_immutability();

-- -----------------------------------------------------------------------------
-- 5. Bootstrap: default portfolio on signup
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.portfolios (user_id, name, is_default)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'portfolio_name'), ''), 'My Portfolio'),
    true
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 6. AI Analysis Cache Table
-- -----------------------------------------------------------------------------
create table if not exists public.ai_analysis_cache (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  portfolio_id      uuid        references public.portfolios (id) on delete cascade,
  analysis_type     text        not null,
  content_hash      text        not null,
  request_payload   jsonb       not null default '{}'::jsonb,
  response_payload  jsonb       not null,
  model             text,
  prompt_tokens     integer,
  completion_tokens integer,
  disclaimer        text        not null default
                     'ผลวิเคราะห์ประมวลผลโดย AI ไม่ใช่คำแนะนำทางการเงิน (Not Financial Advice)',
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),

  constraint ai_analysis_type_allowed check (
    analysis_type in ('SEC_10K_RATIOS', 'PORTFOLIO_RECOMMENDATION',
                      'RISK_ASSESSMENT', 'NEWS_SUMMARY')
  ),
  constraint ai_cache_tokens_non_negative check (
    coalesce(prompt_tokens, 0) >= 0 and coalesce(completion_tokens, 0) >= 0
  ),
  constraint ai_cache_expiry_after_creation check (
    expires_at is null or expires_at > created_at
  )
);

comment on table public.ai_analysis_cache is
  'Cache of LLM output keyed by user + analysis type + input digest.';

create unique index if not exists ai_analysis_cache_lookup_uidx
  on public.ai_analysis_cache (user_id, analysis_type, content_hash);

create index if not exists ai_analysis_cache_portfolio_idx
  on public.ai_analysis_cache (portfolio_id)
  where portfolio_id is not null;

create index if not exists ai_analysis_cache_expires_idx
  on public.ai_analysis_cache (expires_at)
  where expires_at is not null;

drop trigger if exists ai_analysis_cache_set_updated_at on public.ai_analysis_cache;
create trigger ai_analysis_cache_set_updated_at
  before update on public.ai_analysis_cache
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. Enable Row Level Security (RLS) & Create Policies
-- -----------------------------------------------------------------------------
alter table public.portfolios       enable row level security;
alter table public.assets           enable row level security;
alter table public.transactions     enable row level security;
alter table public.ai_analysis_cache enable row level security;

-- portfolios policies
drop policy if exists portfolios_select_own on public.portfolios;
create policy portfolios_select_own on public.portfolios
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists portfolios_insert_own on public.portfolios;
create policy portfolios_insert_own on public.portfolios
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists portfolios_update_own on public.portfolios;
create policy portfolios_update_own on public.portfolios
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists portfolios_delete_own on public.portfolios;
create policy portfolios_delete_own on public.portfolios
  for delete to authenticated using ((select auth.uid()) = user_id);

-- assets policies
drop policy if exists assets_select_own on public.assets;
create policy assets_select_own on public.assets
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists assets_insert_own on public.assets;
create policy assets_insert_own on public.assets
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists assets_update_own on public.assets;
create policy assets_update_own on public.assets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists assets_delete_own on public.assets;
create policy assets_delete_own on public.assets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- transactions policies
drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own on public.transactions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists transactions_update_own on public.transactions;
create policy transactions_update_own on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists transactions_delete_own on public.transactions;
create policy transactions_delete_own on public.transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ai_analysis_cache policies
drop policy if exists ai_analysis_cache_select_own on public.ai_analysis_cache;
create policy ai_analysis_cache_select_own on public.ai_analysis_cache
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists ai_analysis_cache_insert_own on public.ai_analysis_cache;
create policy ai_analysis_cache_insert_own on public.ai_analysis_cache
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists ai_analysis_cache_update_own on public.ai_analysis_cache;
create policy ai_analysis_cache_update_own on public.ai_analysis_cache
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists ai_analysis_cache_delete_own on public.ai_analysis_cache;
create policy ai_analysis_cache_delete_own on public.ai_analysis_cache
  for delete to authenticated using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 8. Portfolio RPC Functions
-- -----------------------------------------------------------------------------
create or replace function public.record_trade(
  p_portfolio_id     uuid,
  p_asset_id         uuid,
  p_transaction_type text,
  p_quantity         numeric,
  p_price            numeric,
  p_fees             numeric default 0,
  p_trade_date       date   default current_date,
  p_notes            text   default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id  uuid;
  v_asset    public.assets%rowtype;
  v_total    numeric;
  v_new_qty  numeric;
  v_new_cost numeric;
  v_fees     numeric := coalesce(p_fees, 0);
  v_tx_id    uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'PT000';
  end if;

  if p_transaction_type is null or p_transaction_type not in ('BUY', 'SELL') then
    raise exception 'UNSUPPORTED_TYPE' using errcode = 'PT004';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY' using errcode = 'PT004';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'INVALID_PRICE' using errcode = 'PT004';
  end if;

  if v_fees < 0 then
    raise exception 'INVALID_FEES' using errcode = 'PT004';
  end if;

  select a.* into v_asset
  from public.assets a
  where a.id = p_asset_id
    and a.portfolio_id = p_portfolio_id;

  if not found then
    raise exception 'ASSET_NOT_IN_PORTFOLIO' using errcode = 'PT002';
  end if;

  if p_transaction_type = 'SELL' and p_quantity > v_asset.quantity then
    raise exception 'INSUFFICIENT_HOLDING' using errcode = 'PT003';
  end if;

  v_total := round(p_quantity * p_price, 6);

  if p_transaction_type = 'BUY' then
    if v_asset.quantity = 0 then
      v_new_qty  := p_quantity;
      v_new_cost := p_price;
    else
      v_new_qty  := v_asset.quantity + p_quantity;
      v_new_cost := round(
        ((v_asset.quantity * v_asset.average_cost) + v_total) / v_new_qty,
        10
      );
    end if;
  else
    v_new_qty  := v_asset.quantity - p_quantity;
    v_new_cost := v_asset.average_cost;
  end if;

  if p_transaction_type = 'BUY' and exists (
    select 1
    from public.portfolios p
    where p.id = p_portfolio_id
      and p.cash_balance < v_total + v_fees
  ) then
    raise exception 'INSUFFICIENT_CASH' using errcode = 'PT001';
  end if;

  insert into public.transactions (
    portfolio_id, asset_id, user_id, transaction_type,
    quantity, price, total_amount, fees, trade_date, notes
  )
  values (
    p_portfolio_id, p_asset_id, v_user_id, p_transaction_type,
    p_quantity, p_price, v_total, v_fees,
    coalesce(p_trade_date, current_date), nullif(btrim(p_notes), '')
  )
  returning id into v_tx_id;

  update public.assets
  set quantity     = v_new_qty,
      average_cost = v_new_cost
  where id = p_asset_id;

  update public.portfolios
  set cash_balance = case
        when p_transaction_type = 'BUY'
          then cash_balance - (v_total + v_fees)
        else cash_balance + (v_total - v_fees)
      end
  where id = p_portfolio_id;

  return v_tx_id;
end;
$$;

create or replace function public.set_default_portfolio(p_portfolio_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'PT000';
  end if;

  if not exists (
    select 1 from public.portfolios p where p.id = p_portfolio_id
  ) then
    raise exception 'PORTFOLIO_NOT_FOUND' using errcode = 'PT002';
  end if;

  update public.portfolios
  set is_default = false
  where is_default
    and id <> p_portfolio_id;

  update public.portfolios
  set is_default = true
  where id = p_portfolio_id;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Grants
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete
  on public.portfolios, public.assets, public.transactions, public.ai_analysis_cache
  to authenticated;

revoke all on public.portfolios, public.assets, public.transactions, public.ai_analysis_cache from anon;

revoke all on function public.set_updated_at()                 from public;
revoke all on function public.derive_user_id_from_portfolio()  from public;
revoke all on function public.enforce_asset_portfolio_match()  from public;
revoke all on function public.guard_transaction_immutability() from public;
revoke all on function public.handle_new_user()               from public;

revoke all on function public.record_trade(uuid, uuid, text, numeric, numeric, numeric, date, text) from public;
revoke all on function public.set_default_portfolio(uuid) from public;

grant execute on function public.record_trade(uuid, uuid, text, numeric, numeric, numeric, date, text) to authenticated;
grant execute on function public.set_default_portfolio(uuid) to authenticated;

comment on function public.record_trade(uuid, uuid, text, numeric, numeric, numeric, date, text)
  is 'Atomically appends a BUY/SELL and re-derives assets.quantity, assets.average_cost and portfolios.cash_balance.';
comment on function public.set_default_portfolio(uuid)
  is 'Atomically moves the is_default flag, honouring the partial unique index.';

commit;
