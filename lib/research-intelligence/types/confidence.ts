/**
 * Confidence model — Phase 5.1 deterministic scoring contracts.
 */

export type ConfidenceTier = "low" | "medium" | "high" | "verified";

export const CONFIDENCE_SCORE_IDS = [
  "trend_confidence",
  "commercial_confidence",
  "brand_fit_confidence",
  "source_agreement",
  "source_diversity",
  "saturation_risk",
  "novelty",
  "longevity",
  "seasonality",
  "launch_readiness",
] as const;

export type ConfidenceScoreId = (typeof CONFIDENCE_SCORE_IDS)[number];

export interface ConfidenceEvidence {
  id: string;
  label: string;
  sourceKey?: string;
  signalId?: string;
  weight: number;
  contribution: number;
  direction: "supports" | "contradicts" | "neutral";
}

export interface ConfidenceScore {
  id: ConfidenceScoreId;
  label: string;
  score: number;
  tier: ConfidenceTier;
  rationale: string;
  evidence: ConfidenceEvidence[];
}

export interface ConfidenceFactor {
  id: string;
  label: string;
  weight: number;
  rationale: string;
}

export interface DomainConfidence {
  domain: string;
  tier: ConfidenceTier;
  score: number;
  factors: ConfidenceFactor[];
}

export interface ConfidenceIntelligence {
  overall: ConfidenceTier;
  overallScore: number;
  scores: Record<ConfidenceScoreId, ConfidenceScore>;
  domains: DomainConfidence[];
  caveats: string[];
}

export function emptyConfidenceIntelligence(): ConfidenceIntelligence {
  const scores = {} as Record<ConfidenceScoreId, ConfidenceScore>;
  for (const id of CONFIDENCE_SCORE_IDS) {
    scores[id] = {
      id,
      label: formatScoreLabel(id),
      score: 0,
      tier: "low",
      rationale: "No intelligence data available.",
      evidence: [],
    };
  }

  return {
    overall: "low",
    overallScore: 0,
    scores,
    domains: [],
    caveats: ["No provider intelligence fused — confidence scores are baseline zero."],
  };
}

function formatScoreLabel(id: ConfidenceScoreId): string {
  return id
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
