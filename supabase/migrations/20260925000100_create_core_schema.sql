-- =============================================================================
-- 20260925000100_create_core_schema.sql   (Phase 2 - Database & Auth)
-- AI US Stock & ETF Portfolio Analytics
-- =============================================================================
-- Tables created:
--   portfolios   - a named container of holdings owned by exactly one user
--   assets       - one held position (ticker level) inside a portfolio
--   transactions - the ledger of BUY / SELL / cash movements over time
--
-- Design decisions
--   * Money and quantities use NUMERIC, never float, for cent-exact maths.
--   * Instants are TIMESTAMPTZ; market events are DATE (exchange local day).
--   * user_id is denormalised onto the child tables on purpose: it lets RLS
--     evaluate "is this mine?" without a join on the hot read path.
--   * assets / transactions cascade on portfolio delete; the ledger rows of a
--     deleted asset also cascade away.
-- =============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Generic helper: keep `updated_at` fresh on every UPDATE
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

-- Case-insensitive uniqueness so "Growth" and "growth" cannot coexist.
create unique index portfolios_user_name_uidx
  on public.portfolios (user_id, lower(name));

-- Hot path: "list my portfolios".
create index portfolios_user_id_idx
  on public.portfolios (user_id);

-- At most one default portfolio per user (partial unique index).
create unique index portfolios_one_default_per_user_uidx
  on public.portfolios (user_id)
  where is_default;

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

  -- Allows NYSE/BATS tickers, class shares (BRK-B) and dots (BRK.B).
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

-- A ticker may only appear once per portfolio. This index also serves every
-- "rows of this portfolio" lookup, so no extra (portfolio_id) index is needed.
create unique index assets_portfolio_symbol_uidx
  on public.assets (portfolio_id, symbol);

create index assets_user_id_idx    on public.assets (user_id);
create index assets_symbol_idx    on public.assets (symbol);
create index assets_type_idx      on public.assets (asset_type);
create index assets_sector_idx    on public.assets (sector) where sector is not null;

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
  -- A trade must point at an instrument and carry both a size and a price.
  constraint transactions_trade_fields check (
    transaction_type not in ('BUY', 'SELL')
    or (asset_id is not null and quantity > 0 and price > 0)
  ),
  -- A stock split re-denominates units, so it also needs a quantity.
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

create index transactions_portfolio_trade_date_uidx
  on public.transactions (portfolio_id, trade_date desc);

create index transactions_user_id_idx
  on public.transactions (user_id);

create index transactions_asset_id_idx
  on public.transactions (asset_id)
  where asset_id is not null;

create index transactions_type_idx
  on public.transactions (portfolio_id, transaction_type, trade_date desc);

create index transactions_trade_date_idx
  on public.transactions (trade_date desc);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. Cross table integrity
-- -----------------------------------------------------------------------------
-- assets.user_id and transactions.user_id are never trusted from the client:
-- they are always re-derived from the parent portfolio. That keeps the RLS
-- predicate and real ownership in agreement no matter what a caller sends.
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

-- A transaction may only reference an asset that lives in the SAME portfolio.
-- A plain foreign key would happily accept a cross-portfolio asset id.
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

-- The ledger is append only: ownership and creation time can never be rewritten.
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

create trigger assets_derive_user_id
  before insert or update of portfolio_id on public.assets
  for each row execute function public.derive_user_id_from_portfolio();

create trigger transactions_derive_user_id
  before insert or update of portfolio_id on public.transactions
  for each row execute function public.derive_user_id_from_portfolio();

create trigger transactions_enforce_asset_portfolio
  before insert or update of asset_id, portfolio_id on public.transactions
  for each row execute function public.enforce_asset_portfolio_match();

create trigger transactions_guard_immutable
  before update on public.transactions
  for each row execute function public.guard_transaction_immutability();

-- -----------------------------------------------------------------------------
-- 5. Bootstrap: give every new auth user a default portfolio
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
-- 6. Grants: authenticated may CRUD, anon is locked out entirely
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete
  on public.portfolios, public.assets, public.transactions
  to authenticated;

revoke all on public.portfolios, public.assets, public.transactions from anon;

-- Helper functions are trigger only; nobody needs to call them directly.
revoke all on function public.set_updated_at()                 from public;
revoke all on function public.derive_user_id_from_portfolio()  from public;
revoke all on function public.enforce_asset_portfolio_match()  from public;
revoke all on function public.guard_transaction_immutability() from public;
revoke all on function public.handle_new_user()               from public;

commit;

