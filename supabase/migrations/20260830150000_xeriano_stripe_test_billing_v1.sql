-- Xeriano Stripe TEST-mode billing settlement V1.
-- Additive only. Existing credit reservation/settlement functions are unchanged.

alter table public.xeriano_billing_customers
  add column if not exists stripe_livemode boolean not null default false,
  add column if not exists plan_version_id uuid references public.xeriano_plan_versions(id) on delete restrict,
  add column if not exists last_paid_invoice_id text,
  add column if not exists last_webhook_at timestamptz,
  add column if not exists checkout_lock_token uuid,
  add column if not exists checkout_lock_mode text check (checkout_lock_mode is null or checkout_lock_mode in ('SUBSCRIPTION','TOP_UP')),
  add column if not exists checkout_lock_product_code text,
  add column if not exists checkout_lock_until timestamptz;

alter table public.xeriano_billing_customers
  drop constraint if exists xeriano_billing_customers_test_mode_only;
alter table public.xeriano_billing_customers
  add constraint xeriano_billing_customers_test_mode_only check (stripe_livemode = false);

create table if not exists public.xeriano_stripe_price_mappings (
  id uuid primary key default gen_random_uuid(),
  product_code text not null check (char_length(product_code) between 1 and 80),
  product_kind text not null check (product_kind in ('SUBSCRIPTION','TOP_UP')),
  stripe_price_id text not null unique check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  catalog_code text not null check (char_length(catalog_code) between 1 and 80),
  catalog_version text not null check (char_length(catalog_version) between 1 and 120),
  plan_version_id uuid references public.xeriano_plan_versions(id) on delete restrict,
  topup_product_version_id uuid references public.xeriano_topup_product_versions(id) on delete restrict,
  gross_price_minor bigint not null check (gross_price_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  granted_credits integer not null check (granted_credits > 0),
  livemode boolean not null default false check (livemode = false),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  unique (product_code,catalog_version),
  check (
    (product_kind = 'SUBSCRIPTION' and plan_version_id is not null and topup_product_version_id is null)
    or (product_kind = 'TOP_UP' and plan_version_id is null and topup_product_version_id is not null)
  )
);
create index if not exists xeriano_stripe_price_mappings_product_idx
  on public.xeriano_stripe_price_mappings(product_code,active,last_verified_at desc);

create table if not exists public.xeriano_stripe_checkouts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete restrict,
  request_id uuid not null,
  stripe_customer_id text not null check (char_length(stripe_customer_id) between 1 and 255),
  stripe_checkout_session_id text not null unique check (stripe_checkout_session_id ~ '^cs_test_[A-Za-z0-9_]+$'),
  stripe_price_mapping_id uuid not null references public.xeriano_stripe_price_mappings(id) on delete restrict,
  mode text not null check (mode in ('SUBSCRIPTION','TOP_UP')),
  status text not null default 'CREATED' check (status in ('CREATED','COMPLETED','PAID','IGNORED')),
  livemode boolean not null default false check (livemode = false),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id,account_id),
  unique (account_id,request_id),
  check ((status = 'CREATED' and completed_at is null) or (status <> 'CREATED' and completed_at is not null))
);
create index if not exists xeriano_stripe_checkouts_account_idx
  on public.xeriano_stripe_checkouts(account_id,created_at desc);
create index if not exists xeriano_stripe_checkouts_customer_idx
  on public.xeriano_stripe_checkouts(stripe_customer_id,created_at desc);

create unique index if not exists xeriano_subscription_bucket_entitlement_once_idx
  on public.xeriano_credit_buckets(account_id,plan_version_id,entitlement_period_start,entitlement_period_end)
  where plan_version_id is not null and entitlement_period_start is not null and entitlement_period_end is not null;

