import type { XerianoStripeProductCode } from "./stripe-config";

const STAGING_PROJECT_REF = "wwfezmywxishfgwnijyd";
const SAFE_STRIPE_VALUE = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;

export type XerianoCheckoutDiagnosticCode =
  | "CHECKOUT_ACCOUNT_RESOLUTION_FAILED"
  | "CHECKOUT_RUNTIME_NOT_READY"
  | "CHECKOUT_PRODUCT_NOT_CONFIGURED"
  | "STRIPE_PRICE_LOOKUP_FAILED"
  | "STRIPE_RESOURCE_CONTEXT_MISMATCH"
  | "STRIPE_PRICE_SANDBOX_MISMATCH"
  | "STRIPE_PRICE_INACTIVE"
  | "STRIPE_PRICE_IDENTITY_MISMATCH"
  | "STRIPE_PRICE_CURRENCY_MISMATCH"
  | "STRIPE_PRICE_AMOUNT_MISMATCH"
  | "STRIPE_PRICE_TAX_BEHAVIOR_MISMATCH"
  | "STRIPE_PRICE_RECURRENCE_MISMATCH"
  | "STRIPE_PRICE_MAPPING_PERSIST_FAILED"
  | "STRIPE_CUSTOMER_READ_FAILED"
  | "STRIPE_CUSTOMER_CREATE_FAILED"
  | "STRIPE_CUSTOMER_SANDBOX_MISMATCH"
  | "STRIPE_CUSTOMER_PERSIST_FAILED"
  | "CHECKOUT_CLAIM_FAILED"
  | "STRIPE_SESSION_CREATE_FAILED"
  | "STRIPE_SESSION_SANDBOX_MISMATCH"
  | "CHECKOUT_SESSION_PERSIST_FAILED"
  | "CHECKOUT_UNEXPECTED_FAILURE";

export type XerianoCheckoutStage =
  | "account_resolution"
  | "runtime_guard"
  | "product_resolution"
  | "price_lookup"
  | "price_verification"
  | "price_mapping_persistence"
  | "customer_lookup"
  | "customer_creation"
  | "customer_persistence"
  | "checkout_claim"
  | "session_creation"
  | "session_persistence"
  | "unexpected";

export type XerianoCheckoutDiagnostic = Readonly<{
  code: XerianoCheckoutDiagnosticCode;
  stage: XerianoCheckoutStage;
  productCode?: XerianoStripeProductCode;
  stripeType?: string;
  stripeCode?: string;
  httpStatus?: number;
}>;

function safeStripeValue(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_STRIPE_VALUE.test(value)
    ? value
    : undefined;
}

function safeHttpStatus(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

/** Reads only Stripe's documented error classification fields, never its message or request data. */
export function getSafeStripeErrorContext(error: unknown): Readonly<{
  stripeType?: string;
  stripeCode?: string;
  httpStatus?: number;
}> {
  if (!error || typeof error !== "object") return Object.freeze({});
  const candidate = error as { type?: unknown; code?: unknown; statusCode?: unknown; status?: unknown };
  const stripeType = safeStripeValue(candidate.type);
  if (!stripeType?.startsWith("Stripe")) return Object.freeze({});
  const stripeCode = safeStripeValue(candidate.code);
  const httpStatus = safeHttpStatus(candidate.statusCode) ?? safeHttpStatus(candidate.status);
  return Object.freeze({
    ...(stripeType ? { stripeType } : {}),
    ...(stripeCode ? { stripeCode } : {}),
    ...(httpStatus ? { httpStatus } : {}),
  });
}

export function isStripeResourceContextFailure(error: unknown): boolean {
  const context = getSafeStripeErrorContext(error);
  return context.stripeCode === "resource_missing"
    || context.stripeType === "StripeAuthenticationError"
    || context.stripeType === "StripePermissionError"
    || context.httpStatus === 401
    || context.httpStatus === 403
    || context.httpStatus === 404;
}

export function checkoutDiagnostic(input: {
  code: XerianoCheckoutDiagnosticCode;
  stage: XerianoCheckoutStage;
  productCode?: XerianoStripeProductCode;
  error?: unknown;
}): XerianoCheckoutDiagnostic {
  return Object.freeze({
    code: input.code,
    stage: input.stage,
    ...(input.productCode ? { productCode: input.productCode } : {}),
    ...getSafeStripeErrorContext(input.error),
  });
}

function isExactStagingProject(env: Record<string, string | undefined>): boolean {
  try {
    return new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname === `${STAGING_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

/**
 * Emits a fixed-field, staging-only diagnostic. It cannot serialize an Error,
 * Stripe/Supabase identifiers, account authority, credentials, or request data.
 */
export function logXerianoCheckoutDiagnostic(
  diagnostic: XerianoCheckoutDiagnostic,
  env: Record<string, string | undefined> = process.env,
  logger: (message: string, context: Record<string, unknown>) => void = console.error,
): void {
  if (!isExactStagingProject(env)) return;
  logger("[xeriano-billing] Checkout failed", {
    code: diagnostic.code,
    stage: diagnostic.stage,
    ...(diagnostic.productCode ? { productCode: diagnostic.productCode } : {}),
    ...(diagnostic.stripeType ? { stripeType: diagnostic.stripeType } : {}),
    ...(diagnostic.stripeCode ? { stripeCode: diagnostic.stripeCode } : {}),
    ...(diagnostic.httpStatus ? { httpStatus: diagnostic.httpStatus } : {}),
  });
}
