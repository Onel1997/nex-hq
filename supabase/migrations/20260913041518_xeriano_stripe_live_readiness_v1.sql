-- Xeriano Stripe live-readiness V1.
-- Live remains application-gated. This migration only adds mode-aware,
-- service-authoritative settlement and recovery foundations.

-- Existing TEST rows retain livemode=false. Unique authorities become mode-aware
-- so equal Stripe identifiers in distinct Stripe namespaces cannot collide.
alter table public.xeriano_billing_customers
  add column if not exists last_subscription_event_created bigint not null default 0,
  add column if not exists last_subscription_event_id text,
  add column if not exists billing_hold boolean not null default false;
alter table public.xeriano_billing_customers
  drop constraint if exists xeriano_billing_customers_test_mode_only;
alter table public.xeriano_billing_customers
  drop constraint if exists xeriano_billing_customers_stripe_customer_id_key;
alter table public.xeriano_billing_customers
  drop constraint if exists xeriano_billing_customers_stripe_subscription_id_key;
create unique index if not exists xeriano_billing_customers_mode_customer_uq
  on public.xeriano_billing_customers(stripe_livemode,stripe_customer_id)
  where stripe_customer_id is not null;
create unique index if not exists xeriano_billing_customers_mode_subscription_uq
  on public.xeriano_billing_customers(stripe_livemode,stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.xeriano_billing_events
  add column if not exists livemode boolean not null default false,
  add column if not exists event_created bigint not null default 0,
  add column if not exists object_id text,
  add column if not exists payload_sha256 text;
alter table public.xeriano_billing_events
  drop constraint if exists xeriano_billing_events_stripe_event_id_key;
alter table public.xeriano_billing_events
  add constraint xeriano_billing_events_mode_event_uq unique(livemode,stripe_event_id);
alter table public.xeriano_billing_events
  add constraint xeriano_billing_events_payload_sha256_check
  check (payload_sha256 is null or payload_sha256 ~ '^[a-f0-9]{64}$');

alter table public.xeriano_stripe_price_mappings
  drop constraint if exists xeriano_stripe_price_mappings_livemode_check;
alter table public.xeriano_stripe_price_mappings
  drop constraint if exists xeriano_stripe_price_mappings_stripe_price_id_key;
alter table public.xeriano_stripe_price_mappings
  drop constraint if exists xeriano_stripe_price_mappings_product_code_catalog_version_key;
alter table public.xeriano_stripe_price_mappings
  add constraint xeriano_stripe_price_mappings_mode_price_uq unique(livemode,stripe_price_id);
alter table public.xeriano_stripe_price_mappings
  add constraint xeriano_stripe_price_mappings_mode_catalog_uq unique(livemode,product_code,catalog_version);

alter table public.xeriano_stripe_checkouts
  add column if not exists actor_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists expires_at timestamptz;
alter table public.xeriano_stripe_checkouts
  drop constraint if exists xeriano_stripe_checkouts_livemode_check;
alter table public.xeriano_stripe_checkouts
  drop constraint if exists xeriano_stripe_checkouts_stripe_checkout_session_id_check;
alter table public.xeriano_stripe_checkouts
  drop constraint if exists xeriano_stripe_checkouts_stripe_checkout_session_id_key;
alter table public.xeriano_stripe_checkouts
  drop constraint if exists xeriano_stripe_checkouts_account_id_request_id_key;
alter table public.xeriano_stripe_checkouts
  drop constraint if exists xeriano_stripe_checkouts_status_check;
alter table public.xeriano_stripe_checkouts
  drop constraint if exists xeriano_stripe_checkouts_check;
alter table public.xeriano_stripe_checkouts
  add constraint xeriano_stripe_checkouts_session_format_check check (
    (not livemode and stripe_checkout_session_id ~ '^cs_test_[A-Za-z0-9_]+$')
    or (livemode and stripe_checkout_session_id ~ '^cs_live_[A-Za-z0-9_]+$')
  );
alter table public.xeriano_stripe_checkouts
  add constraint xeriano_stripe_checkouts_mode_session_uq unique(livemode,stripe_checkout_session_id);
alter table public.xeriano_stripe_checkouts
  add constraint xeriano_stripe_checkouts_mode_request_uq unique(account_id,livemode,request_id);
alter table public.xeriano_stripe_checkouts
  add constraint xeriano_stripe_checkouts_status_check check (status in ('CREATED','COMPLETED','PAID','IGNORED','EXPIRED'));
alter table public.xeriano_stripe_checkouts
  add constraint xeriano_stripe_checkouts_completion_check check (
    (status='CREATED' and completed_at is null) or (status<>'CREATED' and completed_at is not null)
  );
create index if not exists xeriano_stripe_checkouts_active_idx
  on public.xeriano_stripe_checkouts(account_id,livemode,expires_at)
  where status='CREATED';

-- A private copy of the already signature-verified Stripe event is the durable
-- replay authority. It is never browser-readable and never grants by itself.
create table public.xeriano_stripe_event_authorities (
  id uuid primary key default gen_random_uuid(),
  livemode boolean not null,
  stripe_event_id text not null check (char_length(stripe_event_id) between 1 and 255),
  event_type text not null check (char_length(event_type) between 1 and 160),
  event_created bigint not null check (event_created > 0),
  object_id text check (object_id is null or char_length(object_id) between 1 and 255),
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=1048576),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  received_at timestamptz not null default now(),
  unique(livemode,stripe_event_id)
);

create table public.xeriano_stripe_payment_sources (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete restrict,
  livemode boolean not null,
  stripe_customer_id text not null,
  stripe_checkout_session_id text,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  credit_bucket_id uuid not null,
  gross_amount_minor bigint not null check (gross_amount_minor > 0),
  granted_credits integer not null check (granted_credits > 0),
  reversed_amount_minor bigint not null default 0 check (reversed_amount_minor >= 0 and reversed_amount_minor <= gross_amount_minor),
  reversed_credits integer not null default 0 check (reversed_credits >= 0 and reversed_credits <= granted_credits),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(credit_bucket_id,account_id) references public.xeriano_credit_buckets(id,account_id) on delete restrict,
  unique(livemode,stripe_checkout_session_id),
  unique(livemode,stripe_invoice_id),
  unique(livemode,stripe_payment_intent_id),
  unique(livemode,stripe_charge_id)
);

create table public.xeriano_billing_adjustments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete restrict,
  payment_source_id uuid not null references public.xeriano_stripe_payment_sources(id) on delete restrict,
  livemode boolean not null,
  adjustment_kind text not null check (adjustment_kind in ('REFUND','CHARGE_REFUND','DISPUTE')),
  stripe_adjustment_id text not null check (char_length(stripe_adjustment_id) between 1 and 255),
  stripe_status text not null check (char_length(stripe_status) between 1 and 80),
  amount_minor bigint not null check (amount_minor >= 0),
  reversed_credits integer not null default 0 check (reversed_credits >= 0),
  event_created bigint not null check (event_created > 0),
  last_event_id text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=32768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(livemode,adjustment_kind,stripe_adjustment_id)
);

create table public.xeriano_billing_holds (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete restrict,
  livemode boolean not null,
  reason text not null check (reason in ('DISPUTE','REVERSAL_SHORTFALL')),
  authority_id text not null check (char_length(authority_id) between 1 and 255),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RELEASED')),
  shortfall_credits integer not null default 0 check (shortfall_credits >= 0),
  created_at timestamptz not null default now(),
  released_at timestamptz,
  unique(account_id,livemode,reason,authority_id),
  check ((status='ACTIVE' and released_at is null) or (status='RELEASED' and released_at is not null))
);
create index xeriano_billing_holds_active_idx on public.xeriano_billing_holds(account_id,livemode) where status='ACTIVE';

-- Immutable counter-entries extend, never rewrite, the credit history.
alter table public.xeriano_credit_ledger drop constraint if exists xeriano_credit_ledger_transaction_type_check;
alter table public.xeriano_credit_ledger drop constraint if exists xeriano_credit_ledger_check;
alter table public.xeriano_credit_ledger
  add constraint xeriano_credit_ledger_transaction_type_check
  check (transaction_type in ('GRANT','RESERVE','COMMIT','RELEASE','REFUND','EXPIRE','REVERSAL'));
