/**
 * Competitor Intelligence — landscape, watchlist, differentiation, signals.
 */

export type CompetitorTier = "direct" | "aspirational" | "emerging" | "watchlist";

export interface CompetitorProfile {
  name: string;
  tier: CompetitorTier;
  positioning?: string;
  strengths?: string[];
  weaknesses?: string[];
  dropCadence?: string;
  channels?: string[];
  lastObservedAt?: string;
}

export interface MarketSignal {
  signal: string;
  source?: string;
  observedAt: string;
  relevance: "high" | "medium" | "low";
}

export interface CompetitorIntelligenceContent {
  kind: "competitor_intelligence";
  competitors: CompetitorProfile[];
  competitiveEdge?: string;
  marketSignals?: MarketSignal[];
  analysisSummary?: string;
  recommendedActions?: string[];
}
