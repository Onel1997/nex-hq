-- Phase 2.3D.10 — Safe regeneration of accepted Stage B angles

alter table public.persona_reference_package_attempts
  add column if not exists replacement_for_asset_id uuid;

alter table public.persona_reference_package_attempts
  add column if not exists replacement_for_slot text;

alter table public.persona_reference_package_attempts
  add column if not exists replacement_candidate boolean not null default false;

comment on column public.persona_reference_package_attempts.replacement_for_asset_id is
  'Incumbent accepted asset this paid regeneration intends to replace';
comment on column public.persona_reference_package_attempts.replacement_for_slot is
  'Canonical slot the replacement candidate targets (same as reference_slot)';
comment on column public.persona_reference_package_attempts.replacement_candidate is
  'True when this attempt/asset is a pending replacement for an accepted reference';

-- Allow superseded status on reference assets (retired accepted refs after swap)
alter table public.persona_reference_assets
  drop constraint if exists persona_reference_assets_status_check;

alter table public.persona_reference_assets
  add constraint persona_reference_assets_status_check
  check (status in ('uploaded', 'review', 'approved', 'rejected', 'archived', 'superseded'));

alter table public.persona_reference_assets
  add column if not exists superseded_by_asset_id uuid;

comment on column public.persona_reference_assets.superseded_by_asset_id is
  'Replacement asset that superseded this previously accepted reference';
