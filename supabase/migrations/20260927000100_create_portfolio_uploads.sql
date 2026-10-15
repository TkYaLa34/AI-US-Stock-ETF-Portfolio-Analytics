-- =============================================================================
-- 20260927000100_create_portfolio_uploads.sql
-- AI US Stock & ETF Portfolio Analytics - Document & Image Uploads
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. portfolio_uploads table
-- -----------------------------------------------------------------------------
create table if not exists public.portfolio_uploads (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,
  portfolio_id   uuid        references public.portfolios (id) on delete cascade,
  file_path      text        not null,
  file_name      text        not null,
  file_size      bigint      not null check (file_size > 0),
  mime_type      text        not null,
  status         text        not null default 'processing',
  extracted_data jsonb       default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint portfolio_uploads_status_allowed check (
    status in ('processing', 'success', 'error')
  )
);

comment on table public.portfolio_uploads is 'Metadata and OCR extracted data for portfolio document/image uploads.';

create index portfolio_uploads_user_id_idx on public.portfolio_uploads (user_id);
create index portfolio_uploads_portfolio_id_idx on public.portfolio_uploads (portfolio_id) where portfolio_id is not null;
create index portfolio_uploads_created_at_idx on public.portfolio_uploads (created_at desc);

create trigger portfolio_uploads_set_updated_at
  before update on public.portfolio_uploads
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Row Level Security for portfolio_uploads
-- -----------------------------------------------------------------------------
alter table public.portfolio_uploads enable row level security;

drop policy if exists portfolio_uploads_select_own on public.portfolio_uploads;
create policy portfolio_uploads_select_own on public.portfolio_uploads
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists portfolio_uploads_insert_own on public.portfolio_uploads;
create policy portfolio_uploads_insert_own on public.portfolio_uploads
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists portfolio_uploads_update_own on public.portfolio_uploads;
create policy portfolio_uploads_update_own on public.portfolio_uploads
  for update to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists portfolio_uploads_delete_own on public.portfolio_uploads;
create policy portfolio_uploads_delete_own on public.portfolio_uploads
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Grants
grant select, insert, update, delete on public.portfolio_uploads to authenticated;
revoke all on public.portfolio_uploads from anon;

-- -----------------------------------------------------------------------------
-- 3. Storage Bucket & RLS Policies for portfolio-documents
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-documents',
  'portfolio-documents',
  false,
  10485760, -- 10MB
  array['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload portfolio documents" on storage.objects;
create policy "Authenticated users can upload portfolio documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portfolio-documents' and (select auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "Users can view own portfolio documents" on storage.objects;
create policy "Users can view own portfolio documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'portfolio-documents' and (select auth.uid())::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete own portfolio documents" on storage.objects;
create policy "Users can delete own portfolio documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'portfolio-documents' and (select auth.uid())::text = (storage.foldername(name))[1]);

commit;
