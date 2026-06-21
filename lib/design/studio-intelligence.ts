import { MILAENE_PROFILE } from "@/lib/business/business-profile";
import {
  buildDesignIntelligenceDashboard,
  scoreCollectionOpportunities,
  type CollectionOpportunityScore,
  type DesignIntelligenceDashboard,
  type ProductIntelligence,
} from "@/lib/design/product-intelligence";
import { MARKETPRINT_PROFILE } from "@/lib/marketprint/marketprint-profile";
import type { ShopifyPerformanceIntelligence } from "@/lib/shopify/performance";
import {
  isCommerceHistoryActive,
  mergeHistoricalProducts,
  type CommerceIntelligence,
} from "@/lib/shopify/commerce-intelligence";
import {
  getCampaignProducts,
  getEmbroideryProducts,
  getPremiumProducts,
  MARKETPRINT_CATEGORIES,
  matchProductToMarketPrint,
} from "@/lib/marketprint/product-capabilities";
import { MARKETPRINT_MATERIALS } from "@/lib/marketprint/material-library";
import type {
  ProductKnowledge,
  ShopifyKnowledge,
  ShopifyProductSummary,
} from "@/lib/shopify/types";
import { buildProductKnowledge } from "@/lib/shopify/product-knowledge";

/** Product bases shown in Design Studio — mapped from live catalog. */
export const DESIGN_PRODUCT_BASES = [
  "T-Shirts",
  "Hoodies",
  "Beanies",
  "Bucket Hats",
  "Accessories",
] as const;

const BASE_CATEGORY_ALIASES: Record<
  (typeof DESIGN_PRODUCT_BASES)[number],
  string[]
> = {
  "T-Shirts": ["tee", "t-shirt", "tshirt", "shirt", "top"],
  Hoodies: ["hoodie", "hooded", "zip hoodie"],
  Beanies: ["beanie", "knit hat", "winter hat"],
  "Bucket Hats": ["bucket hat", "bucket", "fisherman"],
  Accessories: ["accessory", "tote", "bag", "pouch", "sock", "cap"],
};

export const SUPPLIER_COLOR_PALETTE = [
  "black",
  "white",
  "cream",
  "washed black",
  "beige",
  "gray",
] as const;

export const COLLECTION_OPPORTUNITY_TEMPLATES = [
  {
    id: "winter-essentials",
    title: "Winter Essentials",
    description: "Beanies, heavyweight hoodies, layered streetwear core",
    tags: ["seasonal", "essentials"],
  },
  {
    id: "premium-embroidery",
    title: "Premium Embroidery Capsule",
    description: "Embroidered caps, tonal hoodies, 3D logo headwear",
    tags: ["embroidery", "premium"],
  },
  {
    id: "minimal-core",
    title: "Minimal Core Collection",
    description: "Clean tees, neutral palette, logo-only graphics",
    tags: ["core", "minimal"],
  },
  {
    id: "heavyweight-oversized",
    title: "Heavyweight Oversized Drop",
    description: "450gsm+ hoodies, boxy tees, washed black color story",
    tags: ["oversized", "heavyweight"],
  },
  {
    id: "essentials-2",
    title: "Essentials 2.0",
    description: "Refresh core SKUs with new colorways and fits",
    tags: ["core", "colorways"],
  },
] as const;

export const PRODUCT_OPPORTUNITY_TEMPLATES = [
  {
    title: "Embroidered heavyweight hoodie",
    description: "Premium fleece · chest embroidery · washed black",
    category: "Heavyweight Hoodies",
  },
  {
    title: "Oversized washed tee",
    description: "Boxy fit · premium jersey · cream or washed black",
    category: "Oversized Tees",
  },
  {
    title: "Premium beanie capsule",
    description: "Logo embroidery · acrylic wool blend · winter drop",
    category: "Beanies",
  },
  {
    title: "Luxury basics collection",
    description: "Minimal graphics · neutral palette · elevated blanks",
    category: "T-Shirts",
  },
] as const;

export interface DesignProductBaseRow {
  category: (typeof DESIGN_PRODUCT_BASES)[number];
  productCount: number;
  priceRange: string;
  supplier: string;
  activeCollections: string[];
}

export interface DesignCollectionRow {
  title: string;
  productCount: number;
}

