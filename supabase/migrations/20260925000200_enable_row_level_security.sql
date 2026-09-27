-- =============================================================================
-- 20260925000200_enable_row_level_security.sql   (Phase 2 - Database & Auth)
-- AI US Stock & ETF Portfolio Analytics
-- =============================================================================
-- Threat model
--   The Supabase client is public: the anon key ships to every browser, so the
--   database is the ONLY place where "is this row mine?" can be enforced.
--   Every table below therefore has RLS switched on and is readable/writable
--   only through the row owner.
--
-- Performance note
--   auth.uid() is wrapped in a scalar subquery: Postgres evaluates it once per
--   statement as an InitPlan instead of once per row, which is the difference
--   between an index scan and a sequential scan on a large table.
-- =============================================================================

begin;

alter table public.portfolios    enable row level security;
alter table public.assets        enable row level security;
alter table public.transactions  enable row level security;

-- -----------------------------------------------------------------------------
-- 1. portfolios - ownership is a direct column comparison
-- -----------------------------------------------------------------------------
drop policy if exists portfolios_select_own on public.portfolios;
create policy portfolios_select_own on public.portfolios
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists portfolios_insert_own on public.portfolios;
create policy portfolios_insert_own on public.portfolios
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists portfolios_update_own on public.portfolios;
create policy portfolios_update_own on public.portfolios
  for update to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists portfolios_delete_own on public.portfolios;
create policy portfolios_delete_own on public.portfolios
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 2. assets - user_id is denormalised and re-derived by a trigger, so a plain
--    column comparison is enough. The EXISTS clause is defence in depth: even if
--    a row were ever crafted with a matching user_id, the parent portfolio must
--    still belong to the caller.
-- -----------------------------------------------------------------------------
drop policy if exists assets_select_own on public.assets;
create policy assets_select_own on public.assets
  for select to authenticated
  using ((select auth.uid()) = user_id);

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
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 3. transactions - same ownership rule as assets
-- -----------------------------------------------------------------------------
drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own on public.transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

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
  for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;
