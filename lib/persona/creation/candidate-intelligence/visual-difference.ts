/**
 * Rule-based visual difference between candidates (prompt/variation fingerprints).
 * No pixel vision — diversity of creative interpretation within the same persona.
 */

import {
  resolveCandidateVariation,
  variationFingerprint,
  type CandidateVariationProfile,
} from "./variations";

export interface CandidateDiversityEntry {
  candidateNumber: number;
  variationId: string;
  fingerprint: string;
}

export interface PairwiseDiversity {
  a: number;
  b: number;
  score: number;
  sameVariation: boolean;
}

export interface CandidateDiversityReport {
  entries: CandidateDiversityEntry[];
  pairwise: PairwiseDiversity[];
  /** 0–100 — higher = more different. */
  minPairwiseScore: number;
  averagePairwiseScore: number;
  lowDiversity: boolean;
  warning: string | null;
  method: "variation_fingerprint_v1";
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length > 2),
  );
}

/** Jaccard distance × 100 — 100 = fully different tokens, 0 = identical. */
export function fingerprintDistance(a: string, b: string): number {
  if (a === b) return 0;
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection += 1;
  }
  const union = ta.size + tb.size - intersection;
  if (union === 0) return 0;
  const jaccardSimilarity = intersection / union;
  return Math.round((1 - jaccardSimilarity) * 100);
}

export function buildDiversityReport(params: {
  candidateNumbers: number[];
  variations?: CandidateVariationProfile[];
}): CandidateDiversityReport {
  const entries: CandidateDiversityEntry[] = params.candidateNumbers.map((n, i) => {
    const variation = params.variations?.[i] ?? resolveCandidateVariation(n);
    return {
      candidateNumber: n,
      variationId: variation.id,
      fingerprint: variationFingerprint(variation),
    };
  });

  const pairwise: PairwiseDiversity[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i]!;
      const b = entries[j]!;
      const score = fingerprintDistance(a.fingerprint, b.fingerprint);
      pairwise.push({
        a: a.candidateNumber,
        b: b.candidateNumber,
        score,
        sameVariation: a.variationId === b.variationId,
      });
    }
  }

  const scores = pairwise.map((p) => p.score);
  const minPairwiseScore = scores.length ? Math.min(...scores) : 100;
  const averagePairwiseScore = scores.length
    ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length)
    : 100;

  // Distinct profiles should score high; duplicate slots are a diversity failure.
  const lowDiversity = minPairwiseScore < 35 || pairwise.some((p) => p.sameVariation);

  return {
    entries,
    pairwise,
    minPairwiseScore,
    averagePairwiseScore,
    lowDiversity,
    warning: lowDiversity ? "Candidate diversity is low." : null,
    method: "variation_fingerprint_v1",
  };
}
