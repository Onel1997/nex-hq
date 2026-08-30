import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type Stripe from "stripe";

import type { XerianoAccountContext } from "./auth";
import {
  processVerifiedXerianoStripeEvent,
  verifyXerianoStripeEvent,
  type BillingEventResult,
  type XerianoBillingSettlementRepository,
} from "./billing";
import type {
  CheckoutAuthorityInput,
  XerianoBillingCustomer,
  XerianoCheckoutRepository,
} from "./billing-repository";
import {
  assertXerianoStripeTestRuntime,
  getXerianoStripeAvailability,
  getXerianoStripeReadinessDiagnostic,
  resolveXerianoStripeMappingByPriceId,
  resolveXerianoStripePriceMapping,
  XERIANO_STRIPE_ENV,
  type XerianoStripePriceMapping,
} from "./stripe-config";
import {
  assertStripePriceMatchesCatalog,
  createXerianoCheckout,
  createXerianoPortal,
  type XerianoStripeGateway,
} from "./stripe-service";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const env = {
  STRIPE_SECRET_KEY: "sk_test_not_a_real_key",
  STRIPE_WEBHOOK_SECRET: "whsec_not_a_real_secret",
  NEXT_PUBLIC_SUPABASE_URL: "https://wwfezmywxishfgwnijyd.supabase.co",
  NEXT_PUBLIC_APP_URL: "https://staging.xeriamo.com",
  STRIPE_PRICE_CREATOR_MONTHLY: "price_creator",
  STRIPE_PRICE_STUDIO_MONTHLY: "price_studio",
  STRIPE_PRICE_PRO_MONTHLY: "price_pro",
  STRIPE_PRICE_MAX_MONTHLY: "price_max",
  STRIPE_PRICE_TOP_UP_250: "price_topup250",
  STRIPE_PRICE_TOP_UP_500: "price_topup500",
  STRIPE_PRICE_TOP_UP_1000: "price_topup1000",
  STRIPE_PRICE_TOP_UP_2500: "price_topup2500",
};

const context: XerianoAccountContext = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "customer@example.test",
  role: "CUSTOMER",
  accountId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  accountName: "Customer A",
  workspaceKey: "customer-a",
  brainWorkspaceId: null,
  source: "XERIANO_MEMBERSHIP",
};

class MemoryCheckoutRepository implements XerianoCheckoutRepository {
  customer: XerianoBillingCustomer | null = null;
  checkouts: CheckoutAuthorityInput[] = [];
  mappings: XerianoStripePriceMapping[] = [];
  claims: Array<{ accountId: string; requestId: string; kind: string; productCode: string }> = [];
  requestedAccounts: string[] = [];
  async getBillingCustomer(accountId: string) {
    this.requestedAccounts.push(accountId);
    return this.customer?.accountId === accountId ? this.customer : null;
  }
  async bindStripeCustomer(accountId: string, stripeCustomerId: string) {
    this.customer = { accountId, stripeCustomerId, stripeSubscriptionId: null, billingStatus: "INACTIVE" };
    return this.customer;
  }
  async registerPriceMapping(mapping: XerianoStripePriceMapping) { this.mappings.push(mapping); }
  async claimCheckout(accountId: string, _stripeCustomerId: string, requestId: string, kind: "SUBSCRIPTION" | "TOP_UP", productCode: string) {
    this.claims.push({ accountId, requestId, kind, productCode });
  }
  async recordCheckoutAuthority(input: CheckoutAuthorityInput) { this.checkouts.push(input); }
}

function priceFor(mapping: XerianoStripePriceMapping): Stripe.Price {
  return {
    id: mapping.stripePriceId,
    object: "price",
    active: true,
    currency: "eur",
    livemode: false,
    unit_amount: mapping.grossPriceMinor,
    tax_behavior: "inclusive",
    recurring: mapping.kind === "SUBSCRIPTION"
      ? { interval: "month", interval_count: 1, usage_type: "licensed" }
      : null,
  } as Stripe.Price;
}

