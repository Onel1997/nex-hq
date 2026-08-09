-- Phase 2.3D.7 — Persist inverted provider-direction fallback metadata
-- Canonical requested_slot (reference_slot) is never rewritten.

alter table public.persona_reference_package_attempts
  add column if not exists provider_direction_strategy text;

alter table public.persona_reference_package_attempts
  add column if not exists provider_requested_direction text;

comment on column public.persona_reference_package_attempts.provider_direction_strategy is
  'canonical | inverted_fallback — how the provider prompt direction was chosen';
comment on column public.persona_reference_package_attempts.provider_requested_direction is
  'Direction instruction sent to the provider (may differ from reference_slot under inverted_fallback)';
