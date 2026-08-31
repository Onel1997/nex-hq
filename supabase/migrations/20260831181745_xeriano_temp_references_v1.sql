-- Xeriamo private, short-lived upload authority for Creative and UGC references.
-- Binary bodies go directly to this private Storage bucket through one-path
-- signed upload tokens; generation routes receive opaque reference ids only.

create table public.xeriano_temp_references (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  studio text not null check (studio in ('CREATIVE_STUDIO','UGC_VIDEO_STUDIO')),
  kind text not null check (kind in ('IMAGE','VIDEO','AUDIO')),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (char_length(mime_type) between 1 and 120),
  declared_byte_size bigint not null check (declared_byte_size between 1 and 209715200),
  verified_byte_size bigint check (verified_byte_size is null or verified_byte_size between 1 and 209715200),
  storage_bucket text not null default 'xeriamo-temp-references'
    check (storage_bucket = 'xeriamo-temp-references'),
  storage_path text not null unique
    check (storage_path ~ '^accounts/[0-9a-f-]{36}/references/[0-9a-f-]{36}/source\.[a-z0-9]+$'),
  upload_state text not null default 'PENDING'
    check (upload_state in ('PENDING','READY','BOUND','DELETED')),
  storage_object_id uuid,
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  width integer check (width is null or width between 1 and 32768),
  height integer check (height is null or height between 1 and 32768),
  duration_seconds numeric check (duration_seconds is null or duration_seconds > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  bound_job_id uuid,
  check (expires_at > created_at),
  check (
    (studio = 'CREATIVE_STUDIO' and kind = 'IMAGE' and mime_type in ('image/png','image/jpeg','image/webp','image/avif') and declared_byte_size <= 8388608)
    or
    (studio = 'UGC_VIDEO_STUDIO' and (
      (kind = 'IMAGE' and mime_type in ('image/png','image/jpeg','image/webp','image/gif','image/avif') and declared_byte_size <= 31457280)
      or (kind = 'VIDEO' and mime_type in ('video/mp4','video/quicktime','video/webm','video/x-m4v') and declared_byte_size <= 209715200)
      or (kind = 'AUDIO' and mime_type in ('audio/mpeg','audio/wav','audio/x-wav') and declared_byte_size <= 15728640)
    ))
  )
);

create index xeriano_temp_references_account_expiry_idx
  on public.xeriano_temp_references(account_id,expires_at desc);
create index xeriano_temp_references_actor_state_idx
  on public.xeriano_temp_references(actor_user_id,upload_state,created_at desc);
create index xeriano_temp_references_cleanup_idx
  on public.xeriano_temp_references(expires_at)
  where upload_state <> 'DELETED';

drop trigger if exists xeriano_temp_references_touch_updated_at on public.xeriano_temp_references;
create trigger xeriano_temp_references_touch_updated_at
  before update on public.xeriano_temp_references
  for each row execute function public.xeriano_touch_updated_at();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'xeriamo-temp-references',
  'xeriamo-temp-references',
  false,
  209715200,
  array[
    'image/png','image/jpeg','image/webp','image/gif','image/avif',
    'video/mp4','video/quicktime','video/webm','video/x-m4v',
    'audio/mpeg','audio/wav','audio/x-wav'
  ]
)
on conflict(id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.xeriano_temp_references enable row level security;
revoke all on public.xeriano_temp_references from public,anon,authenticated;
grant all on public.xeriano_temp_references to service_role;

-- Never grant ordinary browser sessions a general list/read/write path. Signed
-- upload tokens are minted server-side for one generated object path only.
drop policy if exists xeriano_temp_reference_objects_direct_access on storage.objects;
create policy xeriano_temp_reference_objects_direct_access
  on storage.objects as restrictive for all to anon,authenticated
  using(bucket_id <> 'xeriamo-temp-references')
  with check(bucket_id <> 'xeriamo-temp-references');
