import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type Stripe from "stripe";
import type { XerianoAccountContext } from "./auth";
import type { CheckoutAuthorityInput, XerianoCheckoutRepository } from "./billing-repository";

import {
  processVerifiedXerianoStripeEvent,
  type BillingEventResult,
  type XerianoBillingSettlementRepository,
} from "./billing";
import { resolveXerianoStripePriceMapping } from "./stripe-config";
import { calculateRefundCreditTarget, disputeAction } from "./billing-adjustment-policy";
import { resolveXerianoStripeRuntime } from "./stripe-runtime";
import { assertStripePriceMatchesCatalog } from "./stripe-service";
import { createXerianoCheckout, type XerianoStripeGateway } from "./stripe-service";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const prices = {
  STRIPE_PRICE_CREATOR_MONTHLY: "price_creator",
  STRIPE_PRICE_PRO_MONTHLY: "price_pro",
  STRIPE_PRICE_STUDIO_MONTHLY: "price_studio",
  STRIPE_PRICE_MAX_MONTHLY: "price_max",
  STRIPE_PRICE_TOP_UP_250: "price_topup250",
  STRIPE_PRICE_TOP_UP_500: "price_topup500",
  STRIPE_PRICE_TOP_UP_1000: "price_topup1000",
  STRIPE_PRICE_TOP_UP_2500: "price_topup2500",
};
const testEnv = {
  XERIAMO_STRIPE_MODE: "test",
  XERIAMO_LIVE_BILLING_ENABLED: "false",
  STRIPE_SECRET_KEY: "sk_test_not_real",
  STRIPE_WEBHOOK_SECRET: "whsec_not_real",
  NEXT_PUBLIC_SUPABASE_URL: "https://wwfezmywxishfgwnijyd.supabase.co",
  NEXT_PUBLIC_APP_URL: "https://staging.xeriamo.example",
  ...prices,
};
const liveEnv = {
  ...testEnv,
  XERIAMO_STRIPE_MODE: "live",
  XERIAMO_LIVE_BILLING_ENABLED: "true",
  NODE_ENV: "production",
  STRIPE_SECRET_KEY: "sk_live_not_real",
  NEXT_PUBLIC_SUPABASE_URL: "https://lggogmvpktedkimbpzix.supabase.co",
  NEXT_PUBLIC_APP_URL: "https://xeriamo.com",
  XERIAMO_LIVE_APP_ORIGIN: "https://xeriamo.com",
  XERIAMO_LIVE_SUPABASE_PROJECT_REF: "lggogmvpktedkimbpzix",
  XERIAMO_LIVE_LEGAL_READY: "true",
  XERIAMO_LIVE_TERMS_VERSION: "reviewed-terms-v1",
  XERIAMO_LIVE_PRIVACY_VERSION: "reviewed-privacy-v1",
  XERIAMO_LIVE_REFUND_POLICY_VERSION: "reviewed-refund-v1",
  XERIAMO_LIVE_MERCHANT_DETAILS_READY: "true",
  XERIAMO_LIVE_MERCHANT_COUNTRY: "DE",
  XERIAMO_LIVE_TAX_READY: "true",
  STRIPE_AUTOMATIC_TAX_ENABLED: "true",
};

test("typed Stripe runtime fails closed for missing mode and disabled live", () => {
  assert.throws(() => resolveXerianoStripeRuntime({ ...testEnv, XERIAMO_STRIPE_MODE: undefined }), /STRIPE_MODE_REQUIRED/);
  assert.throws(() => resolveXerianoStripeRuntime({ ...testEnv, XERIAMO_LIVE_BILLING_ENABLED: "true" }), /LIVE_SWITCH_WITH_TEST_MODE/);
  assert.throws(() => resolveXerianoStripeRuntime({ ...liveEnv, XERIAMO_LIVE_BILLING_ENABLED: "false" }), /LIVE_BILLING_DISABLED/);
  assert.equal(resolveXerianoStripeRuntime(testEnv).mode, "test");
});