function gatewayFor(mapping: XerianoStripePriceMapping): XerianoStripeGateway & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async retrievePrice(id) { calls.push(`price:${id}`); return priceFor(mapping); },
    async createCustomer(_params, idempotencyKey) {
      calls.push(`customer:${idempotencyKey}`);
      return { id: "cus_testCustomer", object: "customer", livemode: false } as Stripe.Customer;
    },
    async createCheckoutSession(params, idempotencyKey) {
      calls.push(`checkout:${params.mode}:${idempotencyKey}`);
      return { id: "cs_test_checkout", object: "checkout.session", livemode: false, url: "https://checkout.stripe.test/session" } as Stripe.Checkout.Session;
    },
    async createPortalSession(params) {
      calls.push(`portal:${params.customer}`);
      return { id: "bps_test", object: "billing_portal.session", livemode: false, url: "https://billing.stripe.test/portal" } as Stripe.BillingPortal.Session;
    },
  };
}

test("Stripe staging guard refuses live keys and production Supabase", () => {
  assert.doesNotThrow(() => assertXerianoStripeTestRuntime(env));
  assert.throws(() => assertXerianoStripeTestRuntime({ ...env, STRIPE_SECRET_KEY: "sk_live_forbidden" }), /STRIPE_LIVE_KEY_FORBIDDEN/);
  assert.throws(() => assertXerianoStripeTestRuntime({ ...env, NEXT_PUBLIC_SUPABASE_URL: "https://lggogmvpktedkimbpzix.supabase.co" }), /PRODUCTION_SUPABASE_FORBIDDEN/);
  assert.throws(() => assertXerianoStripeTestRuntime({ ...env, NEXT_PUBLIC_APP_URL: undefined }), /STRIPE_APP_URL_REQUIRED/);
  assert.equal(getXerianoStripeAvailability({ ...env, STRIPE_WEBHOOK_SECRET: undefined }).products.CREATOR_MONTHLY, false);
});

test("isolated staging accepts the configured LAN HTTP return URL but not arbitrary HTTP", () => {
  const lanEnv = { ...env, NEXT_PUBLIC_APP_URL: "http://192.168.2.90:3000" };
  assert.doesNotThrow(() => assertXerianoStripeTestRuntime(lanEnv));
  assert.throws(
    () => assertXerianoStripeTestRuntime({ ...env, NEXT_PUBLIC_APP_URL: "http://example.test:3000" }),
    /STRIPE_APP_URL_INVALID/,
  );
  assert.throws(
    () => assertXerianoStripeTestRuntime({
      ...lanEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://lggogmvpktedkimbpzix.supabase.co",
    }),
    /PRODUCTION_SUPABASE_FORBIDDEN/,
  );
});

