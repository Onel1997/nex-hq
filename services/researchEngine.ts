import "server-only";

import { loadMilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { TrendIntelligence } from "@/lib/research/types";
import { scanCompetitors, type CompetitorIntel } from "@/services/competitorScanner";
import type { ExternalIntelligence } from "@/services/connectors";
import {
  getResolvedDataSources,
  type DataSourceConnector,
} from "@/services/data-sources";
import { loadKnowledgeBase, type KnowledgeSnapshot } from "@/services/knowledgeEngine";
import {
  generateAiRecommendation,
  generateOpportunities,
  type AiRecommendation,
  type ResearchOpportunity,
} from "@/services/opportunityEngine";
import { analyzeProducts, type ProductIntelligence } from "@/services/productAnalyzer";
import {
  aggregateSignals,
  type AggregatedSignals,
} from "@/services/signalAggregator";
import { generateLiveSignals, type LiveSignal } from "@/services/signalEngine";
import { analyzeTrendIntelligence } from "@/services/trendIntelligence";
import { scanTrends, type TrendScore } from "@/services/trendScanner";

export interface ResearchIntelligenceBundle {
  loadedAt: string;
  commerceConnected: boolean;
  storeDomain: string;
  dataSources: DataSourceConnector[];
  products: ProductIntelligence;
  trends: TrendScore[];
  trendIntelligence: TrendIntelligence;
  competitors: CompetitorIntel[];
  opportunities: ResearchOpportunity[];
  recommendation: AiRecommendation;
  signals: LiveSignal[];
  signalLayers: AggregatedSignals;
  external: ExternalIntelligence;
  knowledge: KnowledgeSnapshot;
  baseline: MilaeneCommerceBaseline | null;
}

async function composeBundle(
  baseline: MilaeneCommerceBaseline | null,
): Promise<ResearchIntelligenceBundle> {
  const products = analyzeProducts({ baseline });
  const trends = scanTrends({ baseline });
  const trendIntelligence = analyzeTrendIntelligence({ trendScores: trends, baseline });
  const competitors = scanCompetitors();

  const signalLayers = await aggregateSignals({
    products,
    trends,
    competitors,
    baseline,
    region: "DE",
  });

  const opportunities = generateOpportunities({
    products,
    trends,
    competitors,
    signals: signalLayers,
  });

  const knowledge = await loadKnowledgeBase();
  const recommendation = generateAiRecommendation(opportunities, trends);

  const signals = generateLiveSignals({
    trends,
    competitors,
    opportunities,
    products,
    baseline,
    aggregated: signalLayers,
    commerceActivity: baseline?.activity.slice(0, 5).map((a) => ({
      message: a.label,
      time: a.time,
    })),
  });

  return {
    loadedAt: new Date().toISOString(),
    commerceConnected: baseline != null,
    storeDomain: baseline?.storeDomain ?? "",
    dataSources: getResolvedDataSources(),
    products,
    trends,
    trendIntelligence,
    competitors,
    opportunities,
    recommendation,
    signals,
    signalLayers,
    external: signalLayers.external,
    knowledge,
    baseline,
  };
}

/** Load full Milaene research intelligence from all connected data sources. */
export async function loadResearchIntelligence(): Promise<ResearchIntelligenceBundle> {
  try {
    const baseline = await loadMilaeneCommerceBaseline();
    return composeBundle(baseline);
  } catch (error) {
    console.warn("[Research Engine] Commerce baseline unavailable", error);
    return composeBundle(null);
  }
}
