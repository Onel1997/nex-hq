/** MarketPrint — Milaene primary production partner. */
export const MARKETPRINT_PROFILE = {
  id: "marketprint" as const,
  name: "MarketPrint Print On Demand",
  role: "primary" as const,
  productionModel: "Print On Demand",
  inventory: "Supplier managed",
  warehouse: false,
  fulfillment: "Supplier managed",
  production: "On demand",
  region: "Europe",
  tier: "premium" as const,
  /** Placeholder for future MarketPrint API base URL */
  apiEndpoint: undefined as string | undefined,
};

export type MarketPrintProfile = typeof MARKETPRINT_PROFILE;

/** Minimum premium score (1–10) for Milaene assortment. */
export const MILAENE_MIN_PREMIUM_SCORE = 7;

/** Minimum MarketPrint suitability (0–100) before recommending a product. */
export const MILAENE_MIN_SUITABILITY = 70;

/** Suitability threshold for hero / campaign products. */
export const CAMPAIGN_SUITABILITY_THRESHOLD = 85;
