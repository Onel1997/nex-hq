/**
 * Phase 2.0C — Historical face embedding backfill types.
 *
 * Safe DTOs never include embedding vectors, image bytes, or signed URLs.
 */

import type { FaceNoveltyState } from "./types";

/** Forbidden states eligible for historical biological protection backfill. */
export const HISTORICAL_BACKFILL_FORBIDDEN_STATES = [
  "shown",
  "shortlisted",
  "saved",
  "rejected",
  "exhausted",
  "approved",
] as const satisfies readonly FaceNoveltyState[];

export type HistoricalBackfillForbiddenState =
  (typeof HISTORICAL_BACKFILL_FORBIDDEN_STATES)[number];

export const HISTORICAL_BACKFILL_DEFAULT_BATCH_SIZE = 5;

export const BACKFILL_JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
] as const;

export type BackfillJobStatus = (typeof BACKFILL_JOB_STATUSES)[number];

export const BACKFILL_RESULT_STATUSES = [
  "embedded",
  "already_embedded",
  "no_face",
  "multiple_faces",
  "low_confidence",
  "too_small",
  "missing_asset",
  "asset_load_failed",
  "evaluator_error",
  "skipped",
] as const;

export type BackfillResultStatus = (typeof BACKFILL_RESULT_STATUSES)[number];

/** Terminal failure statuses that count as failed processing (retryable). */
export const BACKFILL_FAILED_RESULT_STATUSES = [
  "no_face",
  "multiple_faces",
  "low_confidence",
  "too_small",
  "missing_asset",
  "asset_load_failed",
  "evaluator_error",
] as const satisfies readonly BackfillResultStatus[];

/** Detection failures that leave an asset processable for retry. */
export const BACKFILL_RETRYABLE_FAILURE_STATUSES = [
  "no_face",
  "multiple_faces",
  "low_confidence",
  "too_small",
  "asset_load_failed",
  "evaluator_error",
] as const satisfies readonly BackfillResultStatus[];

export type FaceEmbeddingBackfillJob = {
  id: string;
  workspaceId: string;
  archetypeId: string | null;
  status: BackfillJobStatus;
  totalRecords: number;
  processedRecords: number;
  embeddedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  batchSize: number;
  retryFailedOnly: boolean;
  startedAt: string | null;
  completedAt: string | null;
  evaluatorModel: string | null;
  evaluatorVersion: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FaceEmbeddingBackfillResult = {
  id: string;
  jobId: string;
  workspaceId: string;
  noveltyRecordId: string;
  candidateId: string | null;
  assetId: string | null;
  resultStatus: BackfillResultStatus;
  safeErrorCode: string | null;
  safeErrorMessage: string | null;
  durationMs: number | null;
  processedAt: string;
};

/** Novelty row enriched for eligibility — never includes embedding vectors. */
export type HistoricalBackfillEligibilityRecord = {
  noveltyRecordId: string;
  workspaceId: string;
  archetypeId: string;
  creationProjectId: string;
  candidateId: string;
  assetId: string;
  state: FaceNoveltyState;
  hasValidEmbedding: boolean;
  embeddingDimension: number | null;
  detectionStatus: string | null;
  hasChecksumOrPHash: boolean;
  imageChecksum: string | null;
  perceptualHash: string | null;
  storageObjectKey: string | null;
};

export type HistoricalBackfillPreflightSummary = {
  historicalForbiddenFacesTotal: number;
  alreadyProtectedByEmbedding: number;
  missingEmbedding: number;
  missingAssets: number;
  priorDetectionFailures: number;
  estimatedLocalProcessingCount: number;
  paidProviderCostEur: 0;
  evaluatorReady: boolean;
  batchSize: number;
};

/** Client-safe job progress DTO. */
export type SafeBackfillJobSummary = {
  id: string;
  status: BackfillJobStatus;
  totalRecords: number;
  processedRecords: number;
  embeddedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  startedAt: string | null;
  completedAt: string | null;
  evaluatorModel: string | null;
  evaluatorVersion: string | null;
  retryFailedOnly: boolean;
};

export type HistoricalBackfillBatchOutcome = {
  job: SafeBackfillJobSummary;
  results: Array<{
    noveltyRecordId: string;
    candidateId: string | null;
    assetId: string | null;
    resultStatus: BackfillResultStatus;
    safeErrorCode: string | null;
    safeErrorMessage: string | null;
    durationMs: number | null;
  }>;
  openaiCalls: 0;
  paidProviderCalls: 0;
};
