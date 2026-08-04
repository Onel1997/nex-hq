/**
 * Phase 2.0B.2 — Controlled live novelty test mode (development-only).
 *
 * PERSONA_FACE_NOVELTY_DEBUG=true enables diagnostic payloads and UI.
 * Never exposes biometric vectors, signed URLs, credentials, or secrets.
 * Production always returns null / strips debug payloads.
 */

import {
  assertNoSignedUrlLeakage,
  redactAssetPathForDebug,
} from "./safe-debug-redact";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
  FACE_SIMILARITY_EVALUATOR_VERSION,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_MODEL,
} from "./similarity-threshold";

// Avoid importing local-face-embedding-evaluator here — it pulls tfjs-node
// into any client bundle that accidentally imports live-debug types/helpers.
function resolveFailureModeForDebug(): string {
  const env = process.env["FACE_EVALUATOR_FAILURE_MODE"];
  if (env === "fail_open_with_warning") return "fail_open_with_warning";
  return "fail_closed";
}

export { assertNoSignedUrlLeakage, redactAssetPathForDebug } from "./safe-debug-redact";

export const PERSONA_FACE_NOVELTY_DEBUG_ENV = "PERSONA_FACE_NOVELTY_DEBUG";

/** Safe client DTO for novelty diagnostics — never includes embedding vectors. */
export type SafeFaceNoveltyLiveDebug = {
  evaluatorStatus: "active" | "failed";
  evaluatorModel?: string;
  evaluatorVersion?: string;
  failureMode: string;
  thresholdVersion: string;
  duplicateThreshold: number;
  warningThreshold: number;
  priorEmbeddingsLoaded: number;
  comparisonExecuted: boolean;
  faceDetectionStatus?: string;
  faceCount?: number;
  detectionConfidence?: number;
  embeddingStatus?: "created" | "reused" | "missing";
  embeddingDimension?: number;
  closestPriorCandidateId?: string;
  closestPriorAssetId?: string;
  similarity?: number;
  finalDecision: "allowed" | "blocked" | "failed";
  hardRejectReason?: string;
  requiresReplacementConfirmation: boolean;
  evaluationDurationMs?: number;
  evaluatedAt?: string;
  /** Candidate-level extras for the board UI. */
  slot?: number;
  candidateId?: string;
  assetId?: string;
  candidateProjectId?: string;
  evaluatorActive?: boolean;
  duplicateDecision?: boolean;
  /** Safe evaluator error fields — never include tokens or signed URLs. */
  safeErrorCode?: string;
  safeErrorMessage?: string;
};

export type FaceNoveltyPipelineStatus =
  | "waiting"
  | "evaluating"
  | "passed"
  | "blocked"
  | "failed";

/** Run-level debug summary for the Creation Project view. */
export type FaceNoveltyRunLiveDebug = {
  evaluatorStatus: "ACTIVE" | "FAILED";
  evaluatorModel: string;
  evaluatorVersion: string;
  failureMode: string;
  thresholdVersion: string;
  duplicateThreshold: number;
  warningThreshold: number;
  priorEmbeddingsLoaded: number;
  currentRunProjectId: string;
  currentArchetypeId: string;
  lastEvaluationTime?: string;
  pipelineStatus: FaceNoveltyPipelineStatus;
};

export type HistoricalFaceProtectionSummary = {
  forbiddenFacesTotal: number;
  protectedByEmbedding: number;
  protectedOnlyByChecksumOrPHash: number;
  unprotectedForBiologicalSimilarity: number;
  coveragePercentage: number;
  /** Phase 2.0C — extended coverage fields (optional for older payloads). */
  missingEmbedding?: number;
  failedProcessing?: number;
  missingAsset?: number;
  processableCoveragePercentage?: number;
  processableTotal?: number;
  lastBackfillJob?: {
    id: string;
    status: string;
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
  } | null;
  currentProgress?: {
    status: string;
    processedRecords: number;
    totalRecords: number;
    embeddedRecords: number;
    failedRecords: number;
  } | null;
};

export type FaceNoveltyCopyDebugPayload = {
  projectId: string;
  archetypeId: string;
  evaluatorHealth: FaceNoveltyRunLiveDebug;
  historicalCoverage: HistoricalFaceProtectionSummary;
  candidates: SafeFaceNoveltyLiveDebug[];
  finalDecisions: Array<{
    candidateId?: string;
    slot?: number;
    finalDecision: SafeFaceNoveltyLiveDebug["finalDecision"];
    hardRejectReason?: string;
  }>;
};

