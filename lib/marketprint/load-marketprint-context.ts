import type { AgentId } from "@/lib/constants/agents";
import type { ShopifyKnowledgeProduct } from "@/lib/shopify/types";
import { MARKETPRINT_PROFILE } from "@/lib/marketprint/marketprint-profile";
import {
  getCampaignProducts,
  getEmbroideryProducts,
  getPremiumProducts,
  matchProductToMarketPrint,
  type MarketPrintProductMatch,
} from "@/lib/marketprint/product-capabilities";
import { MARKETPRINT_MATERIALS } from "@/lib/marketprint/material-library";
import {
  evaluateProductionFit,
  formatAgentMarketPrintRules,
  formatMarketPrintPrompt,
  getFacilityMarketPrintSections,
  type FacilityMarketPrintSection,
} from "@/lib/marketprint/production-rules";

export type MarketPrintCatalogMatch = {
  productId: string;
  title: string;
  productType: string;
  match: MarketPrintProductMatch;
  fit: ReturnType<typeof evaluateProductionFit>;
};

export type MarketPrintIntelligence = {
  profile: typeof MARKETPRINT_PROFILE;
  premiumProductTypes: ReturnType<typeof getPremiumProducts>;
  embroideryProductTypes: ReturnType<typeof getEmbroideryProducts>;
  campaignProductTypes: ReturnType<typeof getCampaignProducts>;
  materials: typeof MARKETPRINT_MATERIALS;
  catalogMatches: MarketPrintCatalogMatch[];
  premiumProducts: MarketPrintCatalogMatch[];
  embroideryProducts: MarketPrintCatalogMatch[];
  campaignProducts: MarketPrintCatalogMatch[];
  topStreetwear: MarketPrintCatalogMatch[];
  externalSupplierRecommended: MarketPrintCatalogMatch[];
  summary: {
    catalogProducts: number;
    matchedProducts: number;
    averageSuitability: number;
    premiumCount: number;
    embroideryCount: number;
    campaignCount: number;
  };
  commerceExamples: Array<{ label: string; message: string }>;
};

export type MarketPrintContext = {
  intelligence: MarketPrintIntelligence;
  prompt: string;
  facilitySections: Partial<Record<AgentId, FacilityMarketPrintSection[]>>;
};

function toCatalogMatch(product: ShopifyKnowledgeProduct): MarketPrintCatalogMatch {
  const match = matchProductToMarketPrint({
    title: product.title,
    productType: product.productType,
    tags: product.tags,
    materials: product.materials,
  });

  return {
    productId: product.id,
    title: product.title,
    productType: product.productType,
    match,
    fit: evaluateProductionFit(match),
  };
}

export function buildMarketPrintIntelligence(
  products: ShopifyKnowledgeProduct[] = [],
): MarketPrintIntelligence {
  const active = products.filter((p) => p.status === "ACTIVE");
  const catalogMatches = active.map(toCatalogMatch);

  const premiumProducts = catalogMatches.filter(
    (m) => m.fit.premiumEnough && m.match.suitability >= 70,
  );
  const embroideryProducts = catalogMatches.filter(
    (m) => m.match.capability.embroidery && m.match.suitability >= 70,
  );
  const campaignProducts = catalogMatches.filter((m) => m.fit.campaignReady);
  const topStreetwear = [...catalogMatches]
    .filter((m) => !m.match.externalSupplierRecommended)
    .sort(
      (a, b) =>
        b.match.capability.streetwearScore - a.match.capability.streetwearScore ||
        b.match.suitability - a.match.suitability,
    )
    .slice(0, 8);
  const externalSupplierRecommended = catalogMatches.filter(
    (m) => m.match.externalSupplierRecommended,
  );

  const averageSuitability =
    catalogMatches.length > 0
      ? Math.round(
          catalogMatches.reduce((sum, m) => sum + m.match.suitability, 0) /
            catalogMatches.length,
        )
      : 0;

  return {
    profile: MARKETPRINT_PROFILE,
    premiumProductTypes: getPremiumProducts(),
    embroideryProductTypes: getEmbroideryProducts(),
    campaignProductTypes: getCampaignProducts(),
    materials: MARKETPRINT_MATERIALS,
    catalogMatches,
    premiumProducts,
    embroideryProducts,
    campaignProducts,
    topStreetwear,
    externalSupplierRecommended,
    summary: {
      catalogProducts: active.length,
      matchedProducts: catalogMatches.filter((m) => m.match.suitability >= 70).length,
      averageSuitability,
      premiumCount: premiumProducts.length,
      embroideryCount: embroideryProducts.length,
      campaignCount: campaignProducts.length,
    },
    commerceExamples: [
      {
        label: "Heavyweight Hoodie",
        message: "MarketPrint suitability 95%",
      },
      {
        label: "Premium embroidered cap",
        message: "MarketPrint suitability 92%",
      },
      {
        label: "Luxury outerwear",
        message: "External supplier recommended.",
      },
    ],
  };
}

/** Load MarketPrint context — optionally enriched with live Shopify catalog. */
export function loadMarketPrintContext(
  products?: ShopifyKnowledgeProduct[],
): MarketPrintContext {
  return {
    intelligence: buildMarketPrintIntelligence(products),
    prompt: formatMarketPrintPrompt(),
    facilitySections: getFacilityMarketPrintSections(),
  };
}

export async function loadMarketPrintContextAsync(
  products?: ShopifyKnowledgeProduct[],
): Promise<MarketPrintContext> {
  return loadMarketPrintContext(products);
}

export {
  formatAgentMarketPrintRules,
  formatMarketPrintPrompt,
  getFacilityMarketPrintSections,
  matchProductToMarketPrint,
  evaluateProductionFit,
};
