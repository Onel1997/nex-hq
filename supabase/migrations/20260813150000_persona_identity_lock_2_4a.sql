-- Phase 2.4A — Official Brand Face Identity Lock snapshots

alter table public.persona_personas
  add column if not exists identity_locked_at timestamptz;

comment on column public.persona_personas.identity_locked_at is
  'Timestamp when the official Brand Identity package was locked (Phase 2.4A).';

create table if not exists public.persona_identity_lock_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  persona_id uuid not null references public.persona_personas(id) on delete cascade,
  source_candidate_id uuid,
  source_creation_project_id uuid,
  master_reference_asset_id uuid not null,
  master_checksum text not null,
  front_asset_id uuid not null,
  three_quarter_left_asset_id uuid not null,
  three_quarter_right_asset_id uuid not null,
  left_profile_asset_id uuid not null,
  right_profile_asset_id uuid not null,
  canonical_references jsonb not null default '[]'::jsonb,
  identity_lock_version integer not null,
  identity_locked_at timestamptz not null,
  identity_locked_by uuid,
  reference_package_version text not null,
  reference_package_fingerprint text not null,
  provenance_counts jsonb not null default '{}'::jsonb,
  policy_version text not null default 'identity-lock-v1.0.0',
  created_at timestamptz not null default now(),
  unique (workspace_id, persona_id, identity_lock_version)
);

create index if not exists persona_identity_lock_snapshots_persona_idx
  on public.persona_identity_lock_snapshots (workspace_id, persona_id, identity_lock_version desc);

comment on table public.persona_identity_lock_snapshots is
  'Immutable identity package snapshot created on Official Brand Face Identity Lock (Phase 2.4A).';
