-- Xeriano V1 versioned commercial economy and bucket provenance.
-- Additive/prospective: historical grants and ledger rows are not rewritten.

alter type public.xeriano_plan add value if not exists 'STUDIO';

create table if not exists public.xeriano_economic_policies (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (char_length(version) between 1 and 120),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  tax_basis_points integer not null check (tax_basis_points between 0 and 10000),
  hard_margin_basis_points integer not null check (hard_margin_basis_points between 0 and 9999),
  target_margin_basis_points integer not null check (
    target_margin_basis_points between hard_margin_basis_points and 9999
  ),
  credit_increment integer not null check (credit_increment between 1 and 1000),
  fx_policy jsonb not null default '{}'::jsonb check (
    jsonb_typeof(fx_policy) = 'object' and octet_length(fx_policy::text) <= 8192
  ),
  active boolean not null default false,
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from)
);
create unique index if not exists xeriano_economic_policies_one_active_idx
  on public.xeriano_economic_policies(active) where active;

create table if not exists public.xeriano_plan_versions (
  id uuid primary key default gen_random_uuid(),
  catalog_version text not null check (char_length(catalog_version) between 1 and 120),
  plan_code text not null check (plan_code in ('FREE','CREATOR','STUDIO','PRO','MAX')),
  version text not null unique check (char_length(version) between 1 and 120),
  display_name text not null check (char_length(display_name) between 1 and 120),
  active boolean not null default false,
  launch_status text not null check (launch_status in ('LAUNCH','LEGACY')),
  gross_price_minor bigint not null check (gross_price_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  billing_interval text not null check (billing_interval in ('NONE','MONTHLY','QUARTERLY','ANNUAL')),
  grant_cadence text not null check (grant_cadence in ('ONCE','MONTHLY','QUARTERLY','ANNUAL')),
  granted_credits integer not null check (granted_credits >= 0),
  image_concurrency_limit smallint not null check (image_concurrency_limit between 0 and 20),
  video_concurrency_limit smallint not null check (video_concurrency_limit between 0 and 20),
  valid_from timestamptz not null,
  valid_until timestamptz,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalog_version, plan_code),
  check (valid_until is null or valid_until > valid_from),
  check ((plan_code = 'FREE' and gross_price_minor = 0) or (plan_code <> 'FREE' and gross_price_minor > 0))
);
create index if not exists xeriano_plan_versions_active_idx
  on public.xeriano_plan_versions(plan_code, valid_from desc) where active;

