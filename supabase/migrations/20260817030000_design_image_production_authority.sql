-- Durable Design authority and Image production project/asset boundary.
-- Additive only. Intentionally unapplied until a separate controlled preflight.

create table if not exists public.design_master_artworks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.brain_workspaces(id) on delete restrict,
  design_id text not null,
  version text not null,
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_length integer not null check (byte_length > 0 and byte_length <= 20971520),
  source_type text not null check (source_type in (
    'uploaded', 'vector-artwork', 'ai-designer-artwork', 'svg-draft'
  )),
  storage_path text not null unique,
  status text not null check (status = 'APPROVED'),
  placement text,
  print_method text,
  source_report_id text,
  source_handoff_at timestamptz not null,
  provenance jsonb not null,
  approved_by text not null,
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, design_id, version, checksum)
);

create index if not exists design_master_artworks_design_idx
  on public.design_master_artworks (workspace_id, design_id, approved_at desc);

alter table public.design_master_artworks enable row level security;
revoke all on public.design_master_artworks from public, anon, authenticated;
grant select, insert on public.design_master_artworks to service_role;

create table if not exists public.image_production_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.brain_workspaces(id) on delete restrict,
  report_record_id uuid not null,
  report_id uuid not null,
  project_name text not null,
  campaign_direction jsonb not null,
  brand_model jsonb not null,
  master_artwork_id uuid not null references public.design_master_artworks(id) on delete restrict,
  master_artwork jsonb not null,
  product_context jsonb not null,
  shot_plan jsonb not null,
  status text not null default 'READY' check (status in (
    'READY', 'IN_PRODUCTION', 'REVIEW', 'COMPLETE', 'ARCHIVED'
  )),
  version integer not null default 1 check (version > 0),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, report_record_id)
);

create index if not exists image_production_projects_recent_idx
  on public.image_production_projects (workspace_id, updated_at desc);

alter table public.image_production_projects enable row level security;
revoke all on public.image_production_projects from public, anon, authenticated;
grant select, insert, update on public.image_production_projects to service_role;

alter table public.image_generation_jobs
  add column if not exists production_project_id uuid
    references public.image_production_projects(id) on delete restrict,
  add column if not exists production_project_version integer,
  add column if not exists confirmation_expires_at timestamptz
    not null default (now() + interval '30 minutes');

create index if not exists image_generation_jobs_project_idx
  on public.image_generation_jobs (workspace_id, production_project_id, created_at desc);

create table if not exists public.image_production_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.brain_workspaces(id) on delete restrict,
  production_project_id uuid not null references public.image_production_projects(id) on delete restrict,
  generation_job_id uuid not null references public.image_generation_jobs(id) on delete restrict,
  shot_id text not null,
  input_fingerprint text not null check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  brand_model jsonb not null,
  master_artwork jsonb not null,
  product_context jsonb not null,
  provider text not null,
  model text not null,
  provider_request_id text,
  storage_path text not null,
  provenance jsonb not null,
  review_status text not null default 'REVIEW_REQUIRED' check (review_status in (
    'GENERATED', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED'
  )),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, generation_job_id)
);

create index if not exists image_production_assets_project_idx
  on public.image_production_assets (workspace_id, production_project_id, generated_at desc);

alter table public.image_production_assets enable row level security;
revoke all on public.image_production_assets from public, anon, authenticated;
grant select, insert, update on public.image_production_assets to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('design-master-artworks', 'design-master-artworks', false, 20971520,
    array['image/png', 'image/jpeg', 'image/webp']),
  ('image-production-assets', 'image-production-assets', false, 52428800,
    array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Replace the prior claim definition with the same atomic transition plus a
-- hard confirmation TTL. The server-only caller still supplies the current
-- time and cannot claim an expired authorization.
create or replace function public.claim_image_generation_job(
  p_workspace_id uuid,
  p_job_id uuid,
  p_input_fingerprint text,
  p_retry_known_failure boolean,
  p_now timestamptz
)
returns setof public.image_generation_jobs
language sql
security definer
set search_path = public
as $$
  update public.image_generation_jobs
  set status = 'running',
      attempt_count = attempt_count + 1,
      started_at = p_now,
      completed_at = null,
      failure_code = null,
      failure_message = null,
      safe_retry_allowed = false,
      updated_at = p_now
  where workspace_id = p_workspace_id
    and id = p_job_id
    and input_fingerprint = p_input_fingerprint
    and confirmation_fingerprint = input_fingerprint
    and confirmed_at is not null
    and confirmation_expires_at >= p_now
    and (
      status = 'confirmed'
      or (
        p_retry_known_failure
        and status = 'failed'
        and safe_retry_allowed = true
      )
    )
  returning *;
$$;

revoke all on function public.claim_image_generation_job(uuid, uuid, text, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_image_generation_job(uuid, uuid, text, boolean, timestamptz)
  to service_role;
