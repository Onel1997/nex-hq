/** @deprecated Import from `@/lib/business/business-profile` — kept for backward compatibility. */
export {
  BUSINESS_PROFILE_BY_SLUG,
  DEFAULT_BUSINESS_PROFILE_SLUG,
  KNOWN_BUSINESS_APPS,
  MILAENE_PROFILE,
  MILAENE_PROFILE as MILAENE_BUSINESS_PROFILE,
  getAllSuppliers,
  getBusinessProfileForSlug,
  hasWarehouse,
  isPrintOnDemand,
  type BusinessProfile,
  type KnownBusinessApp,
} from "./business-profile";

/** @deprecated Use supplier profiles in `@/lib/business/supplier-profile`. */
export const KNOWN_SUPPLIERS = [
  "MarketPrint Print On Demand",
  "Shirtee Cloud",
  "Printful",
  "Brandsky",
  "Brand Canyon",
] as const;

export type KnownSupplier = (typeof KNOWN_SUPPLIERS)[number];

export const KNOWN_PLATFORMS = ["Shopify"] as const;

export const KNOWN_SALES_CHANNELS = [
  "Website",
  "Instagram",
  "TikTok",
  "Pinterest",
  "Meta Ads",
  "Klaviyo",
  "Google Analytics",
] as const;
