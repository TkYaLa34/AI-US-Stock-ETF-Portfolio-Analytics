-- =============================================================================
-- 20260925000300_create_ai_analysis_cache.sql   (Phase 2 - DB, used by Phase 4)
-- AI US Stock & ETF Portfolio Analytics
-- =============================================================================
-- .clinerules section 4 requires every LLM result to be cached in Supabase so
-- repeated SEC 10-K / recommendation calls cost nothing and render instantly.
--
-- The cache key is (user_id, analysis_type, content_hash). content_hash is a
-- digest of everything that can change the answer (portfolio holdings, filing
-- period, model version), so a hit means "provably the same question".
-- =============================================================================

begin;

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
  -- The AI disclaimer is a column default, not just a UI string, so every
  -- cached answer carries it even if a future screen forgets to render it.
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
  'Cache of LLM output keyed by user + analysis type + input digest. Required by .clinerules section 4.';

-- One row per distinct question; a repeat insert must conflict so the caller
-- can fall back to a select instead of paying for the model again.
create unique index ai_analysis_cache_lookup_uidx
  on public.ai_analysis_cache (user_id, analysis_type, content_hash);

create index ai_analysis_cache_portfolio_idx
  on public.ai_analysis_cache (portfolio_id)
  where portfolio_id is not null;

-- Supports "drop everything that expired" sweeps.
create index ai_analysis_cache_expires_idx
  on public.ai_analysis_cache (expires_at)
  where expires_at is not null;

create trigger ai_analysis_cache_set_updated_at
  before update on public.ai_analysis_cache
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: same ownership rule as the rest of the schema
-- -----------------------------------------------------------------------------
alter table public.ai_analysis_cache enable row level security;

drop policy if exists ai_analysis_cache_select_own on public.ai_analysis_cache;
create policy ai_analysis_cache_select_own on public.ai_analysis_cache
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists ai_analysis_cache_insert_own on public.ai_analysis_cache;
create policy ai_analysis_cache_insert_own on public.ai_analysis_cache
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists ai_analysis_cache_update_own on public.ai_analysis_cache;
create policy ai_analysis_cache_update_own on public.ai_analysis_cache
  for update to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists ai_analysis_cache_delete_own on public.ai_analysis_cache;
create policy ai_analysis_cache_delete_own on public.ai_analysis_cache
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.ai_analysis_cache to authenticated;
revoke all on public.ai_analysis_cache from anon;

commit;
