/**
 * Face Novelty Memory service — high-level operations for the creation flow.
 *
 * Replacement cost policy (Option A — strict confirmed cap):
 *   - No silent paid replacement beyond confirmed calls.
 *   - If a duplicate is detected the slot is returned as FAILED and the UI
 *     must ask the user to confirm a replacement generation.
 *   - Message: "Candidate rejected by novelty protection. Confirm replacement generation."
 */

import { randomUUID } from "crypto";
import type { FaceNoveltyRecord, FaceNoveltyState, NoveltyDebugData } from "./types";
import type { NoveltyRepository } from "./novelty-repository";
import type { DiscoveryHistory, FaceSimilarityEvaluator } from "./types";
import { loadDiscoveryHistory, exhaustUnfinishedCandidates } from "./discovery-history";
import { evaluateDiscoveryNovelty, type NoveltyPolicyInput } from "./novelty-policy";
import { resolveFaceSimilarityEvaluator } from "./face-similarity-adapter";
import { NOVELTY_REPLACEMENT_POLICY } from "./types";
import type { EmbeddingRepository } from "./embedding-repository";
import {
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
  FACE_SIMILARITY_EMBEDDING_DIMENSION,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
  FACE_SIMILARITY_MODEL,
} from "./similarity-threshold";
import { resolveEvaluatorFailureMode } from "./local-face-embedding-evaluator";
import {
  buildSafeFaceNoveltyLiveDebug,
  isPersonaFaceNoveltyDebugEnabled,
  type SafeFaceNoveltyLiveDebug,
} from "./live-debug";
import type { LiveDiagnosticStore } from "./diagnostic-store";
import {
  resolveNoveltyCandidateStatus,
  type NoveltyVisibilityDecision,
} from "./visibility-assertion";

export const NOVELTY_REPLACEMENT_CONFIRMATION_MESSAGE =
  "Candidate rejected by novelty protection. Confirm replacement generation.";

export interface RegisterCandidateInput {
  workspaceId: string;
  archetypeId: string;
  creationProjectId: string;
  candidateId: string;
  assetId: string;
  identityFingerprint: string;
  visualFingerprint?: string;
  perceptualHash?: string;
  storageObjectKey?: string;
  imageChecksum?: string;
  /** Temporary signed URL for face extraction — never persisted, never logged. */
  signedUrl?: string;
  sourceProvider: string;
  sourceModel: string;
}

/**
 * Register a newly generated candidate (state: generated).
 *
 * Idempotent for discovery retries that reuse the same candidate_id:
 * if a novelty row already exists for (workspace_id, candidate_id), reuse
 * that row id and update it — never allocate a second row.
 */
export async function registerGeneratedCandidate(
  repo: NoveltyRepository,
  input: RegisterCandidateInput,
): Promise<FaceNoveltyRecord> {
  const existing = await repo.findByCandidateId(
    input.candidateId,
    input.workspaceId,
  );

  const record: FaceNoveltyRecord = {
    id: existing?.id ?? randomUUID(),
    workspaceId: input.workspaceId,
    archetypeId: input.archetypeId,
    creationProjectId: input.creationProjectId,
    candidateId: input.candidateId,
    assetId: input.assetId,
    state: "generated",
    identityFingerprint: input.identityFingerprint,
    visualFingerprint: input.visualFingerprint,
    perceptualHash: input.perceptualHash,
    storageObjectKey: input.storageObjectKey,
    imageChecksum: input.imageChecksum,
    sourceProvider: input.sourceProvider,
    sourceModel: input.sourceModel,
    // Preserve history on retry; only mint createdAt on first insert.
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    firstShownAt: existing?.firstShownAt,
    exhaustedAt: existing?.exhaustedAt,
    savedAt: existing?.savedAt,
    approvedAt: existing?.approvedAt,
    shortlistedAt: existing?.shortlistedAt,
    rejectedAt: existing?.rejectedAt,
    embeddingVersion: existing?.embeddingVersion,
  };
  await repo.upsert(record);
  return record;
}

/** Transition a candidate to "shown" when displayed on the Candidate Board. */
export async function markCandidateShown(
  repo: NoveltyRepository,
  recordId: string,
  workspaceId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await repo.updateState(recordId, workspaceId, "shown", { firstShownAt: now });
}

/** Transition to "saved" — preserved but excluded from fresh discovery. */
export async function markCandidateSaved(
  repo: NoveltyRepository,
  recordId: string,
  workspaceId: string,
): Promise<void> {
  await repo.updateState(recordId, workspaceId, "saved", {
    savedAt: new Date().toISOString(),
  });
}

/** Transition to "shortlisted" — Keep for A2 / shortlist behavior. */
export async function markCandidateShortlisted(
  repo: NoveltyRepository,
  recordId: string,
  workspaceId: string,
): Promise<void> {
  await repo.updateState(recordId, workspaceId, "shortlisted", {
    shortlistedAt: new Date().toISOString(),
  });
}

