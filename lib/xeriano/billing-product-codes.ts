export const XERIANO_STRIPE_PLAN_CODES = [
  "CREATOR_MONTHLY",
  "PRO_MONTHLY",
  "STUDIO_MONTHLY",
  "MAX_MONTHLY",
] as const;

export const XERIANO_STRIPE_TOP_UP_CODES = [
  "TOPUP_250",
  "TOPUP_500",
  "TOPUP_1000",
  "TOPUP_2500",
] as const;

export type XerianoStripePlanCode = (typeof XERIANO_STRIPE_PLAN_CODES)[number];
export type XerianoStripeTopUpCode = (typeof XERIANO_STRIPE_TOP_UP_CODES)[number];
export type XerianoStripeProductCode = XerianoStripePlanCode | XerianoStripeTopUpCode;
