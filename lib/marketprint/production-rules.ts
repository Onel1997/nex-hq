import type { AgentId } from "@/lib/constants/agents";
import {
  CAMPAIGN_SUITABILITY_THRESHOLD,
  MILAENE_MIN_PREMIUM_SCORE,
  MILAENE_MIN_SUITABILITY,
} from "@/lib/marketprint/marketprint-profile";
import type { MarketPrintIntelligence } from "@/lib/marketprint/load-marketprint-context";
import {
  formatSuitabilityLabel,
  getCampaignProducts,
  getEmbroideryProducts,
  getPremiumProducts,
  MARKETPRINT_CATEGORIES,
  MARKETPRINT_PRODUCTS,
  type MarketPrintProductMatch,
} from "@/lib/marketprint/product-capabilities";

export const MARKETPRINT_DECISION_FRAMEWORK = [
  "1. Can MarketPrint produce this?",
  "2. Does this fit Milaene?",
  "3. Is this premium enough?",
  "4. Is this suitable for campaigns?",
  "Only if MarketPrint cannot support it should NexOS recommend another supplier.",
] as const;

export function evaluateProductionFit(match: MarketPrintProductMatch): {
  canProduce: boolean;
  fitsMilaene: boolean;
  premiumEnough: boolean;
  campaignReady: boolean;
  recommendExternal: boolean;
} {
  const { capability, suitability, externalSupplierRecommended } = match;

  return {
    canProduce: suitability >= MILAENE_MIN_SUITABILITY && !externalSupplierRecommended,
    fitsMilaene: capability.streetwearScore >= 7,
    premiumEnough: capability.premiumScore >= MILAENE_MIN_PREMIUM_SCORE,
    campaignReady:
      capability.campaignSuitability &&
      suitability >= CAMPAIGN_SUITABILITY_THRESHOLD,
    recommendExternal: externalSupplierRecommended || suitability < MILAENE_MIN_SUITABILITY,
  };
}

/** Agent-specific MarketPrint production rules. */
export function formatAgentMarketPrintRules(agentId: AgentId): string {
  const premiumList = getPremiumProducts()
    .slice(0, 6)
    .map((p) => p.name)
    .join(", ");
  const embroideryList = getEmbroideryProducts()
    .slice(0, 5)
    .map((p) => p.name)
    .join(", ");
  const campaignList = getCampaignProducts()
    .slice(0, 5)
    .map((p) => p.name)
    .join(", ");

  switch (agentId) {
    case "designer":
      return [
        "## MARKETPRINT CONTEXT (Design)",
        "- Prioritize MarketPrint products for all collection concepts.",
        "- Avoid impossible products outside MarketPrint catalog.",
        `- Supported categories: ${MARKETPRINT_CATEGORIES.join(", ")}.`,
        `- Premium blanks: ${premiumList}.`,
        "- Output must include MarketPrint suitability score (0–100) per product.",
        "- Recommend secondary suppliers only when MarketPrint cannot produce the category.",
        ...MARKETPRINT_DECISION_FRAMEWORK.map((r) => `- ${r}`),
      ].join("\n");

    case "image":
      return [
        "## MARKETPRINT CONTEXT (Image)",
        "- Mockups must reflect actual MarketPrint materials and production methods.",
        `- Embroidery products: ${embroideryList}.`,
        `- Premium products: ${premiumList}.`,
        "- Image prompts must include: material, printing method, embroidery (yes/no), product category.",
        "- No visuals implying unavailable techniques or non-MarketPrint garments.",
      ].join("\n");

    case "marketing":
      return [
        "## MARKETPRINT CONTEXT (Marketing)",
        "- Identify hero products, premium products, campaign products, and best visual products.",
        `- Campaign-ready MarketPrint products: ${campaignList}.`,
        `- Premium assortment: ${premiumList}.`,
        "- Lead campaigns with highest MarketPrint suitability scores.",
        "- External supplier only when MarketPrint suitability is below 70%.",
      ].join("\n");

    case "ceo":
      return [
        "## MARKETPRINT CONTEXT (CEO)",
        "- Analyze strongest MarketPrint products, missing categories, expansion and premium opportunities.",
        `- MarketPrint categories: ${MARKETPRINT_CATEGORIES.join(", ")}.`,
        "- Missing category gaps should map to MarketPrint first, then secondary suppliers.",
        "- Luxury outerwear and non-POD categories → external supplier recommended.",
        ...MARKETPRINT_DECISION_FRAMEWORK.map((r) => `- ${r}`),
      ].join("\n");

    case "shopify":
      return [
        "## MARKETPRINT CONTEXT (Shopify)",
        "- Default production intelligence to MarketPrint.",
        "- Surface premium, embroidery, campaign, and streetwear suitability per product.",
        "- Show MarketPrint suitability % in commerce insights.",
        formatSuitabilityLabel(95) + " — Heavyweight Hoodie (example).",
        "External supplier recommended — luxury outerwear (example).",
      ].join("\n");

    default:
      return [
        "## MARKETPRINT CONTEXT",
        "- MarketPrint is the default production system for Milaene.",
        ...MARKETPRINT_DECISION_FRAMEWORK.map((r) => `- ${r}`),
      ].join("\n");
  }
}

