import { matchProductToMarketPrint } from "@/lib/marketprint/product-capabilities";
import type {
  ProductPerformanceMetrics,
  ShopifyPerformanceIntelligence,
} from "@/lib/shopify/performance";
import type { CommerceIntelligence, CommerceProductRecord } from "@/lib/shopify/commerce-intelligence";
import type { ShopifyKnowledgeProduct } from "@/lib/shopify/types";

export type EmbroideryPotential = "High" | "Medium" | "Low" | "None";
export type CollectionPotential =
  | "standalone"
  | "core collection"
  | "premium capsule"
  | "seasonal capsule";
export type HeroPotential = "High" | "Medium" | "Low";
export type ScoreTier = "green" | "blue" | "orange" | "muted";

export type ProductIntelligenceBadge =
  | "HERO PRODUCT"
  | "PREMIUM"
  | "EMBROIDERY READY"
  | "CAMPAIGN READY"
  | "POD FAVORITE"
  | "BESTSELLER"
  | "TRENDING"
  | "HIGH CONVERSION"
  | "LOW PRIORITY"
  | "SEASONAL";

export interface ProductIntelligenceInput {
  id: string;
  title: string;
  productType: string;
  price: string;
  currency: string;
  collections: string[];
  tags?: string[];
  materials: string[];
  colors: string[];
  imageUrl?: string | null;
  inventory?: number;
}

export interface ProductIntelligence {
  productId: string;
  title: string;
  category: string;
  price: string;
  currency: string;
  streetwearScore: number;
  premiumScore: number;
  campaignScore: number;
  embroideryPotential: EmbroideryPotential;
  capsuleFit: string;
  trendFit: string;
  collectionPotential: CollectionPotential;
  heroPotential: HeroPotential;
  /** Design + supplier composite (legacy ranking) */
  compositeScore: number;
  /** 40% sales · 20% design · 20% supplier · 20% campaign */
  heroProductScore: number;
  designFitScore: number;
  marketPrintSuitability: number;
  productRank: number;
  launchPotential: number;
  performance: ProductPerformanceMetrics | null;
  commerce: CommerceProductRecord | null;
  badges: ProductIntelligenceBadge[];
  scoreTier: ScoreTier;
}

export interface DesignIntelligenceDashboard {
  topHeroProducts: ProductIntelligence[];
  mostPremiumProducts: ProductIntelligence[];
  highestCampaignPotential: ProductIntelligence[];
  bestEmbroideryCandidates: ProductIntelligence[];
  collectionLeaders: ProductIntelligence[];
  topProducts: ProductIntelligence[];
  topSellers: ProductIntelligence[];
  mostRevenue: ProductIntelligence[];
  fastestGrowing: ProductIntelligence[];
  lowestPerforming: ProductIntelligence[];
  highestPotential: ProductIntelligence[];
  scoredProducts: ProductIntelligence[];
  hasLivePerformance: boolean;
  hasCommerceHistory: boolean;
}

export interface CollectionOpportunityScore {
  id: string;
  title: string;
  description: string;
  confidence: number;
  tags?: string[];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function haystack(input: ProductIntelligenceInput): string {
  return normalize(
    [
      input.title,
      input.productType,
      ...(input.tags ?? []),
      ...(input.materials ?? []),
      ...(input.collections ?? []),
    ].join(" "),
  );
}

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(normalize(k)));
}

function parsePrice(price: string): number {
  const n = parseFloat(price);
  return Number.isNaN(n) ? 0 : n;
}

function scoreTierFor(score: number): ScoreTier {
  if (score >= 90) return "green";
  if (score >= 80) return "blue";
  if (score >= 70) return "orange";
  return "muted";
}

