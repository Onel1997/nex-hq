/**
 * Phase 2.0E — Which stored embeddings may enter the live comparison pool.
 *
 * Only faces that passed novelty evaluation (finalDecision === "allowed")
 * represent identities actually shown or consumed on the board.
 * Failed / blocked / evaluator-error records must not block future discovery.
 */

export type NoveltyLiveEvidenceShape = {
  finalDecision?: string;
} | null;

/**
 * Returns true when a novelty record's stored embedding may be compared
 * against a newly generated candidate.
 */
export function isEmbeddingEligibleForComparison(input: {
  liveEvaluationEvidence?: NoveltyLiveEvidenceShape;
}): boolean {
  const evidence = input.liveEvaluationEvidence;
  if (!evidence || typeof evidence !== "object") {
    // Legacy rows without evidence — keep for backward compatibility.
    return true;
  }
  const decision = evidence.finalDecision;
  if (decision == null || decision === "") {
    return true;
  }
  return decision === "allowed";
}
