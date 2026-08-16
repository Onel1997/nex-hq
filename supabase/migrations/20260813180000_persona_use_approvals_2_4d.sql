-- Phase 2.4D — Image / Video Use Approval + Brand Cast Approval metadata

alter table public.persona_personas
  add column if not exists image_use_approved_at timestamptz,
  add column if not exists image_use_approved_by uuid,
  add column if not exists video_use_approved_at timestamptz,
  add column if not exists video_use_approved_by uuid,
  add column if not exists brand_cast_approved boolean not null default false,
  add column if not exists brand_cast_approved_at timestamptz,
  add column if not exists brand_cast_approved_by uuid;

-- Backfill Brand Cast flag from legacy approved + Approved status only.
update public.persona_personas
set brand_cast_approved = true
where approved = true
  and status = 'Approved'
  and brand_cast_approved = false;

comment on column public.persona_personas.image_use_approved_at is
  'When Image Studio use was explicitly approved (Phase 2.4D).';
comment on column public.persona_personas.video_use_approved_at is
  'When Video Studio use was explicitly approved (Phase 2.4D).';
comment on column public.persona_personas.brand_cast_approved is
  'Official Brand Cast membership — separate from image/video use gates (Phase 2.4D).';
comment on column public.persona_personas.brand_cast_approved_at is
  'When Official Brand Cast approval was granted (Phase 2.4D).';
