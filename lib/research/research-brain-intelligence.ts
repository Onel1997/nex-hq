import "server-only";

import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import { MILAENE_DNA } from "@/services/milaene-dna";
import { getActiveSourceLabels, getReadySourceLabels } from "@/services/data-sources";
import { analyzeProducts } from "@/services/productAnalyzer";
import type { ConnectorIntelligenceScores } from "@/services/connectors";
import type { AiRecommendation, ResearchOpportunity } from "@/services/opportunityEngine";
import type { LiveSignal } from "@/services/signalEngine";
import { formatTrendChange, type TrendScore } from "@/services/trendScanner";

export type {
  AiRecommendation,
  LiveSignal,
  ResearchOpportunity,
  TrendScore,
};

export interface ResearchBrandBrain {
  style: string;
  audience: string;
  colors: string[];
  positioning: string;
  silhouettes: string[];
  fulfillment: string;
  quality: string;
}

export interface ResearchMarketBrain {
  trends: string[];
  demand: string[];
  colors: string[];
  categories: string[];
  sources: string[];
}

export interface ResearchCompetitorBrain {
  name: string;
  status: "watching" | "tracked" | "analyzing" | "stable";
  trendChange: string;
  signal: string;
  positioning: string;
  styleDirection: string;
  growth: string;
  newCollections: string;
  marketMovement: string;
}

export interface ResearchProductBrain {
  bestsellers: string[];
  weakProducts: string[];
  opportunities: string[];
  categories: string[];
  colors: string[];
  salesTrends: string[];
  podProducts: string[];
}

export interface ResearchPodBrain {
  primarySupplier: string;
  secondarySuppliers: string[];
  availableProducts: number;
  newProducts: string[];
  marketPrintMatches: number;
  embroideryReady: number;
}

export interface ResearchKnowledgeBrain {
  recentlyUsed: string[];
  savedInsights: string[];
  lastAnalysis: string;
  reportCount: number;
  trendReportCount: number;
  competitorCount: number;
  signalCount: number;
}

export interface MarketSignalCard {
  id: string;
  label: string;
  active: boolean;
}

export interface ConnectorIntelligenceSnapshot {
  id: string;
  label: string;
  mode: "live" | "simulated";
  socialScore: number;
  demandScore: number;
  trendScore: number;
  confidence: number;
}

export interface ResearchBrainSnapshot {
  loadedAt: string;
  commerceConnected: boolean;
  brand: ResearchBrandBrain;
  market: ResearchMarketBrain;
  competitors: ResearchCompetitorBrain[];
  products: ResearchProductBrain;
  pod: ResearchPodBrain;
  opportunities: ResearchOpportunity[];
  trendScores: TrendScore[];
  marketSignals: MarketSignalCard[];
  knowledge: ResearchKnowledgeBrain;
  signals: LiveSignal[];
  recommendation: AiRecommendation;
  connectorIntelligence: {
    scores: ConnectorIntelligenceScores;
    connectors: ConnectorIntelligenceSnapshot[];
  };
}

function buildBrandBrain(): ResearchBrandBrain {
  return {
    style: MILAENE_DNA.style,
    audience: MILAENE_DNA.audience,
    positioning: MILAENE_DNA.positioning,
    colors: MILAENE_DNA.colors.map(
      (c) => c.charAt(0).toUpperCase() + c.slice(1),
    ),
    silhouettes: [...MILAENE_DNA.silhouettes],
    fulfillment: MILAENE_DNA.fulfillment,
    quality: MILAENE_DNA.quality,
  };
}

function buildMarketBrain(
  trends: TrendScore[],
  products: ReturnType<typeof analyzeProducts>,
  baseline?: MilaeneCommerceBaseline | null,
): ResearchMarketBrain {
  const trendLabels = trends
    .filter((t) => t.direction === "up")
    .slice(0, 4)
    .map((t) => `${t.label} ${formatTrendChange(t)} — DNA ${t.dnaMatch}%`);

  const demandSignals = products.salesTrends.slice(0, 4);

  return {
    trends:
      trendLabels.length > 0
        ? trendLabels
        : [
            "Oversized +18%",
            "Earth Tones +22%",
            "Premium Streetwear +15%",
            "Embroidery +12%",
          ],
    demand:
      demandSignals.length > 0
        ? demandSignals
        : [
            "Faith Oversized Tee — Top-Nachfrage",
            "Dream Oversized Tee — stabil",
            "Heavy Hoodies — Wachstumspotenzial",
            "Earth tone palette — steigende Suche",
          ],
    colors: products.colors,
    categories: products.categories,
    sources: baseline
      ? [...getReadySourceLabels()]
      : getReadySourceLabels(),
  };
}

