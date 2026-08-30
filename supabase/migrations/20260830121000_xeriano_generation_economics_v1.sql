-- Xeriano V1 generation pricing/cost authority and provider-cost events.
-- Current provider adapters and transaction functions are intentionally unchanged.

create table if not exists public.xeriano_provider_cost_rules (
  id uuid primary key default gen_random_uuid(),
  version text not null check (char_length(version) between 1 and 160),
  provider text not null check (char_length(provider) between 1 and 80),
  provider_model text not null check (char_length(provider_model) between 1 and 240),
  operation text not null check (operation in ('IMAGE','VIDEO')),
  billing_unit text not null check (billing_unit in ('PER_IMAGE','PER_SECOND','PER_TOKEN','PER_MEGAPIXEL','FORMULA')),
  original_currency text not null check (original_currency ~ '^[A-Z]{3}$'),
  unit_price_micros bigint check (unit_price_micros is null or unit_price_micros >= 0),
  cost_formula jsonb not null default '{}'::jsonb check (
    jsonb_typeof(cost_formula) = 'object' and octet_length(cost_formula::text) <= 16384
  ),
  active boolean not null default false,
  verified boolean not null default false,
  source_note text check (source_note is null or char_length(source_note) <= 1000),
  last_reviewed_at timestamptz,
  valid_from timestamptz not null,
  valid_until timestamptz,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version,provider_model),
  check (valid_until is null or valid_until > valid_from)
);
create index if not exists xeriano_provider_cost_rules_active_idx
  on public.xeriano_provider_cost_rules(provider,provider_model,operation,valid_from desc) where active;

create table if not exists public.xeriano_generation_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  rule_id text not null check (char_length(rule_id) between 1 and 160),
  variant_key text not null check (char_length(variant_key) between 1 and 160),
  pricing_version text not null check (char_length(pricing_version) between 1 and 160),
  provider text not null check (char_length(provider) between 1 and 80),
  provider_model text not null check (char_length(provider_model) between 1 and 240),
  operation text not null check (operation in ('IMAGE','VIDEO')),
  generation_type text not null check (char_length(generation_type) between 1 and 80),
  workflow_type text,
  input_type text,
  resolution text,
  quality text,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  audio_enabled boolean,
  voice_enabled boolean,
  configured_credits integer check (configured_credits is null or configured_credits > 0),
  price_formula jsonb not null default '{}'::jsonb check (
    jsonb_typeof(price_formula) = 'object' and octet_length(price_formula::text) <= 16384
  ),
  provider_cost_rule_id uuid references public.xeriano_provider_cost_rules(id) on delete restrict,
  active boolean not null default false,
  pricing_complete boolean not null default false,
  customer_available boolean not null default false,
  safety_status text not null check (safety_status in ('UNSAFE','SAFE_BELOW_TARGET','TARGET_OR_BETTER','COST_UNVERIFIED','ECONOMICS_UNVERIFIED')),
  minimum_safe_credits integer,
  target_credits integer,
  valid_from timestamptz not null,
  valid_until timestamptz,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_id,pricing_version,variant_key),
  check (valid_until is null or valid_until > valid_from),
  check (not customer_available or (
    active and pricing_complete and configured_credits is not null
    and safety_status in ('SAFE_BELOW_TARGET','TARGET_OR_BETTER')
  ))
);
create index if not exists xeriano_generation_pricing_rules_active_idx
  on public.xeriano_generation_pricing_rules(provider_model,operation,valid_from desc)
  where active and pricing_complete;

create table if not exists public.xeriano_provider_cost_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.xeriano_accounts(id) on delete restrict,
  generation_authority_id uuid references public.xeriano_generation_authorities(id) on delete restrict,
  job_id text not null check (char_length(job_id) between 1 and 160),
  provider text not null check (char_length(provider) between 1 and 80),
  provider_model text not null check (char_length(provider_model) between 1 and 240),
  operation text not null check (char_length(operation) between 1 and 120),
  subcall_key text not null check (char_length(subcall_key) between 1 and 160),
  estimated_cost_micros bigint not null check (estimated_cost_micros >= 0),
  actual_cost_micros bigint check (actual_cost_micros is null or actual_cost_micros >= 0),
  original_currency text not null check (original_currency ~ '^[A-Z]{3}$'),
  provider_cost_version text not null check (char_length(provider_cost_version) between 1 and 160),
  fx_economic_version text not null check (char_length(fx_economic_version) between 1 and 160),
  provider_request_id text check (provider_request_id is null or char_length(provider_request_id) <= 500),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 240),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384
  ),
  created_at timestamptz not null default now()
);
create index if not exists xeriano_provider_cost_events_account_idx
  on public.xeriano_provider_cost_events(account_id,occurred_at desc);
