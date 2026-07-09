import { computeConfidenceIntelligence } from "../confidence/engine";
import { generateRecommendations } from "../recommendation/engine";
import { computeResearchReasoning } from "../reasoning/engine";
import type { ConfidenceIntelligence } from "../types/confidence";
import type { RecommendationIntelligence } from "../types/recommendation";
import type { ResearchReasoningIntelligence } from "../types/reasoning";
import type { UnifiedResearchIntelligence } from "../types/unified";

export const EVALUATION_LAYER_VERSION = "5.2.0";

export interface EvaluationContext {
  workspaceId?: string;
  locale?: string;
  generatedAt: string;
}

export interface EvaluatedResearchIntelligence {
  intelligence: UnifiedResearchIntelligence;
  confidence: ConfidenceIntelligence;
  reasoning: ResearchReasoningIntelligence;
  recommendations: RecommendationIntelligence;
}

/**
 * Full evaluation pass — confidence scoring, reasoning, and recommendations.
 * Deterministic only. No LLM calls.
 */
export function evaluateResearchIntelligence(
  intelligence: UnifiedResearchIntelligence,
  context?: Partial<EvaluationContext>,
): EvaluatedResearchIntelligence {
  const generatedAt = context?.generatedAt ?? intelligence.generatedAt;
  const confidence = computeConfidenceIntelligence(intelligence);
  const withConfidence: UnifiedResearchIntelligence = {
    ...intelligence,
    confidence,
  };
  const reasoning = computeResearchReasoning(withConfidence, confidence, {
    workspaceId: context?.workspaceId,
    locale: context?.locale,
    generatedAt,
  });
  const recommendations = generateRecommendations({
    intelligence: withConfidence,
    reasoning,
    generatedAt,
  });

  return {
    intelligence: {
      ...withConfidence,
      recommendations,
    },
    confidence,
    reasoning,
    recommendations,
  };
}

export function enrichIntelligenceWithConfidence(
  intelligence: UnifiedResearchIntelligence,
  context?: Partial<EvaluationContext>,
): UnifiedResearchIntelligence {
  return evaluateResearchIntelligence(intelligence, context).intelligence;
}
