# Xeriamo Customer Credit Integration

Status: code-complete, **additive migration required before staging execution**.

## Authority order

1. Resolve the authenticated Xeriamo membership server-side.
2. Calculate the V1 quote from `lib/xeriano/pricing.ts`.
3. Call `xeriano_authorize_customer_generation`, which atomically reserves
   credits and creates the account-scoped generation authority.
4. Only then invoke the existing frozen Creative or UGC generation service.
5. A persisted provider request ID is the acceptance boundary. Acceptance
   commits credits exactly once while the concurrency claim remains `RUNNING`.
6. Terminal studio state closes the concurrency claim. A proven pre-provider
   failure releases; ambiguous acceptance remains reserved/active.

Status observation is also the recovery path after browser/server interruption.
A known request ID is reconciled without a second reservation. A submission
manifest that remains without a request ID for ten minutes, or a missing frozen
job behind an existing financial authority, is quarantined as
`UNKNOWN_OUTCOME`. It is never auto-released or auto-submitted.

The customer never supplies account ID, credit amount, pricing version,
provider acceptance, or settlement action.

## Required additive migration

Apply manually to the isolated staging project before QA:

`supabase/migrations/20260830010000_xeriano_customer_generation_authority_v1.sql`

It adds `xeriano_generation_authorities` and service-role-only RPC functions.
It does not alter provider payloads, studio manifests, or existing migration
history. Do not apply it to production until staging QA is complete.

## Provider acceptance boundaries

- **Nano Banana Pro:** the frozen Creative manifest contains a non-null
  `providerRequestId` after fal has acknowledged the request. No request ID plus
  a terminal preflight failure releases credits.
- **Kling Motion Control:** the frozen UGC submit returns and persists the fal
  request ID before the POST returns `RUNNING`. Status polling never reserves or
  charges again.

Kling customer credits use server-parsed MP4/MOV/M4V `mvhd` duration. Browser
metadata is display-only and cannot lower the financial quote.

## First staging QA

1. Confirm the project ref is `wwfezmywxishfgwnijyd`, never production
   `lggogmvpktedkimbpzix`.
2. Apply the additive migration manually and refresh PostgREST schema cache.
3. Give the test customer a plan/concurrency policy appropriate to the test.
4. Nano: start with 40 credits, run one 1K/2K image (20 credits), expect 20.
5. Kling: use an account with video concurrency >= 1 and at least 125 credits;
   upload a valid five-second MP4 motion reference and run once, expect a
   125-credit commit immediately after provider request-ID persistence.
6. Reload while Kling is running; the same job/request ID must continue and no
   second ledger effect may appear.

No provider call is made by migration application or by the automated tests.
