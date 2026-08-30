import {
  XERIANO_PLAN_VERSIONS,
  XERIANO_TOP_UP_VERSIONS,
  type XerianoPlanId,
} from "./plans";
import {
  type XerianoStripeProductCode,
} from "./billing-product-codes";

export {
  XERIANO_STRIPE_PLAN_CODES,
  XERIANO_STRIPE_TOP_UP_CODES,
  type XerianoStripePlanCode,
  type XerianoStripeProductCode,
  type XerianoStripeTopUpCode,
} from "./billing-product-codes";

export const XERIANO_STRIPE_TEST_STAGING_PROJECT_REF =
  "wwfezmywxishfgwnijyd" as const;
export const XERIANO_STRIPE_API_VERSION = "2026-08-26.dahlia" as const;
export const XERIANO_STRIPE_BLOCKED_PRODUCTION_PROJECT_REF =
  "lggogmvpktedkimbpzix" as const;

export const XERIANO_STRIPE_ENV = Object.freeze({
  secretKey: "STRIPE_SECRET_KEY",
  webhookSecret: "STRIPE_WEBHOOK_SECRET",
  automaticTaxEnabled: "STRIPE_AUTOMATIC_TAX_ENABLED",
  creatorMonthly: "STRIPE_PRICE_CREATOR_MONTHLY",
  studioMonthly: "STRIPE_PRICE_STUDIO_MONTHLY",
  proMonthly: "STRIPE_PRICE_PRO_MONTHLY",
  maxMonthly: "STRIPE_PRICE_MAX_MONTHLY",
  topUp250: "STRIPE_PRICE_TOP_UP_250",
  topUp500: "STRIPE_PRICE_TOP_UP_500",
  topUp1000: "STRIPE_PRICE_TOP_UP_1000",
  topUp2500: "STRIPE_PRICE_TOP_UP_2500",
});

type StripeProductDefinition = {
  code: XerianoStripeProductCode;
  kind: "SUBSCRIPTION" | "TOP_UP";
  catalogCode: XerianoPlanId | string;
  envName: string;
};

export const XERIANO_STRIPE_PRODUCTS: readonly StripeProductDefinition[] = Object.freeze([
  { code: "CREATOR_MONTHLY", kind: "SUBSCRIPTION", catalogCode: "CREATOR", envName: XERIANO_STRIPE_ENV.creatorMonthly },
  { code: "PRO_MONTHLY", kind: "SUBSCRIPTION", catalogCode: "PRO", envName: XERIANO_STRIPE_ENV.proMonthly },
  { code: "STUDIO_MONTHLY", kind: "SUBSCRIPTION", catalogCode: "STUDIO", envName: XERIANO_STRIPE_ENV.studioMonthly },
  { code: "MAX_MONTHLY", kind: "SUBSCRIPTION", catalogCode: "MAX", envName: XERIANO_STRIPE_ENV.maxMonthly },
  { code: "TOPUP_250", kind: "TOP_UP", catalogCode: "TOP_UP_250", envName: XERIANO_STRIPE_ENV.topUp250 },
  { code: "TOPUP_500", kind: "TOP_UP", catalogCode: "TOP_UP_500", envName: XERIANO_STRIPE_ENV.topUp500 },
  { code: "TOPUP_1000", kind: "TOP_UP", catalogCode: "TOP_UP_1000", envName: XERIANO_STRIPE_ENV.topUp1000 },
  { code: "TOPUP_2500", kind: "TOP_UP", catalogCode: "TOP_UP_2500", envName: XERIANO_STRIPE_ENV.topUp2500 },
]);

export type XerianoStripePriceMapping = {
  code: XerianoStripeProductCode;
  kind: "SUBSCRIPTION" | "TOP_UP";
  stripePriceId: string;
  catalogCode: string;
  catalogVersion: string;
  grossPriceMinor: number;
  currency: "EUR";
  grantedCredits: number;
};

