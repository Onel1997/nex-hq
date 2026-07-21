import type {
  Product,
  ProductCatalog,
  ProductCollection,
  ProductColor,
  ProductSize,
  ProductVariant,
} from "./types";
import { PRODUCT_SOURCE_PRIORITY } from "./types";

/** Engine / schema version — bump when snapshot shape or rule semantics change. */
export const PRODUCT_INTELLIGENCE_VERSION = "1.7B.2";

/** Catalog content version for Milaene seed (not live Shopify). */
export const MILAENE_PRODUCT_CATALOG_VERSION = "milaene-seed-2026-07-21-zip";

const SEED_UPDATED_AT = "2026-07-21T00:00:00.000Z";

const SEED_SIZES: ProductSize[] = [
  { id: "size-s", label: "S", sortOrder: 1, confidence: "seed" },
  { id: "size-m", label: "M", sortOrder: 2, confidence: "seed" },
  { id: "size-l", label: "L", sortOrder: 3, confidence: "seed" },
  { id: "size-xl", label: "XL", sortOrder: 4, confidence: "seed" },
  { id: "size-xxl", label: "XXL", sortOrder: 5, confidence: "seed" },
];

const TEE_COLORS: ProductColor[] = [
  {
    id: "color-washed-black",
    name: "washed black",
    slug: "washed-black",
    hex: "#1A1A1A",
    confidence: "seed",
  },
  {
    id: "color-charcoal",
    name: "charcoal",
    slug: "charcoal",
    hex: "#2F2F2F",
    confidence: "seed",
  },
  {
    id: "color-off-white",
    name: "off-white",
    slug: "off-white",
    hex: "#F5F2EB",
    confidence: "seed",
  },
];

const HOODIE_COLORS: ProductColor[] = [
  {
    id: "color-washed-black",
    name: "washed black",
    slug: "washed-black",
    hex: "#1A1A1A",
    confidence: "seed",
  },
  {
    id: "color-charcoal",
    name: "charcoal",
    slug: "charcoal",
    hex: "#2F2F2F",
    confidence: "seed",
  },
  {
    id: "color-concrete-grey",
    name: "concrete grey",
    slug: "concrete-grey",
    hex: "#8A8680",
    confidence: "seed",
  },
  {
    id: "color-muted-taupe",
    name: "muted taupe",
    slug: "muted-taupe",
    hex: "#9C8F82",
    confidence: "seed",
  },
  {
    id: "color-faded-grey",
    name: "faded grey",
    slug: "faded-grey",
    hex: "#9A9690",
    confidence: "seed",
  },
];

function buildVariants(
  productId: string,
  colors: ProductColor[],
  sizes: ProductSize[],
): ProductVariant[] {
  const variants: ProductVariant[] = [];
  for (const color of colors) {
    for (const size of sizes) {
      variants.push({
        id: `${productId}__${color.slug}__${size.label.toLowerCase()}`,
        productId,
        title: `${color.name} / ${size.label}`,
        colorId: color.id,
        sizeId: size.id,
        availability: "seed_assumed",
        sellable: true,
        active: true,
        confidence: "seed",
      });
    }
  }
  return variants;
}

/**
 * Milaene seed products.
 *
 * Confirmed product *direction* (not live Shopify SKUs):
 * - Oversized heavyweight T-shirts are core sellables.
 * - Heavyweight hoodies are core / hero sellables.
 * - Zip hoodies are active sellables (confirmed direction).
 *
 * Explicitly NOT in seed catalog (must not be generated):
 * - Caps, jackets, jewelry, suits, footwear, invented accessories.
 *
 * Colors / sizes / variants for tees + pullover hoodies are seed direction.
 * Zip hoodie variants/colors/sizes remain unknown until live Shopify sync.
 */
const OVERSIZED_HEAVYWEIGHT_TEE: Product = {
  id: "milaene-oversized-heavyweight-tee",
  slug: "oversized-heavyweight-tee",
  title: "Oversized Heavyweight T-Shirt",
  category: "t-shirts",
  productType: "oversized heavyweight tee",
  status: "active",
  description:
    "Seed catalog: oversized heavyweight tee — core Milaene streetwear garment. Exact Shopify SKU / inventory unconfirmed.",
  materials: [
    { id: "mat-heavyweight-cotton", name: "heavyweight cotton", confidence: "seed" },
  ],
  gsm: 450,
  gsmConfidence: "seed",
  fit: ["Oversized", "Heavyweight"],
  silhouette: ["oversized", "boxy", "dropped shoulders"],
  genderPresentation: "unisex",
  availableColors: TEE_COLORS,
  availableSizes: SEED_SIZES,
  variants: buildVariants(
    "milaene-oversized-heavyweight-tee",
    TEE_COLORS,
    SEED_SIZES,
  ),
  collections: ["col-core-essentials"],
  season: "evergreen",
  heroProduct: true,
  active: true,
  sellable: true,
  imageGenerationAllowed: true,
  videoGenerationAllowed: true,
  source: "seed",
  updatedAt: SEED_UPDATED_AT,
  version: "seed-1",
  confidence: "seed",
  media: [],
};

