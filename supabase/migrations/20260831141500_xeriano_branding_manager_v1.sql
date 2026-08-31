-- Xeriamo platform branding: Owner-managed, versioned assets with controlled public delivery.
create table if not exists public.xeriano_branding_assets (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('LOGO','ICON','FAVICON','APPLE_TOUCH_ICON')),
  storage_bucket text not null check (storage_bucket = 'xeriamo-branding'),
  storage_path text not null unique check (storage_path like 'branding/%'),
  mime_type text not null check (mime_type in ('image/png','image/webp','image/svg+xml','image/x-icon')),
  width integer check (width is null or width between 1 and 16384),
  height integer check (height is null or height between 1 and 16384),
  byte_length bigint not null check (byte_length between 1 and 5242880),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  original_filename text not null check (char_length(original_filename) between 1 and 180),
  active boolean not null default false,
  active_at timestamptz,
  activated_by uuid references auth.users(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete restrict,
  check (not active or deleted_at is null),
  check ((deleted_at is null) = (deleted_by is null)),
  check (
    (role = 'LOGO' and mime_type in ('image/png','image/webp','image/svg+xml') and byte_length <= 5242880)
    or (role = 'ICON' and mime_type in ('image/png','image/webp','image/svg+xml') and byte_length <= 2097152)
    or (role = 'FAVICON' and mime_type in ('image/png','image/svg+xml','image/x-icon') and byte_length <= 1048576)
    or (role = 'APPLE_TOUCH_ICON' and mime_type = 'image/png' and byte_length <= 2097152)
  )
);

create unique index if not exists xeriano_branding_one_active_role_idx
  on public.xeriano_branding_assets(role)
  where active and deleted_at is null;
create index if not exists xeriano_branding_role_history_idx
  on public.xeriano_branding_assets(role,created_at desc)
  where deleted_at is null;

create table if not exists public.xeriano_branding_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.xeriano_branding_assets(id) on delete set null,
  role text not null check (role in ('LOGO','ICON','FAVICON','APPLE_TOUCH_ICON')),
  action text not null check (action in ('UPLOADED','ACTIVATED','DELETED')),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists xeriano_branding_events_date_idx
  on public.xeriano_branding_events(created_at desc);

drop trigger if exists xeriano_branding_assets_touch_updated_at on public.xeriano_branding_assets;
create trigger xeriano_branding_assets_touch_updated_at
  before update on public.xeriano_branding_assets
  for each row execute function public.xeriano_touch_updated_at();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'xeriamo-branding',
  'xeriamo-branding',
  false,
  5242880,
  array['image/png','image/webp','image/svg+xml','image/x-icon']
)
on conflict(id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.xeriano_branding_assets enable row level security;
alter table public.xeriano_branding_events enable row level security;
revoke all on public.xeriano_branding_assets,public.xeriano_branding_events from public,anon,authenticated;
grant all on public.xeriano_branding_assets,public.xeriano_branding_events to service_role;

drop policy if exists xeriano_branding_objects_direct_access on storage.objects;
create policy xeriano_branding_objects_direct_access
  on storage.objects as restrictive for all to anon,authenticated
  using(bucket_id <> 'xeriamo-branding')
  with check(bucket_id <> 'xeriamo-branding');

create or replace function public.xeriano_register_branding_asset(
  p_asset_id uuid,
  p_role text,
  p_storage_path text,
  p_mime_type text,
  p_width integer,
  p_height integer,
  p_byte_length bigint,
  p_checksum_sha256 text,
  p_original_filename text,
  p_actor_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.xeriano_branding_assets(
    id,role,storage_bucket,storage_path,mime_type,width,height,byte_length,
    checksum_sha256,original_filename,created_by
  ) values (
    p_asset_id,p_role,'xeriamo-branding',p_storage_path,p_mime_type,p_width,p_height,
    p_byte_length,p_checksum_sha256,p_original_filename,p_actor_user_id
  );
  insert into public.xeriano_branding_events(asset_id,role,action,actor_user_id)
  values(p_asset_id,p_role,'UPLOADED',p_actor_user_id);
  return p_asset_id;
end;
$$;

create or replace function public.xeriano_activate_branding_asset(
  p_asset_id uuid,
  p_actor_user_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.xeriano_branding_assets
  where id = p_asset_id and deleted_at is null;
  if v_role is null then raise exception using errcode = 'P0001', message = 'BRANDING_ASSET_NOT_FOUND'; end if;

  perform pg_advisory_xact_lock(hashtextextended('xeriamo-branding:' || v_role, 0));
  select role into v_role
  from public.xeriano_branding_assets
  where id = p_asset_id and deleted_at is null
  for update;
  if v_role is null then raise exception using errcode = 'P0001', message = 'BRANDING_ASSET_NOT_FOUND'; end if;
  update public.xeriano_branding_assets
    set active = false,active_at = null,activated_by = null
    where role = v_role and active and deleted_at is null and id <> p_asset_id;
  update public.xeriano_branding_assets
    set active = true,active_at = now(),activated_by = p_actor_user_id
    where id = p_asset_id and role = v_role and deleted_at is null;
  insert into public.xeriano_branding_events(asset_id,role,action,actor_user_id)
  values(p_asset_id,v_role,'ACTIVATED',p_actor_user_id);
  return p_asset_id;
end;
$$;

create or replace function public.xeriano_delete_inactive_branding_asset(
  p_asset_id uuid,
  p_actor_user_id uuid
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.xeriano_branding_assets%rowtype;
begin
  select * into v_asset
  from public.xeriano_branding_assets
  where id = p_asset_id and deleted_at is null
  for update;
  if v_asset.id is null then raise exception using errcode = 'P0001', message = 'BRANDING_ASSET_NOT_FOUND'; end if;
  if v_asset.active then raise exception using errcode = 'P0001', message = 'BRANDING_ACTIVE_ASSET'; end if;

  update public.xeriano_branding_assets
    set deleted_at = now(),deleted_by = p_actor_user_id
    where id = p_asset_id and not active and deleted_at is null;
  insert into public.xeriano_branding_events(asset_id,role,action,actor_user_id)
  values(p_asset_id,v_asset.role,'DELETED',p_actor_user_id);
  return v_asset.storage_path;
end;
$$;

revoke all on function public.xeriano_register_branding_asset(uuid,text,text,text,integer,integer,bigint,text,text,uuid) from public,anon,authenticated;
revoke all on function public.xeriano_activate_branding_asset(uuid,uuid) from public,anon,authenticated;
revoke all on function public.xeriano_delete_inactive_branding_asset(uuid,uuid) from public,anon,authenticated;
grant execute on function public.xeriano_register_branding_asset(uuid,text,text,text,integer,integer,bigint,text,text,uuid) to service_role;
grant execute on function public.xeriano_activate_branding_asset(uuid,uuid) to service_role;
grant execute on function public.xeriano_delete_inactive_branding_asset(uuid,uuid) to service_role;