export class XerianoStripeConfigurationError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function projectRefFromUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const hostname = new URL(raw).hostname;
    if (hostname === "127.0.0.1" || hostname === "localhost") return "LOCAL";
    return hostname.endsWith(".supabase.co") ? hostname.split(".")[0] ?? null : null;
  } catch {
    return null;
  }
}

function isPrivateLanIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return octets[0] === 10
    || (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function isValidStripeTestAppUrl(raw: string | undefined, projectRef: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:") return true;
    if (parsed.protocol !== "http:") return false;
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return true;
    // The isolated staging project supports explicit LAN/mobile Checkout QA.
    // Production Supabase is rejected above and never reaches this exception.
    return projectRef === XERIANO_STRIPE_TEST_STAGING_PROJECT_REF
      && isPrivateLanIpv4(parsed.hostname);
  } catch {
    return false;
  }
}

export function assertXerianoStripeTestRuntime(
  env: Record<string, string | undefined> = process.env,
): void {
  const secret = env.STRIPE_SECRET_KEY?.trim();
  if (!secret?.startsWith("sk_test_")) {
    throw new XerianoStripeConfigurationError(
      secret?.startsWith("sk_live_") ? "STRIPE_LIVE_KEY_FORBIDDEN" : "STRIPE_TEST_KEY_REQUIRED",
    );
  }
  const projectRef = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  if (projectRef === XERIANO_STRIPE_BLOCKED_PRODUCTION_PROJECT_REF) {
    throw new XerianoStripeConfigurationError("PRODUCTION_SUPABASE_FORBIDDEN");
  }
  if (projectRef !== XERIANO_STRIPE_TEST_STAGING_PROJECT_REF && projectRef !== "LOCAL") {
    throw new XerianoStripeConfigurationError("STAGING_SUPABASE_REQUIRED");
  }
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) throw new XerianoStripeConfigurationError("STRIPE_APP_URL_REQUIRED");
  if (!isValidStripeTestAppUrl(appUrl, projectRef)) {
    throw new XerianoStripeConfigurationError("STRIPE_APP_URL_INVALID");
  }
}

export function assertXerianoBillingSettlementReady(
  env: Record<string, string | undefined> = process.env,
): void {
  assertXerianoStripeTestRuntime(env);
  if (!env.STRIPE_WEBHOOK_SECRET?.trim().startsWith("whsec_")) {
    throw new XerianoStripeConfigurationError("STRIPE_WEBHOOK_SECRET_REQUIRED");
  }
}

function catalogProjection(definition: StripeProductDefinition) {
  if (definition.kind === "SUBSCRIPTION") {
    const plan = XERIANO_PLAN_VERSIONS.find(
      (candidate) => candidate.active && candidate.code === definition.catalogCode,
    );
    if (!plan || plan.billingInterval !== "MONTHLY" || plan.grossPriceMinor <= 0) return null;
    return {
      catalogVersion: plan.version,
      grossPriceMinor: plan.grossPriceMinor,
      currency: plan.currency,
      grantedCredits: plan.grantedCredits,
    };
  }
  const topUp = XERIANO_TOP_UP_VERSIONS.find(
    (candidate) => candidate.active && candidate.code === definition.catalogCode,
  );
  if (!topUp) return null;
  return {
    catalogVersion: topUp.version,
    grossPriceMinor: topUp.grossPriceMinor,
    currency: topUp.currency,
    grantedCredits: topUp.grantedCredits,
  };
}

export function resolveXerianoStripePriceMapping(
  code: string,
  env: Record<string, string | undefined> = process.env,
): XerianoStripePriceMapping | null {
  const definition = XERIANO_STRIPE_PRODUCTS.find((candidate) => candidate.code === code);
  if (!definition) return null;
  const stripePriceId = env[definition.envName]?.trim();
  if (!stripePriceId || !/^price_[A-Za-z0-9]+$/.test(stripePriceId)) return null;
  const catalog = catalogProjection(definition);
  if (!catalog) return null;
  return {
    code: definition.code,
    kind: definition.kind,
    stripePriceId,
    catalogCode: definition.catalogCode,
    ...catalog,
  };
}

