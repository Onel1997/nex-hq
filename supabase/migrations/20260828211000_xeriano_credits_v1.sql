-- Xeriano V1 credit, reservation and concurrency authority.

do $$ begin create type public.xeriano_plan as enum ('FREE', 'CREATOR', 'PRO', 'MAX');
exception when duplicate_object then null; end $$;
do $$ begin create type public.xeriano_credit_bucket_type as enum ('SUBSCRIPTION', 'TOP_UP', 'TRIAL');
exception when duplicate_object then null; end $$;
do $$ begin create type public.xeriano_credit_reservation_status as enum ('RESERVED', 'COMMITTED', 'RELEASED', 'REFUNDED');
exception when duplicate_object then null; end $$;
do $$ begin create type public.xeriano_generation_operation as enum ('IMAGE', 'VIDEO');
exception when duplicate_object then null; end $$;

create table if not exists public.xeriano_subscription_state (
  account_id uuid primary key references public.xeriano_accounts(id) on delete cascade,
  plan public.xeriano_plan not null default 'FREE',
  status text not null default 'TRIAL' check (status in ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE')),
  monthly_credits integer not null default 0 check (monthly_credits >= 0),
  image_concurrency_limit smallint not null default 1 check (image_concurrency_limit between 0 and 20),
  video_concurrency_limit smallint not null default 0 check (video_concurrency_limit between 0 and 20),
  current_period_start timestamptz,
  current_period_end timestamptz,
  check (current_period_start is null or current_period_end is null or current_period_end > current_period_start),
  updated_at timestamptz not null default now(),
  check (
    (plan = 'FREE' and monthly_credits = 0 and image_concurrency_limit = 1 and video_concurrency_limit = 0)
    or (plan = 'CREATOR' and monthly_credits = 800 and image_concurrency_limit = 1 and video_concurrency_limit = 1)
    or (plan = 'PRO' and monthly_credits = 2000 and image_concurrency_limit = 2 and video_concurrency_limit = 2)
    or (plan = 'MAX' and monthly_credits = 4000 and image_concurrency_limit = 4 and video_concurrency_limit = 3)
  )
);

create table if not exists public.xeriano_credit_accounts (
  account_id uuid primary key references public.xeriano_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.xeriano_credit_buckets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_credit_accounts(account_id) on delete cascade,
  bucket_type public.xeriano_credit_bucket_type not null,
  source_key text not null check (char_length(source_key) between 1 and 200),
  granted_credits integer not null check (granted_credits > 0),
  remaining_credits integer not null check (remaining_credits >= 0 and remaining_credits <= granted_credits),
  reserved_credits integer not null default 0 check (reserved_credits >= 0 and reserved_credits <= remaining_credits),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, source_key),
  unique (id, account_id)
);
create index if not exists xeriano_credit_buckets_spend_idx
  on public.xeriano_credit_buckets(account_id, expires_at, created_at)
  where remaining_credits > 0;

create table if not exists public.xeriano_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_credit_accounts(account_id) on delete cascade,
  job_id text not null check (char_length(job_id) between 1 and 160),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 240),
  model_id text not null check (char_length(model_id) between 1 and 160),
  operation public.xeriano_generation_operation not null,
  pricing_version text not null check (char_length(pricing_version) between 1 and 160),
  amount integer not null check (amount > 0),
  allocations jsonb not null default '[]'::jsonb check (jsonb_typeof(allocations) = 'array' and octet_length(allocations::text) <= 32768),
  status public.xeriano_credit_reservation_status not null default 'RESERVED',
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check ((status = 'RESERVED' and settled_at is null) or (status <> 'RESERVED' and settled_at is not null)),
  unique (account_id, job_id),
  unique (id, account_id),
  unique (id, account_id, job_id, operation)
);
create index if not exists xeriano_credit_reservations_account_idx
  on public.xeriano_credit_reservations(account_id, created_at desc);