export function formatMarketPrintPrompt(): string {
  const productLines = MARKETPRINT_PRODUCTS.map(
    (p) =>
      `- ${p.name} (${p.category}): premium ${p.premiumScore}/10 · streetwear ${p.streetwearScore}/10 · embroidery ${p.embroidery ? "yes" : "no"} · print ${p.printing ? "yes" : "no"} · ${p.recommendedUse}`,
  ).join("\n");

  return [
    "## MARKETPRINT INTELLIGENCE",
    "",
    "Primary supplier: MarketPrint Print On Demand",
    "Production: Print On Demand · On demand · Supplier managed fulfillment",
    "Warehouse: None",
    "",
    "Supported categories:",
    MARKETPRINT_CATEGORIES.map((c) => `- ${c}`).join("\n"),
    "",
    "Product capabilities:",
    productLines,
    "",
    "Production decision framework:",
    ...MARKETPRINT_DECISION_FRAMEWORK.map((r) => `- ${r}`),
    "",
    "Examples:",
    `- Heavyweight Hoodie: ${formatSuitabilityLabel(95)}`,
    `- Premium embroidered cap: ${formatSuitabilityLabel(92)}`,
    "- Luxury outerwear: External supplier recommended.",
  ].join("\n");
}

/** Live Shopify catalog matched against MarketPrint production capabilities. */
export function formatMarketPrintCatalogIntelligence(
  intelligence: MarketPrintIntelligence,
): string {
  const { summary, topStreetwear, premiumProducts, campaignProducts, externalSupplierRecommended } =
    intelligence;

  const lines = [
    "## MARKETPRINT LIVE CATALOG INTELLIGENCE",
    "",
    `Catalog products analyzed: ${summary.catalogProducts}`,
    `Matched at 70%+ suitability: ${summary.matchedProducts}`,
    `Average suitability: ${summary.averageSuitability}%`,
    `Premium: ${summary.premiumCount} · Embroidery: ${summary.embroideryCount} · Campaign-ready: ${summary.campaignCount}`,
    "",
  ];

  if (topStreetwear.length > 0) {
    lines.push("Top streetwear production matches:");
    for (const item of topStreetwear.slice(0, 8)) {
      lines.push(
        `- ${item.title}: ${formatSuitabilityLabel(item.match.suitability)} · ${item.match.capability.category} · streetwear ${item.match.capability.streetwearScore}/10`,
      );
    }
    lines.push("");
  }

  if (premiumProducts.length > 0) {
    lines.push("Premium catalog matches:");
    for (const item of premiumProducts.slice(0, 6)) {
      lines.push(
        `- ${item.title}: ${formatSuitabilityLabel(item.match.suitability)} · premium ${item.match.capability.premiumScore}/10`,
      );
    }
    lines.push("");
  }

  if (campaignProducts.length > 0) {
    lines.push("Campaign-ready catalog matches:");
    for (const item of campaignProducts.slice(0, 6)) {
      lines.push(`- ${item.title}: ${formatSuitabilityLabel(item.match.suitability)}`);
    }
    lines.push("");
  }

  if (externalSupplierRecommended.length > 0) {
    lines.push("External supplier recommended:");
    for (const item of externalSupplierRecommended.slice(0, 4)) {
      lines.push(`- ${item.title}: ${item.match.matchReason}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export type FacilityMarketPrintSection = {
  title: string;
  lines: string[];
};

export function getFacilityMarketPrintSections(): Partial<
  Record<AgentId, FacilityMarketPrintSection[]>
> {
  const premium = getPremiumProducts().map((p) => p.name);
  const embroidery = getEmbroideryProducts().map((p) => p.name);
  const campaign = getCampaignProducts()
    .filter((p) => p.premiumScore >= 8)
    .map((p) => p.name);

  return {
    ceo: [
      {
        title: "Production Overview",
        lines: [
          "Primary: MarketPrint Print On Demand",
          `Premium products: ${premium.slice(0, 4).join(", ")}`,
          `Missing expansion: verify Accessories & Embroidery depth`,
          "Luxury outerwear → external supplier",
        ],
      },
    ],
    designer: [
      {
        title: "Available Production Capabilities",
        lines: [
          ...MARKETPRINT_CATEGORIES.slice(0, 6).map((c) => c),
          `Embroidery: ${embroidery.slice(0, 3).join(", ")}`,
          "Output: MarketPrint suitability score per product",
        ],
      },
    ],
    image: [
      {
        title: "Visual Production Recommendations",
        lines: [
          "Include: material, print method, embroidery, category",
          `Premium visuals: ${premium.slice(0, 3).join(", ")}`,
          `Embroidery mockups: ${embroidery.slice(0, 3).join(", ")}`,
          "Avoid non-MarketPrint garment types in mockups",
        ],
      },
    ],
    shopify: [
      {
        title: "MarketPrint Intelligence",
        lines: [
          `Premium: ${premium.length} product types`,
          `Embroidery: ${embroidery.length} product types`,
          `Campaign-ready: ${campaign.length} hero products`,
          "Streetwear score + suitability on catalog match",
        ],
      },
    ],
    marketing: [
      {
        title: "Campaign Production",
        lines: [
          `Hero products: ${campaign.slice(0, 4).join(", ")}`,
          `Premium focus: ${premium.slice(0, 3).join(", ")}`,
          "Best visuals: heavyweight hoodies, embroidered caps",
        ],
      },
    ],
  };
}