test("live runtime requires every exact production, legal, tax, key and Price gate", () => {
  assert.equal(resolveXerianoStripeRuntime(liveEnv).livemode, true);
  const cases: Array<[Partial<typeof liveEnv>, RegExp]> = [
    [{ NODE_ENV: "development" }, /LIVE_NODE_ENV_REQUIRED/],
    [{ STRIPE_SECRET_KEY: "sk_test_wrong" }, /STRIPE_LIVE_KEY_REQUIRED/],
    [{ NEXT_PUBLIC_APP_URL: "https://other.example" }, /LIVE_APP_ORIGIN_MISMATCH/],
    [{ XERIAMO_LIVE_SUPABASE_PROJECT_REF: "wwfezmywxishfgwnijyd" }, /LIVE_SUPABASE_PROJECT_MISMATCH/],
    [{ STRIPE_PRICE_MAX_MONTHLY: undefined }, /LIVE_PRICE_MAPPINGS_REQUIRED/],
    [{ XERIAMO_LIVE_TERMS_VERSION: "draft" }, /LIVE_LEGAL_READINESS_REQUIRED/],
    [{ XERIAMO_LIVE_TAX_READY: "false" }, /LIVE_TAX_READINESS_REQUIRED/],
    [{ XERIAMO_LIVE_MERCHANT_COUNTRY: "" }, /LIVE_MERCHANT_READINESS_REQUIRED/],
  ];
  for (const [patch, expected] of cases) assert.throws(() => resolveXerianoStripeRuntime({ ...liveEnv, ...patch }), expected);
});

test("Price authority rejects test/live mixing in both directions", () => {
  const testMapping = resolveXerianoStripePriceMapping("CREATOR_MONTHLY", testEnv)!;
  const liveMapping = resolveXerianoStripePriceMapping("CREATOR_MONTHLY", liveEnv)!;
  const base = {
    id: "price_creator", object: "price", active: true, currency: "eur", unit_amount: 1_900,
    tax_behavior: "inclusive", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
  } as Stripe.Price;
  assert.doesNotThrow(() => assertStripePriceMatchesCatalog({ ...base, livemode: false }, testMapping));
  assert.doesNotThrow(() => assertStripePriceMatchesCatalog({ ...base, livemode: true }, liveMapping));
  assert.throws(() => assertStripePriceMatchesCatalog({ ...base, livemode: true }, testMapping));
  assert.throws(() => assertStripePriceMatchesCatalog({ ...base, livemode: false }, liveMapping));
});

class AdjustmentRepository implements XerianoBillingSettlementRepository {
  calls: Array<{ kind: string; status?: string; amount?: number; mode?: string; metadata?: Record<string, unknown> }> = [];
  async resolvePriceMapping() { return null; }
  async completeSubscriptionCheckout() { return { status: "PROCESSED", financialEffect: "NONE" } as const; }
  async grantTopUp() { return { status: "PROCESSED", financialEffect: "TOP_UP_GRANT" } as const; }
  async grantSubscription() { return { status: "PROCESSED", financialEffect: "SUBSCRIPTION_GRANT" } as const; }
  async syncSubscription() { return { status: "PROCESSED", financialEffect: "NONE" } as const; }
  async markInvoicePaymentFailed() { return { status: "PROCESSED", financialEffect: "NONE" } as const; }
  async expireCheckout(input: Parameters<NonNullable<XerianoBillingSettlementRepository["expireCheckout"]>>[0]) {
    this.calls.push({ kind: "expired", mode: input.checkoutMode, metadata: input.metadata });
    return { status: "PROCESSED", financialEffect: "NONE" } as const;
  }
  async applyRefund(input: Parameters<NonNullable<XerianoBillingSettlementRepository["applyRefund"]>>[0]) {
    this.calls.push({ kind: input.aggregate ? "charge-refund" : "refund", status: input.status, amount: input.amountMinor });
    return { status: "PROCESSED", financialEffect: input.status === "succeeded" ? "CREDIT_REVERSAL" : "NONE" } as BillingEventResult;
  }
  async applyDispute(input: Parameters<NonNullable<XerianoBillingSettlementRepository["applyDispute"]>>[0]) {
    this.calls.push({ kind: "dispute", status: input.disputeStatus, amount: input.amountMinor });
    return { status: "PROCESSED", financialEffect: "BILLING_HOLD" } as const;
  }
  async recordOutcome() {}
}

function stripeEvent(type: string, object: object, id: string, livemode = false): Stripe.Event {
  return { id, object: "event", type, created: 1_789_000_000, livemode, data: { object } } as Stripe.Event;
}