create table if not exists public.xeriano_generation_claims (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete cascade,
  job_id text not null check (char_length(job_id) between 1 and 160),
  operation public.xeriano_generation_operation not null,
  reservation_id uuid not null,
  status text not null default 'RUNNING' check (status in ('RUNNING', 'SUCCEEDED', 'FAILED', 'UNKNOWN_OUTCOME', 'REFUNDED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'RUNNING' and completed_at is null) or (status <> 'RUNNING' and completed_at is not null)),
  unique (account_id, job_id),
  foreign key (reservation_id, account_id, job_id, operation)
    references public.xeriano_credit_reservations(id, account_id, job_id, operation) on delete restrict
);
create index if not exists xeriano_generation_claims_active_idx
  on public.xeriano_generation_claims(account_id, operation, created_at)
  where status = 'RUNNING';

create table if not exists public.xeriano_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_credit_accounts(account_id) on delete cascade,
  bucket_id uuid,
  reservation_id uuid,
  transaction_type text not null check (transaction_type in ('GRANT', 'RESERVE', 'COMMIT', 'RELEASE', 'REFUND', 'EXPIRE')),
  amount_delta integer not null,
  reserved_delta integer not null default 0,
  resulting_available integer not null check (resulting_available >= 0),
  model_id text,
  operation public.xeriano_generation_operation,
  job_id text,
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 240),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 32768),
  created_at timestamptz not null default now(),
  check (
    (transaction_type in ('GRANT', 'EXPIRE') and bucket_id is not null)
    or (transaction_type in ('RESERVE', 'COMMIT', 'RELEASE', 'REFUND') and reservation_id is not null)
  ),
  foreign key (bucket_id, account_id)
    references public.xeriano_credit_buckets(id, account_id) on delete restrict,
  foreign key (reservation_id, account_id)
    references public.xeriano_credit_reservations(id, account_id) on delete restrict
);
create index if not exists xeriano_credit_ledger_account_idx
  on public.xeriano_credit_ledger(account_id, created_at desc);

create or replace function public.xeriano_credit_ledger_immutable()
returns trigger language plpgsql as $$ begin raise exception 'xeriano_credit_ledger is append-only'; end; $$;
revoke all on function public.xeriano_credit_ledger_immutable() from public;
drop trigger if exists xeriano_credit_ledger_no_mutation on public.xeriano_credit_ledger;
create trigger xeriano_credit_ledger_no_mutation before update or delete on public.xeriano_credit_ledger
  for each row execute function public.xeriano_credit_ledger_immutable();

create or replace function public.xeriano_reserve_credits(
  p_account_id uuid, p_job_id text, p_idempotency_key text, p_model_id text,
  p_operation public.xeriano_generation_operation, p_pricing_version text, p_amount integer
) returns public.xeriano_credit_reservations
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_existing public.xeriano_credit_reservations;
  v_remaining integer := p_amount;
  v_take integer;
  v_allocations jsonb := '[]'::jsonb;
  v_available integer;
  v_limit integer;
  v_active integer;
  v_bucket public.xeriano_credit_buckets;
  v_reservation public.xeriano_credit_reservations;