/** Transition to "rejected" → exhausted immediately. */
export async function markCandidateRejected(
  repo: NoveltyRepository,
  recordId: string,
  workspaceId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await repo.updateState(recordId, workspaceId, "exhausted", {
    rejectedAt: now,
    exhaustedAt: now,
  });
}

/** Transition to "approved". */
export async function markCandidateApproved(
  repo: NoveltyRepository,
  recordId: string,
  workspaceId: string,
): Promise<void> {
  await repo.updateState(recordId, workspaceId, "approved", {
    approvedAt: new Date().toISOString(),
  });
}

export interface CandidateNoveltyCheck {
  recordId: string;
  hardReject: boolean;
  hardRejectReason?: string;
  softWarning: boolean;
  softWarningReason?: string;
  requiresReplacementConfirmation: boolean;
  replacementMessage?: string;
  closestPriorCandidateId?: string;
  evaluatorMethod?: string;
  /** Detection status from local evaluator (for debug — not for client). */
  detectionStatus?: string;
  /** Face similarity score (0–1), for debug only. */
  similarity?: number;
  /** Whether evaluator returned a warning (possible near-duplicate). */
  isWarning?: boolean;
  /** Final visibility decision after fail_closed mapping. */
  finalDecision: NoveltyVisibilityDecision;
  /** Candidate status that must be persisted (ready / novelty_blocked / novelty_failed). */
  candidateStatus: import("../domain/creation-types").CandidateStatus;
  /** Safe debug DTO — only populated when PERSONA_FACE_NOVELTY_DEBUG is on in development. */
  liveDebug?: SafeFaceNoveltyLiveDebug;
  evaluationStatus?: "performed" | "not_available";
  faceCount?: number;
  detectionConfidence?: number;
  embeddingStatus?: "created" | "reused" | "missing";
  embeddingDimension?: number;
  priorEmbeddingsCompared?: number;
  closestPriorAssetId?: string;
  evaluationDurationMs?: number;
  evaluatedAt?: string;
  comparisonExecuted?: boolean;
  evaluatorActive?: boolean;
}

export interface CheckCandidateOptions {
  /** Override the default face-similarity evaluator (e.g. inject a fake in tests). */
  evaluator?: FaceSimilarityEvaluator;
  /** Embedding repository for persisting/loading face vectors (server-only). */
  embeddingRepo?: EmbeddingRepository;
  /** Diagnostic store for non-sensitive live evidence (survives refresh). */
  diagnosticStore?: LiveDiagnosticStore;
  /** Prior embedding count loaded into the evaluator. */
  priorEmbeddingsLoaded?: number;
  /** Candidate slot number for debug UI. */
  slot?: number;
  /** Whether LocalFaceEmbeddingEvaluator (or live equivalent) is active. */
  evaluatorActive?: boolean;
}

/**
 * Evaluate a candidate against the workspace novelty history.
 * Records the candidate in the repo (as "generated") before evaluating.
 *
 * Replacement message for face-similarity duplicate:
 *   "Candidate is too similar to a previously shown face. Confirm replacement generation."
 *
 * Replacement message for image-level duplicate:
 *   "Candidate rejected by novelty protection. Confirm replacement generation."
 *
 * Returns requiresReplacementConfirmation=true when hard-rejected.
 * The caller (UI + API) must surface the confirmation message and wait for
 * explicit user approval before triggering a replacement generation.
 */
