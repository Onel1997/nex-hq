import { randomUUID } from "node:crypto";
import Stripe from "stripe";

import type { XerianoAccountContext } from "./auth";
import {
  createXerianoBillingRepository,
  type XerianoCheckoutRepository,
} from "./billing-repository";
import {
  assertXerianoBillingSettlementReady,
  resolveXerianoStripePriceMapping,
  XERIANO_STRIPE_API_VERSION,
  XERIANO_STRIPE_PLAN_CODES,
  type XerianoStripePriceMapping,
  type XerianoStripeProductCode,
} from "./stripe-config";
import { resolveXerianoStripeRuntime, type XerianoStripeRuntime } from "./stripe-runtime";
import {
  checkoutDiagnostic,
  isStripeResourceContextFailure,
  type XerianoCheckoutDiagnostic,
  type XerianoCheckoutDiagnosticCode,
  type XerianoCheckoutStage,
} from "./stripe-checkout-diagnostics";

export class XerianoBillingError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 503,
    public readonly diagnostic?: XerianoCheckoutDiagnostic,
  ) {
    super(code);
  }
}

function checkoutFailure(input: {
  code: string;
  diagnosticCode: XerianoCheckoutDiagnosticCode;
  stage: XerianoCheckoutStage;
  productCode?: XerianoStripeProductCode;
  error?: unknown;
  status?: number;
}): XerianoBillingError {
  return new XerianoBillingError(
    input.code,
    input.status ?? 503,
    checkoutDiagnostic({
      code: input.diagnosticCode,
      stage: input.stage,
      productCode: input.productCode,
      error: input.error,
    }),
  );
}

export interface XerianoStripeGateway {
  retrievePrice(id: string): Promise<Stripe.Price>;
  createCustomer(
    params: Stripe.CustomerCreateParams,
    idempotencyKey: string,
  ): Promise<Stripe.Customer>;
  createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
    idempotencyKey: string,
  ): Promise<Stripe.Checkout.Session>;
  createPortalSession(params: Stripe.BillingPortal.SessionCreateParams): Promise<Stripe.BillingPortal.Session>;
  retrievePortalConfiguration?(id: string): Promise<Stripe.BillingPortal.Configuration>;
  retrieveCheckoutSession?(id: string): Promise<Stripe.Checkout.Session>;
  retrieveSubscription?(id: string): Promise<Stripe.Subscription>;
}

export function createXerianoStripeGateway(env: Record<string, string | undefined> = process.env): XerianoStripeGateway {
  const runtime = resolveXerianoStripeRuntime(env);
  const stripe = new Stripe(runtime.secretKey, { apiVersion: XERIANO_STRIPE_API_VERSION });
  return {
    retrievePrice: (id) => stripe.prices.retrieve(id),
    createCustomer: (params, idempotencyKey) => stripe.customers.create(params, { idempotencyKey }),
    createCheckoutSession: (params, idempotencyKey) => stripe.checkout.sessions.create(params, { idempotencyKey }),
    createPortalSession: (params) => stripe.billingPortal.sessions.create(params),
    retrievePortalConfiguration: (id) => stripe.billingPortal.configurations.retrieve(id),
    retrieveCheckoutSession: (id) => stripe.checkout.sessions.retrieve(id),
    retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
  };
}

function appOrigin(env: Record<string, string | undefined>): string {
  return resolveXerianoStripeRuntime(env).appOrigin;
}

export function assertXerianoBillingOrigin(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): void {
  let expected: string;
  try {
    expected = appOrigin(env);
  } catch (error) {
    throw checkoutFailure({
      code: "BILLING_RUNTIME_NOT_READY",
      diagnosticCode: "CHECKOUT_RUNTIME_NOT_READY",
      stage: "runtime_guard",
      error,
    });
  }
  const origin = request.headers.get("origin");
  if (!origin || origin !== expected) throw new XerianoBillingError("BILLING_ORIGIN_REJECTED", 403);
}