begin
  if p_amount <= 0 then raise exception 'INVALID_CREDIT_AMOUNT'; end if;
  if coalesce(char_length(p_job_id), 0) not between 1 and 160
    or coalesce(char_length(p_idempotency_key), 0) not between 1 and 240
    or coalesce(char_length(p_model_id), 0) not between 1 and 160
    or coalesce(char_length(p_pricing_version), 0) not between 1 and 160
  then raise exception 'INVALID_CREDIT_RESERVATION_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));
  select * into v_existing from public.xeriano_credit_reservations where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.account_id <> p_account_id
      or v_existing.job_id <> p_job_id
      or v_existing.model_id <> p_model_id
      or v_existing.operation <> p_operation
      or v_existing.pricing_version <> p_pricing_version
      or v_existing.amount <> p_amount
    then
      raise exception 'CREDIT_IDEMPOTENCY_CONFLICT';
    end if;
    return v_existing;
  end if;
  perform 1 from public.xeriano_accounts where id = p_account_id and status = 'ACTIVE';
  if not found then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  perform 1 from public.xeriano_credit_accounts where account_id = p_account_id for update;
  if not found then raise exception 'CREDIT_ACCOUNT_NOT_FOUND'; end if;
  select case when p_operation = 'IMAGE' then image_concurrency_limit else video_concurrency_limit end
    into v_limit from public.xeriano_subscription_state where account_id = p_account_id;
  if v_limit is null then raise exception 'PLAN_AUTHORITY_NOT_FOUND'; end if;
  select count(*) into v_active from public.xeriano_generation_claims
    where account_id = p_account_id and operation = p_operation and status = 'RUNNING';
  if v_active >= v_limit then raise exception 'CONCURRENCY_LIMIT_REACHED'; end if;
  select coalesce(sum(remaining_credits - reserved_credits), 0) into v_available
    from public.xeriano_credit_buckets
    where account_id = p_account_id and (expires_at is null or expires_at > now());
  if v_available < p_amount then raise exception 'INSUFFICIENT_CREDITS'; end if;
  for v_bucket in
    select * from public.xeriano_credit_buckets
    where account_id = p_account_id and remaining_credits > reserved_credits
      and (expires_at is null or expires_at > now())
    order by (expires_at is null), expires_at,
      case bucket_type when 'SUBSCRIPTION' then 0 when 'TRIAL' then 1 else 2 end,
      created_at, id
    for update
  loop
    exit when v_remaining = 0;
    v_take := least(v_remaining, v_bucket.remaining_credits - v_bucket.reserved_credits);
    update public.xeriano_credit_buckets set reserved_credits = reserved_credits + v_take where id = v_bucket.id;
    v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('bucketId', v_bucket.id, 'amount', v_take));
    v_remaining := v_remaining - v_take;
  end loop;
  if v_remaining <> 0 then raise exception 'CREDIT_ALLOCATION_INVARIANT_FAILED'; end if;
  insert into public.xeriano_credit_reservations(account_id, job_id, idempotency_key, model_id, operation, pricing_version, amount, allocations)
  values (p_account_id, p_job_id, p_idempotency_key, p_model_id, p_operation, p_pricing_version, p_amount, v_allocations)
  returning * into v_reservation;
  insert into public.xeriano_generation_claims(account_id, job_id, operation, reservation_id)
  values (p_account_id, p_job_id, p_operation, v_reservation.id);
  insert into public.xeriano_credit_ledger(account_id, reservation_id, transaction_type, amount_delta, reserved_delta, resulting_available, model_id, operation, job_id, idempotency_key)
  values (p_account_id, v_reservation.id, 'RESERVE', 0, p_amount, v_available - p_amount, p_model_id, p_operation, p_job_id, p_idempotency_key || ':reserve');
  return v_reservation;
end;
$$;

create or replace function public.xeriano_settle_credit_reservation(
  p_reservation_id uuid, p_action text, p_idempotency_key text
) returns public.xeriano_credit_reservations
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_account_id uuid;
  v_res public.xeriano_credit_reservations;
  v_item jsonb;
  v_bucket_id uuid;
  v_amount integer;
  v_allocated integer := 0;
  v_available integer;
  v_updated integer;
  v_existing_reservation_id uuid;
  v_existing_transaction_type text;
