import type { ProviderSourceKey } from "../types";

/**
 * Source weight roles — deterministic domain weighting for confidence scoring.
 */
export type SourceWeightRole =
  | "commercial_truth"
  | "social_momentum"
  | "commerce_validation"
  | "search_demand"
  | "consumer_voice"
  | "editorial_cultural";

export interface SourceWeightProfile {
  sourceKey: string;
  role: SourceWeightRole;
  weight: number;
  label: string;
}

export const SOURCE_WEIGHT_PROFILES: Record<string, SourceWeightProfile> = {
  shopify: {
    sourceKey: "shopify",
    role: "commercial_truth",
    weight: 1.0,
    label: "Shopify",
  },
  tiktok: {
    sourceKey: "tiktok",
    role: "social_momentum",
    weight: 0.82,
    label: "TikTok",
  },
  pinterest: {
    sourceKey: "pinterest",
    role: "social_momentum",
    weight: 0.8,
    label: "Pinterest",
  },
  youtube: {
    sourceKey: "youtube",
    role: "social_momentum",
    weight: 0.78,
    label: "YouTube",
  },
  etsy: {
    sourceKey: "etsy",
    role: "commerce_validation",
    weight: 0.84,
    label: "Etsy",
  },
  amazon: {
    sourceKey: "amazon",
    role: "commerce_validation",
    weight: 0.86,
    label: "Amazon",
  },
  depop: {
    sourceKey: "depop",
    role: "commerce_validation",
    weight: 0.8,
    label: "Depop",
  },
  stockx: {
    sourceKey: "stockx",
    role: "commerce_validation",
    weight: 0.83,
    label: "StockX",
  },
  grailed: {
    sourceKey: "grailed",
    role: "commerce_validation",
    weight: 0.81,
    label: "Grailed",
  },
  google_trends: {
    sourceKey: "google_trends",
    role: "search_demand",
    weight: 0.88,
    label: "Google Trends",
  },
  reddit: {
    sourceKey: "reddit",
    role: "consumer_voice",
    weight: 0.72,
    label: "Reddit",
  },
  fashion_news: {
    sourceKey: "fashion_news",
    role: "editorial_cultural",
    weight: 0.7,
    label: "Fashion News",
  },
};

export const KNOWN_SOURCE_COUNT = Object.keys(SOURCE_WEIGHT_PROFILES).length;

const DEFAULT_PROFILE: SourceWeightProfile = {
  sourceKey: "unknown",
  role: "consumer_voice",
  weight: 0.5,
  label: "Unknown source",
};

export function getSourceWeightProfile(
  sourceKey: ProviderSourceKey | string,
): SourceWeightProfile {
  return SOURCE_WEIGHT_PROFILES[String(sourceKey)] ?? {
    ...DEFAULT_PROFILE,
    sourceKey: String(sourceKey),
    label: String(sourceKey),
  };
}

export function getSourceWeight(sourceKey: ProviderSourceKey | string): number {
  return getSourceWeightProfile(sourceKey).weight;
}

export function roleLabel(role: SourceWeightRole): string {
  switch (role) {
    case "commercial_truth":
      return "commercial truth";
    case "social_momentum":
      return "social momentum";
    case "commerce_validation":
      return "commerce and resale validation";
    case "search_demand":
      return "search demand";
    case "consumer_voice":
      return "consumer voice";
    case "editorial_cultural":
      return "editorial and cultural signal";
    default:
      return role;
  }
}