function computeStreetwearScore(
  text: string,
  capabilityStreetwear: number,
): number {
  let score = capabilityStreetwear * 9;

  if (hasKeyword(text, ["oversized", "boxy", "relaxed fit", "wide fit"])) {
    score += 12;
  }
  if (
    hasKeyword(text, [
      "heavyweight",
      "450 gsm",
      "500 gsm",
      "480 gsm",
      "heavy",
      "thick",
    ])
  ) {
    score += 10;
  }
  if (hasKeyword(text, ["embroidery", "embroidered", "3d logo"])) {
    score += 6;
  }
  if (
    hasKeyword(text, ["minimal", "essentials", "core", "logo only", "tonal"])
  ) {
    score += 5;
  }
  if (hasKeyword(text, ["hoodie", "beanie", "cap", "streetwear"])) {
    score += 4;
  }

  return Math.min(99, Math.round(score));
}

function computePremiumScore(
  text: string,
  price: number,
  capabilityPremium: number,
): number {
  let score = capabilityPremium * 9;

  if (price >= 55) score += 12;
  else if (price >= 45) score += 8;
  else if (price >= 35) score += 4;

  if (
    hasKeyword(text, [
      "premium",
      "luxury",
      "heavyweight",
      "french terry",
      "organic",
      "480 gsm",
      "500 gsm",
    ])
  ) {
    score += 8;
  }
  if (hasKeyword(text, ["oversized", "structured", "tailored", "boxy"])) {
    score += 5;
  }
  if (hasKeyword(text, ["faith", "love story", "signature", "flagship"])) {
    score += 4;
  }

  return Math.min(99, Math.round(score));
}

function computeCampaignScore(
  input: ProductIntelligenceInput,
  text: string,
  capabilityCampaign: boolean,
): number {
  let score = capabilityCampaign ? 72 : 48;

  if (input.imageUrl) score += 10;
  if (input.collections.length >= 2) score += 6;
  if (input.collections.length >= 1) score += 4;
  if ((input.tags?.length ?? 0) >= 2) score += 4;
  if (hasKeyword(text, ["hero", "campaign", "drop", "signature", "faith"])) {
    score += 8;
  }
  if (hasKeyword(text, ["hoodie", "oversized", "premium", "embroidery"])) {
    score += 5;
  }
  if (input.title.split(" ").length >= 2) score += 3;

  return Math.min(99, Math.round(score));
}

function computeEmbroideryPotential(
  text: string,
  embroideryCapable: boolean,
): EmbroideryPotential {
  if (
    hasKeyword(text, [
      "hoodie",
      "cap",
      "beanie",
      "heavyweight",
      "embroidered",
      "embroidery",
    ])
  ) {
    return "High";
  }
  if (embroideryCapable) return "Medium";
  if (hasKeyword(text, ["tee", "t-shirt", "sweatshirt"])) return "Low";
  return "None";
}

function computeCapsuleFit(text: string, collections: string[]): string {
  if (hasKeyword(text, ["winter", "seasonal", "holiday"])) return "Seasonal Drop";
  if (hasKeyword(text, ["premium", "luxury", "heavyweight", "embroidery"])) {
    return "Premium Capsule";
  }
  if (
    collections.some((c) => normalize(c).includes("essential")) ||
    hasKeyword(text, ["essential", "core", "basics"])
  ) {
    return "Essentials";
  }
  if (hasKeyword(text, ["oversized", "streetwear"])) return "Streetwear Core";
  return "Core Collection";
}

function computeTrendFit(text: string): string {
  if (hasKeyword(text, ["oversized", "heavyweight", "premium", "luxury"])) {
    return "Oversized Luxury";
  }
  if (hasKeyword(text, ["minimal", "essentials", "tonal"])) {
    return "Minimal Luxury";
  }
  if (hasKeyword(text, ["embroidery", "3d", "structured cap"])) {
    return "Premium Embroidery";
  }
  if (hasKeyword(text, ["washed", "vintage", "distressed"])) {
    return "Washed Streetwear";
  }
  return "Contemporary Core";
}

function computeCollectionPotential(
  text: string,
  capsuleFit: string,
): CollectionPotential {
  if (capsuleFit === "Seasonal Drop") return "seasonal capsule";
  if (capsuleFit === "Premium Capsule") return "premium capsule";
  if (capsuleFit === "Essentials" || capsuleFit === "Core Collection") {
    return "core collection";
  }
  if (hasKeyword(text, ["limited", "exclusive", "one-off"])) return "standalone";
  return "core collection";
}

