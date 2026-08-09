-- Phase 2.3D.4 — Wrong-angle reassignment metadata on Stage B attempts.
-- requested slot remains reference_slot; effective_slot is the live coverage slot.

alter table public.persona_reference_package_attempts
  add column if not exists effective_slot text;

alter table public.persona_reference_package_attempts
  add column if not exists reassigned_from text;

alter table public.persona_reference_package_attempts
  add column if not exists reassigned_at timestamptz;

alter table public.persona_reference_package_attempts
  add column if not exists reassigned_by text;

alter table public.persona_reference_package_attempts
  add column if not exists angle_review_source text;

alter table public.persona_reference_package_attempts
  add column if not exists angle_review_decision text;

comment on column public.persona_reference_package_attempts.reference_slot is
  'Originally requested generation slot — historically immutable.';
comment on column public.persona_reference_package_attempts.effective_slot is
  'Live coverage slot after optional user reassignment; null means same as reference_slot.';
