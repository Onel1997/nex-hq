-- Additive Design Studio authority extension. Existing reservation, locking,
-- settlement and RLS authorities remain unchanged.

alter table public.xeriano_generation_authorities
  drop constraint if exists xeriano_generation_authorities_studio_check;
alter table public.xeriano_generation_authorities
  add constraint xeriano_generation_authorities_studio_check
  check (studio in ('CREATIVE_STUDIO','UGC_VIDEO_STUDIO','DESIGN_STUDIO'));

create or replace function public.xeriano_authorize_customer_generation(
  p_account_id uuid,
  p_actor_user_id uuid,
  p_job_id text,
  p_idempotency_key text,
  p_model_id text,
  p_operation public.xeriano_generation_operation,
  p_pricing_version text,
  p_amount integer,
  p_studio text,
  p_pricing_snapshot jsonb
) returns public.xeriano_generation_authorities
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_reservation public.xeriano_credit_reservations;
  v_existing public.xeriano_generation_authorities;
  v_authority public.xeriano_generation_authorities;
begin
  if p_studio not in ('CREATIVE_STUDIO','UGC_VIDEO_STUDIO','DESIGN_STUDIO') then
    raise exception 'INVALID_CUSTOMER_STUDIO';
  end if;
  if jsonb_typeof(p_pricing_snapshot) <> 'object'
    or octet_length(p_pricing_snapshot::text) > 8192
    or p_pricing_snapshot->>'modelId' <> p_model_id
    or p_pricing_snapshot->>'pricingVersion' <> p_pricing_version
    or coalesce((p_pricing_snapshot->>'credits')::integer,0) <> p_amount then
    raise exception 'INVALID_PRICING_SNAPSHOT';
  end if;
  if not exists (
    select 1
    from public.xeriano_account_memberships m
    join public.xeriano_accounts a on a.id = m.account_id
    where m.account_id = p_account_id
      and m.user_id = p_actor_user_id
      and m.role = 'CUSTOMER'
      and m.status = 'ACTIVE'
      and a.status = 'ACTIVE'
  ) then
    raise exception 'CUSTOMER_ACCOUNT_ACCESS_DENIED';
  end if;

  v_reservation := public.xeriano_reserve_credits(
    p_account_id,
    p_job_id,
    p_idempotency_key,
    p_model_id,
    p_operation,
    p_pricing_version,
    p_amount
  );

  select * into v_existing
  from public.xeriano_generation_authorities
  where account_id = p_account_id and job_id = p_job_id;
  if found then
    if v_existing.actor_user_id <> p_actor_user_id
      or v_existing.reservation_id <> v_reservation.id
      or v_existing.studio <> p_studio
      or v_existing.operation <> p_operation
      or v_existing.pricing_snapshot <> p_pricing_snapshot then
      raise exception 'GENERATION_AUTHORITY_IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing;
  end if;

  insert into public.xeriano_generation_authorities(
    account_id, actor_user_id, reservation_id, job_id, studio, operation,
    pricing_snapshot
  ) values (
    p_account_id, p_actor_user_id, v_reservation.id, p_job_id, p_studio,
    p_operation, p_pricing_snapshot
  ) returning * into v_authority;
  return v_authority;
end;
$$;

revoke all on function
  public.xeriano_authorize_customer_generation(uuid,uuid,text,text,text,public.xeriano_generation_operation,text,integer,text,jsonb)
from public,anon,authenticated;
grant execute on function
  public.xeriano_authorize_customer_generation(uuid,uuid,text,text,text,public.xeriano_generation_operation,text,integer,text,jsonb)
to service_role;

alter table public.xeriano_creations
  drop constraint if exists xeriano_creations_source_studio_check;
alter table public.xeriano_creations
  add constraint xeriano_creations_source_studio_check
  check (source_studio in ('CREATIVE_STUDIO','UGC_VIDEO_STUDIO','DESIGN_STUDIO'));

alter table public.xeriano_creations
  drop constraint if exists xeriano_creations_check;
alter table public.xeriano_creations
  add constraint xeriano_creations_check
  check (
    (creation_type = 'IMAGE' and source_studio in ('CREATIVE_STUDIO','DESIGN_STUDIO'))
    or (creation_type = 'VIDEO' and source_studio = 'UGC_VIDEO_STUDIO')
  );

-- Generated Recraft vectors remain first-class DESIGN assets. The existing
-- private Library authority is extended in place; no parallel asset table or
-- public object access is introduced.
-- PostgreSQL may assign different suffixes to unnamed table checks depending
-- on the server version. Remove only the two existing MIME-related checks by
-- their definition, leaving source/storage/account checks untouched.
do $$
declare v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.xeriano_library_assets'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%mime_type%'
  loop
    execute format(
      'alter table public.xeriano_library_assets drop constraint %I',
      v_constraint.conname
    );
  end loop;
end;
$$;
alter table public.xeriano_library_assets
  add constraint xeriano_library_assets_mime_type_v2_check
  check (mime_type in (
    'image/png','image/jpeg','image/webp','image/svg+xml',
    'video/mp4','audio/mpeg','audio/wav'
  ));

alter table public.xeriano_library_assets
  add constraint xeriano_library_assets_type_mime_v2_check
  check (
    (asset_type = 'DESIGN' and mime_type in ('image/png','image/jpeg','image/webp','image/svg+xml'))
    or (asset_type = 'IMAGE' and mime_type in ('image/png','image/jpeg','image/webp'))
    or (asset_type = 'VIDEO' and mime_type = 'video/mp4')
    or asset_type = 'REFERENCE'
  );

update storage.buckets
set allowed_mime_types = array[
  'image/png','image/jpeg','image/webp','image/svg+xml',
  'video/mp4','audio/mpeg','audio/wav'
]
where id = 'xeriano-library-assets';

-- Reassert the original security boundary explicitly; no browser role gains
-- financial mutation authority from this extension.
alter table public.xeriano_generation_authorities enable row level security;
alter table public.xeriano_creations enable row level security;
revoke all on public.xeriano_generation_authorities, public.xeriano_creations
  from public, anon, authenticated;
grant all on public.xeriano_generation_authorities, public.xeriano_creations
  to service_role;
