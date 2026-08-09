-- Phase 2.3D.3 — angle_direction on reference package attempts

alter table public.persona_reference_package_attempts
  add column if not exists angle_direction text;
