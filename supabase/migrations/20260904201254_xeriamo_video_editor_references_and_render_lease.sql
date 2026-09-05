-- Additive private upload authority and render concurrency guard for the
-- OWNER-only Xeriamo Video Editor Studio. Existing Creative/UGC rows and
-- their accepted contracts remain unchanged.

alter table public.xeriano_temp_references
  add constraint xeriano_temp_references_studio_v2_check
  check (studio in ('CREATIVE_STUDIO','UGC_VIDEO_STUDIO','VIDEO_EDITOR_STUDIO'))
  not valid;

alter table public.xeriano_temp_references
  validate constraint xeriano_temp_references_studio_v2_check;

alter table public.xeriano_temp_references
  add constraint xeriano_temp_references_payload_v2_check
  check (
    (studio = 'CREATIVE_STUDIO' and kind = 'IMAGE' and mime_type in ('image/png','image/jpeg','image/webp','image/avif') and declared_byte_size <= 8388608)
    or
    (studio = 'UGC_VIDEO_STUDIO' and (
      (kind = 'IMAGE' and mime_type in ('image/png','image/jpeg','image/webp','image/gif','image/avif') and declared_byte_size <= 31457280)
      or (kind = 'VIDEO' and mime_type in ('video/mp4','video/quicktime','video/webm','video/x-m4v') and declared_byte_size <= 209715200)
      or (kind = 'AUDIO' and mime_type in ('audio/mpeg','audio/wav','audio/x-wav') and declared_byte_size <= 15728640)
    ))
    or
    (studio = 'VIDEO_EDITOR_STUDIO' and (
      (kind = 'VIDEO' and mime_type in ('video/mp4','video/quicktime','video/webm','video/x-m4v') and declared_byte_size <= 104857600)
      or (kind = 'AUDIO' and mime_type in ('audio/mpeg','audio/wav','audio/x-wav') and declared_byte_size <= 15728640)
    ))
  )
  not valid;

alter table public.xeriano_temp_references
  validate constraint xeriano_temp_references_payload_v2_check;

alter table public.xeriano_temp_references
  drop constraint if exists xeriano_temp_references_studio_check;

alter table public.xeriano_temp_references
  drop constraint if exists xeriano_temp_references_check1;

create table public.xeriano_video_editor_render_leases (
  account_id uuid not null references public.xeriano_accounts(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (account_id, actor_user_id),
  unique (job_id),
  constraint xeriano_video_editor_render_leases_expiry_check
    check (expires_at > acquired_at)
);

create index xeriano_video_editor_render_leases_expiry_idx
  on public.xeriano_video_editor_render_leases(expires_at);

alter table public.xeriano_video_editor_render_leases enable row level security;
revoke all on public.xeriano_video_editor_render_leases from public, anon, authenticated;
grant all on public.xeriano_video_editor_render_leases to service_role;

comment on table public.xeriano_video_editor_render_leases is
  'Private service-role-only lease preventing concurrent Video Editor renders per Xeriamo account actor.';