function computeHeroPotential(heroProductScore: number): HeroPotential {
  if (heroProductScore >= 85) return "High";
  if (heroProductScore >= 72) return "Medium";
  return "Low";
}

function computeDesignFitScore(streetwearScore: number, premiumScore: number): number {
  return Math.round(streetwearScore * 0.55 + premiumScore * 0.45);
}

function computeHeroProductScore(
  salesScore: number,
  designFitScore: number,
  supplierFit: number,
  campaignPotential: number,
): number {
  return Math.round(
    salesScore * 0.4 +
      designFitScore * 0.2 +
      supplierFit * 0.2 +
      campaignPotential * 0.2,
  );
}

function computeSalesScore(
  performance: ProductPerformanceMetrics | null,
  commerce: CommerceProductRecord | null,
): number {
  if (commerce && commerce.unitsSold > 0) {
    return commerce.commerceScore;
  }
  if (!performance) return 0;
  return Math.round(
    performance.bestsellerScore * 0.45 +
      performance.conversionScore * 0.3 +
      performance.trendScore * 0.25,
  );
}

function deriveBadges(
  intel: Omit<ProductIntelligence, "badges" | "scoreTier">,
): ProductIntelligenceBadge[] {
  const badges: ProductIntelligenceBadge[] = [];
  const perf = intel.performance;

  if (intel.heroPotential === "High" || intel.heroProductScore >= 85) {
    badges.push("HERO PRODUCT");
  }
  if (intel.premiumScore >= 80) badges.push("PREMIUM");
  if (
    intel.embroideryPotential === "High" ||
    intel.embroideryPotential === "Medium"
  ) {
    badges.push("EMBROIDERY READY");
  }
  if (intel.campaignScore >= 85) badges.push("CAMPAIGN READY");
  if (intel.marketPrintSuitability >= 85) badges.push("POD FAVORITE");

  if (perf) {
    if (perf.trendScore >= 78) badges.push("TRENDING");
    if (intel.heroProductScore < 50 && perf.unitsSold <= 1) {
      badges.push("LOW PRIORITY");
    }
  }

  if (intel.commerce && intel.commerce.unitsSold > 0) {
    if (intel.commerce.unitsRank <= 5) badges.push("BESTSELLER");
    if (intel.commerce.repeatPurchase) badges.push("HIGH CONVERSION");
  } else if (perf) {
    if (perf.bestsellerScore >= 80 || perf.salesRank <= 3) badges.push("BESTSELLER");
    if (perf.conversionScore >= 80) badges.push("HIGH CONVERSION");
  }

  if (
    intel.capsuleFit === "Seasonal Drop" ||
    intel.collectionPotential === "seasonal capsule"
  ) {
    badges.push("SEASONAL");
  }

  return badges;
}