create table if not exists public.xeriano_topup_product_versions (
  id uuid primary key default gen_random_uuid(),
  catalog_version text not null check (char_length(catalog_version) between 1 and 120),
  package_code text not null check (char_length(package_code) between 1 and 80),
  version text not null unique check (char_length(version) between 1 and 120),
  active boolean not null default false,
  gross_price_minor bigint not null check (gross_price_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  granted_credits integer not null check (granted_credits > 0),
  expiry_policy text not null check (expiry_policy in ('NEVER','FIXED')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (catalog_version, package_code),
  check (valid_until is null or valid_until > valid_from)
);
create index if not exists xeriano_topup_versions_active_idx
  on public.xeriano_topup_product_versions(package_code, valid_from desc) where active;

create or replace function public.xeriano_guard_versioned_economics()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if (to_jsonb(new) - array['active','valid_until','updated_at','metadata'])
     <> (to_jsonb(old) - array['active','valid_until','updated_at','metadata']) then
    raise exception 'VERSIONED_ECONOMIC_RECORD_IMMUTABLE';
  end if;
  return new;
end; $$;
revoke all on function public.xeriano_guard_versioned_economics() from public,anon,authenticated;

drop trigger if exists xeriano_economic_policies_version_guard on public.xeriano_economic_policies;
create trigger xeriano_economic_policies_version_guard before update on public.xeriano_economic_policies
  for each row execute function public.xeriano_guard_versioned_economics();
drop trigger if exists xeriano_plan_versions_version_guard on public.xeriano_plan_versions;
create trigger xeriano_plan_versions_version_guard before update on public.xeriano_plan_versions
  for each row execute function public.xeriano_guard_versioned_economics();
drop trigger if exists xeriano_topup_versions_version_guard on public.xeriano_topup_product_versions;
create trigger xeriano_topup_versions_version_guard before update on public.xeriano_topup_product_versions
  for each row execute function public.xeriano_guard_versioned_economics();

insert into public.xeriano_economic_policies(
  version,currency,tax_basis_points,hard_margin_basis_points,target_margin_basis_points,
  credit_increment,fx_policy,active,valid_from
) values (
  'xeriano-economics-eur-v1','EUR',1900,5000,6500,5,
  '{"USD_EUR":{"version":"usd-eur-conservative-parity-v1","numerator":1,"denominator":1}}'::jsonb,
  true,'2026-08-30T00:00:00Z'
) on conflict(version) do nothing;

insert into public.xeriano_plan_versions(
  catalog_version,plan_code,version,display_name,active,launch_status,gross_price_minor,currency,
  billing_interval,grant_cadence,granted_credits,image_concurrency_limit,video_concurrency_limit,
  valid_from,metadata
) values
  ('xeriano-commercial-launch-v1','FREE','free-v2-30-welcome-credits','Free',true,'LAUNCH',0,'EUR','NONE','ONCE',30,1,0,'2026-08-30T00:00:00Z','{"monthlyOnlyV1":true}'::jsonb),
  ('xeriano-commercial-launch-v1','CREATOR','creator-monthly-v1','Creator',true,'LAUNCH',1900,'EUR','MONTHLY','MONTHLY',700,1,1,'2026-08-30T00:00:00Z','{"monthlyOnlyV1":true}'::jsonb),
  ('xeriano-commercial-launch-v1','STUDIO','studio-monthly-v1','Studio',true,'LAUNCH',3900,'EUR','MONTHLY','MONTHLY',1400,2,2,'2026-08-30T00:00:00Z','{"monthlyOnlyV1":true}'::jsonb),
  ('xeriano-commercial-launch-v1','PRO','pro-monthly-v2','Pro',true,'LAUNCH',6900,'EUR','MONTHLY','MONTHLY',2500,2,2,'2026-08-30T00:00:00Z','{"monthlyOnlyV1":true}'::jsonb),
  ('xeriano-commercial-launch-v1','MAX','max-monthly-v2','Max',true,'LAUNCH',11900,'EUR','MONTHLY','MONTHLY',4250,4,3,'2026-08-30T00:00:00Z','{"monthlyOnlyV1":true}'::jsonb)
on conflict(version) do nothing;

insert into public.xeriano_topup_product_versions(
  catalog_version,package_code,version,active,gross_price_minor,currency,granted_credits,
  expiry_policy,valid_from
) values
  ('xeriano-commercial-launch-v1','TOP_UP_250','topup-250-v1',true,800,'EUR',250,'NEVER','2026-08-30T00:00:00Z'),
  ('xeriano-commercial-launch-v1','TOP_UP_500','topup-500-v2',true,1500,'EUR',500,'NEVER','2026-08-30T00:00:00Z'),
  ('xeriano-commercial-launch-v1','TOP_UP_1000','topup-1000-v1',true,2900,'EUR',1000,'NEVER','2026-08-30T00:00:00Z'),
  ('xeriano-commercial-launch-v1','TOP_UP_2500','topup-2500-v1',true,7000,'EUR',2500,'NEVER','2026-08-30T00:00:00Z')
on conflict(version) do nothing;

-- Replace only the original hard-coded commercial-plan shape constraint.
do $$
declare v_constraint record;
begin
  for v_constraint in
    select conname from pg_constraint
    where conrelid = 'public.xeriano_subscription_state'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%monthly_credits%'
      and pg_get_constraintdef(oid) like '%CREATOR%'
      and pg_get_constraintdef(oid) like '%PRO%'
      and pg_get_constraintdef(oid) like '%MAX%'
  loop
    execute format('alter table public.xeriano_subscription_state drop constraint %I', v_constraint.conname);
  end loop;
end $$;

alter table public.xeriano_subscription_state
  add column if not exists plan_version_id uuid references public.xeriano_plan_versions(id) on delete restrict,
  add column if not exists commercial_catalog_version text;

-- Exact launch economics now belong to immutable plan versions. Removing the
-- old hard-coded tuple check is required for STUDIO, future grandfathering and
-- custom allowances; the existing non-negative/limit column checks remain.

alter table public.xeriano_credit_buckets
  add column if not exists plan_version_id uuid references public.xeriano_plan_versions(id) on delete restrict,
  add column if not exists topup_product_version_id uuid references public.xeriano_topup_product_versions(id) on delete restrict,
  add column if not exists economic_policy_id uuid references public.xeriano_economic_policies(id) on delete restrict,
  add column if not exists billing_source_id text,
  add column if not exists gross_amount_minor bigint check (gross_amount_minor is null or gross_amount_minor >= 0),
  add column if not exists net_amount_micros bigint check (net_amount_micros is null or net_amount_micros >= 0),
  add column if not exists economic_currency text check (economic_currency is null or economic_currency ~ '^[A-Z]{3}$'),
  add column if not exists entitlement_period_start timestamptz,
  add column if not exists entitlement_period_end timestamptz,
  add column if not exists granted_at timestamptz not null default now();

alter table public.xeriano_credit_buckets
  drop constraint if exists xeriano_credit_buckets_commercial_provenance_check;
alter table public.xeriano_credit_buckets
  add constraint xeriano_credit_buckets_commercial_provenance_check check (
    not (plan_version_id is not null and topup_product_version_id is not null)
    and (topup_product_version_id is null or (bucket_type = 'TOP_UP' and expires_at is null))
    and (plan_version_id is null or bucket_type = 'SUBSCRIPTION')
    and (entitlement_period_start is null or entitlement_period_end is null or entitlement_period_end > entitlement_period_start)
  );

-- Prospective trial policy only. Existing trial:v1 buckets/ledger remain untouched.
create or replace function public.xeriano_grant_trial_credits() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_bucket uuid; begin
  insert into public.xeriano_credit_accounts(account_id) values(new.id) on conflict do nothing;
  insert into public.xeriano_subscription_state(account_id,plan,status,monthly_credits,image_concurrency_limit,video_concurrency_limit,commercial_catalog_version)
    values(new.id,'FREE','TRIAL',0,1,0,'xeriano-commercial-launch-v1') on conflict do nothing;
  insert into public.xeriano_credit_buckets(account_id,bucket_type,source_key,granted_credits,remaining_credits)
    values(new.id,'TRIAL','trial:v2',30,30) on conflict(account_id,source_key) do nothing returning id into v_bucket;
  if v_bucket is not null then
    insert into public.xeriano_credit_ledger(account_id,bucket_id,transaction_type,amount_delta,resulting_available,idempotency_key,metadata)
      values(new.id,v_bucket,'GRANT',30,30,'trial:v2:'||new.id,jsonb_build_object('trialVersion','xeriano-trial-v2','commercialValueAuthority',false));
  end if; return new;
end; $$;
revoke all on function public.xeriano_grant_trial_credits() from public,anon,authenticated;

alter table public.xeriano_economic_policies enable row level security;
alter table public.xeriano_plan_versions enable row level security;
alter table public.xeriano_topup_product_versions enable row level security;
revoke all on public.xeriano_economic_policies,public.xeriano_plan_versions,public.xeriano_topup_product_versions from public,anon,authenticated;
grant all on public.xeriano_economic_policies,public.xeriano_plan_versions,public.xeriano_topup_product_versions to service_role;
grant execute on function public.xeriano_guard_versioned_economics() to service_role;
