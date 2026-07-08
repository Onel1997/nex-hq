/**
 * Recommendation model contracts — generation deferred to Phase 5.2+.
 * Architecture only: reasoning layer will produce these later.
 */

export type RecommendationPriority = "explore" | "monitor" | "act" | "avoid";

export type RecommendationAudience =
  | "research"
  | "design"
  | "commerce"
  | "marketing"
  | "ceo";

export interface ResearchRecommendation {
  id: string;
  title: string;
  narrative: string;
  priority: RecommendationPriority;
  audiences: RecommendationAudience[];
  tags: string[];
  sourceDomains: string[];
}

export interface RecommendationIntelligence {
  items: ResearchRecommendation[];
  generatedAt?: string;
}

/** Placeholder factory — returns empty shell until recommendation phase. */
export function emptyRecommendationIntelligence(): RecommendationIntelligence {
  return { items: [] };
}
