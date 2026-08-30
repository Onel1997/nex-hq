-- Xeriano customer generation linkage and provider-acceptance settlement.
-- Additive only. This migration intentionally keeps the frozen studio job
-- stores and provider contracts unchanged.

create table if not exists public.xeriano_generation_authorities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  reservation_id uuid not null,
  job_id text not null check (char_length(job_id) between 1 and 160),
  studio text not null check (studio in ('CREATIVE_STUDIO','UGC_VIDEO_STUDIO')),
  operation public.xeriano_generation_operation not null,
  pricing_snapshot jsonb not null check (
    jsonb_typeof(pricing_snapshot) = 'object'
    and octet_length(pricing_snapshot::text) <= 8192
  ),
  state text not null default 'RESERVED' check (
    state in ('RESERVED','PROVIDER_ACCEPTED','UNKNOWN_OUTCOME','SUCCEEDED','FAILED','RELEASED')
  ),
  provider_request_id text check (
    provider_request_id is null or char_length(provider_request_id) between 1 and 500
  ),
  provider_endpoint text check (
    provider_endpoint is null or char_length(provider_endpoint) between 1 and 500
  ),
  provider_accepted_at timestamptz,
  last_observed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, job_id),
  unique (reservation_id),
  foreign key (reservation_id, account_id, job_id, operation)
    references public.xeriano_credit_reservations(id, account_id, job_id, operation)
    on delete restrict,
  check (
    (state in ('RESERVED','UNKNOWN_OUTCOME') and completed_at is null)
    or (state = 'PROVIDER_ACCEPTED' and provider_request_id is not null and provider_accepted_at is not null and completed_at is null)
    or (state in ('SUCCEEDED','FAILED') and provider_request_id is not null and provider_accepted_at is not null and completed_at is not null)
    or (state = 'RELEASED' and provider_request_id is null and completed_at is not null)
  )
);

create index if not exists xeriano_generation_authorities_recovery_idx
  on public.xeriano_generation_authorities(state, updated_at)
  where state in ('RESERVED','PROVIDER_ACCEPTED','UNKNOWN_OUTCOME');

drop trigger if exists xeriano_generation_authorities_touch_updated_at
  on public.xeriano_generation_authorities;
create trigger xeriano_generation_authorities_touch_updated_at
  before update on public.xeriano_generation_authorities
  for each row execute function public.xeriano_touch_updated_at();

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
  if p_studio not in ('CREATIVE_STUDIO','UGC_VIDEO_STUDIO') then
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

-- Provider acceptance commits the monetary reservation exactly once, while
-- deliberately keeping the concurrency claim RUNNING until the studio job is
-- terminal. The original V1 commit function is reused inside this transaction.
create or replace function public.xeriano_mark_customer_generation_accepted(
  p_account_id uuid,
  p_job_id text,
  p_provider_request_id text,
  p_provider_endpoint text
) returns public.xeriano_generation_authorities
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_authority public.xeriano_generation_authorities;
begin
  if coalesce(char_length(p_provider_request_id),0) not between 1 and 500 then
    raise exception 'PROVIDER_REQUEST_ID_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));
  select * into v_authority
  from public.xeriano_generation_authorities
  where account_id = p_account_id and job_id = p_job_id
  for update;
  if not found then raise exception 'GENERATION_AUTHORITY_NOT_FOUND'; end if;
  if v_authority.state in ('SUCCEEDED','FAILED','RELEASED') then
    raise exception 'GENERATION_AUTHORITY_TERMINAL';
  end if;
  if v_authority.provider_request_id is not null
    and v_authority.provider_request_id <> p_provider_request_id then
    raise exception 'PROVIDER_REQUEST_ID_CONFLICT';
  end if;

  perform public.xeriano_commit_credit_reservation(
    v_authority.reservation_id,
    'customer-generation:' || v_authority.id::text || ':commit'
  );
  update public.xeriano_generation_claims
    set status = 'RUNNING', completed_at = null
    where reservation_id = v_authority.reservation_id;
  update public.xeriano_generation_authorities
    set state = 'PROVIDER_ACCEPTED',
        provider_request_id = p_provider_request_id,
        provider_endpoint = nullif(p_provider_endpoint,''),
        provider_accepted_at = coalesce(provider_accepted_at,now()),
        last_observed_at = now(),
        completed_at = null
    where id = v_authority.id
    returning * into v_authority;
  return v_authority;
end;
$$;