const HEAVYWEIGHT_HOODIE: Product = {
  id: "milaene-heavyweight-hoodie",
  slug: "heavyweight-hoodie",
  title: "Heavyweight Hoodie",
  category: "hoodies",
  productType: "heavyweight hoodie",
  status: "active",
  description:
    "Seed catalog: heavyweight pullover hoodie — flagship Milaene silhouette. Exact Shopify SKU / inventory unconfirmed.",
  materials: [
    { id: "mat-heavyweight-cotton", name: "heavyweight cotton", confidence: "seed" },
    { id: "mat-premium-fleece", name: "premium fleece", confidence: "seed" },
  ],
  gsm: 500,
  gsmConfidence: "seed",
  fit: ["Oversized", "Heavyweight", "Relaxed"],
  silhouette: ["oversized", "relaxed", "heavy-weight"],
  genderPresentation: "unisex",
  availableColors: HOODIE_COLORS,
  availableSizes: SEED_SIZES,
  variants: buildVariants("milaene-heavyweight-hoodie", HOODIE_COLORS, SEED_SIZES),
  collections: ["col-core-essentials", "col-hero"],
  season: "evergreen",
  heroProduct: true,
  active: true,
  sellable: true,
  imageGenerationAllowed: true,
  videoGenerationAllowed: true,
  source: "seed",
  updatedAt: SEED_UPDATED_AT,
  version: "seed-1",
  confidence: "seed",
  media: [],
};

/**
 * Zip Hoodie — confirmed Milaene sellable direction.
 * Exact Shopify variants, colors, sizes, inventory, and SKUs are unknown
 * until live catalog sync. Do not invent them.
 */
const ZIP_HOODIE: Product = {
  id: "milaene-zip-hoodie",
  slug: "zip-hoodie",
  title: "Zip Hoodie",
  category: "hoodies",
  productType: "zip hoodie",
  status: "active",
  description:
    "Confirmed direction: Milaene sells zip hoodies. Exact Shopify variants, colors, sizes, inventory, and SKUs unknown until live sync.",
  materials: [
    { id: "mat-heavyweight-cotton", name: "heavyweight cotton", confidence: "seed" },
    { id: "mat-premium-fleece", name: "premium fleece", confidence: "seed" },
  ],
  gsm: null,
  gsmConfidence: "unknown",
  fit: ["Oversized"],
  silhouette: ["heavyweight zip hoodie", "oversized"],
  genderPresentation: "unisex",
  availableColors: [],
  availableSizes: [],
  variants: [],
  collections: ["col-core-essentials"],
  season: "evergreen",
  heroProduct: false,
  active: true,
  sellable: true,
  imageGenerationAllowed: true,
  videoGenerationAllowed: true,
  source: "seed",
  updatedAt: SEED_UPDATED_AT,
  version: "seed-1",
  confidence: "confirmed_direction",
  media: [],
};

/**
 * Inactive example kept out of generation eligibility.
 * Demonstrates status gating without inventing a live Shopify product.
 */
const ARCHIVED_DRAFT_TEE: Product = {
  id: "milaene-archived-draft-tee",
  slug: "archived-draft-tee",
  title: "Archived Draft Tee (Inactive)",
  category: "t-shirts",
  productType: "classic tee",
  status: "archived",
  description:
    "Seed-only inactive product for rule tests — not generation-eligible.",
  materials: [
    { id: "mat-jersey", name: "premium jersey", confidence: "unknown" },
  ],
  gsm: null,
  gsmConfidence: "unknown",
  fit: ["Relaxed"],
  silhouette: ["relaxed"],
  genderPresentation: "unisex",
  availableColors: [
    {
      id: "color-washed-black",
      name: "washed black",
      slug: "washed-black",
      hex: "#1A1A1A",
      confidence: "seed",
    },
  ],
  availableSizes: SEED_SIZES.slice(0, 3),
  variants: [],
  collections: [],
  season: null,
  heroProduct: false,
  active: false,
  sellable: false,
  imageGenerationAllowed: false,
  videoGenerationAllowed: false,
  source: "seed",
  updatedAt: SEED_UPDATED_AT,
  version: "seed-1",
  confidence: "seed",
  media: [],
};

const MILAENE_COLLECTIONS: ProductCollection[] = [
  {
    id: "col-core-essentials",
    slug: "core-essentials",
    title: "Core Essentials",
    confidence: "seed",
  },
  {
    id: "col-hero",
    slug: "hero",
    title: "Hero Capsule",
    confidence: "seed",
  },
];

export const MILAENE_PRODUCT_CATALOG: ProductCatalog = {
  brandSlug: "milaene",
  brandName: "Milaene",
  version: MILAENE_PRODUCT_CATALOG_VERSION,
  source: "seed",
  updatedAt: SEED_UPDATED_AT,
  products: [
    OVERSIZED_HEAVYWEIGHT_TEE,
    HEAVYWEIGHT_HOODIE,
    ZIP_HOODIE,
    ARCHIVED_DRAFT_TEE,
  ],
  collections: MILAENE_COLLECTIONS,
  forbiddenProductTypes: [
    "cap",
    "structured cap",
    "beanie",
    "jacket",
    "coat",
    "puffer",
    "jewelry",
    "necklace",
    "ring",
    "suit",
    "blazer",
    "footwear",
    "sneakers",
    "boots",
    "tote",
    "bag",
    "accessory",
    "sweatpants",
    "cargos",
  ],
  forbiddenCategories: [
    "caps",
    "jackets",
    "footwear",
    "jewelry",
    "accessories",
    "sweatpants",
  ],
  notes: [
    "Phase 1.7B seed catalog — not live Shopify inventory.",
    "Generation-eligible direction: oversized heavyweight tees, heavyweight hoodies, zip hoodies.",
    "Zip hoodie colors/sizes/variants are unknown until Shopify sync — do not invent them.",
    "Caps, jackets, jewelry, suits, footwear, and accessories are absent and must never be invented.",
    "Seed assumptions are fallback only — Shopify live catalog is the authority when available.",
  ],
  sync: {
    catalogSource: "seed",
    sourcePriority: [...PRODUCT_SOURCE_PRIORITY],
    lastSyncedAt: null,
    liveCatalogAvailable: false,
    usingSeedFallback: true,
    stale: false,
    syncError: null,
  },
};

export const MILAENE_PRODUCTS = MILAENE_PRODUCT_CATALOG.products;
