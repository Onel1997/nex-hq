/** Future API integration identifiers — wired when credentials are available. */
export type SupplierApiId =
  | "marketprint"
  | "shirtee"
  | "printful"
  | "brandsky"
  | "brand-canyon";

export type SupplierRole = "primary" | "secondary";

export type SupplierProfile = {
  id: SupplierApiId;
  name: string;
  role: SupplierRole;
  businessModel: "POD" | "wholesale" | "hybrid";
  fulfillment: string;
  inventory: string;
  tier: "premium" | "standard" | "economy";
  capabilities: string[];
  limitations: string[];
  /** Placeholder for future REST/GraphQL base URL */
  apiEndpoint?: string;
};

export const MARKETPRINT_SUPPLIER: SupplierProfile = {
  id: "marketprint",
  name: "MarketPrint Print On Demand",
  role: "primary",
  businessModel: "POD",
  fulfillment: "Supplier fulfillment",
  inventory: "No inventory — on-demand production",
  tier: "premium",
  capabilities: [
    "Premium streetwear blanks",
    "DTG and embroidery",
    "EU production network",
    "Supplier-managed fulfillment",
  ],
  limitations: [
    "Production lead times vary by product",
    "Embroidery placement and color limits apply",
    "Not all garment types available",
  ],
  apiEndpoint: undefined,
};

export const SHIRTEE_SUPPLIER: SupplierProfile = {
  id: "shirtee",
  name: "Shirtee Cloud",
  role: "secondary",
  businessModel: "POD",
  fulfillment: "Supplier fulfillment",
  inventory: "No inventory — on-demand production",
  tier: "standard",
  capabilities: ["POD apparel", "EU fulfillment options"],
  limitations: ["Catalog overlap with MarketPrint — validate quality tier"],
  apiEndpoint: undefined,
};

export const PRINTFUL_SUPPLIER: SupplierProfile = {
  id: "printful",
  name: "Printful",
  role: "secondary",
  businessModel: "POD",
  fulfillment: "Supplier fulfillment",
  inventory: "No inventory — on-demand production",
  tier: "standard",
  capabilities: ["Global POD catalog", "Wide product range", "Embroidery and DTG"],
  limitations: ["Premium positioning may require blank selection review"],
  apiEndpoint: undefined,
};

export const BRANDSKY_SUPPLIER: SupplierProfile = {
  id: "brandsky",
  name: "Brandsky",
  role: "secondary",
  businessModel: "POD",
  fulfillment: "Supplier fulfillment",
  inventory: "No inventory — on-demand production",
  tier: "standard",
  capabilities: ["POD apparel and accessories"],
  limitations: ["Evaluate fit with Milaene premium tier before launch"],
  apiEndpoint: undefined,
};

export const BRAND_CANYON_SUPPLIER: SupplierProfile = {
  id: "brand-canyon",
  name: "Brand Canyon",
  role: "secondary",
  businessModel: "POD",
  fulfillment: "Supplier fulfillment",
  inventory: "No inventory — on-demand production",
  tier: "standard",
  capabilities: ["POD product expansion"],
  limitations: ["Future category expansion only — not primary production"],
  apiEndpoint: undefined,
};

export const SUPPLIER_PROFILES: SupplierProfile[] = [
  MARKETPRINT_SUPPLIER,
  SHIRTEE_SUPPLIER,
  PRINTFUL_SUPPLIER,
  BRANDSKY_SUPPLIER,
  BRAND_CANYON_SUPPLIER,
];

export const SUPPLIER_PROFILE_BY_ID: Record<SupplierApiId, SupplierProfile> = {
  marketprint: MARKETPRINT_SUPPLIER,
  shirtee: SHIRTEE_SUPPLIER,
  printful: PRINTFUL_SUPPLIER,
  brandsky: BRANDSKY_SUPPLIER,
  "brand-canyon": BRAND_CANYON_SUPPLIER,
};

export function getPrimarySupplier(): SupplierProfile {
  return MARKETPRINT_SUPPLIER;
}

export function getSecondarySuppliers(): SupplierProfile[] {
  return SUPPLIER_PROFILES.filter((s) => s.role === "secondary");
}

export function getSupplierByName(name: string): SupplierProfile | undefined {
  const normalized = name.toLowerCase();
  return SUPPLIER_PROFILES.find(
    (s) =>
      s.name.toLowerCase() === normalized ||
      s.id === normalized ||
      normalized.includes(s.id),
  );
}
