import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type Stripe from "stripe";

import type { XerianoAccountContext } from "./auth";
import type {
  XerianoBillingCustomer,
  XerianoCheckoutRepository,
} from "./billing-repository";
import {
  checkoutDiagnostic,
  getSafeStripeErrorContext,
  logXerianoCheckoutDiagnostic,
} from "./stripe-checkout-diagnostics";
import {
  resolveXerianoStripePriceMapping,
  type XerianoStripePriceMapping,
} from "./stripe-config";
import {
  assertStripePriceMatchesCatalog,
  createXerianoCheckout,
  XerianoBillingError,
  type XerianoStripeGateway,
} from "./stripe-service";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const env = {
  STRIPE_SECRET_KEY: "sk_test_not_a_real_key",
  STRIPE_WEBHOOK_SECRET: "whsec_not_a_real_secret",
  NEXT_PUBLIC_SUPABASE_URL: "https://wwfezmywxishfgwnijyd.supabase.co",
  NEXT_PUBLIC_APP_URL: "http://192.168.2.90:3000",
  STRIPE_PRICE_CREATOR_MONTHLY: "price_creator",
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

function priceFor(mapping: XerianoStripePriceMapping): Stripe.Price {
  return {
    id: mapping.stripePriceId,
    object: "price",
    active: true,
    currency: "eur",
    livemode: false,
    unit_amount: mapping.grossPriceMinor,
    tax_behavior: "inclusive",
    recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
  } as Stripe.Price;
}

class Repository implements XerianoCheckoutRepository {
  customer: XerianoBillingCustomer | null = {
    accountId: context.accountId,
    stripeCustomerId: "cus_private",
    stripeSubscriptionId: null,
    billingStatus: "INACTIVE",
  };
  failAt: "lookup" | "bind" | "mapping" | "claim" | "record" | null = null;
  async getBillingCustomer() {
    if (this.failAt === "lookup") throw new Error("private database detail");
    return this.customer;
  }
  async bindStripeCustomer(accountId: string, stripeCustomerId: string) {
    if (this.failAt === "bind") throw new Error("private database detail");
    return { accountId, stripeCustomerId, stripeSubscriptionId: null, billingStatus: "INACTIVE" };
  }
  async registerPriceMapping() {
    if (this.failAt === "mapping") throw new Error("private database detail");
  }
  async claimCheckout() {
    if (this.failAt === "claim") throw new Error("private database detail");
  }
  async recordCheckoutAuthority() {
    if (this.failAt === "record") throw new Error("private database detail");
  }
}

function gateway(overrides: Partial<XerianoStripeGateway> = {}): XerianoStripeGateway {
  const mapping = resolveXerianoStripePriceMapping("CREATOR_MONTHLY", env)!;
  return {
    async retrievePrice() { return priceFor(mapping); },
    async createCustomer() {
      return { id: "cus_private", object: "customer", livemode: false } as Stripe.Customer;
    },
    async createCheckoutSession() {
      return {
        id: "cs_private",
        object: "checkout.session",
        livemode: false,
        url: "https://checkout.stripe.test/session",
      } as Stripe.Checkout.Session;
    },
    async createPortalSession() {
      throw new Error("not used");
    },
    ...overrides,
  };
}

async function billingFailure(run: () => Promise<unknown>): Promise<XerianoBillingError> {
  try {
    await run();
    assert.fail("expected Checkout failure");
  } catch (error) {
    assert.ok(error instanceof XerianoBillingError);
    return error;
  }
}

test("missing runtime secret is a sanitized runtime-not-ready diagnostic", async () => {
  const error = await billingFailure(() => createXerianoCheckout({
    context,
    productCode: "CREATOR_MONTHLY",
    env: { ...env, STRIPE_SECRET_KEY: undefined },
    gateway: gateway(),
    repository: new Repository(),
  }));
  assert.deepEqual(error.diagnostic, {
    code: "CHECKOUT_RUNTIME_NOT_READY",
    stage: "runtime_guard",
    productCode: "CREATOR_MONTHLY",
  });
});

test("inaccessible Price or wrong Stripe secret context is distinguished safely", async () => {
  for (const stripeError of [
    { type: "StripeInvalidRequestError", code: "resource_missing", statusCode: 404, message: "No such price: price_private" },
    { type: "StripeAuthenticationError", statusCode: 401, message: "Invalid API Key: sk_test_private" },
  ]) {
    const error = await billingFailure(() => createXerianoCheckout({
      context,
      productCode: "CREATOR_MONTHLY",
      env,
      gateway: gateway({ async retrievePrice() { throw stripeError; } }),
      repository: new Repository(),
    }));
    assert.equal(error.diagnostic?.code, "STRIPE_RESOURCE_CONTEXT_MISMATCH");
    assert.equal(error.diagnostic?.stage, "price_lookup");
    assert.doesNotMatch(JSON.stringify(error.diagnostic), /price_private|sk_test_private/);
  }
});

test("ordinary Stripe Price lookup failure keeps safe Stripe classification only", async () => {
  const stripeError = {
    type: "StripeAPIError",
    code: "api_error",
    statusCode: 500,
    message: "request req_private failed for price_private",
  };
  const error = await billingFailure(() => createXerianoCheckout({
    context,
    productCode: "CREATOR_MONTHLY",
    env,
    gateway: gateway({ async retrievePrice() { throw stripeError; } }),
    repository: new Repository(),
  }));
  assert.deepEqual(error.diagnostic, {
    code: "STRIPE_PRICE_LOOKUP_FAILED",
    stage: "price_lookup",
    productCode: "CREATOR_MONTHLY",
    stripeType: "StripeAPIError",
    stripeCode: "api_error",
    httpStatus: 500,
  });
});

test("Price verification reports exact sandbox, amount, currency, tax, and recurrence branch", () => {
  const mapping = resolveXerianoStripePriceMapping("CREATOR_MONTHLY", env)!;
  const cases: Array<[Partial<Stripe.Price>, string]> = [
    [{ livemode: true }, "STRIPE_PRICE_SANDBOX_MISMATCH"],
    [{ unit_amount: 1_899 }, "STRIPE_PRICE_AMOUNT_MISMATCH"],
    [{ currency: "usd" }, "STRIPE_PRICE_CURRENCY_MISMATCH"],
    [{ tax_behavior: "exclusive" }, "STRIPE_PRICE_TAX_BEHAVIOR_MISMATCH"],
    [{ recurring: { interval: "year", interval_count: 1, usage_type: "licensed" } as Stripe.Price.Recurring }, "STRIPE_PRICE_RECURRENCE_MISMATCH"],
  ];
  for (const [mutation, expected] of cases) {
    assert.throws(
      () => assertStripePriceMatchesCatalog({ ...priceFor(mapping), ...mutation } as Stripe.Price, mapping),
      (error) => error instanceof XerianoBillingError && error.diagnostic?.code === expected,
    );
  }
});

test("customer creation, checkout claim, and session creation receive distinct diagnostics", async () => {
  const customerRepository = new Repository();
  customerRepository.customer = null;
  const customerError = await billingFailure(() => createXerianoCheckout({
    context,
    productCode: "CREATOR_MONTHLY",
    env,
    gateway: gateway({ async createCustomer() { throw { type: "StripeAPIError", code: "api_error", statusCode: 500 }; } }),
    repository: customerRepository,
  }));
  assert.equal(customerError.diagnostic?.code, "STRIPE_CUSTOMER_CREATE_FAILED");

  const claimRepository = new Repository();
  claimRepository.failAt = "claim";
  const claimError = await billingFailure(() => createXerianoCheckout({ context, productCode: "CREATOR_MONTHLY", env, gateway: gateway(), repository: claimRepository }));
  assert.equal(claimError.diagnostic?.code, "CHECKOUT_CLAIM_FAILED");

  const sessionError = await billingFailure(() => createXerianoCheckout({
    context,
    productCode: "CREATOR_MONTHLY",
    env,
    gateway: gateway({ async createCheckoutSession() { throw { type: "StripeAPIError", code: "api_error", statusCode: 500 }; } }),
    repository: new Repository(),
  }));
  assert.equal(sessionError.diagnostic?.code, "STRIPE_SESSION_CREATE_FAILED");
});

test("repository persistence stages remain distinguishable without database detail", async () => {
  const cases: Array<[Repository["failAt"], string]> = [
    ["lookup", "STRIPE_CUSTOMER_READ_FAILED"],
    ["mapping", "STRIPE_PRICE_MAPPING_PERSIST_FAILED"],
    ["record", "CHECKOUT_SESSION_PERSIST_FAILED"],
  ];
  for (const [failAt, expected] of cases) {
    const repository = new Repository();
    repository.failAt = failAt;
    const error = await billingFailure(() => createXerianoCheckout({ context, productCode: "CREATOR_MONTHLY", env, gateway: gateway(), repository }));
    assert.equal(error.diagnostic?.code, expected);
    assert.doesNotMatch(JSON.stringify(error.diagnostic), /private database detail/);
  }

  const bindRepository = new Repository();
  bindRepository.customer = null;
  bindRepository.failAt = "bind";
  const bindError = await billingFailure(() => createXerianoCheckout({ context, productCode: "CREATOR_MONTHLY", env, gateway: gateway(), repository: bindRepository }));
  assert.equal(bindError.diagnostic?.code, "STRIPE_CUSTOMER_PERSIST_FAILED");
});

test("staging logger emits only allowlisted fields and is silent outside exact staging", () => {
  const captured: Array<[string, Record<string, unknown>]> = [];
  const logger = (message: string, safeContext: Record<string, unknown>) => captured.push([message, safeContext]);
  const diagnostic = checkoutDiagnostic({
    code: "STRIPE_PRICE_LOOKUP_FAILED",
    stage: "price_lookup",
    productCode: "CREATOR_MONTHLY",
    error: {
      type: "StripeAPIError",
      code: "api_error",
      statusCode: 500,
      message: "sk_test_private price_private cus_private cs_private",
      requestId: "req_private",
    },
  });
  logXerianoCheckoutDiagnostic(diagnostic, env, logger);
  assert.deepEqual(captured, [["[xeriano-billing] Checkout failed", {
    code: "STRIPE_PRICE_LOOKUP_FAILED",
    stage: "price_lookup",
    productCode: "CREATOR_MONTHLY",
    stripeType: "StripeAPIError",
    stripeCode: "api_error",
    httpStatus: 500,
  }]]);
  assert.doesNotMatch(JSON.stringify(captured), /sk_test_|price_private|cus_private|cs_private|req_private/);

  logXerianoCheckoutDiagnostic(diagnostic, {
    ...env,
    NEXT_PUBLIC_SUPABASE_URL: "https://lggogmvpktedkimbpzix.supabase.co",
  }, logger);
  assert.equal(captured.length, 1);
});

test("customer response stays generic while diagnostic codes remain server-only", () => {
  const route = read("app/api/xeriano/billing/checkout/route.ts");
  const client = read("components/xeriano/billing-action-button.tsx");
  assert.match(route, /code: "BILLING_UNAVAILABLE"/);
  assert.match(route, /Checkout konnte nicht gestartet werden\./);
  assert.doesNotMatch(route, /error:\s*error\.(?:message|diagnostic)/);
  assert.match(client, /Checkout konnte nicht gestartet werden\. Bitte versuche es erneut\./);
  assert.doesNotMatch(client, /payload\.(?:code|error)|caught\.message/);
  assert.deepEqual(getSafeStripeErrorContext({
    type: "StripeAPIError",
    code: "api_error",
    statusCode: 500,
    message: "secret private detail",
  }), { stripeType: "StripeAPIError", stripeCode: "api_error", httpStatus: 500 });
});