export function assertStripePriceMatchesCatalog(
  price: Stripe.Price,
  mapping: XerianoStripePriceMapping,
): void {
  const recurring = price.recurring;
  const correctRecurrence = mapping.kind === "SUBSCRIPTION"
    ? recurring?.interval === "month" && (recurring.interval_count ?? 1) === 1
    : recurring === null;
  const mismatch = (diagnosticCode: XerianoCheckoutDiagnosticCode) => checkoutFailure({
    code: "STRIPE_PRICE_CATALOG_MISMATCH",
    diagnosticCode,
    stage: "price_verification",
    productCode: mapping.code,
  });
  if (price.livemode !== mapping.livemode) throw mismatch("STRIPE_PRICE_SANDBOX_MISMATCH");
  if (!price.active) throw mismatch("STRIPE_PRICE_INACTIVE");
  if (price.id !== mapping.stripePriceId) throw mismatch("STRIPE_PRICE_IDENTITY_MISMATCH");
  if (price.currency.toUpperCase() !== mapping.currency) throw mismatch("STRIPE_PRICE_CURRENCY_MISMATCH");
  if (price.unit_amount !== mapping.grossPriceMinor) throw mismatch("STRIPE_PRICE_AMOUNT_MISMATCH");
  if (price.tax_behavior !== "inclusive") throw mismatch("STRIPE_PRICE_TAX_BEHAVIOR_MISMATCH");
  if (!correctRecurrence) throw mismatch("STRIPE_PRICE_RECURRENCE_MISMATCH");
}

async function resolveOrCreateCustomer(input: {
  context: XerianoAccountContext;
  gateway: XerianoStripeGateway;
  repository: XerianoCheckoutRepository;
  productCode: XerianoStripeProductCode;
  runtime: XerianoStripeRuntime;
}) {
  let existing;
  try {
    existing = await input.repository.getBillingCustomer(input.context.accountId, input.runtime.livemode);
  } catch (error) {
    throw checkoutFailure({
      code: "STRIPE_CUSTOMER_UNAVAILABLE",
      diagnosticCode: "STRIPE_CUSTOMER_READ_FAILED",
      stage: "customer_lookup",
      productCode: input.productCode,
      error,
    });
  }
  if (existing?.stripeCustomerId) return existing;
  let customer: Stripe.Customer;
  try {
    customer = await input.gateway.createCustomer(
      {
        email: input.context.email ?? undefined,
        name: input.context.accountName,
        metadata: {
          xeriano_account_id: input.context.accountId,
          xeriano_environment: input.runtime.mode,
        },
      },
      `xeriano:stripe-customer:${input.context.accountId}`,
    );
  } catch (error) {
    throw checkoutFailure({
      code: "STRIPE_CUSTOMER_UNAVAILABLE",
      diagnosticCode: isStripeResourceContextFailure(error)
        ? "STRIPE_RESOURCE_CONTEXT_MISMATCH"
        : "STRIPE_CUSTOMER_CREATE_FAILED",
      stage: "customer_creation",
      productCode: input.productCode,
      error,
    });
  }
  if (customer.livemode !== input.runtime.livemode || customer.deleted) {
    throw checkoutFailure({
      code: "STRIPE_TEST_CUSTOMER_REQUIRED",
      diagnosticCode: "STRIPE_CUSTOMER_SANDBOX_MISMATCH",
      stage: "customer_creation",
      productCode: input.productCode,
    });
  }
  try {
    return await input.repository.bindStripeCustomer(input.context.accountId, customer.id, input.runtime.livemode);
  } catch (error) {
    throw checkoutFailure({
      code: "STRIPE_CUSTOMER_UNAVAILABLE",
      diagnosticCode: "STRIPE_CUSTOMER_PERSIST_FAILED",
      stage: "customer_persistence",
      productCode: input.productCode,
      error,
    });
  }
}