alter table public.xeriano_credit_ledger
  add constraint xeriano_credit_ledger_authority_check check (
    (transaction_type in ('GRANT','EXPIRE','REVERSAL') and bucket_id is not null)
    or (transaction_type in ('RESERVE','COMMIT','RELEASE','REFUND') and reservation_id is not null)
  );

alter table public.xeriano_stripe_event_authorities enable row level security;
alter table public.xeriano_stripe_payment_sources enable row level security;
alter table public.xeriano_billing_adjustments enable row level security;
alter table public.xeriano_billing_holds enable row level security;
revoke all on public.xeriano_stripe_event_authorities,public.xeriano_stripe_payment_sources,
  public.xeriano_billing_adjustments,public.xeriano_billing_holds from public,anon,authenticated;
grant all on public.xeriano_stripe_event_authorities,public.xeriano_stripe_payment_sources,
  public.xeriano_billing_adjustments,public.xeriano_billing_holds to service_role;

create or replace function public.xeriano_bind_stripe_customer_v2(
  p_account_id uuid,p_stripe_customer_id text,p_livemode boolean
) returns public.xeriano_billing_customers
language plpgsql security definer set search_path='' as $$
declare v_row public.xeriano_billing_customers;
begin
  if p_stripe_customer_id !~ '^cus_[A-Za-z0-9]+$' then raise exception 'INVALID_STRIPE_CUSTOMER'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text,0));
  perform 1 from public.xeriano_accounts where id=p_account_id and status='ACTIVE';
  if not found then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  insert into public.xeriano_billing_customers(account_id,stripe_customer_id,stripe_livemode)
    values(p_account_id,p_stripe_customer_id,p_livemode) on conflict(account_id) do nothing;
  select * into v_row from public.xeriano_billing_customers where account_id=p_account_id for update;
  if v_row.stripe_livemode<>p_livemode or (v_row.stripe_customer_id is not null and v_row.stripe_customer_id<>p_stripe_customer_id)
  then raise exception 'STRIPE_CUSTOMER_CONFLICT'; end if;
  update public.xeriano_billing_customers set stripe_customer_id=p_stripe_customer_id,updated_at=now()
    where account_id=p_account_id returning * into v_row;
  return v_row;
end; $$;

create or replace function public.xeriano_register_stripe_price_mapping_v2(
  p_mode text,p_product_code text,p_catalog_version text,p_stripe_price_id text,p_livemode boolean
) returns public.xeriano_stripe_price_mappings
language plpgsql security definer set search_path='' as $$
declare v_mapping public.xeriano_stripe_price_mappings;v_plan public.xeriano_plan_versions;v_topup public.xeriano_topup_product_versions;
begin
  if p_mode not in ('SUBSCRIPTION','TOP_UP') or p_stripe_price_id !~ '^price_[A-Za-z0-9]+$'
  then raise exception 'INVALID_STRIPE_PRICE_MAPPING'; end if;
  perform pg_advisory_xact_lock(hashtextextended('stripe-price:'||p_livemode::text||':'||p_product_code,0));
  if p_mode='SUBSCRIPTION' then
    select * into v_plan from public.xeriano_plan_versions where version=p_catalog_version and active;
    if not found or v_plan.plan_code<>replace(p_product_code,'_MONTHLY','') or v_plan.billing_interval<>'MONTHLY'
    then raise exception 'PLAN_CATALOG_MISMATCH'; end if;
    insert into public.xeriano_stripe_price_mappings(product_code,product_kind,stripe_price_id,catalog_code,catalog_version,plan_version_id,gross_price_minor,currency,granted_credits,livemode)
      values(p_product_code,p_mode,p_stripe_price_id,v_plan.plan_code,v_plan.version,v_plan.id,v_plan.gross_price_minor,v_plan.currency,v_plan.granted_credits,p_livemode)
      on conflict(livemode,stripe_price_id) do nothing;
  else
    select * into v_topup from public.xeriano_topup_product_versions where version=p_catalog_version and active;
    if not found or replace(v_topup.package_code,'TOP_UP_','TOPUP_')<>p_product_code or v_topup.expiry_policy<>'NEVER'
    then raise exception 'TOPUP_CATALOG_MISMATCH'; end if;
    insert into public.xeriano_stripe_price_mappings(product_code,product_kind,stripe_price_id,catalog_code,catalog_version,topup_product_version_id,gross_price_minor,currency,granted_credits,livemode)
      values(p_product_code,p_mode,p_stripe_price_id,v_topup.package_code,v_topup.version,v_topup.id,v_topup.gross_price_minor,v_topup.currency,v_topup.granted_credits,p_livemode)
      on conflict(livemode,stripe_price_id) do nothing;
  end if;
  select * into v_mapping from public.xeriano_stripe_price_mappings where livemode=p_livemode and stripe_price_id=p_stripe_price_id for update;
  if not found or v_mapping.product_code<>p_product_code or v_mapping.product_kind<>p_mode or v_mapping.catalog_version<>p_catalog_version
  then raise exception 'STRIPE_PRICE_MAPPING_CONFLICT'; end if;
  update public.xeriano_stripe_price_mappings set active=false where livemode=p_livemode and product_code=p_product_code and id<>v_mapping.id;
  update public.xeriano_stripe_price_mappings set active=true,last_verified_at=now() where id=v_mapping.id returning * into v_mapping;
  return v_mapping;
end; $$;