export async function checkAndRegisterCandidate(
  repo: NoveltyRepository,
  history: DiscoveryHistory,
  input: RegisterCandidateInput,
  options?: CheckCandidateOptions,
): Promise<CandidateNoveltyCheck> {
  const startedAt = Date.now();
  const evaluatedAt = new Date().toISOString();

  // Prefer injected evaluator (e.g. LocalFaceEmbeddingEvaluator with prior embeddings loaded)
  // over the null fallback from the adapter.
  const evaluator = options?.evaluator ?? resolveFaceSimilarityEvaluator();
  const evaluatorActive =
    options?.evaluatorActive ??
    (evaluator.constructor?.name === "LocalFaceEmbeddingEvaluator" ||
      (evaluator as { method?: string }).method === "local-face-embedding-v1");

  const policyInput: NoveltyPolicyInput = {
    candidateId: input.candidateId,
    assetId: input.assetId,
    creationProjectId: input.creationProjectId,
    identityFingerprint: input.identityFingerprint,
    assetRef: {
      candidateId: input.candidateId,
      assetId: input.assetId,
      storageObjectKey: input.storageObjectKey,
      imageChecksum: input.imageChecksum,
      perceptualHash: input.perceptualHash,
      signedUrl: input.signedUrl,
    },
    history,
    faceSimilarityEvaluator: evaluator,
  };
  const evaluation = await evaluateDiscoveryNovelty(policyInput);

  // Extract embedding side-channel data attached by LocalFaceEmbeddingEvaluator.
  const rawResult = evaluation.faceSimilarity as (typeof evaluation.faceSimilarity) &
    Record<string, unknown>;
  const embeddingVector = rawResult?._embedding as number[] | undefined;
  const detectionConfidence = rawResult?._detectionConfidence as number | undefined;
  const faceCount = rawResult?._faceCount as number | undefined;
  const detectionStatus = rawResult?._detectionStatus as string | undefined;
  const safeErrorCode = rawResult?._safeErrorCode as string | undefined;
  const safeErrorMessage = rawResult?._safeErrorMessage as string | undefined;
  const isWarning = rawResult?._isWarning as boolean | undefined;
  const thresholdVersion = rawResult?._thresholdVersion as string | undefined;
  const closestPriorAssetId =
    (rawResult?._closestMatchAssetId as string | undefined) ??
    evaluation.faceSimilarity?.closestMatchAssetId;
  const closestPriorCandidateId =
    evaluation.closestPriorCandidateId ??
    (rawResult?._closestMatchCandidateId as string | undefined);
  const priorCompared =
    options?.priorEmbeddingsLoaded ?? history.priorAssetReferences.length;
  const comparisonExecuted =
    evaluation.faceSimilarity?.status === "performed" && priorCompared > 0;
  const evaluationStatus = evaluation.faceSimilarity?.status;

  // Register the candidate regardless of result so the failed attempt is
  // recorded safely (never lost).
  const record = await registerGeneratedCandidate(repo, input);

  let embeddingStatus: "created" | "reused" | "missing" = "missing";
  let embeddingDimension: number | undefined;

  // Persist embedding if extracted — once per record, never re-extracted.
  if (embeddingVector && embeddingVector.length > 0 && options?.embeddingRepo) {
    const alreadyHas = await options.embeddingRepo.hasEmbedding(record.id, input.workspaceId);
    if (!alreadyHas) {
      await options.embeddingRepo.saveEmbedding({
        noveltyRecordId: record.id,
        workspaceId: input.workspaceId,
        embedding: embeddingVector,
        embeddingDimension: embeddingVector.length,
        embeddingModel: "faceRecognitionNet",
        embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
        detectionConfidence: detectionConfidence ?? 0,
        faceCount: faceCount ?? 0,
        detectionStatus: (evaluation.faceSimilarity?.status === "performed"
          ? "performed"
          : (detectionStatus ?? "unavailable")) as import("./similarity-threshold").FaceDetectionStatus,
        similarityThresholdVersion: thresholdVersion ?? FACE_SIMILARITY_THRESHOLD_VERSION,
      });
      embeddingStatus = "created";
      embeddingDimension = embeddingVector.length;
    } else {
      embeddingStatus = "reused";
      embeddingDimension = embeddingVector.length;
    }
  } else if (evaluationStatus === "performed") {
    embeddingStatus = embeddingVector ? "created" : "missing";
    embeddingDimension = embeddingVector?.length;
  }

  if (evaluation.hardReject) {
    // Immediately exhaust the rejected candidate.
    await repo.updateState(record.id, input.workspaceId, "exhausted", {
      exhaustedAt: new Date().toISOString(),
    });
  }

  const isFaceSimilarityReject =
    evaluation.hardRejectReason === "face_similarity_duplicate";

  const statusResult = resolveNoveltyCandidateStatus({
    hardReject: evaluation.hardReject,
    hardRejectReason: evaluation.hardRejectReason,
    softWarning: evaluation.softWarning,
    softWarningReason: evaluation.softWarningReason,
    evaluationStatus,
    detectionStatus:
      detectionStatus ??
      (evaluationStatus === "performed" ? "performed" : undefined),
    evaluatorActive,
  });

  const evaluationDurationMs = Date.now() - startedAt;
  const effectiveHardReject =
    evaluation.hardReject || statusResult.finalDecision !== "allowed";
  const effectiveHardRejectReason =
    statusResult.hardRejectReason ?? evaluation.hardRejectReason;

  const liveDebugBase = buildSafeFaceNoveltyLiveDebug({
    evaluatorStatus: evaluatorActive ? "active" : "failed",
    evaluatorModel: FACE_SIMILARITY_MODEL,
    evaluatorVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
    failureMode: resolveEvaluatorFailureMode(),
    thresholdVersion: thresholdVersion ?? FACE_SIMILARITY_THRESHOLD_VERSION,
    duplicateThreshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
    warningThreshold: FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
    priorEmbeddingsLoaded: priorCompared,
    comparisonExecuted,
    faceDetectionStatus:
      detectionStatus ??
      (evaluationStatus === "performed" ? "performed" : evaluationStatus),
    faceCount,
    detectionConfidence,
    embeddingStatus,
    embeddingDimension:
      embeddingDimension ??
      (embeddingStatus !== "missing" ? FACE_SIMILARITY_EMBEDDING_DIMENSION : undefined),
    closestPriorCandidateId,
    closestPriorAssetId,
    similarity: evaluation.faceSimilarity?.similarity,
    finalDecision: statusResult.finalDecision,
    hardRejectReason: effectiveHardRejectReason,
    requiresReplacementConfirmation: statusResult.requiresReplacementConfirmation,
    evaluationDurationMs,
    evaluatedAt,
    slot: options?.slot,
    candidateId: input.candidateId,
    assetId: input.assetId,
    candidateProjectId: input.creationProjectId,
    evaluatorActive,
    duplicateDecision: isFaceSimilarityReject || evaluation.hardRejectReason === "exact_checksum",
    safeErrorCode,
    safeErrorMessage,
  });

  // Always persist non-sensitive evidence so refresh survives — no embedding vectors.
  if (options?.diagnosticStore) {
    await options.diagnosticStore.saveEvidence(record.id, input.workspaceId, liveDebugBase);
  }

  const liveDebug = isPersonaFaceNoveltyDebugEnabled() ? liveDebugBase : undefined;

  return {
    recordId: record.id,
    hardReject: effectiveHardReject,
    hardRejectReason: effectiveHardRejectReason,
    softWarning: effectiveHardReject ? false : evaluation.softWarning,
    softWarningReason: effectiveHardReject ? undefined : evaluation.softWarningReason,
    requiresReplacementConfirmation: statusResult.requiresReplacementConfirmation,
    replacementMessage: effectiveHardReject
      ? isFaceSimilarityReject || effectiveHardRejectReason === "face_similarity_duplicate"
        ? FACE_SIMILARITY_REPLACEMENT_CONFIRMATION_MESSAGE
        : NOVELTY_REPLACEMENT_CONFIRMATION_MESSAGE
      : undefined,
    closestPriorCandidateId,
    evaluatorMethod: evaluation.evaluatorMethod,
    detectionStatus:
      detectionStatus ??
      (evaluationStatus === "performed" ? "performed" : evaluationStatus),
    similarity: evaluation.faceSimilarity?.similarity,
    isWarning,
    finalDecision: statusResult.finalDecision,
    candidateStatus: statusResult.status,
    liveDebug,
    evaluationStatus,
    faceCount,
    detectionConfidence,
    embeddingStatus,
    embeddingDimension: liveDebugBase.embeddingDimension,
    priorEmbeddingsCompared: priorCompared,
    closestPriorAssetId,
    evaluationDurationMs,
    evaluatedAt,
    comparisonExecuted,
    evaluatorActive,
  };
}