export function resolveXerianoStripeMappingByPriceId(
  stripePriceId: string,
  env: Record<string, string | undefined> = process.env,
): XerianoStripePriceMapping | null {
  const mappings = XERIANO_STRIPE_PRODUCTS
    .map((definition) => resolveXerianoStripePriceMapping(definition.code, env))
    .filter((mapping): mapping is XerianoStripePriceMapping => mapping !== null);
  const matches = mappings.filter((mapping) => mapping.stripePriceId === stripePriceId);
  if (matches.length > 1) throw new XerianoStripeConfigurationError("DUPLICATE_STRIPE_PRICE_MAPPING");
  return matches[0] ?? null;
}

export function getXerianoStripeAvailability(
  env: Record<string, string | undefined> = process.env,
) {
  const diagnostic = getXerianoStripeReadinessDiagnostic(env);
  return Object.freeze({
    runtimeReady: diagnostic.runtimeReady,
    portal: diagnostic.settlementReady,
    products: Object.freeze(Object.fromEntries(
      XERIANO_STRIPE_PRODUCTS.map((product) => [
        product.code,
        diagnostic.products[product.code],
      ]),
    ) as Record<XerianoStripeProductCode, boolean>),
  });
}

export type XerianoStripeReadinessDiagnostic = Readonly<{
  secretKeyPresent: boolean;
  testSecretKey: boolean;
  webhookSecretPresent: boolean;
  appUrlPresent: boolean;
  appUrlValid: boolean;
  stagingProject: boolean;
  productionProjectBlocked: boolean;
  runtimeReady: boolean;
  settlementReady: boolean;
  products: Readonly<Record<XerianoStripeProductCode, boolean>>;
}>;

/** Server/developer diagnostic containing booleans only—never credential values. */
export function getXerianoStripeReadinessDiagnostic(
  env: Record<string, string | undefined> = process.env,
): XerianoStripeReadinessDiagnostic {
  const projectRef = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const secret = env.STRIPE_SECRET_KEY?.trim();
  const secretKeyPresent = Boolean(secret);
  const testSecretKey = Boolean(secret?.startsWith("sk_test_"));
  const webhookSecretPresent = Boolean(env.STRIPE_WEBHOOK_SECRET?.trim().startsWith("whsec_"));
  const appUrlPresent = Boolean(env.NEXT_PUBLIC_APP_URL?.trim());
  const appUrlValid = isValidStripeTestAppUrl(env.NEXT_PUBLIC_APP_URL?.trim(), projectRef);
  const stagingProject = projectRef === XERIANO_STRIPE_TEST_STAGING_PROJECT_REF || projectRef === "LOCAL";
  const productionProjectBlocked = projectRef === XERIANO_STRIPE_BLOCKED_PRODUCTION_PROJECT_REF;
  let runtimeReady = false;
  try {
    assertXerianoStripeTestRuntime(env);
    runtimeReady = true;
  } catch {
    runtimeReady = false;
  }
  const settlementReady = runtimeReady && webhookSecretPresent;
  const products = Object.fromEntries(
    XERIANO_STRIPE_PRODUCTS.map((product) => [
      product.code,
      settlementReady && resolveXerianoStripePriceMapping(product.code, env) !== null,
    ]),
  ) as Record<XerianoStripeProductCode, boolean>;
  return Object.freeze({
    secretKeyPresent,
    testSecretKey,
    webhookSecretPresent,
    appUrlPresent,
    appUrlValid,
    stagingProject,
    productionProjectBlocked,
    runtimeReady,
    settlementReady,
    products: Object.freeze(products),
  });
}

export function isXerianoStripeConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  try {
    assertXerianoBillingSettlementReady(env);
    return true;
  } catch {
    return false;
  }
}

export function isXerianoStripeProductCode(value: string): value is XerianoStripeProductCode {
  return XERIANO_STRIPE_PRODUCTS.some((product) => product.code === value);
}
