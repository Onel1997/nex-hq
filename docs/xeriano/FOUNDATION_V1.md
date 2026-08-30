# Xeriamo V1 Foundation

## Status

The Xeriamo foundation and Credit Economy V1 are active in isolated staging.
Stripe Test Mode remains fail-closed until the additive Stripe billing migration
and owner-managed Test configuration are applied. See
`docs/xeriano/STRIPE_TEST_MODE_V1.md`.

## Required environment values

- `NEXT_PUBLIC_APP_URL=https://xeriamo.com`
- `NEXHQ_OWNER_USER_IDS` — trusted Supabase user IDs for the internal NexHQ shell
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_AUTOMATIC_TAX_ENABLED`
- `STRIPE_PRICE_CREATOR_MONTHLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_STUDIO_MONTHLY`
- `STRIPE_PRICE_MAX_MONTHLY`
- `STRIPE_PRICE_TOP_UP_250`
- `STRIPE_PRICE_TOP_UP_500`
- `STRIPE_PRICE_TOP_UP_1000`
- `STRIPE_PRICE_TOP_UP_2500`

Do not put secret keys or server Price IDs in client code. `.env.local` is not modified by this phase.

## Controlled rollout order

1. Review and back up the linked Supabase project.
2. Apply tenancy, credits, billing, then Library migrations in timestamp order.
3. Promote the existing owner UID to `OWNER` and set `NEXHQ_OWNER_USER_IDS` during the compatibility period.
4. Configure Supabase Site URL as `https://xeriamo.com` and allow `/auth/callback` plus `/reset-password` redirects.
5. Apply the additive Stripe Test billing migration only after verifying the
   staging project reference.
6. Create Stripe products/prices in Test mode and configure the server variables
   using `STRIPE_TEST_MODE_V1.md`.

## Local staging runtime

The Supabase CLI link controls migrations, but it does **not** select the
Supabase project used by the Next.js runtime. Start local Xeriamo staging with:

```bash
npm run dev:staging
```

This command reads the ignored `Staging-ENV`, makes its public URL, publishable
key and service credential authoritative for the child process, and prints only
the non-secret project reference. A plain `npm run dev` continues to use the
normal Next.js env-file resolution and must not be used as proof that the app is
connected to the project currently linked by the Supabase CLI.

After switching Supabase projects, stop the previous Next.js process before
starting the staging command. This prevents a stale client bundle (public
project URL) from being paired with a service credential from another env file.

## Owner bootstrap (manual staging step; do not run against production)

Keep `NEXHQ_OWNER_USER_IDS` configured during the compatibility period. After all
four migrations are applied in staging, first verify the exact existing auth UID
and whether it already has a primary membership:

```sql
select id, email from auth.users where id = '<EXACT_EXISTING_OWNER_AUTH_UID>'::uuid;
select account_id, role, status, is_primary
from public.xeriano_account_memberships
where user_id = '<EXACT_EXISTING_OWNER_AUTH_UID>'::uuid;
```

If no membership exists, generate and record one new account UUID, then run this
as one explicit transaction after replacing every placeholder. The workspace key
must be the existing trusted NexHQ workspace slug, not a request value.

```sql
begin;

insert into public.xeriano_profiles(user_id, display_name)
values ('<EXACT_EXISTING_OWNER_AUTH_UID>'::uuid, 'NexHQ Owner')
on conflict (user_id) do nothing;

insert into public.xeriano_accounts(
  id, slug, name, created_by, studio_workspace_key, brain_workspace_id
)
values (
  '<NEW_RECORDED_OWNER_ACCOUNT_UUID>'::uuid,
  '<UNIQUE_OWNER_ACCOUNT_SLUG>',
  'NexHQ',
  '<EXACT_EXISTING_OWNER_AUTH_UID>'::uuid,
  '<EXISTING_NEXHQ_WORKSPACE_SLUG>',
  (select id from public.brain_workspaces where slug = '<EXISTING_NEXHQ_WORKSPACE_SLUG>')
);

insert into public.xeriano_account_memberships(account_id, user_id, role, status, is_primary)
values (
  '<NEW_RECORDED_OWNER_ACCOUNT_UUID>'::uuid,
  '<EXACT_EXISTING_OWNER_AUTH_UID>'::uuid,
  'OWNER',
  'ACTIVE',
  true
);

commit;
```

If a primary membership already exists, do not create a second account. Verify
its workspace linkage and promote only that exact `(account_id, user_id)` row in
a reviewed transaction. Customer signup always provisions `CUSTOMER`; there is
no automatic owner-by-email rule.

## Credit and billing activation decisions

- Trial: historical `trial:v1` grants remain truthful; new `trial:v2` accounts
  receive one 30-credit grant. Hard-deleting the entire account and auth user would permit a new
  account to receive a new trial, so production deletion must be a soft
  close/suspension and signup abuse controls must be defined before activation.
- Subscription authority: `invoice.paid` is the only monthly credit-grant event,
  including the first paid subscription invoice. The source/idempotency key must
  include the Stripe invoice ID. `customer.subscription.created/updated` only
  synchronizes plan/period state; it never grants credits.
- Upgrade/downgrade: V1 must not issue a second full bucket for a
  `subscription_update` proration invoice. Downgrades take effect at the next
  paid cycle. Canceled subscription buckets expire at their recorded period end;
  non-expiring top-up buckets remain.
- Top-up authority: `checkout.session.completed` may grant a top-up only for a
  server-created allowlisted top-up Price and a verified paid payment state. It
  must use the Checkout Session or PaymentIntent ID as its source/idempotency key.
- Cancellation and failure: `customer.subscription.deleted` cancels future
  subscription authority; `invoice.payment_failed` marks `PAST_DUE` and grants
  nothing.
- The Stripe Test webhook now uses transactional event claiming plus independent
  invoice/session source idempotency. It remains inactive until the new migration
  and Test secrets/Prices are configured by the owner.

## Generation recovery decision

The current credit claim has no lease/heartbeat or stale-claim reconciler. Before
customer generation is activated, stale `RUNNING` claims must be moved to an
explicit `UNKNOWN_OUTCOME` reconciliation path without automatically releasing
credits when provider acceptance is uncertain.

## Domain and Vercel

- Add `xeriamo.com` to the Vercel project.
- Redirect `www.xeriamo.com` to the canonical apex domain.
- Stripe Checkout/Portal return base: `https://xeriamo.com/app/credits`.
- Stripe webhook: `https://xeriamo.com/api/xeriano/billing/webhook`.
- UGC generation already uses asynchronous job polling.
- Creative Studio currently uses a synchronous route boundary with `maxDuration = 300`; the selected Vercel plan must support that duration. The frozen runtime was not changed.
- Customer and `/hq` pages are `noindex`; only approved public routes belong in the sitemap.

## Legal

The Impressum, Datenschutz and Terms pages are placeholders and require professional legal review before production publication.