export async function createXerianoCheckout(input: {
  context: XerianoAccountContext;
  productCode: XerianoStripeProductCode;
  requestId?: string;
  env?: Record<string, string | undefined>;
  gateway?: XerianoStripeGateway;
  repository?: XerianoCheckoutRepository;
}): Promise<{ url: string }> {
  if (input.context.role !== "CUSTOMER") throw new XerianoBillingError("CUSTOMER_BILLING_REQUIRED", 403);
  const env = input.env ?? process.env;
  try {
    assertXerianoBillingSettlementReady(env);
  } catch (error) {
    throw checkoutFailure({
      code: "BILLING_RUNTIME_NOT_READY",
      diagnosticCode: "CHECKOUT_RUNTIME_NOT_READY",
      stage: "runtime_guard",
      productCode: input.productCode,
      error,
    });
  }
  const runtime = resolveXerianoStripeRuntime(env);
  const mapping = resolveXerianoStripePriceMapping(input.productCode, env);
  if (!mapping) throw checkoutFailure({
    code: "STRIPE_PRICE_NOT_CONFIGURED",
    diagnosticCode: "CHECKOUT_PRODUCT_NOT_CONFIGURED",
    stage: "product_resolution",
    productCode: input.productCode,
  });
  let gateway: XerianoStripeGateway;
  let repository: XerianoCheckoutRepository;
  try {
    gateway = input.gateway ?? createXerianoStripeGateway(env);
    repository = input.repository ?? createXerianoBillingRepository();
  } catch (error) {
    throw checkoutFailure({
      code: "BILLING_RUNTIME_NOT_READY",
      diagnosticCode: "CHECKOUT_RUNTIME_NOT_READY",
      stage: "runtime_guard",
      productCode: input.productCode,
      error,
    });
  }
  let price: Stripe.Price;
  try {
    price = await gateway.retrievePrice(mapping.stripePriceId);
  } catch (error) {
    throw checkoutFailure({
      code: "STRIPE_PRICE_LOOKUP_FAILED",
      diagnosticCode: isStripeResourceContextFailure(error)
        ? "STRIPE_RESOURCE_CONTEXT_MISMATCH"
        : "STRIPE_PRICE_LOOKUP_FAILED",
      stage: "price_lookup",
      productCode: mapping.code,
      error,
    });
  }
  assertStripePriceMatchesCatalog(price, mapping);
  try {
    await repository.registerPriceMapping(mapping);
  } catch (error) {
    throw checkoutFailure({
      code: "STRIPE_PRICE_MAPPING_PERSIST_FAILED",
      diagnosticCode: "STRIPE_PRICE_MAPPING_PERSIST_FAILED",
      stage: "price_mapping_persistence",
      productCode: mapping.code,
      error,
    });
  }
  const customer = await resolveOrCreateCustomer({
    context: input.context,
    gateway,
    repository,
    productCode: mapping.code,
    runtime,
  });
  if (!customer.stripeCustomerId) throw checkoutFailure({
    code: "STRIPE_CUSTOMER_UNAVAILABLE",
    diagnosticCode: "STRIPE_CUSTOMER_PERSIST_FAILED",
    stage: "customer_persistence",
    productCode: mapping.code,
  });
  if (
    mapping.kind === "SUBSCRIPTION" &&
    customer.stripeSubscriptionId &&
    customer.billingStatus !== "CANCELED" &&
    customer.billingStatus !== "INACTIVE"
  ) {
    throw new XerianoBillingError("USE_BILLING_PORTAL_FOR_PLAN_CHANGE", 409);
  }

  let origin: string;
  try {
    origin = appOrigin(env);
  } catch (error) {
    throw checkoutFailure({
      code: "BILLING_RUNTIME_NOT_READY",
      diagnosticCode: "CHECKOUT_RUNTIME_NOT_READY",
      stage: "runtime_guard",
      productCode: mapping.code,
      error,
    });
  }
  const requestId = input.requestId && /^[0-9a-f-]{36}$/i.test(input.requestId)
    ? input.requestId
    : randomUUID();
  let checkoutClaim: Awaited<ReturnType<XerianoCheckoutRepository["claimCheckout"]>>;
  try {
    checkoutClaim = await repository.claimCheckout(
      input.context.accountId,
      customer.stripeCustomerId,
      requestId,
      mapping.kind,
      mapping.code,
      runtime.livemode,
    );
  } catch (error) {
    throw checkoutFailure({
      code: "CHECKOUT_CLAIM_FAILED",
      diagnosticCode: "CHECKOUT_CLAIM_FAILED",
      stage: "checkout_claim",
      productCode: mapping.code,
      error,
    });
  }
  if (checkoutClaim?.checkoutSessionId) {
    if (!gateway.retrieveCheckoutSession) throw checkoutFailure({
      code: "CHECKOUT_RECOVERY_UNAVAILABLE",
      diagnosticCode: "CHECKOUT_SESSION_PERSIST_FAILED",
      stage: "session_persistence",
      productCode: mapping.code,
    });
    const existingSession = await gateway.retrieveCheckoutSession(checkoutClaim.checkoutSessionId);
    const existingCustomerId = typeof existingSession.customer === "string"
      ? existingSession.customer
      : existingSession.customer?.id;
    if (existingSession.livemode !== runtime.livemode
      || existingCustomerId !== customer.stripeCustomerId
      || existingSession.mode !== (mapping.kind === "SUBSCRIPTION" ? "subscription" : "payment")
      || existingSession.status !== "open"
      || !existingSession.url) {
      throw checkoutFailure({
        code: "CHECKOUT_RECOVERY_CONFLICT",
        diagnosticCode: "CHECKOUT_SESSION_PERSIST_FAILED",
        stage: "session_persistence",
        productCode: mapping.code,
      });
    }
    return { url: existingSession.url };
  }
  const automaticTaxEnabled = env.STRIPE_AUTOMATIC_TAX_ENABLED === "true";
  const common: Stripe.Checkout.SessionCreateParams = {
    mode: mapping.kind === "SUBSCRIPTION" ? "subscription" : "payment",
    // V1 deliberately accepts only the synchronous card path. Delayed methods
    // require a separate async-payment webhook authority before they can ship.
    payment_method_types: ["card"],
    customer: customer.stripeCustomerId,
    line_items: [{ price: mapping.stripePriceId, quantity: 1 }],
    billing_address_collection: "required",
    customer_update: { address: "auto", name: "auto" },
    automatic_tax: { enabled: automaticTaxEnabled },
    client_reference_id: input.context.accountId,
    metadata: {
      xeriano_account_id: input.context.accountId,
      xeriano_product_code: mapping.code,
      xeriano_catalog_version: mapping.catalogVersion,
      xeriano_actor_id: input.context.userId,
      xeriano_request_id: requestId,
      xeriano_livemode: String(runtime.livemode),
    },
    success_url: `${origin}/app/credits?billing=processing&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/app/credits?billing=canceled`,
  };
  if (mapping.kind === "SUBSCRIPTION") {
    common.subscription_data = {
      metadata: {
        xeriano_account_id: input.context.accountId,
        xeriano_product_code: mapping.code,
        xeriano_catalog_version: mapping.catalogVersion,
        xeriano_actor_id: input.context.userId,
        xeriano_request_id: requestId,
        xeriano_livemode: String(runtime.livemode),
      },
    };
  } else {
    common.payment_intent_data = {
      metadata: {
        xeriano_account_id: input.context.accountId,
        xeriano_product_code: mapping.code,
        xeriano_catalog_version: mapping.catalogVersion,
        xeriano_actor_id: input.context.userId,
        xeriano_request_id: requestId,
        xeriano_livemode: String(runtime.livemode),
      },
    };
  }
  let session: Stripe.Checkout.Session;
  try {
    session = await gateway.createCheckoutSession(
      common,
      `xeriano:checkout:${input.context.accountId}:${mapping.code}:${requestId}`,
    );
  } catch (error) {
    throw checkoutFailure({
      code: "STRIPE_SESSION_CREATE_FAILED",
      diagnosticCode: isStripeResourceContextFailure(error)
        ? "STRIPE_RESOURCE_CONTEXT_MISMATCH"
        : "STRIPE_SESSION_CREATE_FAILED",
      stage: "session_creation",
      productCode: mapping.code,
      error,
    });
  }
  const validSessionId = runtime.livemode
    ? /^cs_live_[A-Za-z0-9_]+$/.test(session.id)
    : /^cs_test_[A-Za-z0-9_]+$/.test(session.id);
  if (session.livemode !== runtime.livemode || !validSessionId || !session.url) throw checkoutFailure({
    code: "STRIPE_TEST_CHECKOUT_REQUIRED",
    diagnosticCode: "STRIPE_SESSION_SANDBOX_MISMATCH",
    stage: "session_creation",
    productCode: mapping.code,
  });
  try {
    await repository.recordCheckoutAuthority({
      accountId: input.context.accountId,
      requestId,
      stripeCustomerId: customer.stripeCustomerId,
      stripeCheckoutSessionId: session.id,
      mapping,
      actorId: input.context.userId,
      livemode: runtime.livemode,
      expiresAt: typeof session.expires_at === "number" ? new Date(session.expires_at * 1000).toISOString() : null,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
    });
  } catch (error) {
    throw checkoutFailure({
      code: "CHECKOUT_SESSION_PERSIST_FAILED",
      diagnosticCode: "CHECKOUT_SESSION_PERSIST_FAILED",
      stage: "session_persistence",
      productCode: mapping.code,
      error,
    });
  }
  return { url: session.url };
}