create or replace function public.xeriano_claim_stripe_checkout_v2(
  p_account_id uuid,p_stripe_customer_id text,p_request_id uuid,p_mode text,p_product_code text,p_livemode boolean
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_customer public.xeriano_billing_customers;v_existing public.xeriano_stripe_checkouts;v_existing_product text;
begin
  if p_mode not in ('SUBSCRIPTION','TOP_UP') or coalesce(char_length(p_product_code),0) not between 1 and 80 then raise exception 'INVALID_STRIPE_CHECKOUT_MODE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text,0));
  select * into v_existing from public.xeriano_stripe_checkouts where account_id=p_account_id and livemode=p_livemode and request_id=p_request_id;
  if found then
    select product_code into v_existing_product from public.xeriano_stripe_price_mappings where id=v_existing.stripe_price_mapping_id;
    if v_existing.mode<>p_mode or v_existing_product<>p_product_code then raise exception 'STRIPE_CHECKOUT_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('status','RECORDED','checkoutSessionId',v_existing.stripe_checkout_session_id);
  end if;
  select * into v_customer from public.xeriano_billing_customers where account_id=p_account_id and stripe_customer_id=p_stripe_customer_id and stripe_livemode=p_livemode for update;
  if not found then raise exception 'STRIPE_CUSTOMER_NOT_BOUND'; end if;
  select * into v_existing from public.xeriano_stripe_checkouts c
    where c.account_id=p_account_id and c.livemode=p_livemode and c.status='CREATED' and c.expires_at>now() limit 1;
  if found then
    select product_code into v_existing_product from public.xeriano_stripe_price_mappings where id=v_existing.stripe_price_mapping_id;
    if v_existing_product<>p_product_code or v_existing.mode<>p_mode then raise exception 'STRIPE_CHECKOUT_ALREADY_IN_PROGRESS'; end if;
    return jsonb_build_object('status','EXISTING','checkoutSessionId',v_existing.stripe_checkout_session_id);
  end if;
  if v_customer.checkout_lock_until>now() then
    if v_customer.checkout_lock_token<>p_request_id then raise exception 'STRIPE_CHECKOUT_ALREADY_IN_PROGRESS'; end if;
    if v_customer.checkout_lock_mode<>p_mode or v_customer.checkout_lock_product_code<>p_product_code then raise exception 'STRIPE_CHECKOUT_IDEMPOTENCY_CONFLICT'; end if;
  end if;
  update public.xeriano_billing_customers set checkout_lock_token=p_request_id,checkout_lock_mode=p_mode,checkout_lock_product_code=p_product_code,checkout_lock_until=now()+interval '15 minutes' where account_id=p_account_id;
  return jsonb_build_object('status','CLAIMED');
end; $$;

create or replace function public.xeriano_record_stripe_checkout_v2(
  p_account_id uuid,p_actor_id uuid,p_request_id uuid,p_stripe_customer_id text,p_checkout_session_id text,
  p_mode text,p_product_code text,p_catalog_version text,p_stripe_price_id text,p_livemode boolean,
  p_expires_at timestamptz,p_payment_intent_id text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_mapping public.xeriano_stripe_price_mappings;v_checkout public.xeriano_stripe_checkouts;
begin
  if p_mode not in ('SUBSCRIPTION','TOP_UP') or p_stripe_price_id !~ '^price_[A-Za-z0-9]+$'
    or (p_livemode and p_checkout_session_id !~ '^cs_live_[A-Za-z0-9_]+$')
    or (not p_livemode and p_checkout_session_id !~ '^cs_test_[A-Za-z0-9_]+$')
  then raise exception 'INVALID_STRIPE_CHECKOUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text,0));
  perform 1 from public.xeriano_account_memberships where account_id=p_account_id and user_id=p_actor_id and role='CUSTOMER' and status='ACTIVE';
  if not found then raise exception 'CUSTOMER_ACCOUNT_ACCESS_DENIED'; end if;
  select * into v_checkout from public.xeriano_stripe_checkouts where account_id=p_account_id and livemode=p_livemode and request_id=p_request_id for update;
  if found then
    if v_checkout.stripe_checkout_session_id<>p_checkout_session_id or v_checkout.stripe_customer_id<>p_stripe_customer_id or v_checkout.mode<>p_mode
    then raise exception 'STRIPE_CHECKOUT_CONFLICT'; end if;
    return jsonb_build_object('status','RECORDED');
  end if;
  perform 1 from public.xeriano_billing_customers where account_id=p_account_id and stripe_customer_id=p_stripe_customer_id and stripe_livemode=p_livemode
    and checkout_lock_token=p_request_id and checkout_lock_mode=p_mode and checkout_lock_product_code=p_product_code and checkout_lock_until>now() for update;
  if not found then raise exception 'STRIPE_CUSTOMER_NOT_BOUND'; end if;
  v_mapping:=public.xeriano_register_stripe_price_mapping_v2(p_mode,p_product_code,p_catalog_version,p_stripe_price_id,p_livemode);
  insert into public.xeriano_stripe_checkouts(account_id,actor_user_id,request_id,stripe_customer_id,stripe_checkout_session_id,stripe_payment_intent_id,stripe_price_mapping_id,mode,livemode,expires_at)
    values(p_account_id,p_actor_id,p_request_id,p_stripe_customer_id,p_checkout_session_id,p_payment_intent_id,v_mapping.id,p_mode,p_livemode,p_expires_at)
    on conflict(livemode,stripe_checkout_session_id) do nothing;
  select * into v_checkout from public.xeriano_stripe_checkouts where livemode=p_livemode and stripe_checkout_session_id=p_checkout_session_id;
  if not found or v_checkout.account_id<>p_account_id or v_checkout.request_id<>p_request_id or v_checkout.stripe_customer_id<>p_stripe_customer_id or v_checkout.stripe_price_mapping_id<>v_mapping.id or v_checkout.mode<>p_mode
  then raise exception 'STRIPE_CHECKOUT_CONFLICT'; end if;
  update public.xeriano_billing_customers set checkout_lock_token=null,checkout_lock_mode=null,checkout_lock_product_code=null,checkout_lock_until=null where account_id=p_account_id and checkout_lock_token=p_request_id;
  return jsonb_build_object('status','RECORDED');
end; $$;

create or replace function public.xeriano_begin_billing_event_v2(
  p_event_id text,p_event_type text,p_event_created bigint,p_livemode boolean,p_metadata jsonb
) returns text
language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
  if coalesce(char_length(p_event_id),0) not between 1 and 255 or coalesce(char_length(p_event_type),0) not between 1 and 160
    or p_event_created<=0 or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object' or octet_length(coalesce(p_metadata,'{}'::jsonb)::text)>32768
  then raise exception 'INVALID_BILLING_EVENT'; end if;
  insert into public.xeriano_billing_events(stripe_event_id,event_type,event_created,livemode,processing_status,event_metadata)
    values(p_event_id,p_event_type,p_event_created,p_livemode,'PROCESSING',coalesce(p_metadata,'{}'::jsonb))
    on conflict(livemode,stripe_event_id) do nothing;
  select processing_status into v_status from public.xeriano_billing_events where livemode=p_livemode and stripe_event_id=p_event_id for update;
  if v_status in ('PROCESSED','IGNORED') then return v_status; end if;
  update public.xeriano_billing_events set event_type=p_event_type,event_created=p_event_created,processing_status='PROCESSING',event_metadata=coalesce(p_metadata,'{}'::jsonb),processed_at=null,failure_code=null
    where livemode=p_livemode and stripe_event_id=p_event_id;
  return 'PROCESSING';
end; $$;

create or replace function public.xeriano_finish_billing_event_v2(
  p_event_id text,p_livemode boolean,p_account_id uuid,p_status text,p_failure_code text default null
) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_status not in ('PROCESSED','IGNORED') then raise exception 'INVALID_BILLING_EVENT_STATUS'; end if;
  update public.xeriano_billing_events set account_id=p_account_id,processing_status=p_status,processed_at=now(),failure_code=p_failure_code
    where stripe_event_id=p_event_id and livemode=p_livemode;
  if not found then raise exception 'BILLING_EVENT_NOT_FOUND'; end if;
end; $$;

-- Remove up to the proportional credit authority available in the originating
-- bucket. Consumed/reserved credits are never made negative; any shortfall
-- creates an explicit hold and blocks later customer reservations.
create or replace function public.xeriano_reverse_payment_source_v2(
  p_source_id uuid,p_target_amount_minor bigint,p_authority_key text,p_livemode boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_source public.xeriano_stripe_payment_sources;v_bucket public.xeriano_credit_buckets;v_target integer;v_delta integer;v_available integer;v_shortfall integer;
begin
  select * into v_source from public.xeriano_stripe_payment_sources where id=p_source_id and livemode=p_livemode for update;
  if not found or p_target_amount_minor<0 or p_target_amount_minor>v_source.gross_amount_minor then raise exception 'PAYMENT_SOURCE_REVERSAL_INVALID'; end if;
  v_target:=case when p_target_amount_minor=v_source.gross_amount_minor then v_source.granted_credits else floor(v_source.granted_credits::numeric*p_target_amount_minor/v_source.gross_amount_minor)::integer end;
  if v_target<=v_source.reversed_credits then return jsonb_build_object('reversedCredits',v_source.reversed_credits,'shortfallCredits',0); end if;
  select * into v_bucket from public.xeriano_credit_buckets where id=v_source.credit_bucket_id and account_id=v_source.account_id for update;
  v_delta:=least(v_target-v_source.reversed_credits,greatest(v_bucket.remaining_credits-v_bucket.reserved_credits,0));
  if v_delta>0 then
    update public.xeriano_credit_buckets set remaining_credits=remaining_credits-v_delta where id=v_bucket.id;
    select coalesce(sum(remaining_credits-reserved_credits),0) into v_available from public.xeriano_credit_buckets where account_id=v_source.account_id and (expires_at is null or expires_at>now());
    insert into public.xeriano_credit_ledger(account_id,bucket_id,transaction_type,amount_delta,resulting_available,idempotency_key,metadata)
      values(v_source.account_id,v_bucket.id,'REVERSAL',-v_delta,v_available,p_authority_key||':reversal',jsonb_build_object('livemode',p_livemode,'paymentSourceId',v_source.id))
      on conflict(idempotency_key) do nothing;
  end if;
  v_shortfall:=(v_target-v_source.reversed_credits)-v_delta;
  update public.xeriano_stripe_payment_sources set reversed_amount_minor=greatest(reversed_amount_minor,p_target_amount_minor),reversed_credits=reversed_credits+v_delta,updated_at=now() where id=v_source.id;
  if v_shortfall>0 then
    insert into public.xeriano_billing_holds(account_id,livemode,reason,authority_id,shortfall_credits)
      values(v_source.account_id,p_livemode,'REVERSAL_SHORTFALL',p_authority_key,v_shortfall)
      on conflict(account_id,livemode,reason,authority_id) do update set status='ACTIVE',released_at=null,shortfall_credits=greatest(public.xeriano_billing_holds.shortfall_credits,excluded.shortfall_credits);
    update public.xeriano_billing_customers set billing_hold=true where account_id=v_source.account_id and stripe_livemode=p_livemode;
  end if;
  return jsonb_build_object('reversedCredits',v_source.reversed_credits+v_delta,'shortfallCredits',v_shortfall);
end; $$;

create or replace function public.xeriano_apply_refund_event_v2(
  p_event_id text,p_event_type text,p_event_created bigint,p_livemode boolean,p_adjustment_id text,
  p_payment_intent_id text,p_charge_id text,p_customer_id text,p_amount_minor bigint,p_currency text,
  p_refund_status text,p_is_aggregate boolean,p_event_metadata jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_begin text;v_source public.xeriano_stripe_payment_sources;v_adjust public.xeriano_billing_adjustments;v_result jsonb;v_kind text;v_target_amount bigint;
begin
  v_begin:=public.xeriano_begin_billing_event_v2(p_event_id,p_event_type,p_event_created,p_livemode,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect','NONE'); end if;
  if p_amount_minor<0 or upper(p_currency)!~'^[A-Z]{3}$' then raise exception 'INVALID_REFUND'; end if;
  select * into v_source from public.xeriano_stripe_payment_sources where livemode=p_livemode and (
    (p_payment_intent_id is not null and stripe_payment_intent_id=p_payment_intent_id) or (p_charge_id is not null and stripe_charge_id=p_charge_id)
  ) for update;
  if not found or (p_customer_id is not null and v_source.stripe_customer_id<>p_customer_id) or v_source.currency<>upper(p_currency) then raise exception 'REFUND_PAYMENT_AUTHORITY_MISMATCH'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_source.account_id::text,0));
  v_kind:=case when p_is_aggregate then 'CHARGE_REFUND' else 'REFUND' end;
  select * into v_adjust from public.xeriano_billing_adjustments where livemode=p_livemode and adjustment_kind=v_kind and stripe_adjustment_id=p_adjustment_id for update;
  if found and (v_adjust.event_created>p_event_created or (v_adjust.event_created=p_event_created and v_adjust.last_event_id>=p_event_id)) then
    perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_source.account_id,'IGNORED','STALE_REFUND_EVENT');
    return jsonb_build_object('status','IGNORED','financialEffect','NONE');
  end if;
  insert into public.xeriano_billing_adjustments(account_id,payment_source_id,livemode,adjustment_kind,stripe_adjustment_id,stripe_status,amount_minor,event_created,last_event_id,metadata)
    values(v_source.account_id,v_source.id,p_livemode,v_kind,p_adjustment_id,p_refund_status,p_amount_minor,p_event_created,p_event_id,p_event_metadata)
    on conflict(livemode,adjustment_kind,stripe_adjustment_id) do update set stripe_status=excluded.stripe_status,amount_minor=excluded.amount_minor,event_created=excluded.event_created,last_event_id=excluded.last_event_id,metadata=excluded.metadata,updated_at=now();
  if p_refund_status='succeeded' then
    if p_is_aggregate then v_target_amount:=p_amount_minor;
    else select coalesce(sum(amount_minor),0) into v_target_amount from public.xeriano_billing_adjustments where payment_source_id=v_source.id and adjustment_kind='REFUND' and stripe_status='succeeded';
    end if;
    v_result:=public.xeriano_reverse_payment_source_v2(v_source.id,least(v_target_amount,v_source.gross_amount_minor),'refund-total:'||p_livemode::text||':'||v_source.id::text||':'||v_target_amount::text,p_livemode);
  end if;
  perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_source.account_id,'PROCESSED',null);
  return jsonb_build_object('status','PROCESSED','financialEffect',case when p_refund_status='succeeded' then 'CREDIT_REVERSAL' else 'NONE' end);
end; $$;

create or replace function public.xeriano_apply_dispute_event_v2(
  p_event_id text,p_event_type text,p_event_created bigint,p_livemode boolean,p_dispute_id text,
  p_payment_intent_id text,p_charge_id text,p_amount_minor bigint,p_currency text,p_dispute_status text,p_event_metadata jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_begin text;v_source public.xeriano_stripe_payment_sources;v_adjust public.xeriano_billing_adjustments;
begin
  v_begin:=public.xeriano_begin_billing_event_v2(p_event_id,p_event_type,p_event_created,p_livemode,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect','NONE'); end if;
  select * into v_source from public.xeriano_stripe_payment_sources where livemode=p_livemode and (
    (p_payment_intent_id is not null and stripe_payment_intent_id=p_payment_intent_id) or stripe_charge_id=p_charge_id
  ) for update;
  if not found or v_source.currency<>upper(p_currency) then raise exception 'DISPUTE_PAYMENT_AUTHORITY_MISMATCH'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_source.account_id::text,0));
  select * into v_adjust from public.xeriano_billing_adjustments where livemode=p_livemode and adjustment_kind='DISPUTE' and stripe_adjustment_id=p_dispute_id for update;
  if found and (v_adjust.event_created>p_event_created or (v_adjust.event_created=p_event_created and v_adjust.last_event_id>=p_event_id)) then
    perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_source.account_id,'IGNORED','STALE_DISPUTE_EVENT');
    return jsonb_build_object('status','IGNORED','financialEffect','NONE');
  end if;
  insert into public.xeriano_billing_adjustments(account_id,payment_source_id,livemode,adjustment_kind,stripe_adjustment_id,stripe_status,amount_minor,event_created,last_event_id,metadata)
    values(v_source.account_id,v_source.id,p_livemode,'DISPUTE',p_dispute_id,p_dispute_status,p_amount_minor,p_event_created,p_event_id,p_event_metadata)
    on conflict(livemode,adjustment_kind,stripe_adjustment_id) do update set stripe_status=excluded.stripe_status,amount_minor=excluded.amount_minor,event_created=excluded.event_created,last_event_id=excluded.last_event_id,metadata=excluded.metadata,updated_at=now();
  if p_dispute_status in ('won','warning_closed','prevented') then
    update public.xeriano_billing_holds set status='RELEASED',released_at=now() where account_id=v_source.account_id and livemode=p_livemode and reason='DISPUTE' and authority_id=p_dispute_id and status='ACTIVE';
  else
    insert into public.xeriano_billing_holds(account_id,livemode,reason,authority_id)
      values(v_source.account_id,p_livemode,'DISPUTE',p_dispute_id)
      on conflict(account_id,livemode,reason,authority_id) do update set status='ACTIVE',released_at=null;
  end if;
  if p_dispute_status='lost' then
    perform public.xeriano_reverse_payment_source_v2(v_source.id,least(p_amount_minor,v_source.gross_amount_minor),'dispute:'||p_livemode::text||':'||p_dispute_id,p_livemode);
  end if;
  update public.xeriano_billing_customers set billing_hold=exists(select 1 from public.xeriano_billing_holds h where h.account_id=v_source.account_id and h.livemode=p_livemode and h.status='ACTIVE')
    where account_id=v_source.account_id and stripe_livemode=p_livemode;
  perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_source.account_id,'PROCESSED',null);
  return jsonb_build_object('status','PROCESSED','financialEffect',case when p_dispute_status in ('won','warning_closed','prevented') then 'NONE' else 'BILLING_HOLD' end);