export function analyzeProductIntelligence(
  input: ProductIntelligenceInput,
  performance?: ProductPerformanceMetrics | null,
  commerce?: CommerceProductRecord | null,
): ProductIntelligence {
  const text = haystack(input);
  const match = matchProductToMarketPrint({
    title: input.title,
    productType: input.productType,
    tags: input.tags,
    materials: input.materials,
  });
  const price = parsePrice(input.price);
  const { capability } = match;

  const streetwearScore = computeStreetwearScore(
    text,
    capability.streetwearScore,
  );
  const premiumScore = computePremiumScore(text, price, capability.premiumScore);
  const campaignScore = computeCampaignScore(
    input,
    text,
    capability.campaignSuitability,
  );
  const embroideryPotential = computeEmbroideryPotential(
    text,
    capability.embroidery,
  );
  const capsuleFit = computeCapsuleFit(text, input.collections);
  const trendFit = computeTrendFit(text);
  const collectionPotential = computeCollectionPotential(text, capsuleFit);
  const designFitScore = computeDesignFitScore(streetwearScore, premiumScore);
  const salesScore = computeSalesScore(performance ?? null, commerce ?? null);
  const hasCommerceSignal = Boolean(
    (commerce && commerce.unitsSold > 0) || (performance && performance.unitsSold > 0),
  );
  const heroProductScore = hasCommerceSignal
    ? computeHeroProductScore(
        salesScore,
        designFitScore,
        match.suitability,
        campaignScore,
      )
    : Math.round(
        streetwearScore * 0.3 +
          premiumScore * 0.25 +
          campaignScore * 0.25 +
          match.suitability * 0.2,
      );

  const compositeScore = heroProductScore;
  const heroPotential = computeHeroPotential(heroProductScore);
  const productRank = commerce?.unitsRank ?? performance?.salesRank ?? 0;
  const launchPotential =
    performance?.launchPotential ??
    Math.round(campaignScore * 0.5 + designFitScore * 0.3 + match.suitability * 0.2);

  const base: Omit<ProductIntelligence, "badges" | "scoreTier"> = {
    productId: input.id,
    title: input.title,
    category: input.productType,
    price: input.price,
    currency: input.currency,
    streetwearScore,
    premiumScore,
    campaignScore,
    embroideryPotential,
    capsuleFit,
    trendFit,
    collectionPotential,
    heroPotential,
    compositeScore,
    heroProductScore,
    designFitScore,
    marketPrintSuitability: match.suitability,
    productRank,
    launchPotential,
    performance: performance ?? null,
    commerce: commerce ?? null,
  };

  return {
    ...base,
    badges: deriveBadges(base),
    scoreTier: scoreTierFor(heroProductScore),
  };
}

function toInput(product: ShopifyKnowledgeProduct): ProductIntelligenceInput {
  return {
    id: product.id,
    title: product.title,
    productType: product.productType,
    price: product.price,
    currency: product.currency,
    collections: product.collections,
    tags: product.tags,
    materials: product.materials,
    colors: product.colors,
    imageUrl: product.imageUrl,
    inventory: product.inventory,
  };
}