begin
  if p_action not in ('COMMIT','RELEASE','REFUND') then raise exception 'INVALID_SETTLEMENT_ACTION'; end if;
  if coalesce(char_length(p_idempotency_key), 0) not between 1 and 240 then
    raise exception 'INVALID_SETTLEMENT_IDEMPOTENCY_KEY';
  end if;
  select account_id into v_account_id
    from public.xeriano_credit_reservations where id = p_reservation_id;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text, 0));
  select * into v_res
    from public.xeriano_credit_reservations where id = p_reservation_id for update;
  select reservation_id, transaction_type
    into v_existing_reservation_id, v_existing_transaction_type
    from public.xeriano_credit_ledger where idempotency_key = p_idempotency_key;
  if found then
    if v_existing_reservation_id = p_reservation_id and v_existing_transaction_type = p_action then
      return v_res;
    end if;
    raise exception 'CREDIT_SETTLEMENT_IDEMPOTENCY_CONFLICT';
  end if;

  for v_item in select * from jsonb_array_elements(v_res.allocations) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'INVALID_CREDIT_ALLOCATION'; end if;
    v_bucket_id := (v_item->>'bucketId')::uuid;
    v_amount := (v_item->>'amount')::integer;
    if v_amount <= 0 then raise exception 'INVALID_CREDIT_ALLOCATION'; end if;
    v_allocated := v_allocated + v_amount;
  end loop;
  if v_allocated <> v_res.amount then raise exception 'CREDIT_ALLOCATION_INVARIANT_FAILED'; end if;

  if p_action = 'COMMIT' and v_res.status = 'RESERVED' then
    for v_item in select * from jsonb_array_elements(v_res.allocations) loop
      v_bucket_id := (v_item->>'bucketId')::uuid; v_amount := (v_item->>'amount')::integer;
      update public.xeriano_credit_buckets
        set reserved_credits = reserved_credits - v_amount,
            remaining_credits = remaining_credits - v_amount
        where id = v_bucket_id and account_id = v_res.account_id
          and reserved_credits >= v_amount and remaining_credits >= v_amount;
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then raise exception 'CREDIT_BUCKET_SETTLEMENT_INVARIANT_FAILED'; end if;
    end loop;
    update public.xeriano_credit_reservations set status='COMMITTED', settled_at=now() where id=v_res.id returning * into v_res;
    update public.xeriano_generation_claims set status='SUCCEEDED', completed_at=now() where reservation_id=v_res.id;
  elsif p_action = 'RELEASE' and v_res.status = 'RESERVED' then
    for v_item in select * from jsonb_array_elements(v_res.allocations) loop
      v_bucket_id := (v_item->>'bucketId')::uuid; v_amount := (v_item->>'amount')::integer;
      update public.xeriano_credit_buckets
        set reserved_credits = reserved_credits - v_amount
        where id = v_bucket_id and account_id = v_res.account_id and reserved_credits >= v_amount;
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then raise exception 'CREDIT_BUCKET_SETTLEMENT_INVARIANT_FAILED'; end if;
    end loop;
    update public.xeriano_credit_reservations set status='RELEASED', settled_at=now() where id=v_res.id returning * into v_res;
    update public.xeriano_generation_claims set status='FAILED', completed_at=now() where reservation_id=v_res.id;
  elsif p_action = 'REFUND' and v_res.status = 'COMMITTED' then
    for v_item in select * from jsonb_array_elements(v_res.allocations) loop
      v_bucket_id := (v_item->>'bucketId')::uuid; v_amount := (v_item->>'amount')::integer;
      update public.xeriano_credit_buckets
        set remaining_credits = remaining_credits + v_amount
        where id = v_bucket_id and account_id = v_res.account_id
          and remaining_credits + v_amount <= granted_credits;
      get diagnostics v_updated = row_count;
      if v_updated <> 1 then raise exception 'CREDIT_BUCKET_SETTLEMENT_INVARIANT_FAILED'; end if;
    end loop;
    update public.xeriano_credit_reservations set status='REFUNDED', settled_at=now() where id=v_res.id returning * into v_res;
    update public.xeriano_generation_claims set status='REFUNDED', completed_at=now() where reservation_id=v_res.id;
  else raise exception 'INVALID_RESERVATION_STATE'; end if;
  select coalesce(sum(remaining_credits-reserved_credits),0) into v_available from public.xeriano_credit_buckets where account_id=v_res.account_id and (expires_at is null or expires_at > now());
  insert into public.xeriano_credit_ledger(account_id,reservation_id,transaction_type,amount_delta,reserved_delta,resulting_available,model_id,operation,job_id,idempotency_key)
  values(v_res.account_id,v_res.id,p_action,case when p_action='COMMIT' then -v_res.amount when p_action='REFUND' then v_res.amount else 0 end,case when p_action in ('COMMIT','RELEASE') then -v_res.amount else 0 end,v_available,v_res.model_id,v_res.operation,v_res.job_id,p_idempotency_key);
  return v_res;