create or replace function public.xeriano_begin_billing_event(
  p_event_id text,p_event_type text,p_metadata jsonb
) returns text
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_status text;
begin
  if coalesce(char_length(p_event_id),0) not between 1 and 255
    or coalesce(char_length(p_event_type),0) not between 1 and 160
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_metadata,'{}'::jsonb)::text) > 32768
  then raise exception 'INVALID_BILLING_EVENT'; end if;
  insert into public.xeriano_billing_events(stripe_event_id,event_type,processing_status,event_metadata)
    values(p_event_id,p_event_type,'PROCESSING',coalesce(p_metadata,'{}'::jsonb))
    on conflict(stripe_event_id) do nothing;
  select processing_status into v_status from public.xeriano_billing_events
    where stripe_event_id=p_event_id for update;
  if v_status in ('PROCESSED','IGNORED') then return v_status; end if;
  update public.xeriano_billing_events set
    event_type=p_event_type,processing_status='PROCESSING',event_metadata=coalesce(p_metadata,'{}'::jsonb),
    processed_at=null,failure_code=null
    where stripe_event_id=p_event_id;
  return 'PROCESSING';
end; $$;

create or replace function public.xeriano_finish_billing_event(
  p_event_id text,p_account_id uuid,p_status text,p_failure_code text default null
) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_status not in ('PROCESSED','IGNORED') then raise exception 'INVALID_BILLING_EVENT_STATUS'; end if;
  update public.xeriano_billing_events set account_id=p_account_id,processing_status=p_status,
    processed_at=now(),failure_code=p_failure_code where stripe_event_id=p_event_id;
  if not found then raise exception 'BILLING_EVENT_NOT_FOUND'; end if;
end; $$;

create or replace function public.xeriano_record_billing_event_outcome(
  p_event_id text,p_event_type text,p_status text,p_failure_code text,p_event_metadata jsonb
) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_status not in ('FAILED','IGNORED')
    or coalesce(char_length(p_failure_code),0) not between 1 and 160
    or jsonb_typeof(coalesce(p_event_metadata,'{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_event_metadata,'{}'::jsonb)::text) > 32768
  then raise exception 'INVALID_BILLING_EVENT_OUTCOME'; end if;
  insert into public.xeriano_billing_events(
    stripe_event_id,event_type,processing_status,event_metadata,processed_at,failure_code
  ) values (
    p_event_id,p_event_type,p_status,coalesce(p_event_metadata,'{}'::jsonb),now(),p_failure_code
  ) on conflict(stripe_event_id) do update set
    event_type=excluded.event_type,processing_status=excluded.processing_status,
    event_metadata=excluded.event_metadata,processed_at=excluded.processed_at,failure_code=excluded.failure_code
  where public.xeriano_billing_events.processing_status not in ('PROCESSED','IGNORED');
end; $$;

create or replace function public.xeriano_bind_stripe_customer(
  p_account_id uuid,p_stripe_customer_id text
) returns public.xeriano_billing_customers
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row public.xeriano_billing_customers;
begin
  if p_stripe_customer_id !~ '^cus_[A-Za-z0-9]+$' then raise exception 'INVALID_STRIPE_CUSTOMER'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text,0));
  perform 1 from public.xeriano_accounts where id=p_account_id and status='ACTIVE';
  if not found then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  insert into public.xeriano_billing_customers(account_id,stripe_customer_id,stripe_livemode)
    values(p_account_id,p_stripe_customer_id,false)
    on conflict(account_id) do nothing;
  select * into v_row from public.xeriano_billing_customers where account_id=p_account_id for update;
  if v_row.stripe_livemode or (v_row.stripe_customer_id is not null and v_row.stripe_customer_id<>p_stripe_customer_id)
  then raise exception 'STRIPE_CUSTOMER_CONFLICT'; end if;
  update public.xeriano_billing_customers set stripe_customer_id=p_stripe_customer_id,updated_at=now()
    where account_id=p_account_id returning * into v_row;
  return v_row;
end; $$;

