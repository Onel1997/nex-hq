-- Phase 2.3D.8 — Explicit human identity override (machine evidence preserved)

alter table public.persona_reference_package_attempts
  add column if not exists human_identity_review text;

alter table public.persona_reference_package_attempts
  add column if not exists human_identity_reviewed_at timestamptz;

alter table public.persona_reference_package_attempts
  add column if not exists human_identity_reviewed_by text;

alter table public.persona_reference_package_attempts
  add column if not exists human_identity_override_reason text;

alter table public.persona_reference_package_attempts
  add column if not exists identity_override_version text;

comment on column public.persona_reference_package_attempts.human_identity_review is
  'none|approved_override|rejected — human review of machine identity; never rewrites identity_decision';
comment on column public.persona_reference_package_attempts.identity_override_version is
  'Policy version for human identity override, e.g. human-identity-override-v1.0.0';
