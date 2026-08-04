/**
 * Phase 2.0C — Historical biological protection coverage.
 */

import type { HistoricalBackfillEligibilityRecord } from "./historical-backfill-types";
import type { SafeBackfillJobSummary } from "./historical-backfill-types";
import { hasValidStoredEmbedding } from "./historical-backfill-eligibility";

export type ExtendedHistoricalFaceProtectionSummary = {
  forbiddenFacesTotal: number;
  protectedByEmbedding: number;
  protectedOnlyByChecksumOrPHash: number;
  missingEmbedding: number;
  failedProcessing: number;
  missingAsset: number;
  unprotectedForBiologicalSimilarity: number;
  /** Biological protection among all forbidden faces (embedded / total). */
  coveragePercentage: number;
  /**
   * Embedded / processable. Processable excludes genuinely missing/unreadable assets.
   * Does not claim 100% when failures remain among processable records.
   */
  processableCoveragePercentage: number;
  processableTotal: number;
  lastBackfillJob: SafeBackfillJobSummary | null;
  currentProgress: {
    status: SafeBackfillJobSummary["status"];
    processedRecords: number;
    totalRecords: number;
    embeddedRecords: number;
    failedRecords: number;
  } | null;
};

export function calculateExtendedHistoricalCoverage(input: {
  records: HistoricalBackfillEligibilityRecord[];
  missingAssetIds?: Set<string>;
  failedProcessingIds?: Set<string>;
  lastBackfillJob?: SafeBackfillJobSummary | null;
}): ExtendedHistoricalFaceProtectionSummary {
  const forbiddenFacesTotal = input.records.length;
  let protectedByEmbedding = 0;
  let protectedOnlyByChecksumOrPHash = 0;
  let missingEmbedding = 0;
  let failedProcessing = 0;
  let missingAsset = 0;

  for (const r of input.records) {
    const assetMissing =
      !r.assetId?.trim() || Boolean(input.missingAssetIds?.has(r.assetId));
    if (assetMissing && !hasValidStoredEmbedding(r)) {
      missingAsset += 1;
    }

    if (hasValidStoredEmbedding(r)) {
      protectedByEmbedding += 1;
      continue;
    }

    missingEmbedding += 1;
    if (input.failedProcessingIds?.has(r.noveltyRecordId)) {
      failedProcessing += 1;
    }

    if (r.hasChecksumOrPHash) {
      protectedOnlyByChecksumOrPHash += 1;
    }
  }

  const unprotectedForBiologicalSimilarity = missingEmbedding;
  const processableTotal = Math.max(0, forbiddenFacesTotal - missingAsset);
  const coveragePercentage =
    forbiddenFacesTotal === 0
      ? 100
      : Math.round((protectedByEmbedding / forbiddenFacesTotal) * 1000) / 10;
  const processableCoveragePercentage =
    processableTotal === 0
      ? 100
      : Math.round((protectedByEmbedding / processableTotal) * 1000) / 10;

  const job = input.lastBackfillJob ?? null;
  const currentProgress =
    job && (job.status === "running" || job.status === "pending")
      ? {
          status: job.status,
          processedRecords: job.processedRecords,
          totalRecords: job.totalRecords,
          embeddedRecords: job.embeddedRecords,
          failedRecords: job.failedRecords,
        }
      : job
        ? {
            status: job.status,
            processedRecords: job.processedRecords,
            totalRecords: job.totalRecords,
            embeddedRecords: job.embeddedRecords,
            failedRecords: job.failedRecords,
          }
        : null;

  return {
    forbiddenFacesTotal,
    protectedByEmbedding,
    protectedOnlyByChecksumOrPHash,
    missingEmbedding,
    failedProcessing,
    missingAsset,
    unprotectedForBiologicalSimilarity,
    coveragePercentage,
    processableCoveragePercentage,
    processableTotal,
    lastBackfillJob: job,
    currentProgress,
  };
}
