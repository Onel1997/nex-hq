/**
 * Research reasoning model — Phase 5.1.
 * Human-readable narratives derived deterministically from fused intelligence.
 */

export const RESEARCH_REASONING_VERSION = "5.1.0";

export type ReasoningSeverity = "low" | "medium" | "high";

export interface SourceReasoning {
  sourceKey: string;
  role: string;
  summary: string;
  evidenceIds: string[];
  weight: number;
}

export interface RiskReasoning {
  id: string;
  label: string;
  severity: ReasoningSeverity;
  reason: string;
  relatedScoreIds: string[];
}

export interface BrandFitReasoning {
  fits: boolean;
  score: number;
  tier: "low" | "medium" | "high";
  alignedSignals: string[];
  misalignedSignals: string[];
  summary: string;
}

export interface ScoreEvidenceSummary {
  scoreId: string;
  label: string;
  score: number;
  tier: string;
  rationale: string;
  evidence: string[];
}

export interface ResearchReasoningIntelligence {
  version: typeof RESEARCH_REASONING_VERSION;
  generatedAt: string;
  /** Why the observed trend landscape matters for fashion direction. */
  trendSignificance: string[];
  confirmingSources: SourceReasoning[];
  disagreeingSources: SourceReasoning[];
  risks: RiskReasoning[];
  brandFit: BrandFitReasoning;
  scoreEvidence: ScoreEvidenceSummary[];
  /** Condensed human-readable narratives for UI and downstream layers. */
  narratives: string[];
  caveats: string[];
}

export function emptyResearchReasoningIntelligence(
  generatedAt: string = new Date().toISOString(),
): ResearchReasoningIntelligence {
  return {
    version: RESEARCH_REASONING_VERSION,
    generatedAt,
    trendSignificance: [],
    confirmingSources: [],
    disagreeingSources: [],
    risks: [],
    brandFit: {
      fits: false,
      score: 0,
      tier: "low",
      alignedSignals: [],
      misalignedSignals: [],
      summary: "Insufficient intelligence to assess brand fit.",
    },
    scoreEvidence: [],
    narratives: [],
    caveats: ["No fused intelligence available for reasoning."],
  };
}