export async function createXerianoPortal(input: {
  context: XerianoAccountContext;
  env?: Record<string, string | undefined>;
  gateway?: XerianoStripeGateway;
  repository?: XerianoCheckoutRepository;
}): Promise<{ url: string }> {
  if (input.context.role !== "CUSTOMER") throw new XerianoBillingError("CUSTOMER_BILLING_REQUIRED", 403);
  const env = input.env ?? process.env;
  const runtime = resolveXerianoStripeRuntime(env);
  if (!runtime.portalConfigurationId || !runtime.portalCancellationOnly) {
    throw new XerianoBillingError("STRIPE_PORTAL_CONFIGURATION_REQUIRED", 503);
  }
  const repository = input.repository ?? createXerianoBillingRepository();
  const customer = await repository.getBillingCustomer(input.context.accountId, runtime.livemode);
  if (!customer?.stripeCustomerId) throw new XerianoBillingError("STRIPE_CUSTOMER_NOT_FOUND", 409);
  const gateway = input.gateway ?? createXerianoStripeGateway(env);
  if (!gateway.retrievePortalConfiguration) throw new XerianoBillingError("STRIPE_PORTAL_CONFIGURATION_REQUIRED", 503);
  const portalConfiguration = await gateway.retrievePortalConfiguration(runtime.portalConfigurationId);
  if (!portalConfiguration.active
    || portalConfiguration.livemode !== runtime.livemode
    || !portalConfiguration.features.subscription_cancel.enabled
    || portalConfiguration.features.subscription_cancel.mode !== "at_period_end"
    || portalConfiguration.features.subscription_cancel.proration_behavior !== "none"
    || portalConfiguration.features.subscription_update.enabled) {
    throw new XerianoBillingError("STRIPE_PORTAL_POLICY_MISMATCH", 503);
  }
  // Portal plan changes can emit webhooks without passing through a new
  // Checkout. Persist every configured, verified plan Price first so a later
  // webhook can resolve it without trusting mutable environment state.
  for (const code of XERIANO_STRIPE_PLAN_CODES) {
    const mapping = resolveXerianoStripePriceMapping(code, env);
    if (!mapping) continue;
    const price = await gateway.retrievePrice(mapping.stripePriceId);
    assertStripePriceMatchesCatalog(price, mapping);
    await repository.registerPriceMapping(mapping);
  }
  const session = await gateway.createPortalSession({
    customer: customer.stripeCustomerId,
    return_url: `${appOrigin(env)}/app/credits`,
    configuration: runtime.portalConfigurationId,
  });
  if (session.livemode !== runtime.livemode) throw new XerianoBillingError("STRIPE_PORTAL_MODE_MISMATCH");
  return { url: session.url };
}
