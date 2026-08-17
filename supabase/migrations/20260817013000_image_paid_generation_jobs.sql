-- Image Studio paid-generation safety authority.
-- Additive only. This migration intentionally stores safe frozen-input metadata;
-- private Master Artwork bytes live in a private Storage bucket.

create table if not exists public.image_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.brain_workspaces(id) on delete restrict,
  report_record_id uuid not null,
  report_id uuid not null,
  asset_id text not null,
  created_by text not null,
  input_snapshot jsonb not null,
  input_fingerprint text not null check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  artwork_storage_path text not null,
  provider text not null check (provider in ('openai', 'flux')),
  model text not null,
  estimated_cost_min numeric(12,4) not null check (estimated_cost_min >= 0),
  estimated_cost_max numeric(12,4) not null check (estimated_cost_max >= estimated_cost_min),
  cost_currency text not null default 'USD' check (cost_currency = 'USD'),
  cost_estimate_basis text not null,
  pricing_version text not null,
  status text not null default 'awaiting_confirmation' check (status in (
    'awaiting_confirmation', 'confirmed', 'running', 'succeeded', 'failed',
    'unknown_outcome', 'cancelled'
  )),
  confirmation_token text unique,
  confirmation_fingerprint text,
  confirmed_by text,
  confirmed_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_request_id text,
  result_asset_ids jsonb not null default '[]'::jsonb,
  failure_code text,
  failure_message text,
  safe_retry_allowed boolean not null default false,
  unknown_outcome_reason text,
  reconciliation_state text check (reconciliation_state in (
    'not_required', 'required', 'resolved_no_charge', 'resolved_charged'
  )),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, input_fingerprint),
  check (
    status not in ('confirmed', 'running', 'succeeded', 'failed', 'unknown_outcome')
    or (
      confirmation_fingerprint = input_fingerprint
      and confirmed_by is not null
      and confirmed_at is not null
    )
  )
);

create index if not exists image_generation_jobs_shot_idx
  on public.image_generation_jobs (workspace_id, report_record_id, asset_id, created_at desc);
create unique index if not exists image_generation_jobs_one_running_shot_idx
  on public.image_generation_jobs (workspace_id, report_record_id, asset_id)
  where status = 'running';

alter table public.image_generation_jobs enable row level security;
revoke all on public.image_generation_jobs from public, anon, authenticated;
grant select, insert, update on public.image_generation_jobs to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'image-generation-inputs',
  'image-generation-inputs',
  false,
  20971520,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Atomic single-use execution claim. A known failure may only be reclaimed when
-- explicitly requested and when the prior attempt was recorded safe to retry.
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