create or replace function public.xeriano_claim_stripe_checkout(
  p_account_id uuid,p_stripe_customer_id text,p_request_id uuid,p_mode text,p_product_code text
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_customer public.xeriano_billing_customers;v_existing public.xeriano_stripe_checkouts;v_existing_product text;
begin
  if p_mode not in ('SUBSCRIPTION','TOP_UP') or coalesce(char_length(p_product_code),0) not between 1 and 80
  then raise exception 'INVALID_STRIPE_CHECKOUT_MODE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text,0));
  select * into v_existing from public.xeriano_stripe_checkouts
    where account_id=p_account_id and request_id=p_request_id;
  if found then
    select product_code into v_existing_product from public.xeriano_stripe_price_mappings
      where id=v_existing.stripe_price_mapping_id;
    if v_existing.mode<>p_mode or v_existing_product<>p_product_code
    then raise exception 'STRIPE_CHECKOUT_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('status','RECORDED');
  end if;
  select * into v_customer from public.xeriano_billing_customers
    where account_id=p_account_id and stripe_customer_id=p_stripe_customer_id and stripe_livemode=false for update;
  if not found then raise exception 'STRIPE_CUSTOMER_NOT_BOUND'; end if;
  if v_customer.checkout_lock_until>now() then
    if v_customer.checkout_lock_token<>p_request_id then raise exception 'STRIPE_CHECKOUT_ALREADY_IN_PROGRESS'; end if;
    if v_customer.checkout_lock_mode<>p_mode or v_customer.checkout_lock_product_code<>p_product_code
    then raise exception 'STRIPE_CHECKOUT_IDEMPOTENCY_CONFLICT'; end if;
  end if;
  update public.xeriano_billing_customers set checkout_lock_token=p_request_id,
    checkout_lock_mode=p_mode,checkout_lock_product_code=p_product_code,
    checkout_lock_until=now()+interval '15 minutes'
    where account_id=p_account_id;
  return jsonb_build_object('status','CLAIMED');
end; $$;

create or replace function public.xeriano_register_stripe_price_mapping(
  p_mode text,p_product_code text,p_catalog_version text,p_stripe_price_id text
) returns public.xeriano_stripe_price_mappings
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_mapping public.xeriano_stripe_price_mappings;
  v_plan public.xeriano_plan_versions;
  v_topup public.xeriano_topup_product_versions;
begin
  if p_mode not in ('SUBSCRIPTION','TOP_UP') or p_stripe_price_id !~ '^price_[A-Za-z0-9]+$'
  then raise exception 'INVALID_STRIPE_PRICE_MAPPING'; end if;
  perform pg_advisory_xact_lock(hashtextextended('stripe-price:'||p_product_code,0));
  if p_mode='SUBSCRIPTION' then
    select * into v_plan from public.xeriano_plan_versions where version=p_catalog_version and active;
    if not found or v_plan.plan_code<>replace(p_product_code,'_MONTHLY','') or v_plan.billing_interval<>'MONTHLY'
    then raise exception 'PLAN_CATALOG_MISMATCH'; end if;
    insert into public.xeriano_stripe_price_mappings(
      product_code,product_kind,stripe_price_id,catalog_code,catalog_version,plan_version_id,
      gross_price_minor,currency,granted_credits,livemode
    ) values (
      p_product_code,p_mode,p_stripe_price_id,v_plan.plan_code,v_plan.version,v_plan.id,
      v_plan.gross_price_minor,v_plan.currency,v_plan.granted_credits,false
    ) on conflict(stripe_price_id) do nothing;
  else
    select * into v_topup from public.xeriano_topup_product_versions where version=p_catalog_version and active;
    if not found or replace(v_topup.package_code,'TOP_UP_','TOPUP_')<>p_product_code or v_topup.expiry_policy<>'NEVER'
    then raise exception 'TOPUP_CATALOG_MISMATCH'; end if;
    insert into public.xeriano_stripe_price_mappings(
      product_code,product_kind,stripe_price_id,catalog_code,catalog_version,topup_product_version_id,
      gross_price_minor,currency,granted_credits,livemode
    ) values (
      p_product_code,p_mode,p_stripe_price_id,v_topup.package_code,v_topup.version,v_topup.id,
      v_topup.gross_price_minor,v_topup.currency,v_topup.granted_credits,false
    ) on conflict(stripe_price_id) do nothing;
  end if;
  select * into v_mapping from public.xeriano_stripe_price_mappings where stripe_price_id=p_stripe_price_id for update;
  if not found or v_mapping.product_code<>p_product_code or v_mapping.product_kind<>p_mode
    or v_mapping.catalog_version<>p_catalog_version or v_mapping.livemode
  then raise exception 'STRIPE_PRICE_MAPPING_CONFLICT'; end if;
  update public.xeriano_stripe_price_mappings set active=false
    where product_code=p_product_code and id<>v_mapping.id;
  update public.xeriano_stripe_price_mappings set active=true,last_verified_at=now()
    where id=v_mapping.id returning * into v_mapping;
  return v_mapping;
end; $$;

create or replace function public.xeriano_record_stripe_checkout(
  p_account_id uuid,p_request_id uuid,p_stripe_customer_id text,p_checkout_session_id text,p_mode text,
  p_product_code text,p_catalog_version text,p_stripe_price_id text
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_mapping public.xeriano_stripe_price_mappings;
  v_checkout public.xeriano_stripe_checkouts;
begin
  if p_mode not in ('SUBSCRIPTION','TOP_UP') or p_checkout_session_id !~ '^cs_test_[A-Za-z0-9_]+$'
    or p_stripe_price_id !~ '^price_[A-Za-z0-9]+$' then raise exception 'INVALID_STRIPE_CHECKOUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text,0));
  select * into v_checkout from public.xeriano_stripe_checkouts
    where account_id=p_account_id and request_id=p_request_id for update;
  if found then
    if v_checkout.stripe_checkout_session_id<>p_checkout_session_id
      or v_checkout.stripe_customer_id<>p_stripe_customer_id or v_checkout.mode<>p_mode
    then raise exception 'STRIPE_CHECKOUT_CONFLICT'; end if;
    return jsonb_build_object('status','RECORDED');
  end if;
  perform 1 from public.xeriano_billing_customers where account_id=p_account_id
    and stripe_customer_id=p_stripe_customer_id and stripe_livemode=false
    and checkout_lock_token=p_request_id and checkout_lock_mode=p_mode
    and checkout_lock_product_code=p_product_code
    and checkout_lock_until>now() for update;
  if not found then raise exception 'STRIPE_CUSTOMER_NOT_BOUND'; end if;
  v_mapping:=public.xeriano_register_stripe_price_mapping(
    p_mode,p_product_code,p_catalog_version,p_stripe_price_id
  );
  insert into public.xeriano_stripe_checkouts(
    account_id,request_id,stripe_customer_id,stripe_checkout_session_id,stripe_price_mapping_id,mode,livemode
  ) values (p_account_id,p_request_id,p_stripe_customer_id,p_checkout_session_id,v_mapping.id,p_mode,false)
  on conflict(stripe_checkout_session_id) do nothing;
  select * into v_checkout from public.xeriano_stripe_checkouts where stripe_checkout_session_id=p_checkout_session_id;
  if v_checkout.account_id<>p_account_id or v_checkout.request_id<>p_request_id
    or v_checkout.stripe_customer_id<>p_stripe_customer_id
    or v_checkout.stripe_price_mapping_id<>v_mapping.id or v_checkout.mode<>p_mode or v_checkout.livemode
  then raise exception 'STRIPE_CHECKOUT_CONFLICT'; end if;
  update public.xeriano_billing_customers set checkout_lock_token=null,checkout_lock_mode=null,checkout_lock_product_code=null,
    checkout_lock_until=null where account_id=p_account_id and checkout_lock_token=p_request_id;
  return jsonb_build_object('status','RECORDED');
end; $$;

create or replace function public.xeriano_complete_subscription_checkout_event(
  p_event_id text,p_event_type text,p_checkout_session_id text,p_stripe_customer_id text,
  p_stripe_subscription_id text,p_event_metadata jsonb
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_begin text;v_checkout public.xeriano_stripe_checkouts;
begin
  v_begin:=public.xeriano_begin_billing_event(p_event_id,p_event_type,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect','NONE'); end if;
  select * into v_checkout from public.xeriano_stripe_checkouts where stripe_checkout_session_id=p_checkout_session_id for update;
  if not found or v_checkout.mode<>'SUBSCRIPTION' or v_checkout.stripe_customer_id<>p_stripe_customer_id or v_checkout.livemode
  then raise exception 'SUBSCRIPTION_CHECKOUT_AUTHORITY_MISMATCH'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_checkout.account_id::text,0));
  update public.xeriano_stripe_checkouts set status='COMPLETED',completed_at=coalesce(completed_at,now()) where id=v_checkout.id;
  update public.xeriano_billing_customers set stripe_subscription_id=p_stripe_subscription_id,
    billing_status=case when billing_status='INACTIVE' then 'INCOMPLETE' else billing_status end,
    last_webhook_at=now() where account_id=v_checkout.account_id and stripe_customer_id=p_stripe_customer_id;
  perform public.xeriano_finish_billing_event(p_event_id,v_checkout.account_id,'PROCESSED',null);
  return jsonb_build_object('status','PROCESSED','financialEffect','NONE');
end; $$;

create or replace function public.xeriano_grant_topup_checkout_event(
  p_event_id text,p_event_type text,p_checkout_session_id text,p_stripe_customer_id text,
  p_payment_status text,p_event_metadata jsonb
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_begin text;v_checkout public.xeriano_stripe_checkouts;v_mapping public.xeriano_stripe_price_mappings;
  v_policy public.xeriano_economic_policies;v_bucket_id uuid;v_available integer;v_net_micros bigint;
begin
  v_begin:=public.xeriano_begin_billing_event(p_event_id,p_event_type,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect',case when v_begin='PROCESSED' then 'TOP_UP_GRANT' else 'NONE' end); end if;
  select * into v_checkout from public.xeriano_stripe_checkouts where stripe_checkout_session_id=p_checkout_session_id for update;
  if not found or v_checkout.mode<>'TOP_UP' or v_checkout.stripe_customer_id<>p_stripe_customer_id or v_checkout.livemode
  then raise exception 'TOPUP_CHECKOUT_AUTHORITY_MISMATCH'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_checkout.account_id::text,0));
  if p_payment_status<>'paid' then
    update public.xeriano_stripe_checkouts set status='IGNORED',completed_at=coalesce(completed_at,now()) where id=v_checkout.id;
    perform public.xeriano_finish_billing_event(p_event_id,v_checkout.account_id,'IGNORED','CHECKOUT_NOT_PAID');
    return jsonb_build_object('status','IGNORED','financialEffect','NONE');
  end if;
  select * into v_mapping from public.xeriano_stripe_price_mappings where id=v_checkout.stripe_price_mapping_id and product_kind='TOP_UP' and not livemode;
  select * into v_policy from public.xeriano_economic_policies where active;
  if not found or v_mapping.topup_product_version_id is null then raise exception 'TOPUP_ECONOMICS_UNAVAILABLE'; end if;
  v_net_micros:=floor(v_mapping.gross_price_minor::numeric*10000*10000/(10000+v_policy.tax_basis_points))::bigint;
  insert into public.xeriano_credit_buckets(
    account_id,bucket_type,source_key,granted_credits,remaining_credits,expires_at,
    topup_product_version_id,economic_policy_id,billing_source_id,gross_amount_minor,
    net_amount_micros,economic_currency,granted_at
  ) values (
    v_checkout.account_id,'TOP_UP','topup:checkout_'||p_checkout_session_id,v_mapping.granted_credits,
    v_mapping.granted_credits,null,v_mapping.topup_product_version_id,v_policy.id,p_checkout_session_id,
    v_mapping.gross_price_minor,v_net_micros,v_mapping.currency,now()
  ) on conflict(account_id,source_key) do nothing returning id into v_bucket_id;
  if v_bucket_id is null then select id into v_bucket_id from public.xeriano_credit_buckets
    where account_id=v_checkout.account_id and source_key='topup:checkout_'||p_checkout_session_id; end if;
  select coalesce(sum(remaining_credits-reserved_credits),0) into v_available from public.xeriano_credit_buckets
    where account_id=v_checkout.account_id and (expires_at is null or expires_at>now());
  insert into public.xeriano_credit_ledger(
    account_id,bucket_id,transaction_type,amount_delta,resulting_available,idempotency_key,metadata
  ) values (
    v_checkout.account_id,v_bucket_id,'GRANT',v_mapping.granted_credits,v_available,
    'topup:checkout_'||p_checkout_session_id||':grant',
    jsonb_build_object('productVersion',v_mapping.catalog_version,'stripeEventId',p_event_id)
  ) on conflict(idempotency_key) do nothing;
  update public.xeriano_stripe_checkouts set status='PAID',completed_at=coalesce(completed_at,now()) where id=v_checkout.id;
  perform public.xeriano_finish_billing_event(p_event_id,v_checkout.account_id,'PROCESSED',null);
  return jsonb_build_object('status','PROCESSED','financialEffect','TOP_UP_GRANT');
end; $$;

create or replace function public.xeriano_grant_subscription_invoice_event(
  p_event_id text,p_event_type text,p_invoice_id text,p_stripe_customer_id text,p_stripe_subscription_id text,
  p_stripe_price_id text,p_plan_version text,p_billing_reason text,p_invoice_status text,
  p_amount_paid_minor bigint,p_plan_line_amount_minor bigint,p_currency text,
  p_period_start timestamptz,p_period_end timestamptz,p_event_metadata jsonb
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_begin text;v_account_id uuid;v_mapping public.xeriano_stripe_price_mappings;
  v_plan public.xeriano_plan_versions;v_policy public.xeriano_economic_policies;
  v_bucket_id uuid;v_available integer;v_net_micros bigint;
begin
  v_begin:=public.xeriano_begin_billing_event(p_event_id,p_event_type,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect',case when v_begin='PROCESSED' then 'SUBSCRIPTION_GRANT' else 'NONE' end); end if;
  if p_billing_reason not in ('subscription_create','subscription_cycle') or p_invoice_status<>'paid'
    or p_amount_paid_minor<=0 or p_period_end<=p_period_start then raise exception 'INVOICE_NOT_ELIGIBLE'; end if;
  select account_id into v_account_id from public.xeriano_billing_customers
    where stripe_customer_id=p_stripe_customer_id and stripe_livemode=false for update;
  if not found then raise exception 'STRIPE_CUSTOMER_UNKNOWN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text,0));
  select * into v_mapping from public.xeriano_stripe_price_mappings
    where stripe_price_id=p_stripe_price_id and product_kind='SUBSCRIPTION' and catalog_version=p_plan_version and not livemode;
  if not found then raise exception 'SUBSCRIPTION_PRICE_MAPPING_UNKNOWN'; end if;
  select * into v_plan from public.xeriano_plan_versions where id=v_mapping.plan_version_id;
  select * into v_policy from public.xeriano_economic_policies where active;
  if v_plan.id is null or v_policy.id is null or upper(p_currency)<>v_mapping.currency
    or p_plan_line_amount_minor<>v_mapping.gross_price_minor or p_amount_paid_minor<v_mapping.gross_price_minor
  then raise exception 'SUBSCRIPTION_INVOICE_CATALOG_MISMATCH'; end if;
  v_net_micros:=floor(v_mapping.gross_price_minor::numeric*10000*10000/(10000+v_policy.tax_basis_points))::bigint;
  insert into public.xeriano_credit_buckets(
    account_id,bucket_type,source_key,granted_credits,remaining_credits,expires_at,
    plan_version_id,economic_policy_id,billing_source_id,gross_amount_minor,net_amount_micros,
    economic_currency,entitlement_period_start,entitlement_period_end,granted_at
  ) values (
    v_account_id,'SUBSCRIPTION','subscription:invoice_'||p_invoice_id,v_mapping.granted_credits,
    v_mapping.granted_credits,p_period_end,v_plan.id,v_policy.id,p_invoice_id,v_mapping.gross_price_minor,
    v_net_micros,v_mapping.currency,p_period_start,p_period_end,now()
  ) on conflict(account_id,source_key) do nothing returning id into v_bucket_id;
  if v_bucket_id is null then select id into v_bucket_id from public.xeriano_credit_buckets
    where account_id=v_account_id and source_key='subscription:invoice_'||p_invoice_id; end if;
  select coalesce(sum(remaining_credits-reserved_credits),0) into v_available from public.xeriano_credit_buckets
    where account_id=v_account_id and (expires_at is null or expires_at>now());
  insert into public.xeriano_credit_ledger(
    account_id,bucket_id,transaction_type,amount_delta,resulting_available,idempotency_key,metadata
  ) values (
    v_account_id,v_bucket_id,'GRANT',v_mapping.granted_credits,v_available,
    'subscription:invoice_'||p_invoice_id||':grant',
    jsonb_build_object('planVersion',v_plan.version,'stripeEventId',p_event_id,'billingReason',p_billing_reason)
  ) on conflict(idempotency_key) do nothing;
  update public.xeriano_subscription_state set plan=v_plan.plan_code::public.xeriano_plan,status='ACTIVE',
    monthly_credits=v_plan.granted_credits,image_concurrency_limit=v_plan.image_concurrency_limit,
    video_concurrency_limit=v_plan.video_concurrency_limit,current_period_start=p_period_start,
    current_period_end=p_period_end,plan_version_id=v_plan.id,commercial_catalog_version=v_plan.catalog_version
    where account_id=v_account_id;
  update public.xeriano_billing_customers set stripe_subscription_id=p_stripe_subscription_id,
    plan=v_plan.plan_code::public.xeriano_plan,billing_status='ACTIVE',current_period_start=p_period_start,
    current_period_end=p_period_end,cancel_at_period_end=false,plan_version_id=v_plan.id,
    last_paid_invoice_id=p_invoice_id,last_webhook_at=now() where account_id=v_account_id;
  perform public.xeriano_finish_billing_event(p_event_id,v_account_id,'PROCESSED',null);
  return jsonb_build_object('status','PROCESSED','financialEffect','SUBSCRIPTION_GRANT');
end; $$;

create or replace function public.xeriano_sync_subscription_event(
  p_event_id text,p_event_type text,p_stripe_customer_id text,p_stripe_subscription_id text,
  p_stripe_price_id text,p_plan_version text,p_stripe_status text,p_cancel_at_period_end boolean,
  p_period_start timestamptz,p_period_end timestamptz,p_deleted boolean,p_event_metadata jsonb
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_begin text;v_account_id uuid;v_mapping public.xeriano_stripe_price_mappings;v_plan public.xeriano_plan_versions;v_billing_status text;v_state_status text;
begin
  v_begin:=public.xeriano_begin_billing_event(p_event_id,p_event_type,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect','NONE'); end if;
  if p_period_end<=p_period_start then raise exception 'INVALID_SUBSCRIPTION_PERIOD'; end if;
  select account_id into v_account_id from public.xeriano_billing_customers
    where stripe_customer_id=p_stripe_customer_id and stripe_livemode=false for update;
  if not found then raise exception 'STRIPE_CUSTOMER_UNKNOWN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text,0));
  select * into v_mapping from public.xeriano_stripe_price_mappings
    where stripe_price_id=p_stripe_price_id and product_kind='SUBSCRIPTION' and catalog_version=p_plan_version and not livemode;
  select * into v_plan from public.xeriano_plan_versions where id=v_mapping.plan_version_id;
  if v_plan.id is null then raise exception 'SUBSCRIPTION_PRICE_MAPPING_UNKNOWN'; end if;
  v_billing_status:=case when p_deleted or p_stripe_status in ('canceled','incomplete_expired') then 'CANCELED'
    when p_stripe_status='active' then 'ACTIVE' when p_stripe_status='trialing' then 'TRIALING'
    when p_stripe_status in ('past_due','unpaid') then 'PAST_DUE' else 'INCOMPLETE' end;
  v_state_status:=case when v_billing_status='ACTIVE' then 'ACTIVE' when v_billing_status='PAST_DUE' then 'PAST_DUE'
    when v_billing_status='CANCELED' then 'CANCELED' else 'INCOMPLETE' end;
  update public.xeriano_billing_customers set stripe_subscription_id=p_stripe_subscription_id,
    plan=v_plan.plan_code::public.xeriano_plan,billing_status=v_billing_status,current_period_start=p_period_start,
    current_period_end=p_period_end,cancel_at_period_end=coalesce(p_cancel_at_period_end,false),
    plan_version_id=v_plan.id,last_webhook_at=now() where account_id=v_account_id;
  -- A lifecycle event may arrive before its invoice is paid. It may update the
  -- observed billing status/period, but only invoice.paid may change the paid
  -- plan, allowance or concurrency entitlement.
  update public.xeriano_subscription_state set status=v_state_status,
    current_period_start=p_period_start,current_period_end=p_period_end
    where account_id=v_account_id;
  perform public.xeriano_finish_billing_event(p_event_id,v_account_id,'PROCESSED',null);
  return jsonb_build_object('status','PROCESSED','financialEffect','NONE');
end; $$;

create or replace function public.xeriano_mark_invoice_payment_failed_event(
  p_event_id text,p_event_type text,p_invoice_id text,p_stripe_customer_id text,
  p_stripe_subscription_id text,p_event_metadata jsonb
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_begin text;v_account_id uuid;
begin
  v_begin:=public.xeriano_begin_billing_event(p_event_id,p_event_type,p_event_metadata);
  if v_begin in ('PROCESSED','IGNORED') then return jsonb_build_object('status',v_begin,'financialEffect','NONE'); end if;
  select account_id into v_account_id from public.xeriano_billing_customers
    where stripe_customer_id=p_stripe_customer_id and stripe_livemode=false for update;
  if not found then raise exception 'STRIPE_CUSTOMER_UNKNOWN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text,0));
  update public.xeriano_billing_customers set stripe_subscription_id=p_stripe_subscription_id,
    billing_status='PAST_DUE',last_webhook_at=now() where account_id=v_account_id;
  update public.xeriano_subscription_state set status='PAST_DUE' where account_id=v_account_id;
  perform public.xeriano_finish_billing_event(p_event_id,v_account_id,'PROCESSED','INVOICE_PAYMENT_FAILED');
  return jsonb_build_object('status','PROCESSED','financialEffect','NONE');
end; $$;

alter table public.xeriano_stripe_price_mappings enable row level security;
alter table public.xeriano_stripe_checkouts enable row level security;
revoke all on public.xeriano_stripe_price_mappings,public.xeriano_stripe_checkouts from public,anon,authenticated;
grant all on public.xeriano_stripe_price_mappings,public.xeriano_stripe_checkouts to service_role;

revoke all on function public.xeriano_begin_billing_event(text,text,jsonb),
  public.xeriano_finish_billing_event(text,uuid,text,text),
  public.xeriano_record_billing_event_outcome(text,text,text,text,jsonb),
  public.xeriano_bind_stripe_customer(uuid,text),
  public.xeriano_claim_stripe_checkout(uuid,text,uuid,text,text),
  public.xeriano_register_stripe_price_mapping(text,text,text,text),
  public.xeriano_record_stripe_checkout(uuid,uuid,text,text,text,text,text,text),
  public.xeriano_complete_subscription_checkout_event(text,text,text,text,text,jsonb),
  public.xeriano_grant_topup_checkout_event(text,text,text,text,text,jsonb),
  public.xeriano_grant_subscription_invoice_event(text,text,text,text,text,text,text,text,text,bigint,bigint,text,timestamptz,timestamptz,jsonb),
  public.xeriano_sync_subscription_event(text,text,text,text,text,text,text,boolean,timestamptz,timestamptz,boolean,jsonb),
  public.xeriano_mark_invoice_payment_failed_event(text,text,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.xeriano_bind_stripe_customer(uuid,text),
  public.xeriano_claim_stripe_checkout(uuid,text,uuid,text,text),
  public.xeriano_register_stripe_price_mapping(text,text,text,text),
  public.xeriano_record_stripe_checkout(uuid,uuid,text,text,text,text,text,text),
  public.xeriano_complete_subscription_checkout_event(text,text,text,text,text,jsonb),
  public.xeriano_grant_topup_checkout_event(text,text,text,text,text,jsonb),
  public.xeriano_grant_subscription_invoice_event(text,text,text,text,text,text,text,text,text,bigint,bigint,text,timestamptz,timestamptz,jsonb),
  public.xeriano_sync_subscription_event(text,text,text,text,text,text,text,boolean,timestamptz,timestamptz,boolean,jsonb),
  public.xeriano_mark_invoice_payment_failed_event(text,text,text,text,text,jsonb),
  public.xeriano_record_billing_event_outcome(text,text,text,text,jsonb)
  to service_role;
