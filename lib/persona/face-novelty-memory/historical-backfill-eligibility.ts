/**
 * Phase 2.0C — Eligibility selection for historical face embedding backfill.
 */

import {
  HISTORICAL_BACKFILL_FORBIDDEN_STATES,
  type HistoricalBackfillEligibilityRecord,
  type HistoricalBackfillPreflightSummary,
  type BackfillResultStatus,
} from "./historical-backfill-types";
import type { FaceNoveltyState } from "./types";

export function isForbiddenBackfillState(state: FaceNoveltyState): boolean {
  return (HISTORICAL_BACKFILL_FORBIDDEN_STATES as readonly string[]).includes(state);
}

export function hasValidStoredEmbedding(record: {
  hasValidEmbedding: boolean;
  embeddingDimension?: number | null;
}): boolean {
  if (!record.hasValidEmbedding) return false;
  if (
    typeof record.embeddingDimension === "number" &&
    record.embeddingDimension > 0 &&
    record.embeddingDimension !== 128
  ) {
    // Dimension mismatch — treat as invalid so it can be re-processed.
    return false;
  }
  return true;
}

/**
 * A record is backfill-eligible when it is forbidden, workspace-matched,
 * has a candidate + asset id, and lacks a valid stored embedding.
 */
export function isBackfillEligible(
  record: HistoricalBackfillEligibilityRecord,
  activeWorkspaceId: string,
): boolean {
  if (record.workspaceId !== activeWorkspaceId) return false;
  if (!isForbiddenBackfillState(record.state)) return false;
  if (!record.candidateId?.trim()) return false;
  if (!record.assetId?.trim()) return false;
  if (hasValidStoredEmbedding(record)) return false;
  // Never backfill embeddings for faces that never passed novelty (board-visible).
  if (
    record.liveEvaluationFinalDecision != null &&
    record.liveEvaluationFinalDecision !== "allowed"
  ) {
    return false;
  }
  return true;
}

/** Deduplicate by asset id — first occurrence wins. */
export function dedupeEligibleByAsset(
  records: HistoricalBackfillEligibilityRecord[],
): {
  unique: HistoricalBackfillEligibilityRecord[];
  duplicateAssetIds: Set<string>;
} {
  const seen = new Set<string>();
  const duplicateAssetIds = new Set<string>();
  const unique: HistoricalBackfillEligibilityRecord[] = [];
  for (const r of records) {
    if (!r.assetId) {
      unique.push(r);
      continue;
    }
    if (seen.has(r.assetId)) {
      duplicateAssetIds.add(r.assetId);
      continue;
    }
    seen.add(r.assetId);
    unique.push(r);
  }
  return { unique, duplicateAssetIds };
}

export function buildHistoricalBackfillPreflightSummary(input: {
  records: HistoricalBackfillEligibilityRecord[];
  evaluatorReady: boolean;
  batchSize: number;
  /** Asset IDs known to be missing / unreadable (from prior results or probe). */
  missingAssetIds?: Set<string>;
  /** Novelty IDs with prior detection failures (no embedding). */
  priorDetectionFailureIds?: Set<string>;
}): HistoricalBackfillPreflightSummary {
  const forbidden = input.records.filter((r) =>
    isForbiddenBackfillState(r.state),
  );
  let alreadyProtectedByEmbedding = 0;
  let missingEmbedding = 0;
  let missingAssets = 0;
  let priorDetectionFailures = 0;

  for (const r of forbidden) {
    if (hasValidStoredEmbedding(r)) {
      alreadyProtectedByEmbedding += 1;
      continue;
    }
    missingEmbedding += 1;
    if (!r.assetId?.trim() || input.missingAssetIds?.has(r.assetId)) {
      missingAssets += 1;
    }
    if (
      input.priorDetectionFailureIds?.has(r.noveltyRecordId) ||
      (r.detectionStatus &&
        r.detectionStatus !== "performed" &&
        r.detectionStatus !== "unavailable")
    ) {
      priorDetectionFailures += 1;
    }
  }

  const estimatedLocalProcessingCount = Math.max(
    0,
    missingEmbedding - missingAssets,
  );

  return {
    historicalForbiddenFacesTotal: forbidden.length,
    alreadyProtectedByEmbedding,
    missingEmbedding,
    missingAssets,
    priorDetectionFailures,
    estimatedLocalProcessingCount,
    paidProviderCostEur: 0,
    evaluatorReady: input.evaluatorReady,
    batchSize: input.batchSize,
  };
}

export function mapDetectionStatusToResultStatus(
  status: string,
): BackfillResultStatus {
  switch (status) {
    case "no_face":
      return "no_face";
    case "multiple_faces":
      return "multiple_faces";
    case "low_confidence":
      return "low_confidence";
    case "too_small":
      return "too_small";
    case "error":
      return "evaluator_error";
    case "performed":
      return "embedded";
    default:
      return "evaluator_error";
  }
}