export function buildDesignIntelligenceDashboard(
  products: ShopifyKnowledgeProduct[],
  performanceIntelligence?: ShopifyPerformanceIntelligence,
  commerceIntelligence?: CommerceIntelligence,
): DesignIntelligenceDashboard {
  const scoredProducts = products.map((p) =>
    analyzeProductIntelligence(
      toInput(p),
      performanceIntelligence?.byProductId[p.id] ?? null,
      commerceIntelligence?.byProductId[p.id] ?? null,
    ),
  );

  const byHeroScore = (a: ProductIntelligence, b: ProductIntelligence) =>
    b.heroProductScore - a.heroProductScore;

  const byProductId = new Map(scoredProducts.map((p) => [p.productId, p]));
  const pickPerformanceLeaders = (
    ids: ProductPerformanceMetrics[],
  ): ProductIntelligence[] =>
    ids
      .map((metric) => byProductId.get(metric.productId))
      .filter((p): p is ProductIntelligence => Boolean(p));

  const pickCommerceLeaders = (
    records: CommerceProductRecord[],
  ): ProductIntelligence[] =>
    records
      .map((record) => byProductId.get(record.productId))
      .filter((p): p is ProductIntelligence => Boolean(p));

  const topHeroProducts = commerceIntelligence
    ? pickCommerceLeaders(commerceIntelligence.heroProducts).slice(0, 5)
    : [...scoredProducts]
        .filter((p) => p.heroPotential === "High" || p.badges.includes("HERO PRODUCT"))
        .sort(byHeroScore)
        .slice(0, 5);

  const topProducts = commerceIntelligence
    ? pickCommerceLeaders(commerceIntelligence.topProducts).slice(0, 5)
    : [...scoredProducts].sort(byHeroScore).slice(0, 5);

  const mostPremiumProducts = [...scoredProducts]
    .sort((a, b) => b.premiumScore - a.premiumScore)
    .slice(0, 5);

  const highestCampaignPotential = [...scoredProducts]
    .sort((a, b) => b.campaignScore - a.campaignScore)
    .slice(0, 5);

  const bestEmbroideryCandidates = [...scoredProducts]
    .filter((p) => p.embroideryPotential === "High" || p.embroideryPotential === "Medium")
    .sort((a, b) => {
      const rank = { High: 2, Medium: 1, Low: 0, None: -1 };
      return (
        rank[b.embroideryPotential] - rank[a.embroideryPotential] ||
        b.heroProductScore - a.heroProductScore
      );
    })
    .slice(0, 5);

  const collectionLeaders = commerceIntelligence
    ? pickCommerceLeaders(commerceIntelligence.heroProducts).slice(0, 5)
    : [...scoredProducts]
        .filter((p) => p.heroProductScore >= 75)
        .sort(byHeroScore)
        .slice(0, 5);

  const topProductsResolved = topProducts;

  const topSellers = commerceIntelligence
    ? pickCommerceLeaders(commerceIntelligence.topUnits)
    : performanceIntelligence
      ? pickPerformanceLeaders(performanceIntelligence.topSellers)
      : [...scoredProducts]
          .filter((p) => (p.commerce?.unitsSold ?? p.performance?.unitsSold ?? 0) > 0)
          .sort(
            (a, b) =>
              (b.commerce?.unitsSold ?? b.performance?.unitsSold ?? 0) -
              (a.commerce?.unitsSold ?? a.performance?.unitsSold ?? 0),
          )
          .slice(0, 5);

  const mostRevenue = commerceIntelligence
    ? pickCommerceLeaders(commerceIntelligence.topRevenue)
    : performanceIntelligence
      ? pickPerformanceLeaders(performanceIntelligence.mostRevenue)
      : topSellers;

  const fastestGrowing = performanceIntelligence
    ? pickPerformanceLeaders(performanceIntelligence.fastestGrowing)
    : [...scoredProducts]
        .sort((a, b) => (b.performance?.trendScore ?? 0) - (a.performance?.trendScore ?? 0))
        .slice(0, 5);

  const lowestPerforming = performanceIntelligence
    ? pickPerformanceLeaders(performanceIntelligence.lowestPerforming)
    : [...scoredProducts]
        .sort((a, b) => a.heroProductScore - b.heroProductScore)
        .slice(0, 5);

  const highestPotential = performanceIntelligence
    ? pickPerformanceLeaders(performanceIntelligence.highestPotential)
    : [...scoredProducts]
        .sort((a, b) => b.launchPotential - a.launchPotential)
        .slice(0, 5);

  return {
    topHeroProducts,
    mostPremiumProducts,
    highestCampaignPotential,
    bestEmbroideryCandidates,
    collectionLeaders,
    topProducts: topProductsResolved,
    topSellers,
    mostRevenue,
    fastestGrowing,
    lowestPerforming,
    highestPotential,
    scoredProducts: [...scoredProducts].sort(byHeroScore),
    hasLivePerformance: Boolean(
      commerceIntelligence?.summary.productsWithSales ||
        (performanceIntelligence && performanceIntelligence.summary.productsWithSales > 0),
    ),
    hasCommerceHistory: Boolean(
      commerceIntelligence && commerceIntelligence.summary.totalOrders > 0,
    ),
  };
}

