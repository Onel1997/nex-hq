-- OWNER-only Xeriamo customer-center and manual credit grant authority.
-- Financial primitives remain the existing buckets + immutable ledger.

create table if not exists public.xeriano_manual_credit_grants (
  id uuid primary key,
  account_id uuid not null references public.xeriano_credit_accounts(account_id) on delete restrict,
  bucket_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  amount integer not null check (amount between 1 and 1000000),
  reason text not null check (char_length(trim(reason)) between 2 and 500),
  source_key text not null unique check (source_key ~ '^manual:[0-9a-f-]{36}$'),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 240),
  created_at timestamptz not null default now(),
  foreign key (bucket_id,account_id)
    references public.xeriano_credit_buckets(id,account_id) on delete restrict,
  unique (id,account_id)
);

create index if not exists xeriano_manual_credit_grants_account_idx
  on public.xeriano_manual_credit_grants(account_id,created_at desc);
create index if not exists xeriano_manual_credit_grants_owner_idx
  on public.xeriano_manual_credit_grants(owner_user_id,created_at desc);

-- Bounded OWNER search/list paths use prefix-search and sort indexes instead
-- of loading the customer corpus into application memory.
create index if not exists xeriano_owner_accounts_created_idx
  on public.xeriano_accounts(created_at desc,id);
create index if not exists xeriano_owner_accounts_name_search_idx
  on public.xeriano_accounts(lower(name) text_pattern_ops);
create index if not exists xeriano_owner_profiles_name_search_idx
  on public.xeriano_profiles(lower(display_name) text_pattern_ops);

create or replace function public.xeriano_manual_credit_grants_immutable()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  raise exception 'xeriano_manual_credit_grants is append-only';
end; $$;

revoke all on function public.xeriano_manual_credit_grants_immutable() from public,anon,authenticated;
drop trigger if exists xeriano_manual_credit_grants_no_mutation on public.xeriano_manual_credit_grants;
create trigger xeriano_manual_credit_grants_no_mutation
  before update or delete on public.xeriano_manual_credit_grants
  for each row execute function public.xeriano_manual_credit_grants_immutable();

create or replace function public.xeriano_grant_manual_credits(
  p_grant_id uuid,
  p_account_id uuid,
  p_owner_user_id uuid,
  p_amount integer,
  p_reason text,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_existing public.xeriano_manual_credit_grants;
  v_bucket_id uuid;
  v_available integer;
  v_reason text := trim(p_reason);
  v_source_key text := 'manual:' || p_grant_id::text;
begin
  if p_grant_id is null or p_account_id is null or p_owner_user_id is null
    or p_amount not between 1 and 1000000
    or coalesce(char_length(v_reason),0) not between 2 and 500
    or coalesce(char_length(p_idempotency_key),0) not between 1 and 240
  then raise exception 'INVALID_MANUAL_CREDIT_GRANT'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text,0));

  select * into v_existing
  from public.xeriano_manual_credit_grants
  where id=p_grant_id or idempotency_key=p_idempotency_key
  order by created_at asc
  limit 1
  for update;

  if found then
    if v_existing.id<>p_grant_id
      or v_existing.account_id<>p_account_id
      or v_existing.owner_user_id<>p_owner_user_id
      or v_existing.amount<>p_amount
      or v_existing.reason<>v_reason
      or v_existing.idempotency_key<>p_idempotency_key
    then raise exception 'MANUAL_CREDIT_IDEMPOTENCY_CONFLICT'; end if;
    select coalesce(sum(remaining_credits-reserved_credits),0)::integer into v_available
    from public.xeriano_credit_buckets
    where account_id=p_account_id and (expires_at is null or expires_at>now());
    return jsonb_build_object(
      'status','REPLAYED','grantId',v_existing.id,'amount',v_existing.amount,
      'availableCredits',v_available,'createdAt',v_existing.created_at
    );
  end if;

  perform 1 from public.xeriano_accounts
    where id=p_account_id and status='ACTIVE';
  if not found then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;

  perform 1 from public.xeriano_credit_accounts
    where account_id=p_account_id for update;
  if not found then raise exception 'CREDIT_ACCOUNT_NOT_FOUND'; end if;

  insert into public.xeriano_credit_buckets(
    account_id,bucket_type,source_key,granted_credits,remaining_credits,
    reserved_credits,expires_at,granted_at
  ) values (
    p_account_id,'MANUAL',v_source_key,p_amount,p_amount,0,null,now()
  ) returning id into v_bucket_id;

  insert into public.xeriano_manual_credit_grants(
    id,account_id,bucket_id,owner_user_id,amount,reason,source_key,idempotency_key
  ) values (
    p_grant_id,p_account_id,v_bucket_id,p_owner_user_id,p_amount,v_reason,
    v_source_key,p_idempotency_key
  );

  select coalesce(sum(remaining_credits-reserved_credits),0)::integer into v_available
  from public.xeriano_credit_buckets
  where account_id=p_account_id and (expires_at is null or expires_at>now());

  insert into public.xeriano_credit_ledger(
    account_id,bucket_id,transaction_type,amount_delta,resulting_available,
    idempotency_key,metadata
  ) values (
    p_account_id,v_bucket_id,'GRANT',p_amount,v_available,
    v_source_key||':grant',
    jsonb_build_object('grantType','MANUAL','commercialValueAuthority',false)
  );

  return jsonb_build_object(
    'status','GRANTED','grantId',p_grant_id,'amount',p_amount,
    'availableCredits',v_available,'createdAt',now()
  );
end; $$;