create index if not exists xeriano_provider_cost_events_job_idx
  on public.xeriano_provider_cost_events(account_id,job_id);

drop trigger if exists xeriano_provider_cost_rules_version_guard on public.xeriano_provider_cost_rules;
create trigger xeriano_provider_cost_rules_version_guard before update on public.xeriano_provider_cost_rules
  for each row execute function public.xeriano_guard_versioned_economics();
drop trigger if exists xeriano_generation_pricing_rules_version_guard on public.xeriano_generation_pricing_rules;
create trigger xeriano_generation_pricing_rules_version_guard before update on public.xeriano_generation_pricing_rules
  for each row execute function public.xeriano_guard_versioned_economics();

-- Repository-authoritative provider cost versions. USD->EUR remains an
-- explicit economic-policy conversion, not a value hidden in provider code.
insert into public.xeriano_provider_cost_rules(
  version,provider,provider_model,operation,billing_unit,original_currency,unit_price_micros,
  cost_formula,active,verified,source_note,last_reviewed_at,valid_from
) values
  ('fal-public-pricing-2026-08-27','fal','fal-ai/nano-banana-pro/edit','IMAGE','FORMULA','USD',null,
   '{"credits":{"1K":150000,"2K":150000,"4K":300000},"unit":"micros_per_image"}'::jsonb,
   true,true,'Existing Nano Banana provider configuration','2026-08-27T00:00:00Z','2026-08-27T00:00:00Z'),
  ('fal-public-pricing-2026-08-27','fal','fal-ai/nano-banana-pro','IMAGE','FORMULA','USD',null,
   '{"credits":{"1K":150000,"2K":150000,"4K":300000},"unit":"micros_per_image"}'::jsonb,
   true,true,'Existing Nano Banana provider configuration','2026-08-27T00:00:00Z','2026-08-27T00:00:00Z'),
  ('fal-public-per-second-2026-08-27','fal','fal-ai/kling-video/v3/pro/motion-control','VIDEO','PER_SECOND','USD',168000,
   '{}'::jsonb,true,true,'Existing Kling Motion Control provider configuration','2026-08-27T00:00:00Z','2026-08-27T00:00:00Z'),
  ('fal-public-token-pricing-2026-08-27','fal','bytedance/seedance-2.5/reference-to-video','VIDEO','FORMULA','USD',null,
   '{"formula":"width*height*billable_seconds*24/1024/1000*token_rate","tokenRatePerThousandUsd":{"480p":0.0214,"720p":0.0214,"1080p":0.0234},"videoReferenceMultiplier":0.6,"maximumReferenceSeconds":30.2}'::jsonb,
   true,true,'Existing Seedance 2.5 token-cost configuration','2026-08-27T00:00:00Z','2026-08-27T00:00:00Z')
on conflict(version,provider_model) do nothing;

