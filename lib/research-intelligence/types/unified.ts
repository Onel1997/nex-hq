import type { BrandIntelligence } from "./brand";
import type { CommercialIntelligence } from "./commercial";
import type { ConfidenceIntelligence } from "./confidence";
import type { MarketIntelligence } from "./market";
import type { ProviderContributionManifest } from "./provider-source";
import type { RecommendationIntelligence } from "./recommendation";
import type { NormalizedSignal } from "./signals";
import type { TrendIntelligence } from "./trends";

export const UNIFIED_INTELLIGENCE_VERSION = "5.0.0";

export interface FusionManifest {
  engineVersion: string;
  generatedAt: string;
  providerCount: number;
  liveProviderCount: number;
  simulatedProviderCount: number;
  contributions: ProviderContributionManifest[];
}

/**
 * Single canonical intelligence object produced by the Fusion Engine.
 * Will later power Research Studio, CEO Command, Commerce Lab, Marketing,
 * Shopify Operations, and Performance Intelligence.
 */
export interface UnifiedResearchIntelligence {
  version: typeof UNIFIED_INTELLIGENCE_VERSION;
  generatedAt: string;
  manifest: FusionManifest;
  signals: NormalizedSignal[];
  trends: TrendIntelligence;
  market: MarketIntelligence;
  commercial: CommercialIntelligence;
  brand: BrandIntelligence;
  /**
   * Slot reserved for Phase 5.1+ confidence scoring.
   * Not computed in Phase 5.0.
   */
  confidence: ConfidenceIntelligence;
  /**
   * Slot reserved for Phase 5.2+ recommendation engine.
   * Not generated in Phase 5.0.
   */
  recommendations: RecommendationIntelligence;
}