-- A single bounded OWNER query resolves canonical account/profile/membership,
-- plan and wallet authority without N+1 reads. Access remains service-only;
-- the application route independently requires the OWNER role.
create or replace function public.xeriano_owner_list_customers(
  p_search text default null,
  p_plan text default null,
  p_status text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_account_id uuid default null
) returns table (
  account_id uuid,
  user_id uuid,
  display_name text,
  email text,
  account_status text,
  current_plan text,
  subscription_status text,
  renewal_at timestamptz,
  total_available integer,
  subscription_available integer,
  topup_available integer,
  trial_available integer,
  manual_available integer,
  reserved_credits integer,
  registered_at timestamptz,
  latest_activity_at timestamptz,
  total_count bigint
)
language sql stable security definer set search_path=pg_catalog,public,auth as $$
  with customer_base as (
    select
      a.id as account_id,
      member.user_id,
      coalesce(nullif(trim(profile.display_name),''),a.name) as display_name,
      users.email::text as email,
      a.status as account_status,
      coalesce(subscription.plan::text,'FREE') as current_plan,
      coalesce(subscription.status,'TRIAL') as subscription_status,
      subscription.current_period_end as renewal_at,
      a.created_at as registered_at
    from public.xeriano_accounts a
    join lateral (
      select membership.user_id
      from public.xeriano_account_memberships membership
      where membership.account_id=a.id
        and membership.role='CUSTOMER'
        and membership.status='ACTIVE'
      order by membership.is_primary desc,membership.created_at asc
      limit 1
    ) member on true
    join auth.users users on users.id=member.user_id
    left join public.xeriano_profiles profile on profile.user_id=member.user_id
    left join public.xeriano_subscription_state subscription on subscription.account_id=a.id
    where (p_account_id is null or a.id=p_account_id)
      and (
        nullif(trim(p_search),'') is null
        or lower(coalesce(users.email,'')) like lower(trim(p_search)) || '%'
        or lower(coalesce(profile.display_name,'')) like lower(trim(p_search)) || '%'
        or lower(coalesce(a.name,'')) like lower(trim(p_search)) || '%'
      )
      and (nullif(trim(p_plan),'') is null or upper(trim(p_plan))=coalesce(subscription.plan::text,'FREE'))
      and (nullif(trim(p_status),'') is null or upper(trim(p_status))=a.status)
  ), counted as (
    select customer_base.*,count(*) over() as total_count
    from customer_base
    order by registered_at desc,account_id
    limit least(greatest(p_limit,1),50)
    offset greatest(p_offset,0)
  )
  select
    counted.account_id,counted.user_id,counted.display_name,counted.email,
    counted.account_status,counted.current_plan,counted.subscription_status,
    counted.renewal_at,
    coalesce(wallet.total_available,0)::integer,
    coalesce(wallet.subscription_available,0)::integer,
    coalesce(wallet.topup_available,0)::integer,
    coalesce(wallet.trial_available,0)::integer,
    coalesce(wallet.manual_available,0)::integer,
    coalesce(wallet.reserved_credits,0)::integer,
    counted.registered_at,
    coalesce(activity.latest_activity_at,counted.registered_at),
    counted.total_count
  from counted
  left join lateral (
    select
      coalesce(sum(bucket.remaining_credits-bucket.reserved_credits)
        filter(where bucket.expires_at is null or bucket.expires_at>now()),0) as total_available,
      coalesce(sum(bucket.remaining_credits-bucket.reserved_credits)
        filter(where bucket.bucket_type='SUBSCRIPTION' and (bucket.expires_at is null or bucket.expires_at>now())),0) as subscription_available,
      coalesce(sum(bucket.remaining_credits-bucket.reserved_credits)
        filter(where bucket.bucket_type='TOP_UP' and (bucket.expires_at is null or bucket.expires_at>now())),0) as topup_available,
      coalesce(sum(bucket.remaining_credits-bucket.reserved_credits)
        filter(where bucket.bucket_type='TRIAL' and (bucket.expires_at is null or bucket.expires_at>now())),0) as trial_available,
      coalesce(sum(bucket.remaining_credits-bucket.reserved_credits)
        filter(where bucket.bucket_type='MANUAL' and (bucket.expires_at is null or bucket.expires_at>now())),0) as manual_available,
      coalesce(sum(bucket.reserved_credits)
        filter(where bucket.expires_at is null or bucket.expires_at>now()),0) as reserved_credits
    from public.xeriano_credit_buckets bucket
    where bucket.account_id=counted.account_id
  ) wallet on true
  left join lateral (
    select max(ledger.created_at) as latest_activity_at
    from public.xeriano_credit_ledger ledger
    where ledger.account_id=counted.account_id
  ) activity on true
  order by counted.registered_at desc,counted.account_id;
$$;

alter table public.xeriano_manual_credit_grants enable row level security;
revoke all on public.xeriano_manual_credit_grants from public,anon,authenticated;
grant all on public.xeriano_manual_credit_grants to service_role;

revoke all on function public.xeriano_grant_manual_credits(uuid,uuid,uuid,integer,text,text)
  from public,anon,authenticated;
revoke all on function public.xeriano_owner_list_customers(text,text,text,integer,integer,uuid)
  from public,anon,authenticated;
grant execute on function public.xeriano_grant_manual_credits(uuid,uuid,uuid,integer,text,text)
  to service_role;
grant execute on function public.xeriano_owner_list_customers(text,text,text,integer,integer,uuid)
  to service_role;

comment on table public.xeriano_manual_credit_grants is
  'Append-only OWNER audit authority for non-commercial manual/beta credit grants.';