test("refunds, charge refunds, disputes and expired Checkouts use explicit idempotent repository boundaries", async () => {
  const repository = new AdjustmentRepository();
  await processVerifiedXerianoStripeEvent({ event: stripeEvent("refund.created", {
    id: "re_1", object: "refund", amount: 400, currency: "eur", charge: "ch_1", payment_intent: "pi_1", customer: "cus_1", status: "succeeded",
  }, "evt_refund"), repository });
  await processVerifiedXerianoStripeEvent({ event: stripeEvent("charge.refunded", {
    id: "ch_1", object: "charge", amount_refunded: 800, currency: "eur", payment_intent: "pi_1", customer: "cus_1", refunded: false,
  }, "evt_charge_refund"), repository });
  for (const [status, suffix] of [["needs_response", "open"], ["won", "won"], ["lost", "lost"]] as const) {
    await processVerifiedXerianoStripeEvent({ event: stripeEvent("charge.dispute.updated", {
      id: "dp_1", object: "dispute", amount: 800, currency: "eur", charge: "ch_1", payment_intent: "pi_1", status,
    }, `evt_dispute_${suffix}`), repository });
  }
  await processVerifiedXerianoStripeEvent({ event: stripeEvent("checkout.session.expired", {
    id: "cs_test_1", object: "checkout.session", customer: "cus_1", mode: "payment",
    metadata: {
      xeriano_account_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      xeriano_actor_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      xeriano_request_id: "11111111-1111-4111-8111-111111111111",
      xeriano_product_code: "TOPUP_250",
      xeriano_catalog_version: "topup-250-v1",
    },
  }, "evt_expired"), repository });
  assert.deepEqual(repository.calls, [
    { kind: "refund", status: "succeeded", amount: 400 },
    { kind: "charge-refund", status: "succeeded", amount: 800 },
    { kind: "dispute", status: "needs_response", amount: 800 },
    { kind: "dispute", status: "won", amount: 800 },
    { kind: "dispute", status: "lost", amount: 800 },
    {
      kind: "expired",
      mode: "TOP_UP",
      metadata: {
        livemode: false,
        objectId: "cs_test_1",
        accountId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        requestId: "11111111-1111-4111-8111-111111111111",
        productCode: "TOPUP_250",
        catalogVersion: "topup-250-v1",
      },
    },
  ]);
});

test("runtime matrix rejects invalid modes, mixed key modes, noncanonical live origins and wrong projects", () => {
  assert.throws(() => resolveXerianoStripeRuntime({ ...testEnv, XERIAMO_STRIPE_MODE: "sandbox" }), /STRIPE_MODE_REQUIRED/);
  assert.throws(() => resolveXerianoStripeRuntime({ ...testEnv, STRIPE_SECRET_KEY: "sk_live_wrong" }), /STRIPE_TEST_KEY_REQUIRED/);
  assert.throws(() => resolveXerianoStripeRuntime({ ...liveEnv, STRIPE_SECRET_KEY: "sk_test_wrong" }), /STRIPE_LIVE_KEY_REQUIRED/);
  assert.throws(() => resolveXerianoStripeRuntime({ ...liveEnv, NEXT_PUBLIC_APP_URL: "https://www.xeriamo.com" }), /LIVE_APP_ORIGIN_MISMATCH/);
  assert.throws(() => resolveXerianoStripeRuntime({ ...liveEnv, XERIAMO_LIVE_APP_ORIGIN: "https://www.xeriamo.com" }), /LIVE_APP_ORIGIN_MISMATCH/);
  assert.throws(() => resolveXerianoStripeRuntime({ ...liveEnv, NEXT_PUBLIC_SUPABASE_URL: "https://wwfezmywxishfgwnijyd.supabase.co" }), /LIVE_SUPABASE_PROJECT_MISMATCH/);
});

test("partial and full refunds map to cumulative immutable counter-credit targets without negative balances", () => {
  assert.equal(calculateRefundCreditTarget({ grantedCredits: 250, grossAmountMinor: 800, cumulativeRefundedAmountMinor: 200 }), 62);
  assert.equal(calculateRefundCreditTarget({ grantedCredits: 250, grossAmountMinor: 800, cumulativeRefundedAmountMinor: 400 }), 125);
  assert.equal(calculateRefundCreditTarget({ grantedCredits: 250, grossAmountMinor: 800, cumulativeRefundedAmountMinor: 800 }), 250);
  assert.equal(calculateRefundCreditTarget({ grantedCredits: 250, grossAmountMinor: 800, cumulativeRefundedAmountMinor: 2_000 }), 250);
  assert.equal(disputeAction("needs_response"), "HOLD");
  assert.equal(disputeAction("lost"), "REVERSE_AND_HOLD");
  assert.equal(disputeAction("won"), "RELEASE");
});

