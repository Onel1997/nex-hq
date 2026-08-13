-- Phase 2.3D.9 — Deterministic horizontal-mirror salvage for wrong camera direction

alter table public.persona_reference_package_attempts
  add column if not exists derived_from_asset_id uuid;

alter table public.persona_reference_package_attempts
  add column if not exists derivation_type text;

alter table public.persona_reference_package_attempts
  add column if not exists derived_at timestamptz;

alter table public.persona_reference_package_attempts
  add column if not exists derived_by text;

comment on column public.persona_reference_package_attempts.derived_from_asset_id is
  'Source Stage B asset that was horizontally mirrored (never overwritten)';
comment on column public.persona_reference_package_attempts.derivation_type is
  'horizontal_mirror when this attempt is a local deterministic salvage';
comment on column public.persona_reference_package_attempts.derived_at is
  'When the local mirror derivation was created';
comment on column public.persona_reference_package_attempts.derived_by is
  'Actor who triggered Create mirrored version';