-- OWNER-approved launch prices are Nano 15/30 and Kling 25/sec.
-- The earlier Nano 10-credit proposal is stored as inactive/UNSAFE only.
insert into public.xeriano_generation_pricing_rules(
  rule_id,variant_key,pricing_version,provider,provider_model,operation,generation_type,quality,
  configured_credits,price_formula,provider_cost_rule_id,active,pricing_complete,
  customer_available,safety_status,minimum_safe_credits,target_credits,valid_from,metadata
) values
  ('nano-banana-pro-quality-v2','quality:1K','xeriano-generation-pricing-v2-economy','fal','fal-ai/nano-banana-pro/edit','IMAGE','IMAGE','1K',15,'{"rule":"QUALITY_X_COUNT"}'::jsonb,
   (select id from public.xeriano_provider_cost_rules where version='fal-public-pricing-2026-08-27' and provider_model='fal-ai/nano-banana-pro/edit'),true,true,true,'SAFE_BELOW_TARGET',15,20,'2026-08-30T00:00:00Z','{}'::jsonb),
  ('nano-banana-pro-quality-v2','quality:2K','xeriano-generation-pricing-v2-economy','fal','fal-ai/nano-banana-pro/edit','IMAGE','IMAGE','2K',15,'{"rule":"QUALITY_X_COUNT"}'::jsonb,
   (select id from public.xeriano_provider_cost_rules where version='fal-public-pricing-2026-08-27' and provider_model='fal-ai/nano-banana-pro/edit'),true,true,true,'SAFE_BELOW_TARGET',15,20,'2026-08-30T00:00:00Z','{}'::jsonb),
  ('nano-banana-pro-quality-v2','quality:4K','xeriano-generation-pricing-v2-economy','fal','fal-ai/nano-banana-pro/edit','IMAGE','IMAGE','4K',30,'{"rule":"QUALITY_X_COUNT"}'::jsonb,
   (select id from public.xeriano_provider_cost_rules where version='fal-public-pricing-2026-08-27' and provider_model='fal-ai/nano-banana-pro/edit'),true,true,true,'SAFE_BELOW_TARGET',30,40,'2026-08-30T00:00:00Z','{}'::jsonb),
  ('nano-banana-pro-quality-v2','text-quality:1K','xeriano-generation-pricing-v2-economy','fal','fal-ai/nano-banana-pro','IMAGE','IMAGE','1K',15,'{"rule":"QUALITY_X_COUNT"}'::jsonb,
   (select id from public.xeriano_provider_cost_rules where version='fal-public-pricing-2026-08-27' and provider_model='fal-ai/nano-banana-pro'),true,true,true,'SAFE_BELOW_TARGET',15,20,'2026-08-30T00:00:00Z','{}'::jsonb),
  ('nano-banana-pro-quality-v2','text-quality:2K','xeriano-generation-pricing-v2-economy','fal','fal-ai/nano-banana-pro','IMAGE','IMAGE','2K',15,'{"rule":"QUALITY_X_COUNT"}'::jsonb,
   (select id from public.xeriano_provider_cost_rules where version='fal-public-pricing-2026-08-27' and provider_model='fal-ai/nano-banana-pro'),true,true,true,'SAFE_BELOW_TARGET',15,20,'2026-08-30T00:00:00Z','{}'::jsonb),
  ('nano-banana-pro-quality-v2','text-quality:4K','xeriano-generation-pricing-v2-economy','fal','fal-ai/nano-banana-pro','IMAGE','IMAGE','4K',30,'{"rule":"QUALITY_X_COUNT"}'::jsonb,
   (select id from public.xeriano_provider_cost_rules where version='fal-public-pricing-2026-08-27' and provider_model='fal-ai/nano-banana-pro'),true,true,true,'SAFE_BELOW_TARGET',30,40,'2026-08-30T00:00:00Z','{}'::jsonb),
  ('nano-banana-pro-standard-owner-draft-10','quality:1K','xeriano-generation-pricing-v2-economy','fal','fal-ai/nano-banana-pro/edit','IMAGE','IMAGE','1K',10,'{"rule":"FIXED_DRAFT"}'::jsonb,
   (select id from public.xeriano_provider_cost_rules where version='fal-public-pricing-2026-08-27' and provider_model='fal-ai/nano-banana-pro/edit'),false,true,false,'UNSAFE',15,20,'2026-08-30T00:00:00Z','{"requiresOwnerReview":true}'::jsonb),
  ('kling-v3-motion-per-second-v2','per-second','xeriano-generation-pricing-v2-economy','fal','fal-ai/kling-video/v3/pro/motion-control','VIDEO','IMAGE_TO_VIDEO',null,25,'{"rule":"PER_SECOND","creditsPerSecond":25}'::jsonb,
   (select id from public.xeriano_provider_cost_rules where version='fal-public-per-second-2026-08-27'),true,true,true,'TARGET_OR_BETTER',null,null,'2026-08-30T00:00:00Z','{}'::jsonb),
  ('seedance-2.5-customer-incomplete','reference-video','xeriano-generation-pricing-v2-economy','fal','bytedance/seedance-2.5/reference-to-video','VIDEO','REFERENCE_TO_VIDEO',null,null,'{"rule":"UNPUBLISHED"}'::jsonb,
   (select id from public.xeriano_provider_cost_rules where version='fal-public-token-pricing-2026-08-27' and provider_model='bytedance/seedance-2.5/reference-to-video'),false,false,false,'ECONOMICS_UNVERIFIED',null,null,'2026-08-30T00:00:00Z','{"reason":"customer_price_not_defined"}'::jsonb)
on conflict(rule_id,pricing_version,variant_key) do nothing;

alter table public.xeriano_provider_cost_rules enable row level security;
alter table public.xeriano_generation_pricing_rules enable row level security;
alter table public.xeriano_provider_cost_events enable row level security;
revoke all on public.xeriano_provider_cost_rules,public.xeriano_generation_pricing_rules,public.xeriano_provider_cost_events from public,anon,authenticated;
grant all on public.xeriano_provider_cost_rules,public.xeriano_generation_pricing_rules,public.xeriano_provider_cost_events to service_role;