export interface DesignOpportunityCard {
  id: string;
  title: string;
  description: string;
  tags?: string[];
  marketPrintSuitability?: number;
  confidence?: number;
}

export interface DesignExistingProductCard {
  id: string;
  title: string;
  category: string;
  price: string;
  currency: string;
  collections: string[];
  colors: string[];
  materials: string[];
  marketPrintSuitability: number;
  premiumScore: number;
  embroidery: boolean;
  intelligence?: ProductIntelligence;
}

export type { CollectionOpportunityScore, DesignIntelligenceDashboard, ProductIntelligence };
export type { CommerceIntelligence } from "@/lib/shopify/commerce-intelligence";

export interface DesignStudioIntelligence {
  productEcosystem: DesignProductBaseRow[];
  supplierCapabilities: {
    primarySupplier: string;
    capabilities: string[];
    limitations: string[];
  };
  availableMaterials: string[];
  existingCollections: DesignCollectionRow[];
  collectionOpportunities: DesignOpportunityCard[];
  productGaps: string[];
  capsuleIdeas: DesignOpportunityCard[];
  colorIntelligence: {
    supplierColors: string[];
    catalogColors: string[];
    recommended: string[];
  };
  productOpportunities: DesignOpportunityCard[];
  existingProducts: DesignExistingProductCard[];
  designIntelligence: DesignIntelligenceDashboard;
  performanceIntelligence: ShopifyPerformanceIntelligence | null;
  commerceIntelligence: CommerceIntelligence | null;
  scoredOpportunities: CollectionOpportunityScore[];
  marketPrintCategories: string[];
  summary: {
    totalProducts: number;
    activeProducts: number;
    categories: number;
    collections: number;
    averageSuitability: number;
    averageCompositeScore: number;
    heroProductCount: number;
    totalRevenue: number;
    totalUnitsSold: number;
    averageOrderValue: number;
    performancePeriodDays: number;
    commerceOrderCount: number;
  };
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function productMatchesBase(
  product: ShopifyProductSummary,
  base: (typeof DESIGN_PRODUCT_BASES)[number],
): boolean {
  const aliases = BASE_CATEGORY_ALIASES[base];
  const haystack = normalize(
    [product.title, product.productType, ...product.collections].join(" "),
  );
  return aliases.some((alias) => haystack.includes(normalize(alias)));
}

function priceRangeForProducts(products: ShopifyProductSummary[]): string {
  if (products.length === 0) return "—";
  const prices = products
    .map((p) => parseFloat(p.price))
    .filter((n) => !Number.isNaN(n));
  if (prices.length === 0) return "—";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const currency = products[0]?.currency ?? "EUR";
  if (min === max) return `${min.toFixed(0)} ${currency}`;
  return `${min.toFixed(0)}–${max.toFixed(0)} ${currency}`;
}

function collectionsForProducts(products: ShopifyProductSummary[]): string[] {
  const set = new Set<string>();
  for (const product of products) {
    for (const col of product.collections) set.add(col);
  }
  return [...set].slice(0, 4);
}

function buildProductEcosystem(
  products: ShopifyProductSummary[],
): DesignProductBaseRow[] {
  return DESIGN_PRODUCT_BASES.map((category) => {
    const matched = products.filter((p) => productMatchesBase(p, category));
    return {
      category,
      productCount: matched.length,
      priceRange: priceRangeForProducts(matched),
      supplier: MILAENE_PROFILE.primarySupplier,
      activeCollections: collectionsForProducts(matched),
    };
  });
}


function buildExistingProducts(
  products: ShopifyProductSummary[],
  intelligenceById: Map<string, ProductIntelligence>,
): DesignExistingProductCard[] {
  return products.slice(0, 12).map((product) => {
    const intel = intelligenceById.get(product.id);
    const match = matchProductToMarketPrint({
      title: product.title,
      productType: product.productType,
      materials: product.materials,
    });

    return {
      id: product.id,
      title: product.title,
      category: product.productType,
      price: product.price,
      currency: product.currency,
      collections: product.collections,
      colors: product.colors,
      materials: product.materials,
      marketPrintSuitability: intel?.marketPrintSuitability ?? match.suitability,
      premiumScore: intel?.premiumScore ?? match.capability.premiumScore * 10,
      embroidery: intel?.embroideryPotential !== "None" && intel?.embroideryPotential !== "Low"
        ? true
        : match.capability.embroidery,
      intelligence: intel,
    };
  });
}

function buildCapsuleIdeas(gaps: string[]): DesignOpportunityCard[] {
  const ideas: DesignOpportunityCard[] = COLLECTION_OPPORTUNITY_TEMPLATES.map(
    (item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      tags: [...item.tags],
      marketPrintSuitability: 90,
    }),
  );

