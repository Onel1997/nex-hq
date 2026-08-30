-- Xeriano V1 account-owned Library and handoff authority.
do $$ begin create type public.xeriano_asset_type as enum ('DESIGN','IMAGE','VIDEO','REFERENCE');
exception when duplicate_object then null; end $$;

create table if not exists public.xeriano_library_assets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  asset_type public.xeriano_asset_type not null,
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  source_studio text not null check (source_studio in ('DESIGN_STUDIO','CREATIVE_STUDIO','UGC_VIDEO_STUDIO','UPLOAD')),
  source_job_id text check (source_job_id is null or char_length(source_job_id) between 1 and 160),
  source_result_id text check (source_result_id is null or char_length(source_result_id) between 1 and 160),
  storage_bucket text not null check (storage_bucket = 'xeriano-library-assets'),
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','video/mp4','audio/mpeg','audio/wav')),
  byte_length bigint not null check (byte_length > 0 and byte_length <= 52428800),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  favorite boolean not null default false,
  tags text[] not null default '{}' check (
    cardinality(tags) <= 20
    and array_position(tags, null) is null
    and octet_length(array_to_string(tags, '')) <= 800
  ),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object' and octet_length(provenance::text) <= 32768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path like 'accounts/' || account_id::text || '/%'),
  check (
    (source_studio = 'DESIGN_STUDIO' and asset_type = 'DESIGN')
    or (source_studio = 'CREATIVE_STUDIO' and asset_type = 'IMAGE' and source_job_id is not null and source_result_id is not null)
    or (source_studio = 'UGC_VIDEO_STUDIO' and asset_type = 'VIDEO' and source_job_id is not null and source_result_id is not null)
    or source_studio = 'UPLOAD'
  ),
  check (
    (asset_type in ('DESIGN','IMAGE') and mime_type in ('image/png','image/jpeg','image/webp'))
    or (asset_type = 'VIDEO' and mime_type = 'video/mp4')
    or asset_type = 'REFERENCE'
  ),
  unique(account_id,storage_bucket,storage_path),
  unique(account_id,source_studio,source_job_id,source_result_id),
  unique(id,account_id)
);
create index if not exists xeriano_library_assets_account_date_idx on public.xeriano_library_assets(account_id,created_at desc);
create index if not exists xeriano_library_assets_list_idx on public.xeriano_library_assets(account_id,asset_type,created_at desc);
create index if not exists xeriano_library_assets_favorite_idx on public.xeriano_library_assets(account_id,created_at desc) where favorite;

create table if not exists public.xeriano_asset_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete cascade,
  asset_id uuid not null,
  target_studio text not null check (target_studio in ('CREATIVE_STUDIO','UGC_VIDEO_STUDIO')),
  handoff_token_hash text check (handoff_token_hash is null or handoff_token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  check (consumed_at is null or consumed_at >= created_at),
  foreign key (asset_id,account_id)
    references public.xeriano_library_assets(id,account_id) on delete cascade
);
create index if not exists xeriano_asset_links_account_idx on public.xeriano_asset_links(account_id,created_at desc);
create index if not exists xeriano_asset_links_asset_idx on public.xeriano_asset_links(asset_id);
create unique index if not exists xeriano_asset_links_token_idx on public.xeriano_asset_links(handoff_token_hash) where handoff_token_hash is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('xeriano-library-assets','xeriano-library-assets',false,52428800,array['image/png','image/jpeg','image/webp','video/mp4','audio/mpeg','audio/wav'])
on conflict(id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop trigger if exists xeriano_library_assets_touch_updated_at on public.xeriano_library_assets;
create trigger xeriano_library_assets_touch_updated_at
  before update on public.xeriano_library_assets
  for each row execute function public.xeriano_touch_updated_at();

alter table public.xeriano_library_assets enable row level security;
alter table public.xeriano_asset_links enable row level security;
revoke all on public.xeriano_library_assets,public.xeriano_asset_links from public,anon,authenticated;
grant select on public.xeriano_library_assets,public.xeriano_asset_links to authenticated;
grant update(title,description,favorite,tags) on public.xeriano_library_assets to authenticated;
drop policy if exists xeriano_library_read_member on public.xeriano_library_assets;
create policy xeriano_library_read_member on public.xeriano_library_assets for select to authenticated using(public.xeriano_is_account_member(account_id));
drop policy if exists xeriano_library_update_owner on public.xeriano_library_assets;
create policy xeriano_library_update_owner on public.xeriano_library_assets for update to authenticated using(owner_user_id=auth.uid() and public.xeriano_is_account_member(account_id)) with check(owner_user_id=auth.uid() and public.xeriano_is_account_member(account_id));
drop policy if exists xeriano_asset_links_read_member on public.xeriano_asset_links;
create policy xeriano_asset_links_read_member on public.xeriano_asset_links for select to authenticated using(public.xeriano_is_account_member(account_id));
grant all on public.xeriano_library_assets,public.xeriano_asset_links to service_role;

-- Direct object access is denied. Xeriano server routes authorize membership and
-- stream private bytes with the service role; clients never choose storage paths.
drop policy if exists xeriano_library_objects_direct_access on storage.objects;
create policy xeriano_library_objects_direct_access
  on storage.objects as restrictive for all to anon, authenticated
  using(bucket_id <> 'xeriano-library-assets')
  with check(bucket_id <> 'xeriano-library-assets');