test("event livemode mismatch is terminal before settlement", async () => {
  const repository = new AdjustmentRepository();
  await assert.rejects(
    () => processVerifiedXerianoStripeEvent({ event: stripeEvent("refund.updated", {}, "evt_wrong", true), repository, expectedLivemode: false }),
    /STRIPE_EVENT_MODE_MISMATCH/,
  );
  assert.equal(repository.calls.length, 0);
});

test("subscription processing resolves current authority and stale delivery cannot restore an older plan state", async () => {
  const mapping = resolveXerianoStripePriceMapping("CREATOR_MONTHLY", testEnv)!;
  let lastMarker = 0;
  let currentStatus = "";
  const repository: XerianoBillingSettlementRepository = {
    async resolvePriceMapping() { return mapping; },
    async completeSubscriptionCheckout() { return { status: "PROCESSED", financialEffect: "NONE" }; },
    async grantTopUp() { return { status: "PROCESSED", financialEffect: "TOP_UP_GRANT" }; },
    async grantSubscription() { return { status: "PROCESSED", financialEffect: "SUBSCRIPTION_GRANT" }; },
    async syncSubscription(input) {
      if (input.objectMarker >= lastMarker) { lastMarker = input.objectMarker; currentStatus = input.stripeStatus; }
      return { status: "PROCESSED", financialEffect: "NONE" };
    },
    async markInvoicePaymentFailed() { return { status: "PROCESSED", financialEffect: "NONE" }; },
    async recordOutcome() {},
  };
  const current = {
    id: "sub_1", object: "subscription", created: 100, customer: "cus_1", status: "canceled", cancel_at_period_end: true,
    livemode: false,
    items: { data: [{ price: { id: "price_creator" }, current_period_start: 1_788_048_000, current_period_end: 1_790_726_400 }] },
  } as Stripe.Subscription;
  const resolver = { async retrieveSubscription() { return current; } };
  const deliveredActive = { ...current, status: "active", cancel_at_period_end: false };
  await processVerifiedXerianoStripeEvent({
    event: { ...stripeEvent("customer.subscription.deleted", current, "evt_new"), created: 200 } as Stripe.Event,
    repository, authorityResolver: resolver,
  });
  await processVerifiedXerianoStripeEvent({
    event: { ...stripeEvent("customer.subscription.updated", deliveredActive, "evt_old"), created: 150 } as Stripe.Event,
    repository, authorityResolver: resolver,
  });
  assert.equal(currentStatus, "canceled");
  assert.equal(lastMarker, 200);
});

