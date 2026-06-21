/** Connected business apps — API integrations planned or active. */
export const KNOWN_BUSINESS_APPS = [
  "Bilbee",
  "Klaviyo",
  "Judge.me",
  "Lexware",
  "Globo Product Options",
  "Unlimited Bundles",
  "Shopify Flow",
] as const;

export type KnownBusinessApp = (typeof KNOWN_BUSINESS_APPS)[number];

export type BusinessProfile = {
  brand: string;
  positioning: string;
  businessModel: string;
  inventoryModel: string;
  warehouse: string;
  fulfillment: string;
  primarySupplier: string;
  secondarySuppliers: string[];
  marketingStyle: string;
  productStrategy: string;
  /** Legacy / prompt fields */
  industry: string;
  targetAudience: string;
  platforms: string[];
  salesChannels: string[];
  regions: string[];
  priceSegment: string;
  connectedApps: KnownBusinessApp[];
};

export const DEFAULT_BUSINESS_PROFILE_SLUG = "milaene";

/** Milaene — premium Print On Demand streetwear brand. */
export const MILAENE_PROFILE: BusinessProfile = {
  brand: "Milaene",
  positioning: "Premium minimalist streetwear — capsule drops, editorial quality, supplier-fulfilled POD",
  businessModel: "Print On Demand",
  inventoryModel: "Supplier Managed",
  warehouse: "None",
  fulfillment: "Supplier Managed",
  primarySupplier: "MarketPrint Print On Demand",
  secondarySuppliers: [
    "Shirtee Cloud",
    "Printful",
    "Brandsky",
    "Brand Canyon",
  ],
  marketingStyle:
    "Storytelling, capsule drops, premium positioning — no fake scarcity or warehouse messaging",
  productStrategy:
    "Curated POD streetwear via MarketPrint first; expand categories through secondary suppliers when justified",
  industry: "Premium Streetwear",
  targetAudience: "18-35 streetwear customers",
  platforms: ["Shopify"],
  salesChannels: ["Website", "Instagram", "TikTok", "Klaviyo"],
  regions: ["Germany", "Europe"],
  priceSegment: "Premium",
  connectedApps: [...KNOWN_BUSINESS_APPS],
};

export const BUSINESS_PROFILE_BY_SLUG: Record<string, BusinessProfile> = {
  milaene: MILAENE_PROFILE,
};

export function isPrintOnDemand(profile: BusinessProfile): boolean {
  return (
    /print on demand|pod|on demand/i.test(profile.businessModel) ||
    /supplier managed|virtual inventory/i.test(profile.inventoryModel)
  );
}

export function hasWarehouse(profile: BusinessProfile): boolean {
  return profile.warehouse.toLowerCase() !== "none";
}

export function getBusinessProfileForSlug(slug: string): BusinessProfile {
  return (
    BUSINESS_PROFILE_BY_SLUG[slug] ??
    BUSINESS_PROFILE_BY_SLUG[DEFAULT_BUSINESS_PROFILE_SLUG]
  );
}

/** All suppliers in priority order (primary first). */
export function getAllSuppliers(profile: BusinessProfile): string[] {
  return [profile.primarySupplier, ...profile.secondarySuppliers];
}
