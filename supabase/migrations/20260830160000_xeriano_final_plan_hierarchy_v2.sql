-- Correct the launch plan identity hierarchy without rewriting V1 history.
-- Numeric economics are unchanged: PRO owns the former EUR39 tier and STUDIO
-- owns the former EUR69 tier. No credits, ledger rows or subscriptions are
-- created or deleted by this migration.

do $$
declare
  v_transition constant timestamptz := '2026-08-30T13:30:00Z';
  v_free_plan_id uuid;
begin
  -- The version guard explicitly permits lifecycle fields. Preserve the old
  -- catalog rows as inactive historical truth rather than editing their
  -- commercial identity or amounts.
  update public.xeriano_plan_versions
  set active=false,valid_until=coalesce(valid_until,v_transition),updated_at=now()
  where catalog_version='xeriano-commercial-launch-v1' and active;

  insert into public.xeriano_plan_versions(
    catalog_version,plan_code,version,display_name,active,launch_status,
    gross_price_minor,currency,billing_interval,grant_cadence,granted_credits,
    image_concurrency_limit,video_concurrency_limit,valid_from,metadata
  ) values
    ('xeriano-commercial-launch-v2-plan-hierarchy','FREE','free-v3-launch-v2','Free',true,'LAUNCH',0,'EUR','NONE','ONCE',30,1,0,v_transition,'{"monthlyOnlyV1":true,"planHierarchy":"v2"}'::jsonb),
    ('xeriano-commercial-launch-v2-plan-hierarchy','CREATOR','creator-monthly-v2','Creator',true,'LAUNCH',1900,'EUR','MONTHLY','MONTHLY',700,1,1,v_transition,'{"monthlyOnlyV1":true,"planHierarchy":"v2"}'::jsonb),
    ('xeriano-commercial-launch-v2-plan-hierarchy','PRO','pro-monthly-v3','Pro',true,'LAUNCH',3900,'EUR','MONTHLY','MONTHLY',1400,2,2,v_transition,'{"monthlyOnlyV1":true,"planHierarchy":"v2"}'::jsonb),
    ('xeriano-commercial-launch-v2-plan-hierarchy','STUDIO','studio-monthly-v2','Studio',true,'LAUNCH',6900,'EUR','MONTHLY','MONTHLY',2500,2,2,v_transition,'{"monthlyOnlyV1":true,"planHierarchy":"v2"}'::jsonb),
    ('xeriano-commercial-launch-v2-plan-hierarchy','MAX','max-monthly-v3','Max',true,'LAUNCH',11900,'EUR','MONTHLY','MONTHLY',4250,4,3,v_transition,'{"monthlyOnlyV1":true,"planHierarchy":"v2"}'::jsonb)
  on conflict(version) do nothing;

  -- A retried/manual review must still converge on exactly these active rows.
  update public.xeriano_plan_versions
  set active=true,valid_until=null,updated_at=now()
  where catalog_version='xeriano-commercial-launch-v2-plan-hierarchy';

  select id into strict v_free_plan_id
  from public.xeriano_plan_versions
  where version='free-v3-launch-v2' and active;

  -- Current FREE authority follows the corrected catalog prospectively. Trial
  -- buckets and immutable historical ledger entries are deliberately untouched.
  update public.xeriano_subscription_state
  set plan_version_id=v_free_plan_id,
      commercial_catalog_version='xeriano-commercial-launch-v2-plan-hierarchy',
      updated_at=now()
  where plan='FREE';

  update public.xeriano_billing_customers
  set plan_version_id=v_free_plan_id,updated_at=now()
  where plan='FREE' and stripe_subscription_id is null;

  -- Any Test mapping recorded against the superseded plan versions remains
  -- auditable but cannot be selected as the active commercial mapping.
  update public.xeriano_stripe_price_mappings as mapping
  set active=false
  from public.xeriano_plan_versions as plan
  where mapping.plan_version_id=plan.id
    and mapping.product_kind='SUBSCRIPTION'
    and plan.catalog_version='xeriano-commercial-launch-v1';
end $$;

create unique index if not exists xeriano_plan_versions_one_active_per_code_idx
  on public.xeriano_plan_versions(plan_code) where active;

-- Prospective Free provisioning keeps the same 30-credit policy while binding
-- new account state to the corrected catalog. Existing trial grants are not
-- rewritten or granted again.
create or replace function public.xeriano_grant_trial_credits() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_bucket uuid;v_free_plan_id uuid;begin
  select id into strict v_free_plan_id from public.xeriano_plan_versions
    where version='free-v3-launch-v2' and active;
  insert into public.xeriano_credit_accounts(account_id) values(new.id) on conflict do nothing;
  insert into public.xeriano_subscription_state(
    account_id,plan,status,monthly_credits,image_concurrency_limit,
    video_concurrency_limit,plan_version_id,commercial_catalog_version
  ) values(
    new.id,'FREE','TRIAL',0,1,0,v_free_plan_id,
    'xeriano-commercial-launch-v2-plan-hierarchy'
  ) on conflict do nothing;
  insert into public.xeriano_credit_buckets(
    account_id,bucket_type,source_key,granted_credits,remaining_credits
  ) values(new.id,'TRIAL','trial:v2',30,30)
    on conflict(account_id,source_key) do nothing returning id into v_bucket;
  if v_bucket is not null then
    insert into public.xeriano_credit_ledger(
      account_id,bucket_id,transaction_type,amount_delta,resulting_available,
      idempotency_key,metadata
    ) values(
      new.id,v_bucket,'GRANT',30,30,'trial:v2:'||new.id,
      jsonb_build_object('trialVersion','xeriano-trial-v2','commercialValueAuthority',false)
    );
  end if;
  return new;
end; $$;

revoke all on function public.xeriano_grant_trial_credits() from public,anon,authenticated;
grant execute on function public.xeriano_grant_trial_credits() to service_role;
