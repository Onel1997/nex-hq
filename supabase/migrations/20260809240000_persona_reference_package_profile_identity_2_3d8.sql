-- Phase 2.3D.8 — Persist profile identity preservation mode/version on attempts

alter table public.persona_reference_package_attempts
  add column if not exists profile_identity_mode text;

alter table public.persona_reference_package_attempts
  add column if not exists profile_prompt_version text;

comment on column public.persona_reference_package_attempts.profile_identity_mode is
  'Profile-only identity mode, e.g. profile_identity_preservation_v1; null for non-profile slots';
comment on column public.persona_reference_package_attempts.profile_prompt_version is
  'Version string for the profile identity prompt builder';