end; $$;

create or replace function public.xeriano_expire_stripe_checkout_event_v2(
  p_event_id text,p_event_type text,p_event_created bigint,p_livemode boolean,p_checkout_session_id text,p_stripe_customer_id text,p_mode text,p_event_metadata jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_begin text;v_checkout public.xeriano_stripe_checkouts;
begin
  v_begin:=public.xeriano_begin_billing_event_v2(p_event_id,p_event_type,p_event_created,p_livemode,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect','NONE'); end if;
  select * into v_checkout from public.xeriano_stripe_checkouts where livemode=p_livemode and stripe_checkout_session_id=p_checkout_session_id for update;
  if not found and p_stripe_customer_id is not null then v_checkout:=public.xeriano_recover_checkout_from_event_v2(p_checkout_session_id,p_stripe_customer_id,p_mode,null,p_livemode,p_event_metadata); end if;
  if v_checkout.id is null or (p_stripe_customer_id is not null and v_checkout.stripe_customer_id<>p_stripe_customer_id) or v_checkout.mode<>p_mode then raise exception 'CHECKOUT_EXPIRY_AUTHORITY_MISMATCH'; end if;
  update public.xeriano_stripe_checkouts set status='EXPIRED',completed_at=coalesce(completed_at,now()) where id=v_checkout.id and status='CREATED';
  update public.xeriano_billing_customers set checkout_lock_token=null,checkout_lock_mode=null,checkout_lock_product_code=null,checkout_lock_until=null
    where account_id=v_checkout.account_id and checkout_lock_token=v_checkout.request_id;
  perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_checkout.account_id,'PROCESSED',null);
  return jsonb_build_object('status','PROCESSED','financialEffect','NONE');
end; $$;

-- Existing generation reservation remains the atomic spend authority. An
-- active billing hold is checked inside the same account advisory lock.
create or replace function public.xeriano_assert_no_billing_hold(p_account_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.xeriano_billing_holds where account_id=p_account_id and status='ACTIVE')
  then raise exception 'BILLING_HOLD_ACTIVE'; end if;
end; $$;

-- Every new definer is callable only by the trusted server role.
revoke all on function public.xeriano_bind_stripe_customer_v2(uuid,text,boolean),
  public.xeriano_register_stripe_price_mapping_v2(text,text,text,text,boolean),
  public.xeriano_claim_stripe_checkout_v2(uuid,text,uuid,text,text,boolean),
  public.xeriano_record_stripe_checkout_v2(uuid,uuid,uuid,text,text,text,text,text,text,boolean,timestamptz,text),
  public.xeriano_begin_billing_event_v2(text,text,bigint,boolean,jsonb),
  public.xeriano_finish_billing_event_v2(text,boolean,uuid,text,text),
  public.xeriano_reverse_payment_source_v2(uuid,bigint,text,boolean),
  public.xeriano_apply_refund_event_v2(text,text,bigint,boolean,text,text,text,text,bigint,text,text,boolean,jsonb),
  public.xeriano_apply_dispute_event_v2(text,text,bigint,boolean,text,text,text,bigint,text,text,jsonb),
  public.xeriano_expire_stripe_checkout_event_v2(text,text,bigint,boolean,text,text,text,jsonb),
  public.xeriano_assert_no_billing_hold(uuid)
from public,anon,authenticated;
grant execute on function public.xeriano_bind_stripe_customer_v2(uuid,text,boolean),
  public.xeriano_register_stripe_price_mapping_v2(text,text,text,text,boolean),
  public.xeriano_claim_stripe_checkout_v2(uuid,text,uuid,text,text,boolean),
  public.xeriano_record_stripe_checkout_v2(uuid,uuid,uuid,text,text,text,text,text,text,boolean,timestamptz,text),
  public.xeriano_begin_billing_event_v2(text,text,bigint,boolean,jsonb),
  public.xeriano_finish_billing_event_v2(text,boolean,uuid,text,text),
  public.xeriano_reverse_payment_source_v2(uuid,bigint,text,boolean),
  public.xeriano_apply_refund_event_v2(text,text,bigint,boolean,text,text,text,text,bigint,text,text,boolean,jsonb),
  public.xeriano_apply_dispute_event_v2(text,text,bigint,boolean,text,text,text,bigint,text,text,jsonb),
  public.xeriano_expire_stripe_checkout_event_v2(text,text,bigint,boolean,text,text,text,jsonb),
  public.xeriano_assert_no_billing_hold(uuid)
to service_role;

-- If Stripe accepted a Checkout but the post-create authority write failed,
-- signed Stripe metadata plus the still account-bound claim can reconstruct
-- exactly that session. This function never creates a Stripe session.
create or replace function public.xeriano_recover_checkout_from_event_v2(
  p_checkout_session_id text,p_stripe_customer_id text,p_mode text,p_payment_intent_id text,p_livemode boolean,p_event_metadata jsonb
) returns public.xeriano_stripe_checkouts language plpgsql security definer set search_path='' as $$
declare v_account_id uuid;v_actor_id uuid;v_request_id uuid;v_product_code text;v_catalog_version text;v_mapping public.xeriano_stripe_price_mappings;v_checkout public.xeriano_stripe_checkouts;
begin
  if p_mode not in ('SUBSCRIPTION','TOP_UP') or jsonb_typeof(p_event_metadata)<>'object' then raise exception 'CHECKOUT_RECOVERY_INVALID'; end if;
  begin
    v_account_id:=(p_event_metadata->>'accountId')::uuid;
    v_actor_id:=(p_event_metadata->>'actorId')::uuid;
    v_request_id:=(p_event_metadata->>'requestId')::uuid;
  exception when invalid_text_representation then raise exception 'CHECKOUT_RECOVERY_METADATA_INVALID'; end;
  v_product_code:=p_event_metadata->>'productCode';v_catalog_version:=p_event_metadata->>'catalogVersion';
  perform 1 from public.xeriano_account_memberships where account_id=v_account_id and user_id=v_actor_id and role='CUSTOMER' and status='ACTIVE';
  if not found then raise exception 'CHECKOUT_RECOVERY_ACCOUNT_MISMATCH'; end if;
  perform 1 from public.xeriano_billing_customers where account_id=v_account_id and stripe_customer_id=p_stripe_customer_id and stripe_livemode=p_livemode;
  if not found then raise exception 'CHECKOUT_RECOVERY_CUSTOMER_MISMATCH'; end if;
  select * into v_mapping from public.xeriano_stripe_price_mappings where livemode=p_livemode and product_code=v_product_code and catalog_version=v_catalog_version and product_kind=p_mode and active;
  if not found then raise exception 'CHECKOUT_RECOVERY_PRICE_MISMATCH'; end if;
  insert into public.xeriano_stripe_checkouts(account_id,actor_user_id,request_id,stripe_customer_id,stripe_checkout_session_id,stripe_payment_intent_id,stripe_price_mapping_id,mode,livemode)
    values(v_account_id,v_actor_id,v_request_id,p_stripe_customer_id,p_checkout_session_id,p_payment_intent_id,v_mapping.id,p_mode,p_livemode)
    on conflict(livemode,stripe_checkout_session_id) do nothing;
  select * into v_checkout from public.xeriano_stripe_checkouts where livemode=p_livemode and stripe_checkout_session_id=p_checkout_session_id;
  if not found or v_checkout.account_id<>v_account_id or v_checkout.actor_user_id<>v_actor_id or v_checkout.request_id<>v_request_id or v_checkout.mode<>p_mode then raise exception 'CHECKOUT_RECOVERY_CONFLICT'; end if;
  return v_checkout;
end; $$;
revoke all on function public.xeriano_recover_checkout_from_event_v2(text,text,text,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.xeriano_recover_checkout_from_event_v2(text,text,text,text,boolean,jsonb) to service_role;


create or replace function public.xeriano_complete_subscription_checkout_event(
  p_event_id text,p_event_type text,p_checkout_session_id text,p_stripe_customer_id text,p_stripe_subscription_id text,
  p_event_metadata jsonb,p_livemode boolean,p_event_created bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_begin text;v_checkout public.xeriano_stripe_checkouts;
begin
  v_begin:=public.xeriano_begin_billing_event_v2(p_event_id,p_event_type,p_event_created,p_livemode,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect','NONE'); end if;
  select * into v_checkout from public.xeriano_stripe_checkouts where livemode=p_livemode and stripe_checkout_session_id=p_checkout_session_id for update;
  if not found then v_checkout:=public.xeriano_recover_checkout_from_event_v2(p_checkout_session_id,p_stripe_customer_id,'SUBSCRIPTION',null,p_livemode,p_event_metadata); end if;
  if v_checkout.id is null or v_checkout.mode<>'SUBSCRIPTION' or v_checkout.stripe_customer_id<>p_stripe_customer_id then raise exception 'SUBSCRIPTION_CHECKOUT_AUTHORITY_MISMATCH'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_checkout.account_id::text,0));
  update public.xeriano_stripe_checkouts set status='COMPLETED',completed_at=coalesce(completed_at,now()) where id=v_checkout.id;
  update public.xeriano_billing_customers set stripe_subscription_id=p_stripe_subscription_id,billing_status=case when billing_status='INACTIVE' then 'INCOMPLETE' else billing_status end,last_webhook_at=now()
    where account_id=v_checkout.account_id and stripe_customer_id=p_stripe_customer_id and stripe_livemode=p_livemode;
  perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_checkout.account_id,'PROCESSED',null);
  return jsonb_build_object('status','PROCESSED','financialEffect','NONE');
end; $$;

create or replace function public.xeriano_grant_topup_checkout_event(
  p_event_id text,p_event_type text,p_checkout_session_id text,p_stripe_customer_id text,p_payment_status text,
  p_payment_intent_id text,p_amount_total_minor bigint,p_currency text,p_event_metadata jsonb,p_livemode boolean,p_event_created bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_begin text;v_checkout public.xeriano_stripe_checkouts;v_mapping public.xeriano_stripe_price_mappings;v_policy public.xeriano_economic_policies;v_bucket_id uuid;v_available integer;v_net_micros bigint;
begin
  v_begin:=public.xeriano_begin_billing_event_v2(p_event_id,p_event_type,p_event_created,p_livemode,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect',case when v_begin='PROCESSED' then 'TOP_UP_GRANT' else 'NONE' end); end if;
  select * into v_checkout from public.xeriano_stripe_checkouts where livemode=p_livemode and stripe_checkout_session_id=p_checkout_session_id for update;
  if not found then v_checkout:=public.xeriano_recover_checkout_from_event_v2(p_checkout_session_id,p_stripe_customer_id,'TOP_UP',p_payment_intent_id,p_livemode,p_event_metadata); end if;
  if v_checkout.id is null or v_checkout.mode<>'TOP_UP' or v_checkout.stripe_customer_id<>p_stripe_customer_id then raise exception 'TOPUP_CHECKOUT_AUTHORITY_MISMATCH'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_checkout.account_id::text,0));
  if p_payment_status<>'paid' then
    update public.xeriano_stripe_checkouts set status='IGNORED',completed_at=coalesce(completed_at,now()) where id=v_checkout.id;
    perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_checkout.account_id,'IGNORED','CHECKOUT_NOT_PAID');
    return jsonb_build_object('status','IGNORED','financialEffect','NONE');
  end if;
  select * into v_mapping from public.xeriano_stripe_price_mappings where id=v_checkout.stripe_price_mapping_id and product_kind='TOP_UP' and livemode=p_livemode;
  select * into v_policy from public.xeriano_economic_policies where active;
  if not found or v_mapping.topup_product_version_id is null or p_amount_total_minor is null or p_currency is null or p_amount_total_minor<>v_mapping.gross_price_minor or upper(p_currency)<>v_mapping.currency then raise exception 'TOPUP_ECONOMICS_UNAVAILABLE'; end if;
  v_net_micros:=floor(v_mapping.gross_price_minor::numeric*10000*10000/(10000+v_policy.tax_basis_points))::bigint;
  insert into public.xeriano_credit_buckets(account_id,bucket_type,source_key,granted_credits,remaining_credits,expires_at,topup_product_version_id,economic_policy_id,billing_source_id,gross_amount_minor,net_amount_micros,economic_currency,granted_at)
    values(v_checkout.account_id,'TOP_UP','topup:stripe_'||p_livemode::text||':'||p_checkout_session_id,v_mapping.granted_credits,v_mapping.granted_credits,null,v_mapping.topup_product_version_id,v_policy.id,p_checkout_session_id,v_mapping.gross_price_minor,v_net_micros,v_mapping.currency,now())
    on conflict(account_id,source_key) do nothing returning id into v_bucket_id;
  if v_bucket_id is null then select id into v_bucket_id from public.xeriano_credit_buckets where account_id=v_checkout.account_id and source_key='topup:stripe_'||p_livemode::text||':'||p_checkout_session_id; end if;
  select coalesce(sum(remaining_credits-reserved_credits),0) into v_available from public.xeriano_credit_buckets where account_id=v_checkout.account_id and (expires_at is null or expires_at>now());
  insert into public.xeriano_credit_ledger(account_id,bucket_id,transaction_type,amount_delta,resulting_available,idempotency_key,metadata)
    values(v_checkout.account_id,v_bucket_id,'GRANT',v_mapping.granted_credits,v_available,'topup:stripe_'||p_livemode::text||':'||p_checkout_session_id||':grant',jsonb_build_object('productVersion',v_mapping.catalog_version,'stripeEventId',p_event_id,'livemode',p_livemode))
    on conflict(idempotency_key) do nothing;
  insert into public.xeriano_stripe_payment_sources(account_id,livemode,stripe_customer_id,stripe_checkout_session_id,stripe_payment_intent_id,credit_bucket_id,gross_amount_minor,granted_credits,currency)
    values(v_checkout.account_id,p_livemode,p_stripe_customer_id,p_checkout_session_id,p_payment_intent_id,v_bucket_id,v_mapping.gross_price_minor,v_mapping.granted_credits,v_mapping.currency)
    on conflict(livemode,stripe_checkout_session_id) do update set stripe_payment_intent_id=coalesce(public.xeriano_stripe_payment_sources.stripe_payment_intent_id,excluded.stripe_payment_intent_id),updated_at=now();
  update public.xeriano_stripe_checkouts set status='PAID',completed_at=coalesce(completed_at,now()),stripe_payment_intent_id=coalesce(stripe_payment_intent_id,p_payment_intent_id) where id=v_checkout.id;
  perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_checkout.account_id,'PROCESSED',null);
  return jsonb_build_object('status','PROCESSED','financialEffect','TOP_UP_GRANT');