test("Checkout persistence retry reuses the Stripe-idempotent existing session and never creates a second session", async () => {
  const mapping = resolveXerianoStripePriceMapping("TOPUP_250", testEnv)!;
  const customer = { accountId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", stripeCustomerId: "cus_1", stripeSubscriptionId: null, billingStatus: "INACTIVE", livemode: false };
  let recorded = false;
  let createCalls = 0;
  const repository: XerianoCheckoutRepository = {
    async getBillingCustomer() { return customer; },
    async bindStripeCustomer() { return customer; },
    async registerPriceMapping() {},
    async claimCheckout() {
      return recorded
        ? { status: "RECORDED", checkoutSessionId: "cs_test_recovered" }
        : { status: "CLAIMED", checkoutSessionId: null };
    },
    async recordCheckoutAuthority(_input: CheckoutAuthorityInput) { recorded = true; throw new Error("transient persistence failure"); },
  };
  const session = { id: "cs_test_recovered", object: "checkout.session", livemode: false, status: "open", mode: "payment", customer: "cus_1", url: "https://checkout.stripe.test/recovered" } as Stripe.Checkout.Session;
  const gateway: XerianoStripeGateway = {
    async retrievePrice() { return { id: mapping.stripePriceId, object: "price", active: true, livemode: false, currency: "eur", unit_amount: 800, tax_behavior: "inclusive", recurring: null } as Stripe.Price; },
    async createCustomer() { throw new Error("not used"); },
    async createCheckoutSession() { createCalls += 1; return session; },
    async retrieveCheckoutSession() { return session; },
    async createPortalSession() { throw new Error("not used"); },
  };
  const context: XerianoAccountContext = {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: null, role: "CUSTOMER",
    accountId: customer.accountId, accountName: "Customer", workspaceKey: "customer", brainWorkspaceId: null, source: "XERIANO_MEMBERSHIP",
  };
  const requestId = "11111111-1111-4111-8111-111111111111";
  await assert.rejects(() => createXerianoCheckout({ context, productCode: "TOPUP_250", requestId, env: testEnv, repository, gateway }), /CHECKOUT_SESSION_PERSIST_FAILED/);
  const recovered = await createXerianoCheckout({ context, productCode: "TOPUP_250", requestId, env: testEnv, repository, gateway });
  assert.equal(recovered.url, session.url);
  assert.equal(createCalls, 1);
});

test("migration is mode-separated, immutable-ledger based, private and blocks generation under hold", () => {
  const sql = read("supabase/migrations/20260913041518_xeriano_stripe_live_readiness_v1.sql");
  assert.match(sql, /unique\(livemode,stripe_event_id\)/);
  assert.match(sql, /unique\(livemode,stripe_checkout_session_id\)/);
  assert.match(sql, /REVERSAL/);
  assert.match(sql, /BILLING_HOLD_ACTIVE/);
  assert.match(sql, /xeriano_apply_refund_event_v2/);
  assert.match(sql, /xeriano_apply_dispute_event_v2/);
  assert.match(sql, /xeriano_recover_checkout_from_event_v2/);
  assert.match(sql, /unique\(livemode,stripe_payment_intent_id\)/);
  assert.match(sql, /unique\(livemode,stripe_charge_id\)/);
  assert.match(sql, /unique\(livemode,adjustment_kind,stripe_adjustment_id\)/);
  assert.match(sql, /on conflict\(livemode,stripe_event_id\) do nothing/);
  assert.match(sql, /checkout_lock_until=now\(\)\+interval '15 minutes'/);
  assert.match(sql, /status='EXPIRED'/);
  assert.match(sql, /STALE_SUBSCRIPTION_EVENT/);
  assert.match(sql, /REVERSAL_SHORTFALL/);
  assert.match(sql, /reason='DISPUTE'/);
  assert.match(sql, /security definer set search_path=''/);
  assert.match(sql, /revoke all on public\.xeriano_stripe_event_authorities[\s\S]*from public,anon,authenticated/);
  assert.match(sql, /public\.xeriano_apply_refund_event_v2\([^)]+\),[\s\S]*public\.xeriano_apply_dispute_event_v2\([^)]+\),[\s\S]*from public,anon,authenticated/);
  assert.doesNotMatch(sql, /delete from public\.xeriano_credit_ledger|update public\.xeriano_credit_ledger/);
});

test("reconciliation GET is dry-run only and mutation requires explicit OWNER POST", () => {
  const route = read("app/api/hq/billing/reconciliation/route.ts");
  assert.match(route, /await requireXerianoOwner\(\)/);
  assert.match(route, /dryRun: true/);
  assert.match(route, /body\.mutate !== true/);
  const getBody = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.doesNotMatch(getBody, /processVerifiedXerianoStripeEvent|createXerianoStripeGateway|insert\(|update\(|\.rpc\(/);
  const postBody = route.slice(route.indexOf("export async function POST"));
  assert.match(postBody, /assessTrustedXeriamoApplicationOrigin/);
  assert.match(postBody, /body\.mutate !== true/);
  assert.match(postBody, /loadStripeEventAuthorityForReplay/);
  assert.match(postBody, /expectedLivemode: billingRuntime\.livemode/);
});

test("portal and subscription update policies remain conservative", () => {
  const service = read("lib/xeriano/stripe-service.ts");
  const billing = read("lib/xeriano/billing.ts");
  const docs = read("docs/xeriamo-stripe-controlled-live-setup.md");
  assert.match(service, /portalCancellationOnly/);
  assert.match(service, /configuration: runtime\.portalConfigurationId/);
  assert.match(billing, /billing_reason === "subscription_update"/);
  assert.match(billing, /PRORATION_GRANT_DEFERRED/);
  assert.match(docs, /Subscription Update \/ Planwechsel deaktivieren/);
});

test("OWNER generation authority and provider payloads remain outside billing changes", () => {
  const diffSensitive = [
    "lib/xeriano/credit-guard.ts",
    "lib/creative-studio/provider.ts",
    "lib/ugc-video-studio/providers/fal-video-edit.ts",
  ].map(read).join("\n");
  assert.match(diffSensitive, /OWNER/);
  assert.doesNotMatch(read("lib/xeriano/stripe-runtime.ts"), /queue\.submit|reserveCustomerGeneration|OWNER_ESTIMATE_ONLY/);
});