end;
$$;

create or replace function public.xeriano_commit_credit_reservation(p_reservation_id uuid,p_idempotency_key text)
returns public.xeriano_credit_reservations language sql security definer set search_path=pg_catalog,public as $$ select public.xeriano_settle_credit_reservation(p_reservation_id,'COMMIT',p_idempotency_key); $$;
create or replace function public.xeriano_release_credit_reservation(p_reservation_id uuid,p_idempotency_key text)
returns public.xeriano_credit_reservations language sql security definer set search_path=pg_catalog,public as $$ select public.xeriano_settle_credit_reservation(p_reservation_id,'RELEASE',p_idempotency_key); $$;
create or replace function public.xeriano_refund_credit_reservation(p_reservation_id uuid,p_idempotency_key text)
returns public.xeriano_credit_reservations language sql security definer set search_path=pg_catalog,public as $$ select public.xeriano_settle_credit_reservation(p_reservation_id,'REFUND',p_idempotency_key); $$;

create or replace function public.xeriano_grant_trial_credits() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_bucket uuid; begin
  insert into public.xeriano_credit_accounts(account_id) values(new.id) on conflict do nothing;
  insert into public.xeriano_subscription_state(account_id, plan, status, monthly_credits, image_concurrency_limit, video_concurrency_limit)
    values(new.id,'FREE','TRIAL',0,1,0) on conflict do nothing;
  insert into public.xeriano_credit_buckets(account_id,bucket_type,source_key,granted_credits,remaining_credits)
    values(new.id,'TRIAL','trial:v1',40,40) on conflict(account_id,source_key) do nothing returning id into v_bucket;
  if v_bucket is not null then
    insert into public.xeriano_credit_ledger(account_id,bucket_id,transaction_type,amount_delta,resulting_available,idempotency_key,metadata)
      values(new.id,v_bucket,'GRANT',40,40,'trial:v1:'||new.id,jsonb_build_object('trialVersion','xeriano-trial-v1'));
  end if; return new;
end; $$;
drop trigger if exists xeriano_account_trial_grant on public.xeriano_accounts;
create trigger xeriano_account_trial_grant after insert on public.xeriano_accounts for each row execute function public.xeriano_grant_trial_credits();

revoke all on function public.xeriano_grant_trial_credits() from public;

-- Cover accounts created after migration 1 but before this trigger existed.
insert into public.xeriano_credit_accounts(account_id)
select id from public.xeriano_accounts
on conflict (account_id) do nothing;
insert into public.xeriano_subscription_state(account_id, plan, status, monthly_credits, image_concurrency_limit, video_concurrency_limit)
select id, 'FREE', 'TRIAL', 0, 1, 0 from public.xeriano_accounts
on conflict (account_id) do nothing;
insert into public.xeriano_credit_buckets(account_id,bucket_type,source_key,granted_credits,remaining_credits)
select id, 'TRIAL', 'trial:v1', 40, 40 from public.xeriano_accounts
on conflict (account_id,source_key) do nothing;
insert into public.xeriano_credit_ledger(account_id,bucket_id,transaction_type,amount_delta,resulting_available,idempotency_key,metadata)
select b.account_id,b.id,'GRANT',40,40,'trial:v1:'||b.account_id,jsonb_build_object('trialVersion','xeriano-trial-v1')
from public.xeriano_credit_buckets b
where b.bucket_type = 'TRIAL' and b.source_key = 'trial:v1'
on conflict (idempotency_key) do nothing;