  for (const gap of gaps.slice(0, 2)) {
    ideas.push({
      id: `gap-${normalize(gap)}`,
      title: `${gap} Expansion`,
      description: `Fill catalog gap with MarketPrint-ready ${gap.toLowerCase()} concepts`,
      tags: ["gap", "expansion"],
      marketPrintSuitability: 75,
    });
  }

  return ideas;
}

function buildProductOpportunities(): DesignOpportunityCard[] {
  return PRODUCT_OPPORTUNITY_TEMPLATES.map((item, index) => {
    const match = matchProductToMarketPrint({
      title: item.title,
      productType: item.category,
    });
    return {
      id: `opp-${index}`,
      title: item.title,
      description: item.description,
      marketPrintSuitability: match.suitability,
    };
  });
}

function mergeColors(catalogColors: string[]): DesignStudioIntelligence["colorIntelligence"] {
  const supplierColors = [...SUPPLIER_COLOR_PALETTE];
  const normalizedCatalog = catalogColors.map((c) => c.toLowerCase());
  const recommended = [
    ...supplierColors,
    ...catalogColors.filter(
      (c) => !supplierColors.some((s) => normalizedCatalog.includes(s.toLowerCase())),
    ),
  ].slice(0, 10);

  return {
    supplierColors,
    catalogColors,
    recommended: [...new Set(recommended.map((c) => c.toLowerCase()))],
  };
}

