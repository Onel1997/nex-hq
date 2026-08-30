export const XERIANO_COMMERCIAL_CATALOG_VERSION =
  "xeriano-commercial-launch-v2-plan-hierarchy" as const;
export const XERIANO_TOP_UP_CATALOG_VERSION =
  "xeriano-commercial-launch-v1" as const;

export type XerianoPlanId = "FREE" | "CREATOR" | "STUDIO" | "PRO" | "MAX";
export type XerianoBillingInterval = "NONE" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
export type XerianoCreditGrantCadence = "ONCE" | "MONTHLY";

export type XerianoPlanVersion = {
  id: string;
  catalogVersion: typeof XERIANO_COMMERCIAL_CATALOG_VERSION;
  code: XerianoPlanId;
  version: string;
  name: string;
  active: boolean;
  status: "LAUNCH" | "LEGACY";
  grossPriceMinor: number;
  currency: "EUR";
  billingInterval: XerianoBillingInterval;
  creditGrantCadence: XerianoCreditGrantCadence;
  grantedCredits: number;
  imageConcurrency: number;
  videoConcurrency: number;
  validFrom: string;
  validUntil: string | null;
  recommended: boolean;
  metadata: Readonly<Record<string, string | number | boolean>>;
};

const launchPlan = (
  input: Omit<
    XerianoPlanVersion,
    "catalogVersion" | "active" | "status" | "currency" | "billingInterval" |
      "creditGrantCadence" | "validFrom" | "validUntil" | "metadata"
  >,
): XerianoPlanVersion => ({
  ...input,
  catalogVersion: XERIANO_COMMERCIAL_CATALOG_VERSION,
  active: true,
  status: "LAUNCH",
  currency: "EUR",
  billingInterval: input.code === "FREE" ? "NONE" : "MONTHLY",
  creditGrantCadence: input.code === "FREE" ? "ONCE" : "MONTHLY",
  validFrom: "2026-08-30T13:30:00.000Z",
  validUntil: null,
  metadata: Object.freeze({ monthlyOnlyV1: true }),
});

export const XERIANO_PLAN_VERSIONS: readonly XerianoPlanVersion[] = Object.freeze([
  launchPlan({
    id: "free-launch-v2",
    code: "FREE",
    version: "free-v3-launch-v2",
    name: "Free",
    grossPriceMinor: 0,
    grantedCredits: 30,
    imageConcurrency: 1,
    videoConcurrency: 0,
    recommended: false,
  }),
  launchPlan({
    id: "creator-monthly-launch-v2",
    code: "CREATOR",
    version: "creator-monthly-v2",
    name: "Creator",
    grossPriceMinor: 1_900,
    grantedCredits: 700,
    imageConcurrency: 1,
    videoConcurrency: 1,
    recommended: false,
  }),
  launchPlan({
    id: "pro-monthly-launch-v2",
    code: "PRO",
    version: "pro-monthly-v3",
    name: "Pro",
    grossPriceMinor: 3_900,
    grantedCredits: 1_400,
    imageConcurrency: 2,
    videoConcurrency: 2,
    recommended: false,
  }),
  launchPlan({
    id: "studio-monthly-launch-v2",
    code: "STUDIO",
    version: "studio-monthly-v2",
    name: "Studio",
    grossPriceMinor: 6_900,
    grantedCredits: 2_500,
    imageConcurrency: 2,
    videoConcurrency: 2,
    recommended: false,
  }),
  launchPlan({
    id: "max-monthly-launch-v2",
    code: "MAX",
    version: "max-monthly-v3",
    name: "Max",
    grossPriceMinor: 11_900,
    grantedCredits: 4_250,
    imageConcurrency: 4,
    videoConcurrency: 3,
    recommended: false,
  }),
]);

export const XERIANO_PLAN_REGISTRY = Object.freeze(
  Object.fromEntries(
    XERIANO_PLAN_VERSIONS.filter((plan) => plan.active).map((plan) => [
      plan.code,
      {
        ...plan,
        monthlyPriceEur: plan.grossPriceMinor / 100,
        monthlyCredits: plan.grantedCredits,
      },
    ]),
  ) as Record<
    XerianoPlanId,
    XerianoPlanVersion & { monthlyPriceEur: number; monthlyCredits: number }
  >,
);

export type XerianoTopUpVersion = {
  id: string;
  code: string;
  version: string;
  catalogVersion: typeof XERIANO_TOP_UP_CATALOG_VERSION;
  active: boolean;
  grossPriceMinor: number;
  currency: "EUR";
  grantedCredits: number;
  expires: false;
  validFrom: string;
  validUntil: string | null;
};

export const XERIANO_TOP_UP_VERSIONS: readonly XerianoTopUpVersion[] =
  Object.freeze([
    { id: "topup-250-launch-v1", code: "TOP_UP_250", version: "topup-250-v1", grossPriceMinor: 800, grantedCredits: 250 },
    { id: "topup-500-launch-v1", code: "TOP_UP_500", version: "topup-500-v2", grossPriceMinor: 1_500, grantedCredits: 500 },
    { id: "topup-1000-launch-v1", code: "TOP_UP_1000", version: "topup-1000-v1", grossPriceMinor: 2_900, grantedCredits: 1_000 },
    { id: "topup-2500-launch-v1", code: "TOP_UP_2500", version: "topup-2500-v1", grossPriceMinor: 7_000, grantedCredits: 2_500 },
  ].map((product) => ({
    ...product,
    catalogVersion: XERIANO_TOP_UP_CATALOG_VERSION,
    active: true,
    currency: "EUR" as const,
    expires: false as const,
    validFrom: "2026-08-30T00:00:00.000Z",
    validUntil: null,
  })));

/** Compatibility DTO for the existing customer Credits page. */
export const XERIANO_TOP_UPS = Object.freeze(
  XERIANO_TOP_UP_VERSIONS.map((product) => ({
    id: product.code,
    credits: product.grantedCredits,
    priceEur: product.grossPriceMinor / 100,
    version: product.version,
  })),
);

export const XERIANO_TRIAL = Object.freeze({
  version: "xeriano-trial-v2",
  credits: 30,
  oneGrantPerAccount: true,
  commercialValueAuthority: false,
});

/** Customer-safe catalog projection. Financial cost/margin authority is excluded. */
export function getXerianoCommercialCatalogDto() {
  return {
    version: XERIANO_COMMERCIAL_CATALOG_VERSION,
    plans: XERIANO_PLAN_VERSIONS.filter((plan) => plan.active).map((plan) => ({
      code: plan.code,
      version: plan.version,
      name: plan.name,
      grossPriceMinor: plan.grossPriceMinor,
      currency: plan.currency,
      billingInterval: plan.billingInterval,
      grantedCredits: plan.grantedCredits,
      imageConcurrency: plan.imageConcurrency,
      videoConcurrency: plan.videoConcurrency,
      recommended: plan.recommended,
    })),
    topUps: XERIANO_TOP_UP_VERSIONS.filter((product) => product.active).map((product) => ({
      code: product.code,
      version: product.version,
      grossPriceMinor: product.grossPriceMinor,
      currency: product.currency,
      grantedCredits: product.grantedCredits,
      expires: product.expires,
    })),
  } as const;
}

export function resolveActiveXerianoPlan(planCode: string | null | undefined) {
  const normalized = planCode?.trim().toUpperCase();
  return getXerianoCommercialCatalogDto().plans.find((plan) => plan.code === normalized) ?? null;
}
