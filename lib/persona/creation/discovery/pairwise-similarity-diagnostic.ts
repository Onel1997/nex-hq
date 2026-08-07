/**
 * Phase 2.2A — non-blocking pairwise face similarity diagnostic (dev only).
 * Does NOT change novelty thresholds. Never logs embeddings.
 */

export type PairwiseSimilarityEntry = {
  pair: "A-B" | "A-C" | "A-D" | "B-C" | "B-D" | "C-D";
  similarity: number;
};

export type PairwiseSimilarityDiagnostic = {
  matrix: PairwiseSimilarityEntry[];
  closestSameRunPair: PairwiseSimilarityEntry | null;
  historicalClosestMatch: {
    candidateSlot: "A" | "B" | "C" | "D";
    similarity: number;
    matchedLabel: string;
  } | null;
};

const PAIRS = [
  ["A", "B"],
  ["A", "C"],
  ["A", "D"],
  ["B", "C"],
  ["B", "D"],
  ["C", "D"],
] as const;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Build diagnostic matrix from slot embeddings.
 * Embeddings are inputs only — never included in the returned object.
 */
export function buildPairwiseSimilarityDiagnostic(input: {
  embeddingsBySlot: Partial<Record<"A" | "B" | "C" | "D", number[]>>;
  historicalClosest?: {
    candidateSlot: "A" | "B" | "C" | "D";
    similarity: number;
    matchedLabel: string;
  } | null;
}): PairwiseSimilarityDiagnostic {
  const matrix: PairwiseSimilarityEntry[] = [];
  for (const [left, right] of PAIRS) {
    const a = input.embeddingsBySlot[left];
    const b = input.embeddingsBySlot[right];
    if (!a || !b) continue;
    matrix.push({
      pair: `${left}-${right}` as PairwiseSimilarityEntry["pair"],
      similarity: Number(cosineSimilarity(a, b).toFixed(4)),
    });
  }
  const closestSameRunPair =
    matrix.length === 0
      ? null
      : matrix.reduce((best, row) => (row.similarity > best.similarity ? row : best));

  return {
    matrix,
    closestSameRunPair,
    historicalClosestMatch: input.historicalClosest ?? null,
  };
}
