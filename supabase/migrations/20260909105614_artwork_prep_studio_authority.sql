-- Additive authority for the OWNER-only Artwork Prep Studio. Existing upload,
-- Library, Creation and RLS behavior remains unchanged.

alter table public.xeriano_temp_references
  add constraint xeriano_temp_references_studio_v3_check
  check (studio in ('CREATIVE_STUDIO','UGC_VIDEO_STUDIO','VIDEO_EDITOR_STUDIO','ARTWORK_PREP_STUDIO'))
  not valid;

alter table public.xeriano_temp_references
  validate constraint xeriano_temp_references_studio_v3_check;

alter table public.xeriano_temp_references
  add constraint xeriano_temp_references_payload_v3_check
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
    or
    (studio = 'ARTWORK_PREP_STUDIO' and kind = 'IMAGE' and (
      (mime_type in ('image/png','image/jpeg','image/webp') and declared_byte_size <= 20971520)
      or (mime_type = 'image/svg+xml' and declared_byte_size <= 5242880)
    ))
  )
  not valid;

alter table public.xeriano_temp_references
  validate constraint xeriano_temp_references_payload_v3_check;

alter table public.xeriano_temp_references
  drop constraint if exists xeriano_temp_references_studio_v2_check;

alter table public.xeriano_temp_references
  drop constraint if exists xeriano_temp_references_payload_v2_check;

update storage.buckets
set allowed_mime_types = case
  when allowed_mime_types is null then array['image/svg+xml']::text[]
  when not ('image/svg+xml' = any(allowed_mime_types)) then array_append(allowed_mime_types, 'image/svg+xml')
  else allowed_mime_types
end
where id = 'xeriamo-temp-references';

alter table public.xeriano_library_assets
  add constraint xeriano_library_assets_source_studio_v2_check
  check (source_studio in ('DESIGN_STUDIO','CREATIVE_STUDIO','UGC_VIDEO_STUDIO','UPLOAD','ARTWORK_PREP_STUDIO'))
  not valid;

alter table public.xeriano_library_assets
  validate constraint xeriano_library_assets_source_studio_v2_check;

alter table public.xeriano_library_assets
  add constraint xeriano_library_assets_source_type_v2_check
  check (
    (source_studio = 'DESIGN_STUDIO' and asset_type = 'DESIGN')
    or (source_studio = 'ARTWORK_PREP_STUDIO' and asset_type = 'DESIGN')
    or (source_studio = 'CREATIVE_STUDIO' and asset_type = 'IMAGE' and source_job_id is not null and source_result_id is not null)
    or (source_studio = 'UGC_VIDEO_STUDIO' and asset_type = 'VIDEO' and source_job_id is not null and source_result_id is not null)
    or source_studio = 'UPLOAD'
  )
  not valid;

alter table public.xeriano_library_assets
  validate constraint xeriano_library_assets_source_type_v2_check;

do $$
declare constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.xeriano_library_assets'::regclass
      and contype = 'c'
      and conname not in (
        'xeriano_library_assets_source_studio_v2_check',
        'xeriano_library_assets_source_type_v2_check'
      )
      and pg_get_constraintdef(oid) ilike '%source_studio%'
  loop
    execute format(
      'alter table public.xeriano_library_assets drop constraint %I',
      constraint_row.conname
    );
  end loop;
end;
$$;

alter table public.xeriano_creations
  drop constraint if exists xeriano_creations_source_studio_check;
alter table public.xeriano_creations
  add constraint xeriano_creations_source_studio_check
  check (source_studio in ('CREATIVE_STUDIO','UGC_VIDEO_STUDIO','DESIGN_STUDIO','ARTWORK_PREP_STUDIO'));

alter table public.xeriano_creations
  drop constraint if exists xeriano_creations_check;
alter table public.xeriano_creations
  add constraint xeriano_creations_check
  check (
    (creation_type = 'IMAGE' and source_studio in ('CREATIVE_STUDIO','DESIGN_STUDIO','ARTWORK_PREP_STUDIO'))
    or (creation_type = 'VIDEO' and source_studio = 'UGC_VIDEO_STUDIO')
  );

-- The new studio remains private and server-authoritative. Browser roles gain
-- no insert/update privileges from this extension.
alter table public.xeriano_temp_references enable row level security;
alter table public.xeriano_library_assets enable row level security;
alter table public.xeriano_creations enable row level security;
revoke all on public.xeriano_temp_references, public.xeriano_creations
  from public, anon, authenticated;
grant all on public.xeriano_temp_references, public.xeriano_library_assets,
  public.xeriano_creations to service_role;
