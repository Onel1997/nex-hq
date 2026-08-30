-- Xeriano durable Creation authority.
-- Additive only: generated results remain in the frozen studio stores while a
-- private Library asset and immutable setup/reference snapshot form the
-- customer-facing Creation record.

do $$ begin
  create type public.xeriano_creation_type as enum ('IMAGE', 'VIDEO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.xeriano_creation_status as enum ('SUCCEEDED', 'PARTIAL');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.xeriano_creation_reference_source as enum (
    'LIBRARY_REFERENCE',
    'GENERATED_RESULT_REFERENCE',
    'LOCAL_FILE_REFERENCE'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.xeriano_creations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  library_asset_id uuid not null,
  creation_type public.xeriano_creation_type not null,
  source_studio text not null check (source_studio in ('CREATIVE_STUDIO','UGC_VIDEO_STUDIO')),
  source_job_id text not null check (char_length(source_job_id) between 1 and 160),
  source_result_id text not null check (char_length(source_result_id) between 1 and 160),
  original_prompt text not null check (char_length(original_prompt) between 1 and 12000),
  provider_prompt text check (provider_prompt is null or char_length(provider_prompt) <= 20000),
  model_id text not null check (char_length(model_id) between 1 and 200),
  settings jsonb not null check (
    jsonb_typeof(settings) = 'object'
    and octet_length(settings::text) <= 32768
  ),
  credit_cost integer not null check (credit_cost >= 0),
  credit_pricing_version text check (
    credit_pricing_version is null
    or char_length(credit_pricing_version) between 1 and 100
  ),
  favorite boolean not null default false,
  status public.xeriano_creation_status not null default 'SUCCEEDED',
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  foreign key (library_asset_id, account_id)
    references public.xeriano_library_assets(id, account_id) on delete restrict,
  unique(account_id, source_studio, source_job_id, source_result_id),
  unique(library_asset_id),
  unique(id, account_id),
  check (
    (creation_type = 'IMAGE' and source_studio = 'CREATIVE_STUDIO')
    or (creation_type = 'VIDEO' and source_studio = 'UGC_VIDEO_STUDIO')
  )
);

create index if not exists xeriano_creations_account_date_idx
  on public.xeriano_creations(account_id, created_at desc, id desc);
create index if not exists xeriano_creations_account_type_date_idx
  on public.xeriano_creations(account_id, creation_type, created_at desc, id desc);
create index if not exists xeriano_creations_favorite_idx
  on public.xeriano_creations(account_id, created_at desc, id desc)
  where favorite;

create table if not exists public.xeriano_creation_references (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete cascade,
  creation_id uuid not null,
  reference_order integer not null check (reference_order >= 0 and reference_order < 64),
  role text not null check (char_length(role) between 1 and 80),
  source_kind public.xeriano_creation_reference_source not null,
  library_asset_id uuid,
  source_job_id text check (source_job_id is null or char_length(source_job_id) between 1 and 160),
  source_result_id text check (source_result_id is null or char_length(source_result_id) between 1 and 160),
  filename text not null check (char_length(filename) between 1 and 255),
  mime_type text not null check (char_length(mime_type) between 1 and 120),
  byte_length bigint not null check (byte_length > 0 and byte_length <= 52428800),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  storage_bucket text,
  storage_path text,
  created_at timestamptz not null default now(),
  foreign key (creation_id, account_id)
    references public.xeriano_creations(id, account_id) on delete cascade,
  foreign key (library_asset_id, account_id)
    references public.xeriano_library_assets(id, account_id) on delete restrict,
  unique(creation_id, reference_order),
  check (
    (source_kind = 'LIBRARY_REFERENCE'
      and library_asset_id is not null
      and storage_bucket is null and storage_path is null)
    or (source_kind = 'GENERATED_RESULT_REFERENCE'
      and source_job_id is not null and source_result_id is not null
      and storage_bucket is null and storage_path is null)
    or (source_kind = 'LOCAL_FILE_REFERENCE'
      and storage_bucket = 'creative-studio-assets'
      and storage_path is not null
      and library_asset_id is null)
  )
);

create index if not exists xeriano_creation_references_creation_idx
  on public.xeriano_creation_references(account_id, creation_id, reference_order);
create index if not exists xeriano_creation_references_library_idx
  on public.xeriano_creation_references(library_asset_id)
  where library_asset_id is not null;

drop trigger if exists xeriano_creations_touch_updated_at on public.xeriano_creations;
create trigger xeriano_creations_touch_updated_at
  before update on public.xeriano_creations
  for each row execute function public.xeriano_touch_updated_at();

alter table public.xeriano_creations enable row level security;
alter table public.xeriano_creation_references enable row level security;

revoke all on public.xeriano_creations, public.xeriano_creation_references
  from public, anon, authenticated;

-- These policies document and enforce the account boundary if a future
-- narrowly-scoped grant is added. V1 clients use authenticated server routes;
-- no direct table grant exposes provider prompts or private object authority.
drop policy if exists xeriano_creations_read_member on public.xeriano_creations;
create policy xeriano_creations_read_member
  on public.xeriano_creations for select to authenticated
  using (public.xeriano_is_account_member(account_id));

drop policy if exists xeriano_creation_references_read_member on public.xeriano_creation_references;
create policy xeriano_creation_references_read_member
  on public.xeriano_creation_references for select to authenticated
  using (public.xeriano_is_account_member(account_id));

grant all on public.xeriano_creations, public.xeriano_creation_references to service_role;

comment on table public.xeriano_creations is
  'One idempotent, account-scoped customer Creation per successful provider result.';
comment on table public.xeriano_creation_references is
  'Ordered durable provenance for the exact references used by a Xeriano Creation.';
