-- Phase 2.3D.6 — Persist real post-generation orientation evidence

alter table public.persona_reference_package_attempts
  add column if not exists detected_orientation text;

alter table public.persona_reference_package_attempts
  add column if not exists detected_yaw_degrees numeric;

comment on column public.persona_reference_package_attempts.detected_orientation is
  'Observed head orientation from facial landmarks: image_left|image_right|frontal|profile_left|profile_right|uncertain';
comment on column public.persona_reference_package_attempts.detected_yaw_degrees is
  'Approximate yaw degrees; positive = nose toward image-right';
