import type { RecommendationIntelligence } from "../types/recommendation";
import type { ResearchReasoningIntelligence } from "../types/reasoning";
import type { UnifiedResearchIntelligence } from "../types";
import { generateRecommendations } from "./engine";

/**
 * Recommendation engine contract — Phase 5.2.
 */
export interface RecommendationContext {
  workspaceId?: string;
  audiences?: string[];
  generatedAt: string;
}

export interface RecommendationEngine {
  recommend(
    intelligence: UnifiedResearchIntelligence,
    reasoning: ResearchReasoningIntelligence,
    context: RecommendationContext,
  ): RecommendationIntelligence;
}

export const RECOMMENDATION_ENGINE_VERSION = "5.2.0";

export const defaultRecommendationEngine: RecommendationEngine = {
  recommend(intelligence, reasoning, context) {
    return generateRecommendations({
      intelligence,
      reasoning,
      generatedAt: context.generatedAt,
    });
  },
};

export {
  enrichIntelligenceWithRecommendations,
  generateRecommendations,
} from "./engine";
