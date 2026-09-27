-- =============================================================================
-- 20260926000100_create_portfolio_functions.sql   (Phase 3 - Portfolio Mgmt)
-- AI US Stock & ETF Portfolio Analytics
-- =============================================================================
-- Tables created: none. This migration only adds the three write paths that
-- MUST be atomic, because each one touches a ledger row *and* the derived
-- position the dashboard reports on:
--
--   public.record_trade(...)          - BUY / SELL
--   public.record_cash_movement(...)  - DEPOSIT / WITHDRAWAL
--   public.set_default_portfolio(...) - move the is_default flag
--
-- Why a Postgres function instead of three calls from a Server Action: a
-- Server Action can only issue sequential REST requests, so a failure halfway
-- through (ledger written, position not) silently corrupts every downstream
-- number. Postgres runs a function inside a single transaction, so either all
-- of the rows move or none of them do.
--
-- SECURITY: all three are `security invoker`, so the RLS policies created in
-- 20260925000200_enable_row_level_security.sql apply to every statement inside
-- them. A caller can therefore only ever touch rows where
-- auth.uid() = user_id, and the ownership checks are the database's rather
-- than the application's.
--
-- Errors use machine readable SQLSTATEs so the Server Action can map them to a
-- Thai message without string matching:
--   PT000  not authenticated
--   PT001  not enough cash
--   PT002  row not found / not visible to this caller
--   PT003  selling more shares than are held
--   PT004  invalid input
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. record_trade - append a BUY/SELL to the ledger and re-derive the position
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

  -- RLS applies to this SELECT, so an asset the caller may not see is simply
  -- invisible: that is what stops PT002 from turning into an existence oracle.
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

  -- Round to 6dp: the smallest unit the portfolio currency realistically needs.
  v_total := round(p_quantity * p_price, 6);


  if p_transaction_type = 'BUY' then
    -- Volume weighted average cost. A position opened from zero has no
    -- historical cost to blend with, so it simply starts at the fill price.
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
    -- Selling realises P&L, it does not change the cost basis of the remainder.
    v_new_qty  := v_asset.quantity - p_quantity;
    v_new_cost := v_asset.average_cost;
  end if;

  -- Check the cash guard up front so the failure is a readable message rather
  -- than portfolios_cash_non_neg (23514) blowing up on the UPDATE.
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


-- -----------------------------------------------------------------------------
-- 2. record_cash_movement - DEPOSIT / WITHDRAWAL against the cash balance
-- -----------------------------------------------------------------------------
-- A BUY always debits cash, so without a way to put money into the portfolio
-- the very first trade would fail portfolios_cash_non_neg.
-- -----------------------------------------------------------------------------
create or replace function public.record_cash_movement(
  p_portfolio_id     uuid,
  p_transaction_type text,
  p_amount           numeric,
  p_notes            text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_amount  numeric := round(coalesce(p_amount, 0), 6);
  v_tx_id   uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'PT000';
  end if;

  if p_transaction_type is null or p_transaction_type not in ('DEPOSIT', 'WITHDRAWAL') then
    raise exception 'UNSUPPORTED_TYPE' using errcode = 'PT004';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'PT004';
  end if;

  if not exists (
    select 1 from public.portfolios p where p.id = p_portfolio_id
  ) then
    raise exception 'PORTFOLIO_NOT_FOUND' using errcode = 'PT002';
  end if;

  if p_transaction_type = 'WITHDRAWAL' and exists (
    select 1
    from public.portfolios p
    where p.id = p_portfolio_id and p.cash_balance < v_amount
  ) then
    raise exception 'INSUFFICIENT_CASH' using errcode = 'PT001';
  end if;

  insert into public.transactions (
    portfolio_id, asset_id, user_id, transaction_type,
    quantity, price, total_amount, fees, trade_date, notes
  )
  values (
    p_portfolio_id, null, v_user_id, p_transaction_type,
    null, null, v_amount, 0, current_date, nullif(btrim(p_notes), '')
  )
  returning id into v_tx_id;

  update public.portfolios
  set cash_balance = case
        when p_transaction_type = 'DEPOSIT' then cash_balance + v_amount
        else cash_balance - v_amount
      end
  where id = p_portfolio_id;

  return v_tx_id;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. set_default_portfolio - move the is_default flag
-- -----------------------------------------------------------------------------
-- portfolios_one_default_per_user_uidx is a PARTIAL unique index, so there can
-- only ever be one default per user. Clearing the old one and setting the new
-- one has to be a single statement pair or a failure in between leaves the
-- user with no default at all.
-- -----------------------------------------------------------------------------
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
-- 4. Grants - Postgres grants EXECUTE to PUBLIC by default, so revoke first
-- -----------------------------------------------------------------------------
revoke all on function public.record_trade(uuid, uuid, text, numeric, numeric, numeric, date, text) from public;
revoke all on function public.record_cash_movement(uuid, text, numeric, text) from public;
revoke all on function public.set_default_portfolio(uuid) from public;

grant execute on function public.record_trade(uuid, uuid, text, numeric, numeric, numeric, date, text) to authenticated;
grant execute on function public.record_cash_movement(uuid, text, numeric, text) to authenticated;
grant execute on function public.set_default_portfolio(uuid) to authenticated;

comment on function public.record_trade(uuid, uuid, text, numeric, numeric, numeric, date, text)
  is 'Atomically appends a BUY/SELL and re-derives assets.quantity, assets.average_cost and portfolios.cash_balance.';
comment on function public.record_cash_movement(uuid, text, numeric, text)
  is 'Atomically appends a DEPOSIT/WITHDRAWAL and moves portfolios.cash_balance.';
comment on function public.set_default_portfolio(uuid)
  is 'Atomically moves the is_default flag, honouring the partial unique index.';

commit;

