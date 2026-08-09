-- Phase 2.3D — Controlled Reference Package sessions + per-angle attempts.

create table if not exists public.persona_reference_package_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  persona_id uuid not null references public.persona_personas (id) on delete cascade,
  master_reference_id uuid not null,
  status text not null default 'pending_confirmation',
  provider text not null default 'openai',
  confirmation_token text,
  estimate_hash text,
  estimated_cost_min numeric not null default 0,
  estimated_cost_max numeric not null default 0,
  max_authorized_spend numeric not null default 0,
  image_count integer not null default 0,
  confirmed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists persona_ref_pkg_sessions_persona_idx
  on public.persona_reference_package_sessions (workspace_id, persona_id, created_at desc);

create index if not exists persona_ref_pkg_sessions_token_idx
  on public.persona_reference_package_sessions (workspace_id, confirmation_token)
  where confirmation_token is not null;

create table if not exists public.persona_reference_package_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  persona_id uuid not null references public.persona_personas (id) on delete cascade,
  session_id uuid not null references public.persona_reference_package_sessions (id) on delete cascade,
  master_reference_id uuid not null,
  reference_slot text not null,
  provider text not null default 'openai',
  provider_request_id text,
  generated_asset_id uuid,
  status text not null default 'queued',
  identity_decision text,
  identity_distance numeric,
  identity_similarity numeric,
  cost_eur numeric,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists persona_ref_pkg_attempts_persona_idx
  on public.persona_reference_package_attempts (workspace_id, persona_id, created_at);

create index if not exists persona_ref_pkg_attempts_session_idx
  on public.persona_reference_package_attempts (session_id, created_at);