/**
 * Development-only feature flag.
 * Never true in production, even if the env var is set.
 */
export function isPersonaFaceNoveltyDebugEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env[PERSONA_FACE_NOVELTY_DEBUG_ENV] === "true") return true;
  return false;
}

/** Keys / patterns that must never appear in a safe debug DTO. */
const FORBIDDEN_DEBUG_KEYS = [
  "embedding",
  "face_embedding",
  "_embedding",
  "embeddingVector",
  "signedUrl",
  "signed_url",
  "imageBytes",
  "image_bytes",
  "rawBytes",
  "storageCredential",
  "serviceRole",
  "service_role",
  "apiKey",
  "api_key",
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function assertSafeFaceNoveltyDebugDto(value: unknown): void {
  const json = JSON.stringify(value);
  for (const key of FORBIDDEN_DEBUG_KEYS) {
    if (json.includes(`"${key}"`)) {
      throw new Error(`SafeFaceNoveltyLiveDebug must not contain key: ${key}`);
    }
  }
  // Detect large numeric arrays that look like embedding vectors.
  if (/"embedding"\s*:/.test(json) || /\[(?:\s*-?\d+\.?\d*\s*,){16,}/.test(json)) {
    // Allow short numeric lists (counts/thresholds); reject 128-dim-like arrays.
    const vectorMatch = json.match(/\[[\d\s.,eE+-]{200,}\]/);
    if (vectorMatch) {
      throw new Error("SafeFaceNoveltyLiveDebug must not contain embedding vectors");
    }
  }
  assertNoSignedUrlLeakage(json);
}

export function buildSafeFaceNoveltyLiveDebug(
  partial: Partial<SafeFaceNoveltyLiveDebug> &
    Pick<SafeFaceNoveltyLiveDebug, "finalDecision" | "requiresReplacementConfirmation">,
): SafeFaceNoveltyLiveDebug {
  const dto: SafeFaceNoveltyLiveDebug = {
    evaluatorStatus: partial.evaluatorStatus ?? "active",
    evaluatorModel: partial.evaluatorModel ?? FACE_SIMILARITY_MODEL,
    evaluatorVersion: partial.evaluatorVersion ?? FACE_SIMILARITY_EVALUATOR_VERSION,
    failureMode: partial.failureMode ?? resolveFailureModeForDebug(),
    thresholdVersion: partial.thresholdVersion ?? FACE_SIMILARITY_THRESHOLD_VERSION,
    duplicateThreshold:
      partial.duplicateThreshold ?? FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
    warningThreshold:
      partial.warningThreshold ?? FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
    priorEmbeddingsLoaded: partial.priorEmbeddingsLoaded ?? 0,
    comparisonExecuted: partial.comparisonExecuted ?? false,
    faceDetectionStatus: partial.faceDetectionStatus,
    faceCount: partial.faceCount,
    detectionConfidence: partial.detectionConfidence,
    embeddingStatus: partial.embeddingStatus,
    embeddingDimension: partial.embeddingDimension,
    closestPriorCandidateId: partial.closestPriorCandidateId,
    closestPriorAssetId: partial.closestPriorAssetId,
    similarity: partial.similarity,
    finalDecision: partial.finalDecision,
    hardRejectReason: partial.hardRejectReason,
    requiresReplacementConfirmation: partial.requiresReplacementConfirmation,
    evaluationDurationMs: partial.evaluationDurationMs,
    evaluatedAt: partial.evaluatedAt,
    slot: partial.slot,
    candidateId: partial.candidateId,
    assetId: partial.assetId,
    candidateProjectId: partial.candidateProjectId,
    evaluatorActive: partial.evaluatorActive ?? partial.evaluatorStatus !== "failed",
    duplicateDecision: partial.duplicateDecision,
    safeErrorCode: partial.safeErrorCode,
    safeErrorMessage: partial.safeErrorMessage,
  };
  assertSafeFaceNoveltyDebugDto(dto);
  return dto;
}

export function buildRunLiveDebug(input: {
  projectId: string;
  archetypeId: string;
  evaluatorStatus: "active" | "failed";
  priorEmbeddingsLoaded: number;
  pipelineStatus: FaceNoveltyPipelineStatus;
  lastEvaluationTime?: string;
  evaluatorModel?: string;
  evaluatorVersion?: string;
}): FaceNoveltyRunLiveDebug {
  return {
    evaluatorStatus: input.evaluatorStatus === "active" ? "ACTIVE" : "FAILED",
    evaluatorModel: input.evaluatorModel ?? FACE_SIMILARITY_MODEL,
    evaluatorVersion: input.evaluatorVersion ?? FACE_SIMILARITY_EVALUATOR_VERSION,
    failureMode: resolveFailureModeForDebug(),
    thresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    duplicateThreshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
    warningThreshold: FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
    priorEmbeddingsLoaded: input.priorEmbeddingsLoaded,
    currentRunProjectId: input.projectId,
    currentArchetypeId: input.archetypeId,
    lastEvaluationTime: input.lastEvaluationTime,
    pipelineStatus: input.pipelineStatus,
  };
}

/**
 * Historical embedding coverage for forbidden novelty records.
 * Does not silently claim unprotected faces are biologically protected.
 */
export function calculateHistoricalEmbeddingCoverage(records: Array<{
  hasEmbedding: boolean;
  hasChecksumOrPHash: boolean;
  detectionFailed: boolean;
  missingAssetAccess: boolean;
}>): HistoricalFaceProtectionSummary {
  const forbiddenFacesTotal = records.length;
  let protectedByEmbedding = 0;
  let protectedOnlyByChecksumOrPHash = 0;
  let unprotectedForBiologicalSimilarity = 0;

  for (const r of records) {
    if (r.hasEmbedding) {
      protectedByEmbedding += 1;
    } else if (r.hasChecksumOrPHash) {
      protectedOnlyByChecksumOrPHash += 1;
      unprotectedForBiologicalSimilarity += 1;
    } else {
      unprotectedForBiologicalSimilarity += 1;
    }
    void r.detectionFailed;
    void r.missingAssetAccess;
  }

  let missingEmbedding = 0;
  let failedProcessing = 0;
  let missingAsset = 0;
  for (const r of records) {
    if (!r.hasEmbedding) missingEmbedding += 1;
    if (r.detectionFailed) failedProcessing += 1;
    if (r.missingAssetAccess) missingAsset += 1;
  }

  const processableTotal = Math.max(0, forbiddenFacesTotal - missingAsset);
  const coveragePercentage =
    forbiddenFacesTotal === 0
      ? 100
      : Math.round((protectedByEmbedding / forbiddenFacesTotal) * 1000) / 10;
  const processableCoveragePercentage =
    processableTotal === 0
      ? 100
      : Math.round((protectedByEmbedding / processableTotal) * 1000) / 10;

  return {
    forbiddenFacesTotal,
    protectedByEmbedding,
    protectedOnlyByChecksumOrPHash,
    unprotectedForBiologicalSimilarity,
    coveragePercentage,
    missingEmbedding,
    failedProcessing,
    missingAsset,
    processableCoveragePercentage,
    processableTotal,
    lastBackfillJob: null,
    currentProgress: null,
  };
}

export function buildCopyDebugPayload(input: {
  projectId: string;
  archetypeId: string;
  run: FaceNoveltyRunLiveDebug;
  coverage: HistoricalFaceProtectionSummary;
  candidates: SafeFaceNoveltyLiveDebug[];
}): FaceNoveltyCopyDebugPayload {
  const payload: FaceNoveltyCopyDebugPayload = {
    projectId: input.projectId,
    archetypeId: input.archetypeId,
    evaluatorHealth: input.run,
    historicalCoverage: input.coverage,
    candidates: input.candidates.map((c) => buildSafeFaceNoveltyLiveDebug(c)),
    finalDecisions: input.candidates.map((c) => ({
      candidateId: c.candidateId,
      slot: c.slot,
      finalDecision: c.finalDecision,
      hardRejectReason: c.hardRejectReason,
    })),
  };
  assertSafeFaceNoveltyDebugDto(payload);
  return payload;
}

/** Strip any novelty debug fields from a candidate payload for non-debug clients. */
export function stripNoveltyDebugFromCandidateSettings(
  settings: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!settings) return {};
  const next = { ...settings };
  delete next.faceNoveltyLiveDebug;
  delete next._faceNoveltyLiveDebug;
  delete next.face_novelty_live_debug;
  return next;
}

export function maybeAttachNoveltyDebugToSettings(
  settings: Record<string, unknown>,
  debug: SafeFaceNoveltyLiveDebug | null,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  if (!debug || !isPersonaFaceNoveltyDebugEnabled(env)) {
    return stripNoveltyDebugFromCandidateSettings(settings);
  }
  return {
    ...stripNoveltyDebugFromCandidateSettings(settings),
    faceNoveltyLiveDebug: buildSafeFaceNoveltyLiveDebug(debug),
  };
}