create or replace function public.xeriano_mark_customer_generation_unknown(
  p_account_id uuid,
  p_job_id text,
  p_provider_request_id text default null,
  p_provider_endpoint text default null
) returns public.xeriano_generation_authorities
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_authority public.xeriano_generation_authorities;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));
  select * into v_authority from public.xeriano_generation_authorities
    where account_id=p_account_id and job_id=p_job_id for update;
  if not found then raise exception 'GENERATION_AUTHORITY_NOT_FOUND'; end if;
  if v_authority.state in ('SUCCEEDED','FAILED','RELEASED') then return v_authority; end if;
  if v_authority.provider_request_id is not null and p_provider_request_id is not null
    and v_authority.provider_request_id <> p_provider_request_id then
    raise exception 'PROVIDER_REQUEST_ID_CONFLICT';
  end if;
  update public.xeriano_generation_authorities set
    state='UNKNOWN_OUTCOME',
    provider_request_id=coalesce(provider_request_id,nullif(p_provider_request_id,'')),
    provider_endpoint=coalesce(provider_endpoint,nullif(p_provider_endpoint,'')),
    provider_accepted_at=case when coalesce(provider_request_id,nullif(p_provider_request_id,'')) is not null then coalesce(provider_accepted_at,now()) else provider_accepted_at end,
    last_observed_at=now(), completed_at=null
    where id=v_authority.id returning * into v_authority;
  -- UNKNOWN remains an active claim: neither credits nor a concurrency slot are
  -- released while provider acceptance is financially ambiguous.
  update public.xeriano_generation_claims set status='RUNNING',completed_at=null
    where reservation_id=v_authority.reservation_id;
  return v_authority;
end;
$$;

create or replace function public.xeriano_release_customer_generation(
  p_account_id uuid,
  p_job_id text
) returns public.xeriano_generation_authorities
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_authority public.xeriano_generation_authorities;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));
  select * into v_authority from public.xeriano_generation_authorities
    where account_id=p_account_id and job_id=p_job_id for update;
  if not found then raise exception 'GENERATION_AUTHORITY_NOT_FOUND'; end if;
  if v_authority.state = 'RELEASED' then return v_authority; end if;
  if v_authority.provider_request_id is not null
    or v_authority.state in ('PROVIDER_ACCEPTED','SUCCEEDED','FAILED') then
    raise exception 'PROVIDER_MAY_HAVE_ACCEPTED';
  end if;
  perform public.xeriano_release_credit_reservation(
    v_authority.reservation_id,
    'customer-generation:' || v_authority.id::text || ':release'
  );
  update public.xeriano_generation_authorities
    set state='RELEASED',last_observed_at=now(),completed_at=now()
    where id=v_authority.id returning * into v_authority;
  return v_authority;
end;
$$;

create or replace function public.xeriano_finalize_customer_generation(
  p_account_id uuid,
  p_job_id text,
  p_terminal_status text
) returns public.xeriano_generation_authorities
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_authority public.xeriano_generation_authorities;
begin
  if p_terminal_status not in ('SUCCEEDED','FAILED') then
    raise exception 'INVALID_GENERATION_TERMINAL_STATUS';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));
  select * into v_authority from public.xeriano_generation_authorities
    where account_id=p_account_id and job_id=p_job_id for update;
  if not found then raise exception 'GENERATION_AUTHORITY_NOT_FOUND'; end if;
  if v_authority.state in ('SUCCEEDED','FAILED') then
    if v_authority.state <> p_terminal_status then raise exception 'GENERATION_TERMINAL_CONFLICT'; end if;
    return v_authority;
  end if;
  if v_authority.provider_request_id is null then raise exception 'PROVIDER_ACCEPTANCE_NOT_PROVEN'; end if;
  if not exists (
    select 1 from public.xeriano_credit_reservations
    where id=v_authority.reservation_id and status='COMMITTED'
  ) then raise exception 'CREDIT_COMMIT_NOT_PROVEN'; end if;
  update public.xeriano_generation_claims
    set status=p_terminal_status,completed_at=now()
    where reservation_id=v_authority.reservation_id;
  update public.xeriano_generation_authorities
    set state=p_terminal_status,last_observed_at=now(),completed_at=now()
    where id=v_authority.id returning * into v_authority;
  return v_authority;
end;
$$;

alter table public.xeriano_generation_authorities enable row level security;
revoke all on public.xeriano_generation_authorities from public,anon,authenticated;
grant all on public.xeriano_generation_authorities to service_role;

revoke all on function
  public.xeriano_authorize_customer_generation(uuid,uuid,text,text,text,public.xeriano_generation_operation,text,integer,text,jsonb),
  public.xeriano_mark_customer_generation_accepted(uuid,text,text,text),
  public.xeriano_mark_customer_generation_unknown(uuid,text,text,text),
  public.xeriano_release_customer_generation(uuid,text),
  public.xeriano_finalize_customer_generation(uuid,text,text)
from public,anon,authenticated;
grant execute on function
  public.xeriano_authorize_customer_generation(uuid,uuid,text,text,text,public.xeriano_generation_operation,text,integer,text,jsonb),
  public.xeriano_mark_customer_generation_accepted(uuid,text,text,text),
  public.xeriano_mark_customer_generation_unknown(uuid,text,text,text),
  public.xeriano_release_customer_generation(uuid,text),
  public.xeriano_finalize_customer_generation(uuid,text,text)
to service_role;