end; $$;

create or replace function public.xeriano_grant_subscription_invoice_event(
  p_event_id text,p_event_type text,p_invoice_id text,p_stripe_customer_id text,p_stripe_subscription_id text,
  p_stripe_price_id text,p_plan_version text,p_billing_reason text,p_invoice_status text,p_amount_paid_minor bigint,
  p_plan_line_amount_minor bigint,p_currency text,p_period_start timestamptz,p_period_end timestamptz,p_event_metadata jsonb,
  p_livemode boolean,p_event_created bigint,p_payment_intent_id text,p_charge_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_begin text;v_account_id uuid;v_mapping public.xeriano_stripe_price_mappings;v_plan public.xeriano_plan_versions;v_policy public.xeriano_economic_policies;v_bucket_id uuid;v_available integer;v_net_micros bigint;
begin
  v_begin:=public.xeriano_begin_billing_event_v2(p_event_id,p_event_type,p_event_created,p_livemode,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect',case when v_begin='PROCESSED' then 'SUBSCRIPTION_GRANT' else 'NONE' end); end if;
  if p_billing_reason not in ('subscription_create','subscription_cycle') or p_invoice_status<>'paid' or p_amount_paid_minor<=0 or p_period_end<=p_period_start then raise exception 'INVOICE_NOT_ELIGIBLE'; end if;
  select account_id into v_account_id from public.xeriano_billing_customers where stripe_customer_id=p_stripe_customer_id and stripe_livemode=p_livemode for update;
  if not found then raise exception 'STRIPE_CUSTOMER_UNKNOWN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text,0));
  select * into v_mapping from public.xeriano_stripe_price_mappings where livemode=p_livemode and stripe_price_id=p_stripe_price_id and product_kind='SUBSCRIPTION' and catalog_version=p_plan_version;
  if not found then raise exception 'SUBSCRIPTION_PRICE_MAPPING_UNKNOWN'; end if;
  select * into v_plan from public.xeriano_plan_versions where id=v_mapping.plan_version_id;
  select * into v_policy from public.xeriano_economic_policies where active;
  if v_plan.id is null or v_policy.id is null or upper(p_currency)<>v_mapping.currency or p_plan_line_amount_minor<>v_mapping.gross_price_minor or p_amount_paid_minor<v_mapping.gross_price_minor then raise exception 'SUBSCRIPTION_INVOICE_CATALOG_MISMATCH'; end if;
  v_net_micros:=floor(v_mapping.gross_price_minor::numeric*10000*10000/(10000+v_policy.tax_basis_points))::bigint;
  insert into public.xeriano_credit_buckets(account_id,bucket_type,source_key,granted_credits,remaining_credits,expires_at,plan_version_id,economic_policy_id,billing_source_id,gross_amount_minor,net_amount_micros,economic_currency,entitlement_period_start,entitlement_period_end,granted_at)
    values(v_account_id,'SUBSCRIPTION','subscription:stripe_'||p_livemode::text||':'||p_invoice_id,v_mapping.granted_credits,v_mapping.granted_credits,p_period_end,v_plan.id,v_policy.id,p_invoice_id,v_mapping.gross_price_minor,v_net_micros,v_mapping.currency,p_period_start,p_period_end,now())
    on conflict(account_id,source_key) do nothing returning id into v_bucket_id;
  if v_bucket_id is null then select id into v_bucket_id from public.xeriano_credit_buckets where account_id=v_account_id and source_key='subscription:stripe_'||p_livemode::text||':'||p_invoice_id; end if;
  select coalesce(sum(remaining_credits-reserved_credits),0) into v_available from public.xeriano_credit_buckets where account_id=v_account_id and (expires_at is null or expires_at>now());
  insert into public.xeriano_credit_ledger(account_id,bucket_id,transaction_type,amount_delta,resulting_available,idempotency_key,metadata)
    values(v_account_id,v_bucket_id,'GRANT',v_mapping.granted_credits,v_available,'subscription:stripe_'||p_livemode::text||':'||p_invoice_id||':grant',jsonb_build_object('planVersion',v_plan.version,'stripeEventId',p_event_id,'livemode',p_livemode,'billingReason',p_billing_reason))
    on conflict(idempotency_key) do nothing;
  insert into public.xeriano_stripe_payment_sources(account_id,livemode,stripe_customer_id,stripe_invoice_id,stripe_payment_intent_id,stripe_charge_id,credit_bucket_id,gross_amount_minor,granted_credits,currency)
    values(v_account_id,p_livemode,p_stripe_customer_id,p_invoice_id,p_payment_intent_id,p_charge_id,v_bucket_id,v_mapping.gross_price_minor,v_mapping.granted_credits,v_mapping.currency)
    on conflict(livemode,stripe_invoice_id) do update set stripe_payment_intent_id=coalesce(public.xeriano_stripe_payment_sources.stripe_payment_intent_id,excluded.stripe_payment_intent_id),stripe_charge_id=coalesce(public.xeriano_stripe_payment_sources.stripe_charge_id,excluded.stripe_charge_id),updated_at=now();
  update public.xeriano_subscription_state set plan=v_plan.plan_code::public.xeriano_plan,status='ACTIVE',monthly_credits=v_plan.granted_credits,image_concurrency_limit=v_plan.image_concurrency_limit,video_concurrency_limit=v_plan.video_concurrency_limit,current_period_start=p_period_start,current_period_end=p_period_end,plan_version_id=v_plan.id,commercial_catalog_version=v_plan.catalog_version where account_id=v_account_id;
  update public.xeriano_billing_customers set stripe_subscription_id=p_stripe_subscription_id,plan=v_plan.plan_code::public.xeriano_plan,billing_status='ACTIVE',current_period_start=p_period_start,current_period_end=p_period_end,cancel_at_period_end=false,plan_version_id=v_plan.id,last_paid_invoice_id=p_invoice_id,last_webhook_at=now() where account_id=v_account_id and stripe_livemode=p_livemode;
  perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_account_id,'PROCESSED',null);
  return jsonb_build_object('status','PROCESSED','financialEffect','SUBSCRIPTION_GRANT');
end; $$;

create or replace function public.xeriano_sync_subscription_event(
  p_event_id text,p_event_type text,p_stripe_customer_id text,p_stripe_subscription_id text,p_stripe_price_id text,
  p_plan_version text,p_stripe_status text,p_cancel_at_period_end boolean,p_period_start timestamptz,p_period_end timestamptz,
  p_deleted boolean,p_event_metadata jsonb,p_livemode boolean,p_event_created bigint,p_object_marker bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_begin text;v_customer public.xeriano_billing_customers;v_mapping public.xeriano_stripe_price_mappings;v_plan public.xeriano_plan_versions;v_billing_status text;v_state_status text;
begin
  v_begin:=public.xeriano_begin_billing_event_v2(p_event_id,p_event_type,p_event_created,p_livemode,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect','NONE'); end if;
  if p_period_end<=p_period_start then raise exception 'INVALID_SUBSCRIPTION_PERIOD'; end if;
  select * into v_customer from public.xeriano_billing_customers where stripe_customer_id=p_stripe_customer_id and stripe_livemode=p_livemode for update;
  if not found then raise exception 'STRIPE_CUSTOMER_UNKNOWN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_customer.account_id::text,0));
  if v_customer.last_subscription_event_created>p_object_marker or (v_customer.last_subscription_event_created=p_object_marker and coalesce(v_customer.last_subscription_event_id,'')>=p_event_id) then
    perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_customer.account_id,'IGNORED','STALE_SUBSCRIPTION_EVENT');
    return jsonb_build_object('status','IGNORED','financialEffect','NONE');
  end if;
  select * into v_mapping from public.xeriano_stripe_price_mappings where livemode=p_livemode and stripe_price_id=p_stripe_price_id and product_kind='SUBSCRIPTION' and catalog_version=p_plan_version;
  select * into v_plan from public.xeriano_plan_versions where id=v_mapping.plan_version_id;
  if v_plan.id is null then raise exception 'SUBSCRIPTION_PRICE_MAPPING_UNKNOWN'; end if;
  v_billing_status:=case when p_deleted or p_stripe_status in ('canceled','incomplete_expired') then 'CANCELED' when p_stripe_status='active' then 'ACTIVE' when p_stripe_status='trialing' then 'TRIALING' when p_stripe_status in ('past_due','unpaid') then 'PAST_DUE' else 'INCOMPLETE' end;
  v_state_status:=case when v_billing_status='ACTIVE' then 'ACTIVE' when v_billing_status='PAST_DUE' then 'PAST_DUE' when v_billing_status='CANCELED' then 'CANCELED' else 'INCOMPLETE' end;
  update public.xeriano_billing_customers set stripe_subscription_id=p_stripe_subscription_id,plan=v_plan.plan_code::public.xeriano_plan,billing_status=v_billing_status,current_period_start=p_period_start,current_period_end=p_period_end,cancel_at_period_end=coalesce(p_cancel_at_period_end,false),plan_version_id=v_plan.id,last_webhook_at=now(),last_subscription_event_created=p_object_marker,last_subscription_event_id=p_event_id where account_id=v_customer.account_id and stripe_livemode=p_livemode;
  update public.xeriano_subscription_state set status=v_state_status,current_period_start=p_period_start,current_period_end=p_period_end where account_id=v_customer.account_id;
  perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_customer.account_id,'PROCESSED',null);
  return jsonb_build_object('status','PROCESSED','financialEffect','NONE');
end; $$;

create or replace function public.xeriano_mark_invoice_payment_failed_event(
  p_event_id text,p_event_type text,p_invoice_id text,p_stripe_customer_id text,p_stripe_subscription_id text,
  p_event_metadata jsonb,p_livemode boolean,p_event_created bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_begin text;v_account_id uuid;
begin
  v_begin:=public.xeriano_begin_billing_event_v2(p_event_id,p_event_type,p_event_created,p_livemode,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect','NONE'); end if;
  select account_id into v_account_id from public.xeriano_billing_customers where stripe_customer_id=p_stripe_customer_id and stripe_livemode=p_livemode for update;
  if not found then raise exception 'STRIPE_CUSTOMER_UNKNOWN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text,0));
  update public.xeriano_billing_customers set stripe_subscription_id=p_stripe_subscription_id,billing_status='PAST_DUE',last_webhook_at=now() where account_id=v_account_id and stripe_livemode=p_livemode;
  update public.xeriano_subscription_state set status='PAST_DUE' where account_id=v_account_id;
  perform public.xeriano_finish_billing_event_v2(p_event_id,p_livemode,v_account_id,'PROCESSED','INVOICE_PAYMENT_FAILED');
  return jsonb_build_object('status','PROCESSED','financialEffect','NONE');
end; $$;

revoke all on function public.xeriano_complete_subscription_checkout_event(text,text,text,text,text,jsonb,boolean,bigint),
  public.xeriano_grant_topup_checkout_event(text,text,text,text,text,text,bigint,text,jsonb,boolean,bigint),
  public.xeriano_grant_subscription_invoice_event(text,text,text,text,text,text,text,text,text,bigint,bigint,text,timestamptz,timestamptz,jsonb,boolean,bigint,text,text),
  public.xeriano_sync_subscription_event(text,text,text,text,text,text,text,boolean,timestamptz,timestamptz,boolean,jsonb,boolean,bigint,bigint),
  public.xeriano_mark_invoice_payment_failed_event(text,text,text,text,text,jsonb,boolean,bigint)
from public,anon,authenticated;
grant execute on function public.xeriano_complete_subscription_checkout_event(text,text,text,text,text,jsonb,boolean,bigint),
  public.xeriano_grant_topup_checkout_event(text,text,text,text,text,text,bigint,text,jsonb,boolean,bigint),
  public.xeriano_grant_subscription_invoice_event(text,text,text,text,text,text,text,text,text,bigint,bigint,text,timestamptz,timestamptz,jsonb,boolean,bigint,text,text),
  public.xeriano_sync_subscription_event(text,text,text,text,text,text,text,boolean,timestamptz,timestamptz,boolean,jsonb,boolean,bigint,bigint),
  public.xeriano_mark_invoice_payment_failed_event(text,text,text,text,text,jsonb,boolean,bigint)
to service_role;


-- Atomic generation gate: holds are checked under the same account lock as reservations.
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
  perform public.xeriano_assert_no_billing_hold(p_account_id);
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
revoke all on function public.xeriano_reserve_credits(uuid,text,text,text,public.xeriano_generation_operation,text,integer) from public,anon,authenticated;
grant execute on function public.xeriano_reserve_credits(uuid,text,text,text,public.xeriano_generation_operation,text,integer) to service_role;

create or replace function public.xeriano_record_billing_event_outcome_v2(
  p_event_id text,p_event_type text,p_event_created bigint,p_livemode boolean,p_status text,p_failure_code text,p_event_metadata jsonb
) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_status not in ('FAILED','IGNORED') or p_event_created<=0 or coalesce(char_length(p_failure_code),0) not between 1 and 160
    or jsonb_typeof(coalesce(p_event_metadata,'{}'::jsonb))<>'object' or octet_length(coalesce(p_event_metadata,'{}'::jsonb)::text)>32768
  then raise exception 'INVALID_BILLING_EVENT_OUTCOME'; end if;
  insert into public.xeriano_billing_events(stripe_event_id,event_type,event_created,livemode,processing_status,event_metadata,processed_at,failure_code)
    values(p_event_id,p_event_type,p_event_created,p_livemode,p_status,coalesce(p_event_metadata,'{}'::jsonb),now(),p_failure_code)
    on conflict(livemode,stripe_event_id) do update set event_type=excluded.event_type,event_created=excluded.event_created,processing_status=excluded.processing_status,event_metadata=excluded.event_metadata,processed_at=excluded.processed_at,failure_code=excluded.failure_code
    where public.xeriano_billing_events.processing_status not in ('PROCESSED','IGNORED');
end; $$;
revoke all on function public.xeriano_record_billing_event_outcome_v2(text,text,bigint,boolean,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.xeriano_record_billing_event_outcome_v2(text,text,bigint,boolean,text,text,jsonb) to service_role;

create or replace function public.xeriano_stripe_event_authority_immutable()
returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception 'STRIPE_EVENT_AUTHORITY_IMMUTABLE'; end; $$;
drop trigger if exists xeriano_stripe_event_authority_no_mutation on public.xeriano_stripe_event_authorities;
create trigger xeriano_stripe_event_authority_no_mutation before update or delete on public.xeriano_stripe_event_authorities
  for each row execute function public.xeriano_stripe_event_authority_immutable();
revoke all on function public.xeriano_stripe_event_authority_immutable() from public,anon,authenticated;
grant execute on function public.xeriano_stripe_event_authority_immutable() to service_role;

-- Backward-compatible TEST wrappers keep a rolling deployment's older server
-- instances functional after the unique authorities become livemode-aware.
-- They can never write Live authority because livemode is fixed to false.
create or replace function public.xeriano_begin_billing_event(
  p_event_id text,p_event_type text,p_metadata jsonb
) returns text language plpgsql security definer set search_path='' as $$
begin
  return public.xeriano_begin_billing_event_v2(
    p_event_id,p_event_type,extract(epoch from clock_timestamp())::bigint,false,p_metadata
  );
end; $$;

create or replace function public.xeriano_finish_billing_event(
  p_event_id text,p_account_id uuid,p_status text,p_failure_code text default null
) returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.xeriano_finish_billing_event_v2(p_event_id,false,p_account_id,p_status,p_failure_code);
end; $$;

create or replace function public.xeriano_record_billing_event_outcome(
  p_event_id text,p_event_type text,p_status text,p_failure_code text,p_event_metadata jsonb
) returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.xeriano_record_billing_event_outcome_v2(
    p_event_id,p_event_type,extract(epoch from clock_timestamp())::bigint,false,
    p_status,p_failure_code,p_event_metadata
  );
end; $$;

create or replace function public.xeriano_register_stripe_price_mapping(
  p_mode text,p_product_code text,p_catalog_version text,p_stripe_price_id text
) returns public.xeriano_stripe_price_mappings language plpgsql security definer set search_path='' as $$
begin
  return public.xeriano_register_stripe_price_mapping_v2(
    p_mode,p_product_code,p_catalog_version,p_stripe_price_id,false
  );
end; $$;

create or replace function public.xeriano_record_stripe_checkout(
  p_account_id uuid,p_request_id uuid,p_stripe_customer_id text,p_checkout_session_id text,p_mode text,
  p_product_code text,p_catalog_version text,p_stripe_price_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor_id uuid;
begin
  select m.user_id into v_actor_id
  from public.xeriano_account_memberships m
  where m.account_id=p_account_id and m.role='CUSTOMER' and m.status='ACTIVE' and m.is_primary
  order by m.created_at,m.user_id limit 1;
  if v_actor_id is null then raise exception 'CUSTOMER_ACCOUNT_ACCESS_DENIED'; end if;
  return public.xeriano_record_stripe_checkout_v2(
    p_account_id,v_actor_id,p_request_id,p_stripe_customer_id,p_checkout_session_id,
    p_mode,p_product_code,p_catalog_version,p_stripe_price_id,false,null,null
  );
end; $$;

revoke all on function public.xeriano_begin_billing_event(text,text,jsonb),
  public.xeriano_finish_billing_event(text,uuid,text,text),
  public.xeriano_record_billing_event_outcome(text,text,text,text,jsonb),
  public.xeriano_register_stripe_price_mapping(text,text,text,text),
  public.xeriano_record_stripe_checkout(uuid,uuid,text,text,text,text,text,text)
from public,anon,authenticated;
grant execute on function public.xeriano_begin_billing_event(text,text,jsonb),
  public.xeriano_finish_billing_event(text,uuid,text,text),
  public.xeriano_record_billing_event_outcome(text,text,text,text,jsonb),
  public.xeriano_register_stripe_price_mapping(text,text,text,text),
  public.xeriano_record_stripe_checkout(uuid,uuid,text,text,text,text,text,text)
to service_role;
