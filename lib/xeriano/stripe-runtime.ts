import { XERIANO_DEFAULT_APP_URL } from "./config";

export type XerianoStripeMode = "test" | "live";

export const XERIANO_STRIPE_RUNTIME_ENV = Object.freeze({
  mode: "XERIAMO_STRIPE_MODE",
  liveEnabled: "XERIAMO_LIVE_BILLING_ENABLED",
  appUrl: "NEXT_PUBLIC_APP_URL",
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  secretKey: "STRIPE_SECRET_KEY",
  webhookSecret: "STRIPE_WEBHOOK_SECRET",
  portalConfigurationId: "STRIPE_PORTAL_CONFIGURATION_ID",
  portalCancellationOnly: "XERIAMO_STRIPE_PORTAL_CANCELLATION_ONLY",
  automaticTaxEnabled: "STRIPE_AUTOMATIC_TAX_ENABLED",
  liveAppOrigin: "XERIAMO_LIVE_APP_ORIGIN",
  liveSupabaseProjectRef: "XERIAMO_LIVE_SUPABASE_PROJECT_REF",
  legalReady: "XERIAMO_LIVE_LEGAL_READY",
  termsVersion: "XERIAMO_LIVE_TERMS_VERSION",
  privacyVersion: "XERIAMO_LIVE_PRIVACY_VERSION",
  refundPolicyVersion: "XERIAMO_LIVE_REFUND_POLICY_VERSION",
  merchantDetailsReady: "XERIAMO_LIVE_MERCHANT_DETAILS_READY",
  merchantCountry: "XERIAMO_LIVE_MERCHANT_COUNTRY",
  taxReady: "XERIAMO_LIVE_TAX_READY",
});

const TEST_PROJECT_REF = "wwfezmywxishfgwnijyd";
const PRODUCTION_PROJECT_REF = "lggogmvpktedkimbpzix";
const REQUIRED_PRICE_ENV_NAMES = [
  "STRIPE_PRICE_CREATOR_MONTHLY",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_STUDIO_MONTHLY",
  "STRIPE_PRICE_MAX_MONTHLY",
  "STRIPE_PRICE_TOP_UP_250",
  "STRIPE_PRICE_TOP_UP_500",
  "STRIPE_PRICE_TOP_UP_1000",
  "STRIPE_PRICE_TOP_UP_2500",
] as const;

export class XerianoStripeRuntimeError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export type XerianoStripeRuntime = Readonly<{
  mode: XerianoStripeMode;
  livemode: boolean;
  appOrigin: string;
  supabaseProjectRef: string;
  secretKey: string;
  webhookSecret: string;
  automaticTaxEnabled: boolean;
  portalConfigurationId: string | null;
  portalCancellationOnly: boolean;
  liveBillingEnabled: boolean;
}>;

function exactBoolean(raw: string | undefined): boolean {
  return raw === "true";
}

function parseMode(raw: string | undefined): XerianoStripeMode {
  if (raw === "test" || raw === "live") return raw;
  throw new XerianoStripeRuntimeError("STRIPE_MODE_REQUIRED");
}

function canonicalOrigin(raw: string | undefined, requireHttps: boolean): string {
  if (!raw) throw new XerianoStripeRuntimeError("STRIPE_APP_URL_REQUIRED");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new XerianoStripeRuntimeError("STRIPE_APP_URL_INVALID");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new XerianoStripeRuntimeError("STRIPE_APP_URL_INVALID");
  }
  if (requireHttps && (url.protocol !== "https:" || (url.port && url.port !== "443"))) {
    throw new XerianoStripeRuntimeError("STRIPE_PRODUCTION_HTTPS_REQUIRED");
  }
  return url.origin;
}

function projectRef(raw: string | undefined): string {
  if (!raw) throw new XerianoStripeRuntimeError("SUPABASE_PROJECT_REQUIRED");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new XerianoStripeRuntimeError("SUPABASE_PROJECT_INVALID");
  }
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return "LOCAL";
  const suffix = ".supabase.co";
  if (!url.hostname.endsWith(suffix)) throw new XerianoStripeRuntimeError("SUPABASE_PROJECT_INVALID");
  const ref = url.hostname.slice(0, -suffix.length);
  if (!/^[a-z0-9]{20}$/.test(ref)) throw new XerianoStripeRuntimeError("SUPABASE_PROJECT_INVALID");
  return ref;
}

function isPrivateLanIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return octets[0] === 10
    || (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function assertTestOrigin(raw: string | undefined, project: string): string {
  const origin = canonicalOrigin(raw, false);
  const url = new URL(origin);
  if (url.protocol === "https:") return origin;
  if (url.protocol !== "http:") throw new XerianoStripeRuntimeError("STRIPE_APP_URL_INVALID");
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return origin;
  if (project === TEST_PROJECT_REF && isPrivateLanIpv4(url.hostname)) return origin;
  throw new XerianoStripeRuntimeError("STRIPE_APP_URL_INVALID");
}

function nonPlaceholderVersion(raw: string | undefined): boolean {
  const value = raw?.trim() ?? "";
  return value.length >= 8
    && value.length <= 120
    && /^[a-z0-9][a-z0-9._-]+$/i.test(value)
    && !/(placeholder|draft|todo|tbd|example|unreviewed)/i.test(value);
}

function assertLiveReadiness(env: Record<string, string | undefined>, appOrigin: string, project: string): void {
  if (!exactBoolean(env.XERIAMO_LIVE_BILLING_ENABLED)) throw new XerianoStripeRuntimeError("LIVE_BILLING_DISABLED");
  if (env.NODE_ENV !== "production") throw new XerianoStripeRuntimeError("LIVE_NODE_ENV_REQUIRED");

  const expectedOrigin = canonicalOrigin(env.XERIAMO_LIVE_APP_ORIGIN, true);
  if (expectedOrigin !== XERIANO_DEFAULT_APP_URL || appOrigin !== XERIANO_DEFAULT_APP_URL) {
    throw new XerianoStripeRuntimeError("LIVE_APP_ORIGIN_MISMATCH");
  }
  if (env.XERIAMO_LIVE_SUPABASE_PROJECT_REF !== PRODUCTION_PROJECT_REF || project !== PRODUCTION_PROJECT_REF) {
    throw new XerianoStripeRuntimeError("LIVE_SUPABASE_PROJECT_MISMATCH");
  }
  if (!exactBoolean(env.XERIAMO_LIVE_LEGAL_READY)
    || !nonPlaceholderVersion(env.XERIAMO_LIVE_TERMS_VERSION)
    || !nonPlaceholderVersion(env.XERIAMO_LIVE_PRIVACY_VERSION)
    || !nonPlaceholderVersion(env.XERIAMO_LIVE_REFUND_POLICY_VERSION)) {
    throw new XerianoStripeRuntimeError("LIVE_LEGAL_READINESS_REQUIRED");
  }
  if (!exactBoolean(env.XERIAMO_LIVE_MERCHANT_DETAILS_READY)
    || !/^[A-Z]{2}$/.test(env.XERIAMO_LIVE_MERCHANT_COUNTRY ?? "")) {
    throw new XerianoStripeRuntimeError("LIVE_MERCHANT_READINESS_REQUIRED");
  }
  if (!exactBoolean(env.XERIAMO_LIVE_TAX_READY) || !exactBoolean(env.STRIPE_AUTOMATIC_TAX_ENABLED)) {
    throw new XerianoStripeRuntimeError("LIVE_TAX_READINESS_REQUIRED");
  }
  for (const envName of REQUIRED_PRICE_ENV_NAMES) {
    if (!/^price_[A-Za-z0-9]+$/.test(env[envName]?.trim() ?? "")) {
      throw new XerianoStripeRuntimeError("LIVE_PRICE_MAPPINGS_REQUIRED");
    }
  }
}

/**
 * Single server authority for Stripe deployment mode. Missing or mixed
 * configuration is terminally rejected; no mode is inferred from a key.
 */
export function resolveXerianoStripeRuntime(
  env: Record<string, string | undefined> = process.env,
): XerianoStripeRuntime {
  const mode = parseMode(env.XERIAMO_STRIPE_MODE);
  const livemode = mode === "live";
  if (!livemode && exactBoolean(env.XERIAMO_LIVE_BILLING_ENABLED)) {
    throw new XerianoStripeRuntimeError("LIVE_SWITCH_WITH_TEST_MODE");
  }
  const secretKey = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  if (!webhookSecret.startsWith("whsec_")) throw new XerianoStripeRuntimeError("STRIPE_WEBHOOK_SECRET_REQUIRED");
  if (livemode ? !secretKey.startsWith("sk_live_") : !secretKey.startsWith("sk_test_")) {
    throw new XerianoStripeRuntimeError(livemode ? "STRIPE_LIVE_KEY_REQUIRED" : "STRIPE_TEST_KEY_REQUIRED");
  }
  const project = projectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  const appOrigin = livemode
    ? canonicalOrigin(env.NEXT_PUBLIC_APP_URL, true)
    : assertTestOrigin(env.NEXT_PUBLIC_APP_URL, project);

  if (livemode) assertLiveReadiness(env, appOrigin, project);
  else if (project !== TEST_PROJECT_REF && project !== "LOCAL") {
    throw new XerianoStripeRuntimeError("STRIPE_TEST_PROJECT_REQUIRED");
  }

  const portalConfigurationId = env.STRIPE_PORTAL_CONFIGURATION_ID?.trim() ?? null;
  if (portalConfigurationId && !/^bpc_[A-Za-z0-9]+$/.test(portalConfigurationId)) {
    throw new XerianoStripeRuntimeError("STRIPE_PORTAL_CONFIGURATION_INVALID");
  }

  return Object.freeze({
    mode,
    livemode,
    appOrigin,
    supabaseProjectRef: project,
    secretKey,
    webhookSecret,
    automaticTaxEnabled: exactBoolean(env.STRIPE_AUTOMATIC_TAX_ENABLED),
    portalConfigurationId,
    portalCancellationOnly: exactBoolean(env.XERIAMO_STRIPE_PORTAL_CANCELLATION_ONLY),
    liveBillingEnabled: livemode,
  });
}

export function assertXerianoStripeEventMode(eventLivemode: boolean, runtime: XerianoStripeRuntime): void {
  if (eventLivemode !== runtime.livemode) throw new XerianoStripeRuntimeError("STRIPE_EVENT_MODE_MISMATCH");
}

export const XERIANO_STRIPE_PROJECTS = Object.freeze({
  test: TEST_PROJECT_REF,
  live: PRODUCTION_PROJECT_REF,
});