export function buildDesignStudioIntelligence(
  knowledge: ShopifyKnowledge,
  performanceIntelligence?: ShopifyPerformanceIntelligence | null,
  commerceIntelligence?: CommerceIntelligence | null,
): DesignStudioIntelligence {
  const productKnowledge = buildProductKnowledge(knowledge);
  const activeProducts = productKnowledge.availableProducts.filter(
    (p) => p.status === "ACTIVE",
  );

  const historyActive =
    isCommerceHistoryActive(commerceIntelligence?.historical) ||
    Boolean(commerceIntelligence?.import?.products.length);

  const mergedProducts =
    historyActive && commerceIntelligence
      ? mergeHistoricalProducts(knowledge, commerceIntelligence)
      : knowledge.products;

  const designIntelligence = buildDesignIntelligenceDashboard(
    mergedProducts,
    performanceIntelligence ?? undefined,
    historyActive ? commerceIntelligence ?? undefined : undefined,
  );
  const intelligenceById = new Map(
    designIntelligence.scoredProducts.map((p) => [p.productId, p]),
  );
  const scoredOpportunities = scoreCollectionOpportunities(
    designIntelligence.scoredProducts,
    historyActive ? commerceIntelligence ?? undefined : undefined,
  );

  const cardSource =
    productKnowledge.bestsellerCandidates.length > 0
      ? productKnowledge.bestsellerCandidates
      : activeProducts.slice(0, 12);

  const existingProducts = buildExistingProducts(cardSource, intelligenceById);

  const suitabilityScores = designIntelligence.scoredProducts.map(
    (p) => p.marketPrintSuitability,
  );
  const averageSuitability =
    suitabilityScores.length > 0
      ? Math.round(
          suitabilityScores.reduce((a, b) => a + b, 0) / suitabilityScores.length,
        )
      : 0;
  const averageCompositeScore =
    designIntelligence.scoredProducts.length > 0
      ? Math.round(
          designIntelligence.scoredProducts.reduce(
            (sum, p) => sum + p.heroProductScore,
            0,
          ) / designIntelligence.scoredProducts.length,
        )
      : 0;
  const heroProductCount = designIntelligence.scoredProducts.filter(
    (p) => p.heroPotential === "High",
  ).length;
  const perfSummary =
    performanceIntelligence?.summary ??
    (historyActive
      ? commerceIntelligence?.import?.summary ?? commerceIntelligence?.summary
      : undefined);

  const marketPrintPremium = getPremiumProducts().map((p) => p.name);
  const marketPrintEmbroidery = getEmbroideryProducts().map((p) => p.name);

  return {
    productEcosystem: buildProductEcosystem(activeProducts),
    supplierCapabilities: {
      primarySupplier: MARKETPRINT_PROFILE.name,
      capabilities: [
        "embroidery",
        "DTG printing",
        "oversized garments",
        "premium blanks",
        "POD fulfillment",
        ...marketPrintPremium.slice(0, 3).map((p) => `${p} production`),
      ],
      limitations: [
        "no luxury leather",
        "no cut & sew",
        "no custom manufacturing",
        "no luxury outerwear",
      ],
    },
    availableMaterials: [
      ...new Set([
        ...productKnowledge.availableMaterials,
        ...MARKETPRINT_MATERIALS.map((m) => m.name),
      ]),
    ].slice(0, 12),
    existingCollections: knowledge.collections.map((c) => ({
      title: c.title,
      productCount: c.productCount,
    })),
    collectionOpportunities: scoredOpportunities.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      tags: item.tags,
      confidence: item.confidence,
      marketPrintSuitability: item.confidence,
    })),
    productGaps: productKnowledge.categoryGaps,
    capsuleIdeas: buildCapsuleIdeas(productKnowledge.categoryGaps),
    colorIntelligence: mergeColors(productKnowledge.availableColors),
    productOpportunities: buildProductOpportunities(),
    existingProducts,
    designIntelligence,
    performanceIntelligence: performanceIntelligence ?? null,
    commerceIntelligence: commerceIntelligence ?? null,
    scoredOpportunities,
    marketPrintCategories: [...MARKETPRINT_CATEGORIES],
    summary: {
      totalProducts: productKnowledge.productCount,
      activeProducts: productKnowledge.inventoryState.activeProducts,
      categories: productKnowledge.availableCategories.length,
      collections: productKnowledge.collections.length,
      averageSuitability,
      averageCompositeScore,
      heroProductCount,
      totalRevenue: perfSummary?.totalRevenue ?? 0,
      totalUnitsSold: perfSummary?.totalUnits ?? 0,
      averageOrderValue:
        performanceIntelligence?.summary.averageOrderValue ??
        commerceIntelligence?.summary.averageOrderValue ??
        0,
      performancePeriodDays: 0,
      commerceOrderCount: commerceIntelligence?.summary.totalOrders ?? 0,
    },
  };
}

export function buildDesignStudioFromProductKnowledge(
  productKnowledge: ProductKnowledge,
  knowledge?: ShopifyKnowledge,
  performanceIntelligence?: ShopifyPerformanceIntelligence | null,
  commerceIntelligence?: CommerceIntelligence | null,
): DesignStudioIntelligence {
  if (knowledge) {
    return buildDesignStudioIntelligence(
      knowledge,
      performanceIntelligence,
      commerceIntelligence,
    );
  }

  const mockKnowledge: ShopifyKnowledge = {
    products: productKnowledge.availableProducts.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.id,
      status: p.status,
      productType: p.productType,
      price: p.price,
      currency: p.currency,
      inventory: p.inventory,
      collections: p.collections,
      tags: [],
      colors: p.colors,
      materials: p.materials,
    })),
    collections: productKnowledge.collections.map((title, i) => ({
      title,
      handle: title.toLowerCase().replace(/\s+/g, "-"),
      productCount: 0,
    })),
    categories: productKnowledge.availableCategories,
    colors: productKnowledge.availableColors,
    materials: productKnowledge.availableMaterials,
    priceRanges: [],
    tags: [],
    inventorySummary: productKnowledge.inventoryState,
  };

  return buildDesignStudioIntelligence(
    mockKnowledge,
    performanceIntelligence,
    commerceIntelligence,
  );
}

/** Campaign-ready MarketPrint product names for agent reference. */
export function getDesignStudioMarketPrintRefs(): {
  premium: string[];
  embroidery: string[];
  campaign: string[];
} {
  return {
    premium: getPremiumProducts().map((p) => p.name),
    embroidery: getEmbroideryProducts().map((p) => p.name),
    campaign: getCampaignProducts().map((p) => p.name),
  };
}
