/**
 * Phase 2.3D — Identity Consistency policy (NOT discovery novelty).
 *
 * We WANT generated angles to match the Master Identity Reference.
 * Numeric bands mirror face-api literature but are independently versioned —
 * do NOT change FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD (0.45) here.
 */

import {
  euclideanDistance,
  euclideanToCosineSimilarity,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
} from "@/lib/persona/face-novelty-memory/similarity-threshold";

export const IDENTITY_CONSISTENCY_POLICY_VERSION =
  "identity-consistency-v1.0.0" as const;

export const IDENTITY_CONSISTENCY_DECISIONS = [
  "identity_match",
  "identity_warning",
  "identity_mismatch",
  "evaluation_failed",
] as const;

export type IdentityConsistencyDecision =
  (typeof IDENTITY_CONSISTENCY_DECISIONS)[number];

/**
 * Match band: Euclidean ≤ literature same-identity band (0.45).
 * Independently named — discovery novelty uses DISCOVERY_HARD_DUPLICATE_THRESHOLD (0.30).
 * Identity Lock / Reference Package keep FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD (0.45).
 */
export const IDENTITY_CONSISTENCY_MATCH_EUCLIDEAN =
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD;

export const IDENTITY_CONSISTENCY_WARNING_EUCLIDEAN =
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD;

export type IdentityConsistencyEvaluation = {
  policyVersion: typeof IDENTITY_CONSISTENCY_POLICY_VERSION;
  masterEmbeddingAvailable: boolean;
  generatedEmbeddingAvailable: boolean;
  euclideanDistance: number | null;
  similarity: number | null;
  decision: IdentityConsistencyDecision;
  reason: string;
};

export function evaluateIdentityConsistency(input: {
  masterEmbedding: number[] | null | undefined;
  generatedEmbedding: number[] | null | undefined;
}): IdentityConsistencyEvaluation {
  const masterOk =
    Array.isArray(input.masterEmbedding) && input.masterEmbedding.length > 0;
  const generatedOk =
    Array.isArray(input.generatedEmbedding) &&
    input.generatedEmbedding.length > 0;

  if (!masterOk || !generatedOk) {
    return {
      policyVersion: IDENTITY_CONSISTENCY_POLICY_VERSION,
      masterEmbeddingAvailable: masterOk,
      generatedEmbeddingAvailable: generatedOk,
      euclideanDistance: null,
      similarity: null,
      decision: "evaluation_failed",
      reason: !masterOk
        ? "Master identity embedding unavailable"
        : "Generated angle embedding unavailable",
    };
  }

  const dist = euclideanDistance(
    input.masterEmbedding!,
    input.generatedEmbedding!,
  );
  const similarity = euclideanToCosineSimilarity(dist);

  if (dist <= IDENTITY_CONSISTENCY_MATCH_EUCLIDEAN) {
    return {
      policyVersion: IDENTITY_CONSISTENCY_POLICY_VERSION,
      masterEmbeddingAvailable: true,
      generatedEmbeddingAvailable: true,
      euclideanDistance: dist,
      similarity,
      decision: "identity_match",
      reason: "Generated angle matches Master Identity within match band",
    };
  }

  if (dist <= IDENTITY_CONSISTENCY_WARNING_EUCLIDEAN) {
    return {
      policyVersion: IDENTITY_CONSISTENCY_POLICY_VERSION,
      masterEmbeddingAvailable: true,
      generatedEmbeddingAvailable: true,
      euclideanDistance: dist,
      similarity,
      decision: "identity_warning",
      reason:
        "Possible identity match — soft warning; not accepted without review",
    };
  }

  return {
    policyVersion: IDENTITY_CONSISTENCY_POLICY_VERSION,
    masterEmbeddingAvailable: true,
    generatedEmbeddingAvailable: true,
    euclideanDistance: dist,
    similarity,
    decision: "identity_mismatch",
    reason: "Generated angle does not match Master Identity",
  };
}

/** Only identity_match may enter the usable Reference Package. */
export function isIdentityAcceptedForPackage(
  decision: IdentityConsistencyDecision,
): boolean {
  return decision === "identity_match";
}
