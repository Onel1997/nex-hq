-- Xeriano V1 Stripe authority. No Stripe product or live call is created here.
create table if not exists public.xeriano_billing_customers (
  account_id uuid primary key references public.xeriano_accounts(id) on delete cascade,
  stripe_customer_id text unique check (stripe_customer_id is null or char_length(stripe_customer_id) between 1 and 255),
  stripe_subscription_id text unique check (stripe_subscription_id is null or char_length(stripe_subscription_id) between 1 and 255),
  plan public.xeriano_plan not null default 'FREE',
  billing_status text not null default 'INACTIVE' check (billing_status in ('INACTIVE','TRIALING','ACTIVE','PAST_DUE','CANCELED','INCOMPLETE')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  check (current_period_start is null or current_period_end is null or current_period_end > current_period_start),
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.xeriano_billing_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique check (char_length(stripe_event_id) between 1 and 255),
  account_id uuid references public.xeriano_accounts(id) on delete restrict,
  event_type text not null check (char_length(event_type) between 1 and 160),
  processing_status text not null default 'RECEIVED' check (processing_status in ('RECEIVED','PROCESSING','PROCESSED','FAILED','IGNORED')),
  event_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(event_metadata) = 'object' and octet_length(event_metadata::text) <= 32768),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  failure_code text check (failure_code is null or char_length(failure_code) between 1 and 160),
  check ((processing_status in ('PROCESSED','FAILED','IGNORED') and processed_at is not null) or (processing_status in ('RECEIVED','PROCESSING') and processed_at is null))
);
create index if not exists xeriano_billing_events_account_idx on public.xeriano_billing_events(account_id,received_at desc);
create index if not exists xeriano_billing_events_processing_idx on public.xeriano_billing_events(processing_status,received_at);
drop trigger if exists xeriano_billing_customers_touch_updated_at on public.xeriano_billing_customers;
create trigger xeriano_billing_customers_touch_updated_at
  before update on public.xeriano_billing_customers
  for each row execute function public.xeriano_touch_updated_at();
alter table public.xeriano_billing_customers enable row level security;
alter table public.xeriano_billing_events enable row level security;
revoke all on public.xeriano_billing_customers,public.xeriano_billing_events from public,anon,authenticated;
grant select on public.xeriano_billing_customers to authenticated;
drop policy if exists xeriano_billing_customer_read_member on public.xeriano_billing_customers;
create policy xeriano_billing_customer_read_member on public.xeriano_billing_customers for select to authenticated using(public.xeriano_is_account_member(account_id));
grant all on public.xeriano_billing_customers,public.xeriano_billing_events to service_role;
