/**
 * Confidence model contracts — computation deferred to Phase 5.1+.
 * Architecture only: fusion and reasoning layers will populate these later.
 */

export type ConfidenceTier = "low" | "medium" | "high" | "verified";

export interface ConfidenceFactor {
  id: string;
  label: string;
  weight: number;
  rationale: string;
}

export interface DomainConfidence {
  domain: string;
  tier: ConfidenceTier;
  score?: number;
  factors: ConfidenceFactor[];
}

export interface ConfidenceIntelligence {
  overall?: ConfidenceTier;
  domains: DomainConfidence[];
  caveats: string[];
}

/** Placeholder factory — returns empty shell until scoring phase. */
export function emptyConfidenceIntelligence(): ConfidenceIntelligence {
  return { domains: [], caveats: [] };
}
