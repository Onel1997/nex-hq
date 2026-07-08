import type { UnifiedResearchIntelligence } from "../types";
import type { RecommendationIntelligence } from "../types/recommendation";

/**
 * Recommendation engine contract — Phase 5.2+.
 *
 * Consumes fused (+ optionally reasoned) intelligence and produces
 * actionable recommendations for downstream Studios. Not implemented in Phase 5.0.
 */
export interface RecommendationContext {
  workspaceId?: string;
  audiences?: string[];
  generatedAt: string;
}

export interface RecommendationEngine {
  recommend(
    intelligence: UnifiedResearchIntelligence,
    context: RecommendationContext,
  ): RecommendationIntelligence;
}

/** Stub — recommendations not generated in Phase 5.0. */
export const RECOMMENDATION_ENGINE_VERSION = "5.0.0-stub";