const COLLECTION_OPPORTUNITY_DEFINITIONS = [
  {
    id: "premium-embroidery",
    title: "Premium Embroidery Capsule",
    description: "Embroidered caps, tonal hoodies, 3D logo headwear",
    tags: ["embroidery", "premium"],
    signals: ["embroidery", "cap", "beanie", "premium", "3d"],
  },
  {
    id: "heavyweight-essentials",
    title: "Heavyweight Essentials",
    description: "450gsm+ hoodies, boxy tees, washed black color story",
    tags: ["oversized", "heavyweight"],
    signals: ["heavyweight", "oversized", "essential", "480 gsm", "450 gsm"],
  },
  {
    id: "minimal-luxury",
    title: "Minimal Luxury Collection",
    description: "Clean tees, neutral palette, logo-only graphics",
    tags: ["core", "minimal"],
    signals: ["minimal", "luxury", "essentials", "tonal", "neutral"],
  },
  {
    id: "winter-essentials",
    title: "Winter Essentials",
    description: "Beanies, heavyweight hoodies, layered streetwear core",
    tags: ["seasonal", "essentials"],
    signals: ["winter", "beanie", "hoodie", "seasonal"],
  },
  {
    id: "streetwear-hero",
    title: "Streetwear Hero Drop",
    description: "Oversized silhouettes, campaign-ready hero pieces",
    tags: ["streetwear", "hero"],
    signals: ["oversized", "streetwear", "hero", "campaign"],
  },
] as const;

export function scoreCollectionOpportunities(
  products: ProductIntelligence[],
  commerceIntelligence?: CommerceIntelligence,
): CollectionOpportunityScore[] {
  const catalogText = products.map((p) => normalize(p.title + " " + p.category)).join(" ");
  const categorySales = new Map(
    (commerceIntelligence?.topCategories ?? []).map((c) => [normalize(c.category), c.unitsSold]),
  );
  const avgSalesScore =
    products.length > 0
      ? products.reduce(
          (sum, p) => sum + (p.performance?.bestsellerScore ?? p.heroProductScore * 0.5),
          0,
        ) / products.length
      : 0;

  return COLLECTION_OPPORTUNITY_DEFINITIONS.map((def) => {
    let confidence = 68;
    const matchedSignals = def.signals.filter((s) => catalogText.includes(normalize(s)));
    confidence += matchedSignals.length * 5;

    for (const [category, units] of categorySales) {
      if (def.signals.some((signal) => category.includes(normalize(signal)))) {
        confidence += Math.min(18, Math.round(units / 20));
      }
    }

    const relevantProducts = products.filter((p) =>
      def.signals.some((s) =>
        normalize(p.title + " " + p.category + " " + p.trendFit).includes(normalize(s)),
      ),
    );
    if (relevantProducts.length > 0) {
      const avg =
        relevantProducts.reduce((sum, p) => sum + p.heroProductScore, 0) /
        relevantProducts.length;
      const salesAvg =
        relevantProducts.reduce(
          (sum, p) =>
            sum +
            (p.commerce?.commerceScore ??
              p.performance?.bestsellerScore ??
              avgSalesScore),
          0,
        ) / relevantProducts.length;
      confidence = Math.round(confidence * 0.25 + avg * 0.45 + salesAvg * 0.3);
    }

    return {
      id: def.id,
      title: def.title,
      description: def.description,
      tags: [...def.tags],
      confidence: Math.min(98, Math.max(72, confidence)),
    };
  }).sort((a, b) => b.confidence - a.confidence);
}

export function formatScoreTierClass(tier: ScoreTier): string {
  return `design-intel-tier-${tier}`;
}

export function formatIntelligenceSummary(product: ProductIntelligence): string {
  const perf = product.performance;
  const commerce = product.commerce;
  const perfLine = commerce
    ? `All-time ${commerce.unitsSold} units · ${commerce.revenue} ${commerce.currency} · rank #${commerce.unitsRank}`
    : perf
      ? `Revenue ${perf.revenue} ${perf.currency} · ${perf.unitsSold} units · rank #${perf.salesRank}`
      : "No Shopify sales yet";

  return [
    perfLine,
    `Hero ${product.heroProductScore}%`,
    `Streetwear ${product.streetwearScore}%`,
    `Premium ${product.premiumScore}%`,
    `Campaign ${product.campaignScore}%`,
    `Launch ${product.launchPotential}%`,
    `Embroidery ${product.embroideryPotential}`,
    `Collection Fit: ${product.capsuleFit}`,
    `Trend Fit: ${product.trendFit}`,
  ].join(" · ");
}