test("mobile billing client does not assume crypto.randomUUID and redacts local failures", () => {
  const button = read("components/xeriano/billing-action-button.tsx");
  assert.match(button, /createSecureBrowserUuid/);
  assert.doesNotMatch(button, /crypto\.randomUUID\s*\(/);
  assert.match(button, /requestId\.current \?\?=/);
  assert.match(button, /Checkout konnte nicht gestartet werden\. Bitte versuche es erneut\./);
  assert.doesNotMatch(button, /caught\.message|payload\.error/);
});

test("billing readiness is safe, server-derived and product scoped", () => {
  const ready = getXerianoStripeReadinessDiagnostic({ ...env, NEXT_PUBLIC_APP_URL: "http://192.168.2.90:3000" });
  assert.equal(ready.runtimeReady, true);
  assert.equal(ready.settlementReady, true);
  assert.equal(ready.products.CREATOR_MONTHLY, true);
  assert.equal(ready.products.TOPUP_250, true);
  assert.doesNotMatch(JSON.stringify(ready), /sk_test_|whsec_|price_creator/);

  const missingCreator = getXerianoStripeAvailability({ ...env, STRIPE_PRICE_CREATOR_MONTHLY: undefined });
  assert.equal(missingCreator.products.CREATOR_MONTHLY, false);
  assert.equal(missingCreator.products.PRO_MONTHLY, true);
  assert.equal(missingCreator.products.TOPUP_250, true);

  const missingTopUp = getXerianoStripeAvailability({ ...env, STRIPE_PRICE_TOP_UP_250: undefined });
  assert.equal(missingTopUp.products.TOPUP_250, false);
  assert.equal(missingTopUp.products.CREATOR_MONTHLY, true);
  assert.equal(missingTopUp.products.TOPUP_500, true);

  const live = getXerianoStripeAvailability({ ...env, STRIPE_SECRET_KEY: "sk_live_forbidden" });
  assert.equal(Object.values(live.products).some(Boolean), false);
});

test("dev-staging forwards Stripe variables from Staging-ENV without printing values", () => {
  const script = read("scripts/dev-staging.mjs");
  assert.match(script, /\.\.\.stagingEnvironment/);
  assert.match(script, /childEnvironment\[key\] = stagingEnvironment\[key\] \?\? ""/);
  assert.match(script, /STRIPE_PRICE_PRO_MONTHLY/);
  assert.match(script, /STRIPE_PRICE_STUDIO_MONTHLY/);
  assert.doesNotMatch(script, /readFileSync\("\.env\.local"/);
  assert.doesNotMatch(script, /console\.(?:info|log)\([^\n]*stagingEnvironment\[key\]/);
});

test("server Price mapping exactly follows the canonical catalog", () => {
  assert.deepEqual(
    ["CREATOR_MONTHLY", "PRO_MONTHLY", "STUDIO_MONTHLY", "MAX_MONTHLY"].map((code) => {
      const mapping = resolveXerianoStripePriceMapping(code, env)!;
      return [mapping.catalogCode, mapping.grossPriceMinor, mapping.grantedCredits];
    }),
    [["CREATOR", 1_900, 700], ["PRO", 3_900, 1_400], ["STUDIO", 6_900, 2_500], ["MAX", 11_900, 4_250]],
  );
  assert.deepEqual(
    ["TOPUP_250", "TOPUP_500", "TOPUP_1000", "TOPUP_2500"].map((code) => {
      const mapping = resolveXerianoStripePriceMapping(code, env)!;
      return [mapping.grossPriceMinor, mapping.grantedCredits];
    }),
    [[800, 250], [1_500, 500], [2_900, 1_000], [7_000, 2_500]],
  );
  assert.equal(resolveXerianoStripePriceMapping("FREE", env), null);
  assert.equal(resolveXerianoStripeMappingByPriceId("price_unknown", env), null);
  assert.equal(getXerianoStripeAvailability(env).products.CREATOR_MONTHLY, true);
});

test("Free to Creator Checkout is account-scoped and client controls no financial value", async () => {
  const mapping = resolveXerianoStripePriceMapping("CREATOR_MONTHLY", env)!;
  const repository = new MemoryCheckoutRepository();
  const gateway = gatewayFor(mapping);
  const result = await createXerianoCheckout({ context, productCode: "CREATOR_MONTHLY", requestId: "11111111-1111-4111-8111-111111111111", env, gateway, repository });
  assert.equal(result.url, "https://checkout.stripe.test/session");
  assert.equal(repository.checkouts[0]?.accountId, context.accountId);
  assert.equal(repository.checkouts[0]?.mapping.grantedCredits, 700);
  assert.equal(repository.mappings[0]?.catalogCode, "CREATOR");
  assert.deepEqual(repository.claims[0], {
    accountId: context.accountId,
    requestId: "11111111-1111-4111-8111-111111111111",
    kind: "SUBSCRIPTION",
    productCode: "CREATOR_MONTHLY",
  });
  assert.match(gateway.calls.join("\n"), /price:price_creator/);
  assert.match(gateway.calls.join("\n"), /checkout:subscription/);
  assert.doesNotMatch(read("app/api/xeriano/billing/checkout/route.ts"), /body\.(?:credits|amount|priceId|currency)/);
});

test("250 and 2500 top-up Checkout use configured one-time inclusive Prices", async () => {
  for (const code of ["TOPUP_250", "TOPUP_2500"] as const) {
    const mapping = resolveXerianoStripePriceMapping(code, env)!;
    const repository = new MemoryCheckoutRepository();
    const gateway = gatewayFor(mapping);
    await createXerianoCheckout({ context, productCode: code, env, gateway, repository });
    assert.equal(repository.checkouts[0]?.mapping.kind, "TOP_UP");
    assert.match(gateway.calls.join("\n"), /checkout:payment/);
    assert.doesNotThrow(() => assertStripePriceMatchesCatalog(priceFor(mapping), mapping));
  }
});

test("price validation fails closed for wrong amount, tax behavior, recurrence, or live mode", () => {
  const mapping = resolveXerianoStripePriceMapping("CREATOR_MONTHLY", env)!;
  for (const mutation of [
    { unit_amount: 1 },
    { tax_behavior: "exclusive" },
    { recurring: null },
    { livemode: true },
  ]) assert.throws(() => assertStripePriceMatchesCatalog({ ...priceFor(mapping), ...mutation } as Stripe.Price, mapping));
});

test("corrected PRO and STUDIO Stripe Prices accept only their final catalog tiers", () => {
  const pro = resolveXerianoStripePriceMapping("PRO_MONTHLY", env)!;
  const studio = resolveXerianoStripePriceMapping("STUDIO_MONTHLY", env)!;
  assert.deepEqual([pro.grossPriceMinor, pro.grantedCredits], [3_900, 1_400]);
  assert.deepEqual([studio.grossPriceMinor, studio.grantedCredits], [6_900, 2_500]);
  assert.doesNotThrow(() => assertStripePriceMatchesCatalog(priceFor(pro), pro));
  assert.doesNotThrow(() => assertStripePriceMatchesCatalog(priceFor(studio), studio));
  assert.throws(() => assertStripePriceMatchesCatalog({ ...priceFor(pro), unit_amount: 6_900 } as Stripe.Price, pro));
  assert.throws(() => assertStripePriceMatchesCatalog({ ...priceFor(studio), unit_amount: 3_900 } as Stripe.Price, studio));
});

test("Portal uses only the authenticated account customer and Free/no-customer fails safely", async () => {
  const mapping = resolveXerianoStripePriceMapping("CREATOR_MONTHLY", env)!;
  const repository = new MemoryCheckoutRepository();
  const gateway = gatewayFor(mapping);
  await assert.rejects(() => createXerianoPortal({ context, env, gateway, repository }), /STRIPE_CUSTOMER_NOT_FOUND/);
  repository.customer = { accountId: context.accountId, stripeCustomerId: "cus_testCustomer", stripeSubscriptionId: "sub_test", billingStatus: "ACTIVE" };
  const portalEnv = {
    ...env,
    STRIPE_PRICE_STUDIO_MONTHLY: undefined,
    STRIPE_PRICE_PRO_MONTHLY: undefined,
    STRIPE_PRICE_MAX_MONTHLY: undefined,
  };
  const result = await createXerianoPortal({ context, env: portalEnv, gateway, repository });
  assert.equal(result.url, "https://billing.stripe.test/portal");
  assert.deepEqual(repository.requestedAccounts, [context.accountId, context.accountId]);
  assert.equal(repository.mappings.at(-1)?.catalogCode, "CREATOR");
  assert.match(gateway.calls.at(-1)!, /^portal:cus_testCustomer$/);

  const customerB = { ...context, accountId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", accountName: "Customer B" };
  await assert.rejects(() => createXerianoPortal({ context: customerB, env: portalEnv, gateway, repository }), /STRIPE_CUSTOMER_NOT_FOUND/);
});

class MemorySettlementRepository implements XerianoBillingSettlementRepository {
  mappings = new Map<string, XerianoStripePriceMapping>();
  events = new Set<string>();
  invoiceSources = new Set<string>();
  checkoutSources = new Set<string>();
  subscriptionGrantCount = 0;
  topUpGrantCount = 0;
  syncCount = 0;
  failedPaymentCount = 0;
  outcomes: string[] = [];
  async resolvePriceMapping(id: string) { return this.mappings.get(id) ?? null; }
  private replay(eventId: string, effect: BillingEventResult["financialEffect"]): BillingEventResult | null {
    if (this.events.has(eventId)) return { status: "PROCESSED", financialEffect: effect };
    this.events.add(eventId);
    return null;
  }
  async completeSubscriptionCheckout(input: Parameters<XerianoBillingSettlementRepository["completeSubscriptionCheckout"]>[0]) {
    const replay = this.replay(input.eventId, "NONE"); if (replay) return replay;
    this.syncCount += 1; return { status: "PROCESSED", financialEffect: "NONE" } as const;
  }
  async grantTopUp(input: Parameters<XerianoBillingSettlementRepository["grantTopUp"]>[0]) {
    const replay = this.replay(input.eventId, "TOP_UP_GRANT"); if (replay) return replay;
    if (input.paymentStatus !== "paid") return { status: "IGNORED", financialEffect: "NONE" } as const;
    if (!this.checkoutSources.has(input.checkoutSessionId)) { this.checkoutSources.add(input.checkoutSessionId); this.topUpGrantCount += 1; }
    return { status: "PROCESSED", financialEffect: "TOP_UP_GRANT" } as const;
  }
  async grantSubscription(input: Parameters<XerianoBillingSettlementRepository["grantSubscription"]>[0]) {
    const replay = this.replay(input.eventId, "SUBSCRIPTION_GRANT"); if (replay) return replay;
    if (!this.invoiceSources.has(input.invoiceId)) { this.invoiceSources.add(input.invoiceId); this.subscriptionGrantCount += 1; }
    return { status: "PROCESSED", financialEffect: "SUBSCRIPTION_GRANT" } as const;
  }
  async syncSubscription(input: Parameters<XerianoBillingSettlementRepository["syncSubscription"]>[0]) {
    const replay = this.replay(input.eventId, "NONE"); if (replay) return replay;
    this.syncCount += 1; return { status: "PROCESSED", financialEffect: "NONE" } as const;
  }
  async markInvoicePaymentFailed(input: Parameters<XerianoBillingSettlementRepository["markInvoicePaymentFailed"]>[0]) {
    const replay = this.replay(input.eventId, "NONE"); if (replay) return replay;
    this.failedPaymentCount += 1; return { status: "PROCESSED", financialEffect: "NONE" } as const;
  }
  async recordOutcome(input: Parameters<XerianoBillingSettlementRepository["recordOutcome"]>[0]) {
    this.events.add(input.eventId); this.outcomes.push(input.failureCode);
  }
}

function event(type: string, object: Record<string, unknown>, id = `evt_${type.replaceAll(".", "_")}`): Stripe.Event {
  return { id, object: "event", type, livemode: false, data: { object } } as unknown as Stripe.Event;
}

function invoiceEvent(type = "invoice.paid", billingReason = "subscription_cycle", id = "evt_invoice") {
  return event(type, {
    id: "in_test_invoice",
    object: "invoice",
    customer: "cus_testCustomer",
    status: type === "invoice.paid" ? "paid" : "open",
    amount_paid: type === "invoice.paid" ? 1_900 : 0,
    currency: "eur",
    billing_reason: billingReason,
    parent: { subscription_details: { subscription: "sub_test" } },
    lines: { data: [{
      amount: 1_900,
      pricing: { price_details: { price: "price_creator" } },
      parent: { subscription_item_details: { proration: false } },
      subscription: "sub_test",
      period: { start: 1_788_048_000, end: 1_790_726_400 },
    }] },
  }, id);
}

function subscriptionEvent(type: string, id = `evt_${type}`) {
  return event(type, {
    id: "sub_test",
    object: "subscription",
    customer: "cus_testCustomer",
    status: type.endsWith("deleted") ? "canceled" : "active",
    cancel_at_period_end: type.endsWith("deleted"),
    items: { data: [{ price: { id: "price_creator" }, current_period_start: 1_788_048_000, current_period_end: 1_790_726_400 }] },
  }, id);
}

test("invoice.paid grants subscription credits once under duplicate and concurrent replay", async () => {
  const repository = new MemorySettlementRepository();
  repository.mappings.set("price_creator", resolveXerianoStripePriceMapping("CREATOR_MONTHLY", env)!);
  const invoice = invoiceEvent();
  await Promise.all(Array.from({ length: 4 }, () => processVerifiedXerianoStripeEvent({ event: invoice, repository })));
  assert.equal(repository.subscriptionGrantCount, 1);
  assert.equal(repository.invoiceSources.size, 1);
});

test("subscription lifecycle sync and payment failure never grant credits", async () => {
  const repository = new MemorySettlementRepository();
  repository.mappings.set("price_creator", resolveXerianoStripePriceMapping("CREATOR_MONTHLY", env)!);
  await processVerifiedXerianoStripeEvent({ event: subscriptionEvent("customer.subscription.created"), repository });
  await processVerifiedXerianoStripeEvent({ event: subscriptionEvent("customer.subscription.updated", "evt_sub_updated"), repository });
  await processVerifiedXerianoStripeEvent({ event: subscriptionEvent("customer.subscription.deleted", "evt_sub_deleted"), repository });
  await processVerifiedXerianoStripeEvent({ event: invoiceEvent("invoice.payment_failed", "subscription_cycle", "evt_failed"), repository });
  assert.equal(repository.subscriptionGrantCount, 0);
  assert.equal(repository.syncCount, 3);
  assert.equal(repository.failedPaymentCount, 1);
});

test("subscription Checkout completion synchronizes authority but never grants credits", async () => {
  const repository = new MemorySettlementRepository();
  const checkout = event("checkout.session.completed", {
    id: "cs_test_subscription",
    object: "checkout.session",
    mode: "subscription",
    customer: "cus_testCustomer",
    subscription: "sub_test",
    payment_status: "paid",
  }, "evt_subscription_checkout");
  const result = await processVerifiedXerianoStripeEvent({ event: checkout, repository });
  assert.deepEqual(result, { status: "PROCESSED", financialEffect: "NONE" });
  assert.equal(repository.subscriptionGrantCount, 0);
  assert.equal(repository.syncCount, 1);
});

test("paid top-up grants once while unpaid Checkout grants zero", async () => {
  const repository = new MemorySettlementRepository();
  const paid = event("checkout.session.completed", { id: "cs_test_topup", object: "checkout.session", mode: "payment", customer: "cus_testCustomer", payment_status: "paid" }, "evt_topup_paid");
  await Promise.all([1, 2, 3].map(() => processVerifiedXerianoStripeEvent({ event: paid, repository })));
  const unpaid = event("checkout.session.completed", { id: "cs_test_unpaid", object: "checkout.session", mode: "payment", customer: "cus_testCustomer", payment_status: "unpaid" }, "evt_topup_unpaid");
  await processVerifiedXerianoStripeEvent({ event: unpaid, repository });
  assert.equal(repository.topUpGrantCount, 1);
});

test("subscription update proration invoice is ignored and unknown Price fails closed", async () => {
  const repository = new MemorySettlementRepository();
  repository.mappings.set("price_creator", resolveXerianoStripePriceMapping("CREATOR_MONTHLY", env)!);
  const result = await processVerifiedXerianoStripeEvent({ event: invoiceEvent("invoice.paid", "subscription_update", "evt_proration"), repository });
  assert.deepEqual(result, { status: "IGNORED", financialEffect: "NONE" });
  assert.deepEqual(repository.outcomes, ["PRORATION_GRANT_DEFERRED"]);
  repository.mappings.clear();
  await assert.rejects(() => processVerifiedXerianoStripeEvent({ event: invoiceEvent("invoice.paid", "subscription_cycle", "evt_unknown"), repository }), /INVOICE_PLAN_LINE_UNRESOLVED/);
});

test("billing migration is atomic, source-idempotent, TEST-only and service-authoritative", () => {
  const sql = read("supabase/migrations/20260830150000_xeriano_stripe_test_billing_v1.sql");
  assert.match(sql, /xeriano_stripe_price_mappings/);
  assert.match(sql, /xeriano_stripe_checkouts/);
  assert.match(sql, /stripe_livemode = false/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /checkout_lock_token/);
  assert.match(sql, /STRIPE_CHECKOUT_ALREADY_IN_PROGRESS/);
  assert.match(sql, /subscription:invoice_/);
  assert.match(sql, /topup:checkout_/);
  assert.match(sql, /on conflict\(idempotency_key\) do nothing/i);
  assert.match(sql, /p_billing_reason not in \('subscription_create','subscription_cycle'\)/);
  assert.match(sql, /p_payment_status<>'paid'/);
  assert.match(sql, /expires_at,[\s\S]+TOP_UP[\s\S]+null/);
  assert.match(sql, /revoke all on public\.xeriano_stripe_price_mappings,public\.xeriano_stripe_checkouts from public,anon,authenticated/);
  assert.match(sql, /grant execute[\s\S]+to service_role/);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(sql, /create or replace function public\.xeriano_(?:reserve_credits|settle_credit_reservation)/);
  assert.doesNotMatch(sql, /create table[^;]+xeriano_credit_wallet/i);
  const sync = sql.slice(sql.indexOf("create or replace function public.xeriano_sync_subscription_event"), sql.indexOf("create or replace function public.xeriano_mark_invoice_payment_failed_event"));
  assert.doesNotMatch(sync, /monthly_credits=v_plan|image_concurrency_limit=v_plan|video_concurrency_limit=v_plan/);
  assert.doesNotMatch(sync, /xeriano_credit_buckets|xeriano_credit_ledger/);
  assert.match(sql, /processing_status='PROCESSING'/);
  assert.match(sql, /processing_status not in \('PROCESSED','IGNORED'\)/);
});

test("webhook verifies raw payload before settlement and customer UI is non-optimistic", () => {
  const webhook = read("app/api/xeriano/billing/webhook/route.ts");
  const client = read("components/xeriano/billing-action-button.tsx");
  const credits = read("app/(customer)/app/credits/page.tsx");
  const billingReturn = read("components/xeriano/billing-return-status.tsx");
  assert.ok(webhook.indexOf("request.text()") < webhook.indexOf("event = verifyXerianoStripeEvent"));
  assert.ok(webhook.indexOf("event = verifyXerianoStripeEvent") < webhook.indexOf("await processVerifiedXerianoStripeEvent"));
  assert.throws(() => verifyXerianoStripeEvent({ payload: "{}", signature: "invalid", secret: "whsec_not_real" }));
  assert.match(billingReturn, /Zahlung wird bestätigt/);
  assert.match(billingReturn, /Credits erscheinen erst nach/);
  assert.doesNotMatch(client + credits + billingReturn, /grantCredit|remainingCredits\s*[+]=|optimistic/i);
});

test("required Stripe environment convention has no publishable or legacy product variables", () => {
  assert.deepEqual(Object.values(XERIANO_STRIPE_ENV), [
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_AUTOMATIC_TAX_ENABLED",
    "STRIPE_PRICE_CREATOR_MONTHLY", "STRIPE_PRICE_STUDIO_MONTHLY", "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_MAX_MONTHLY",
    "STRIPE_PRICE_TOP_UP_250", "STRIPE_PRICE_TOP_UP_500", "STRIPE_PRICE_TOP_UP_1000", "STRIPE_PRICE_TOP_UP_2500",
  ]);
});
