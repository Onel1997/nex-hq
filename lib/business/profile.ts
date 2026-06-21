/** Supported print-on-demand and fulfillment suppliers (extensible). */
export const KNOWN_SUPPLIERS = ["Printful", "Gelato", "Apliiq"] as const;

export type KnownSupplier = (typeof KNOWN_SUPPLIERS)[number];

/** Sales and marketing platforms (extensible). */
export const KNOWN_PLATFORMS = ["Shopify"] as const;

/** Organic and paid channels (extensible). */
export const KNOWN_SALES_CHANNELS = [
  "Website",
  "Instagram",
  "TikTok",
  "Pinterest",
  "Meta Ads",
  "Klaviyo",
  "Google Analytics",
] as const;

export type BusinessProfile = {
  brandName: string;
  industry: string;
  businessModel: string;
  targetAudience: string;
  positioning: string;
  productionModel: string;
  inventoryModel: string;
  fulfillmentModel: string;
  suppliers: string[];
  platforms: string[];
  salesChannels: string[];
  regions: string[];
  priceSegment: string;
};

export const DEFAULT_BUSINESS_PROFILE_SLUG = "milaene";

/** Default Milaene business profile — Print on Demand premium streetwear. */
export const MILAENE_BUSINESS_PROFILE: BusinessProfile = {
  brandName: "Milaene",
  industry: "Premium Streetwear",
  businessModel: "Print On Demand",
  targetAudience: "18-35 streetwear customers",
  positioning: "Premium minimalist streetwear",
  productionModel: "On Demand",
  inventoryModel: "Virtual Inventory",
  fulfillmentModel: "Supplier Fulfillment",
  suppliers: ["Printful"],
  platforms: ["Shopify"],
  salesChannels: ["Website", "Instagram", "TikTok"],
  regions: ["Germany", "Europe"],
  priceSegment: "Premium",
};

/** Local profile registry keyed by workspace slug. Future brands register here or in Supabase. */
export const BUSINESS_PROFILE_BY_SLUG: Record<string, BusinessProfile> = {
  milaene: MILAENE_BUSINESS_PROFILE,
};

export function isPrintOnDemand(profile: BusinessProfile): boolean {
  return (
    /print on demand|pod|on demand/i.test(profile.businessModel) ||
    /virtual inventory/i.test(profile.inventoryModel)
  );
}

export function getBusinessProfileForSlug(slug: string): BusinessProfile {
  return (
    BUSINESS_PROFILE_BY_SLUG[slug] ??
    BUSINESS_PROFILE_BY_SLUG[DEFAULT_BUSINESS_PROFILE_SLUG]
  );
}