export const FACE_SIMILARITY_REPLACEMENT_CONFIRMATION_MESSAGE =
  "Candidate is too similar to a previously shown face. Confirm replacement generation.";

/** Prepare a new discovery run: exhaust stale candidates, load history. */
export async function prepareDiscoveryRun(
  repo: NoveltyRepository,
  workspaceId: string,
  archetypeId: string,
): Promise<DiscoveryHistory> {
  await exhaustUnfinishedCandidates(repo, workspaceId, archetypeId);
  return loadDiscoveryHistory(repo, workspaceId, archetypeId);
}

export { NOVELTY_REPLACEMENT_POLICY };

/** Build debug data (development mode only). */
export async function buildNoveltyDebugData(
  repo: NoveltyRepository,
  workspaceId: string,
  archetypeId: string,
  candidateChecks: CandidateNoveltyCheck[],
): Promise<NoveltyDebugData> {
  const history = await loadDiscoveryHistory(repo, workspaceId, archetypeId);
  return {
    workspaceId,
    archetypeId,
    noveltyMemoryCount:
      history.totalShown +
      history.totalExhausted +
      history.totalSaved +
      history.totalApproved +
      history.totalRejected,
    forbiddenIdentityFingerprintCount: history.forbiddenIdentityFingerprints.size,
    forbiddenImageHashCount: history.forbiddenImageChecksums.size,
    candidateNoveltyResults: candidateChecks.map((c) => ({
      candidateId: c.recordId,
      hardReject: c.hardReject,
      hardRejectReason: c.hardRejectReason,
      softWarning: c.softWarning,
      closestPriorCandidateId: c.closestPriorCandidateId,
      similarityStatus: c.evaluatorMethod ? `method:${c.evaluatorMethod}` : undefined,
      duplicateReason: c.hardRejectReason,
      evaluatorMethod: c.evaluatorMethod,
    })),
  };
}