function buildPodBrain(baseline?: MilaeneCommerceBaseline | null): ResearchPodBrain {
  if (!baseline) {
    return {
      primarySupplier: "MarketPrint Print On Demand",
      secondarySuppliers: ["Shirtee Cloud", "Printful", "Brandsky"],
      availableProducts: 0,
      newProducts: ["Premium Hoodie", "Oversized Tee", "Embroidery Crewneck"],
      marketPrintMatches: 0,
      embroideryReady: 0,
    };
  }

  const { productKnowledge, marketPrintIntelligence } = baseline;

  return {
    primarySupplier: baseline.businessMeta.primarySupplier,
    secondarySuppliers: ["Shirtee Cloud", "Printful", "Brandsky", "Brand Canyon"],
    availableProducts: productKnowledge.productCount,
    newProducts: analyzeProducts({ baseline }).podProducts,
    marketPrintMatches: marketPrintIntelligence.summary.matchedProducts,
    embroideryReady: marketPrintIntelligence.summary.embroideryCount,
  };
}

function buildMarketSignalCards(trends: TrendScore[]): MarketSignalCard[] {
  return [
    {
      id: "streetwear",
      label: "Streetwear Trend Rising",
      active: trends.some((t) => /streetwear|premium/i.test(t.label) && t.direction === "up"),
    },
    {
      id: "earth-tones",
      label: "Earth Tones Growing",
      active: trends.some((t) => /earth/i.test(t.label) && t.direction === "up"),
    },
    {
      id: "oversized",
      label: "Oversized Demand",
      active: trends.some((t) => /oversized|boxy/i.test(t.label) && t.direction === "up"),
    },
    {
      id: "premium",
      label: "Premium Segment Expanding",
      active: trends.some((t) => /premium|embroidery/i.test(t.label) && t.direction === "up"),
    },
  ];
}

function buildConnectorIntelligence(
  bundle: Awaited<ReturnType<typeof import("@/services/researchEngine").loadResearchIntelligence>>,
): ResearchBrainSnapshot["connectorIntelligence"] {
  const { external, connectorScores } = bundle.signalLayers;

  const connectors: ConnectorIntelligenceSnapshot[] = [
    {
      id: "google_trends",
      label: "Google Trends",
      mode: external.googleTrends.mode,
      socialScore: external.googleTrends.scores?.socialScore ?? 0,
      demandScore: external.googleTrends.scores?.demandScore ?? 0,
      trendScore: external.googleTrends.scores?.trendScore ?? 0,
      confidence: external.googleTrends.scores?.confidence ?? 0,
    },
    {
      id: "reddit",
      label: "Reddit",
      mode: external.reddit.mode,
      socialScore: external.reddit.scores?.socialScore ?? 0,
      demandScore: external.reddit.scores?.demandScore ?? 0,
      trendScore: external.reddit.scores?.trendScore ?? 0,
      confidence: external.reddit.scores?.confidence ?? 0,
    },
  ];

  return { scores: connectorScores, connectors };
}

async function composeSnapshot(
  bundle: Awaited<ReturnType<typeof import("@/services/researchEngine").loadResearchIntelligence>>,
): Promise<ResearchBrainSnapshot> {
  const { products, trends, competitors, opportunities, knowledge, recommendation, signals, baseline } =
    bundle;

  return {
    loadedAt: bundle.loadedAt,
    commerceConnected: bundle.commerceConnected,
    brand: buildBrandBrain(),
    market: buildMarketBrain(trends, products, baseline),
    competitors: competitors.map((c) => ({
      name: c.name,
      status: c.status,
      trendChange: c.trendChange,
      signal: c.signal,
      positioning: c.positioning,
      styleDirection: c.styleDirection,
      growth: c.growth,
      newCollections: c.newCollections,
      marketMovement: c.marketMovement,
    })),
    products,
    pod: buildPodBrain(baseline),
    opportunities,
    trendScores: trends,
    marketSignals: buildMarketSignalCards(trends),
    knowledge,
    signals,
    recommendation,
    connectorIntelligence: buildConnectorIntelligence(bundle),
  };
}

/** Aggregate Milaene brand, commerce, POD and market intelligence for Research HQ. */
export async function loadResearchBrainIntelligence(): Promise<ResearchBrainSnapshot> {
  const { loadResearchIntelligence } = await import("@/services/researchEngine");
  const bundle = await loadResearchIntelligence();
  return composeSnapshot(bundle);
}
