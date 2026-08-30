# Xeriamo Stripe Test Mode V1

This integration is staging/Test-Mode only. Stripe confirms payment; the
versioned Xeriamo catalog decides the plan, credits and entitlement. Browser
redirects never grant credits.

## Required Staging-ENV names

No publishable key is required because Xeriamo redirects to hosted Checkout.
Set these values manually; never commit their values:

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

`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL` and the existing Supabase
server credential must already point at isolated staging. Billing refuses live
Stripe secrets and the production Supabase project reference.

## Stripe Dashboard setup (Test mode)

1. Enable **Test mode** in the existing Stripe account.
2. Create four recurring monthly EUR Prices with tax behavior **inclusive**:
   Creator €19, Pro €39, Studio €69 and Max €119.
3. Create four one-time EUR Prices with tax behavior **inclusive**:
   250 credits €8, 500 credits €15, 1,000 credits €29 and 2,500 credits €70.
4. Put each resulting Test Price ID into the matching server variable above.
   `STRIPE_PRICE_PRO_MONTHLY` is the €39/1,400 tier;
   `STRIPE_PRICE_STUDIO_MONTHLY` is the €69/2,500 tier.
5. Configure a Customer Portal test configuration for payment-method,
   cancellation-at-period-end and invoice management. Keep unsupported
   mid-cycle full-credit plan changes disabled; Xeriamo deliberately grants no
   full allowance for `subscription_update` proration invoices.
6. Add `${NEXT_PUBLIC_APP_URL}/api/xeriano/billing/webhook` as a Test webhook
   using Stripe API version `2026-08-26.dahlia`.
   Subscribe to `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid` and
   `invoice.payment_failed`.
7. Copy the Test endpoint signing secret into `STRIPE_WEBHOOK_SECRET`.
8. Leave `STRIPE_AUTOMATIC_TAX_ENABLED=false` unless Stripe Tax and the owner's
   registrations/origin address are deliberately configured. Enabling it does
   not change Xeriamo's catalog amounts; configured Stripe Prices must remain
   tax-inclusive consumer totals.

## Database rollout

After confirming the linked Supabase project ref is
`wwfezmywxishfgwnijyd`, apply only:

```text
supabase/migrations/20260830150000_xeriano_stripe_test_billing_v1.sql
```

The migration is additive. It adds Test-only Price/Checkout authorities and
transactional service-role RPCs. It does not alter the reserve, commit, release
or refund engine. It must not be applied to production.

## Settlement policy

- `invoice.paid` grants one expiring subscription bucket for
  `subscription_create` or `subscription_cycle` only.
- Subscription lifecycle events synchronize state but do not grant credits.
- Paid one-time Checkout grants one non-expiring Top-up bucket.
- Event ID and invoice/session source keys independently prevent duplicates.
- Failed invoices grant zero credits and do not remove old paid-period or
  Top-up credits.
- Checkout success pages say payment is being confirmed; webhook state remains
  authoritative.
- V1 uses card Checkout only. Delayed payment methods require explicit async
  payment-event support in a later version.

## Production boundary

The migration has a Test-mode-only constraint and the runtime rejects live
keys/events. Production activation requires a separately reviewed migration,
live Price mappings, production webhook, tax/legal review, replay QA and a
deliberate removal/replacement of the staging-only guards.