drop trigger if exists xeriano_subscription_touch_updated_at on public.xeriano_subscription_state;
create trigger xeriano_subscription_touch_updated_at
  before update on public.xeriano_subscription_state
  for each row execute function public.xeriano_touch_updated_at();
drop trigger if exists xeriano_credit_accounts_touch_updated_at on public.xeriano_credit_accounts;
create trigger xeriano_credit_accounts_touch_updated_at
  before update on public.xeriano_credit_accounts
  for each row execute function public.xeriano_touch_updated_at();

alter table public.xeriano_subscription_state enable row level security;
alter table public.xeriano_credit_accounts enable row level security;
alter table public.xeriano_credit_buckets enable row level security;
alter table public.xeriano_credit_reservations enable row level security;
alter table public.xeriano_generation_claims enable row level security;
alter table public.xeriano_credit_ledger enable row level security;
revoke all on public.xeriano_subscription_state,public.xeriano_credit_accounts,public.xeriano_credit_buckets,public.xeriano_credit_reservations,public.xeriano_generation_claims,public.xeriano_credit_ledger from public,anon,authenticated;
grant select on public.xeriano_subscription_state,public.xeriano_credit_accounts,public.xeriano_credit_buckets,public.xeriano_credit_reservations,public.xeriano_generation_claims,public.xeriano_credit_ledger to authenticated;
drop policy if exists xeriano_subscription_read_member on public.xeriano_subscription_state;
create policy xeriano_subscription_read_member on public.xeriano_subscription_state for select to authenticated using(public.xeriano_is_account_member(account_id));
drop policy if exists xeriano_credit_accounts_read_member on public.xeriano_credit_accounts;
create policy xeriano_credit_accounts_read_member on public.xeriano_credit_accounts for select to authenticated using(public.xeriano_is_account_member(account_id));
drop policy if exists xeriano_credit_buckets_read_member on public.xeriano_credit_buckets;
create policy xeriano_credit_buckets_read_member on public.xeriano_credit_buckets for select to authenticated using(public.xeriano_is_account_member(account_id));
drop policy if exists xeriano_credit_reservations_read_member on public.xeriano_credit_reservations;
create policy xeriano_credit_reservations_read_member on public.xeriano_credit_reservations for select to authenticated using(public.xeriano_is_account_member(account_id));
drop policy if exists xeriano_generation_claims_read_member on public.xeriano_generation_claims;
create policy xeriano_generation_claims_read_member on public.xeriano_generation_claims for select to authenticated using(public.xeriano_is_account_member(account_id));
drop policy if exists xeriano_credit_ledger_read_member on public.xeriano_credit_ledger;
create policy xeriano_credit_ledger_read_member on public.xeriano_credit_ledger for select to authenticated using(public.xeriano_is_account_member(account_id));
grant all on public.xeriano_subscription_state,public.xeriano_credit_accounts,public.xeriano_credit_buckets,public.xeriano_credit_reservations,public.xeriano_generation_claims,public.xeriano_credit_ledger to service_role;
revoke all on function public.xeriano_reserve_credits(uuid,text,text,text,public.xeriano_generation_operation,text,integer),public.xeriano_settle_credit_reservation(uuid,text,text),public.xeriano_commit_credit_reservation(uuid,text),public.xeriano_release_credit_reservation(uuid,text),public.xeriano_refund_credit_reservation(uuid,text) from public,anon,authenticated;
grant execute on function public.xeriano_reserve_credits(uuid,text,text,text,public.xeriano_generation_operation,text,integer),public.xeriano_commit_credit_reservation(uuid,text),public.xeriano_release_credit_reservation(uuid,text),public.xeriano_refund_credit_reservation(uuid,text) to service_role;
