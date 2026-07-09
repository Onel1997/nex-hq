/**
 * Recommendation model contracts — Phase 5.2.
 * Deterministic, evidence-backed fashion research recommendations.
 */

export const RECOMMENDATION_ENGINE_MODEL_VERSION = "5.2.0";

export type RecommendationPriority = "explore" | "monitor" | "act" | "avoid";

export type RecommendationAudience =
  | "research"
  | "design"
  | "commerce"
  | "marketing"
  | "ceo";

export type RecommendationType =
  | "design_direction"
  | "product_opportunity"
  | "collection_concept"
  | "color_palette"
  | "typography_direction"
  | "graphic_theme"
  | "launch_timing"
  | "risk_warning"
  | "next_research_action";

export interface RecommendationEvidence {
  id: string;
  label: string;
  sourceKey?: string;
  signalId?: string;
  scoreId?: string;
}

export interface RecommendationSourceSupport {
  sourceKey: string;
  role: string;
  weight: number;
  summary: string;
}

export interface ResearchRecommendation {
  id: string;
  title: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  /** 0–100 — derived from confidence scores, never inflated beyond evidence. */
  confidence: number;
  why: string;
  /** @deprecated Use `why` — retained for backward compatibility. */
  narrative: string;
  evidence: RecommendationEvidence[];
  sourceSupport: RecommendationSourceSupport[];
  risks: string[];
  suggestedNextStep: string;
  audiences: RecommendationAudience[];
  tags: string[];
  sourceDomains: string[];
  relatedScoreIds: string[];
}

export interface RecommendationIntelligence {
  version: typeof RECOMMENDATION_ENGINE_MODEL_VERSION;
  items: ResearchRecommendation[];
  generatedAt: string;
  summary: string;
  caveats: string[];
}

export function emptyRecommendationIntelligence(
  generatedAt: string = new Date().toISOString(),
): RecommendationIntelligence {
  return {
    version: RECOMMENDATION_ENGINE_MODEL_VERSION,
    items: [],
    generatedAt,
    summary: "No recommendations generated — intelligence insufficient.",
    caveats: ["Recommendation engine has not run or produced no actionable output."],
  };
}
