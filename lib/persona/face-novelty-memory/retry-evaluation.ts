/**
 * Development-only retry of face novelty evaluation on an existing candidate image.
 *
 * Reuses stored asset bytes — zero OpenAI / paid provider calls.
 */

import type { WorkspaceScope } from "../domain/types";
import { PersonaDomainError } from "../domain/errors";
import type { PersonaCandidate } from "../domain/creation-types";
import { downloadPersonaCandidateBytes } from "../creation/candidate-storage";
import { getCreationRepository } from "../creation/creation-factory";
import { maybeAttachNoveltyDebugToSettings } from "./live-debug";
import { loadDiscoveryHistory } from "./discovery-history";
import { buildLiveFaceEvaluator } from "./live-evaluator";
import { SupabaseNoveltyRepository } from "./supabase-novelty-repository";
import { SupabaseEmbeddingRepository } from "./supabase-embedding-repository";
import { SupabaseLiveDiagnosticStore } from "./supabase-diagnostic-store";
import { MemoryNoveltyRepository } from "./novelty-repository";
import { MemoryEmbeddingRepository } from "./embedding-repository";
import { MemoryLiveDiagnosticStore } from "./diagnostic-store";
import { evaluateDiscoveryNovelty } from "./novelty-policy";
import {
  markCandidateShown,
  FACE_SIMILARITY_REPLACEMENT_CONFIRMATION_MESSAGE,
  NOVELTY_REPLACEMENT_CONFIRMATION_MESSAGE,
} from "./novelty-service";
import {
  resolveNoveltyCandidateStatus,
  assertCandidateMayBecomeReady,
} from "./visibility-assertion";
import { buildSafeFaceNoveltyLiveDebug } from "./live-debug";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
  FACE_SIMILARITY_EVALUATOR_VERSION,
  FACE_SIMILARITY_EMBEDDING_DIMENSION,
  FACE_SIMILARITY_MODEL,
  FACE_SIMILARITY_THRESHOLD_VERSION,
} from "./similarity-threshold";
import { resolveEvaluatorFailureMode } from "./local-face-embedding-evaluator";
import type { FaceSimilarityEvaluator } from "./types";
import type { EmbeddingRepository } from "./embedding-repository";
import type { NoveltyRepository } from "./novelty-repository";
import type { LiveDiagnosticStore } from "./diagnostic-store";

/** Env flag enabling temporary step logs inside extractFaceEmbedding. */
export const PERSONA_FACE_NOVELTY_RETRY_TRACE_ENV = "PERSONA_FACE_NOVELTY_RETRY_TRACE";

export type RetryFaceEvaluationResult = {
  candidateId: string;
  reusedExistingImage: true;
  openaiCalls: 0;
  paidProviderCalls: 0;
  candidateStatus: PersonaCandidate["status"];
  finalDecision: "allowed" | "blocked" | "failed";
  evaluationStatus?: "performed" | "not_available";
  detectionStatus?: string;
  safeErrorCode?: string;
  safeErrorMessage?: string;
  /** Development-only exception persistence when evaluation fails. */
  errorStack?: string;
  visibleOnBoard: boolean;
  /** Last instrumentation checkpoint reached (development). */
  lastCheckpoint?: string;
};

export type RetryFaceEvaluationDeps = {
  noveltyRepo?: NoveltyRepository;
  embeddingRepo?: EmbeddingRepository;
  diagnosticStore?: LiveDiagnosticStore;
  /** Inject evaluator factory for tests — must not call paid providers. */
  buildEvaluator?: (args: {
    workspaceId: string;
    archetypeId: string;
    imageSourceMap: Map<string, string>;
  }) => Promise<FaceSimilarityEvaluator>;
  /** Inject image bytes loader for tests. */
  loadImageBytes?: (storagePath: string) => Promise<Buffer>;
};

function retryLog(checkpoint: string, detail?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  const safe = detail
    ? Object.fromEntries(
        Object.entries(detail).map(([k, v]) => {
          if (typeof v === "string" && (v.includes("?token=") || v.startsWith("data:"))) {
            return [k, "[redacted]"];
          }
          return [k, v];
        }),
      )
    : undefined;
  console.info(`[persona.novelty.retry] ${checkpoint}`, safe ?? "");
}

function assertDevOnlyRetry(): void {
  // Development-only gate. Do NOT require PERSONA_FACE_NOVELTY_DEBUG —
  // that flag gates the Live Check *panel*. Requiring it here caused a
  // silent HTTP 200 no-op while the Candidate Board still showed Retry.
  if (process.env.NODE_ENV === "production") {
    throw new PersonaDomainError(
      "Retry Face Evaluation is development-only.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }
}

/**
 * Re-run LocalFaceEmbeddingEvaluator on the candidate's stored primary image.
 * Never generates a new image. Never calls OpenAI or paid providers.
 */
export async function retryFaceNoveltyEvaluation(
  scope: WorkspaceScope,
  candidateId: string,
  deps: RetryFaceEvaluationDeps = {},
): Promise<RetryFaceEvaluationResult> {
  let lastCheckpoint = "retry_request_received";
  retryLog("1.retry_request_received", { candidateId, workspaceId: scope.workspaceId });

  const prevTrace = process.env[PERSONA_FACE_NOVELTY_RETRY_TRACE_ENV];
  process.env[PERSONA_FACE_NOVELTY_RETRY_TRACE_ENV] = "1";

  try {
    assertDevOnlyRetry();
    const startedAt = Date.now();
    const evaluatedAt = new Date().toISOString();

    const creationRepo = getCreationRepository();
    const candidate = await creationRepo.getCandidate(scope, candidateId);
    lastCheckpoint = "candidate_loaded";
    retryLog("2.candidate_loaded", {
      candidateId,
      status: candidate?.status,
      projectId: candidate?.creation_project_id,
      primaryPreviewAssetId: candidate?.primary_preview_asset_id,
    });

    if (!candidate) {
      throw new PersonaDomainError("Kandidat nicht gefunden.", "NOT_FOUND");
    }
    if (
      candidate.status !== "novelty_failed" &&
      candidate.status !== "novelty_blocked"
    ) {
      throw new PersonaDomainError(
        "Retry Face Evaluation is only allowed for novelty_failed or novelty_blocked candidates.",
        "WORKFLOW",
        { status: candidate.status },
      );
    }
    if (!candidate.primary_preview_asset_id) {
      throw new PersonaDomainError(
        "Candidate has no primary preview asset to re-evaluate.",
        "VALIDATION",
      );
    }

    const asset = await creationRepo.getCandidateAsset(
      scope,
      candidate.primary_preview_asset_id,
    );
    lastCheckpoint = "asset_loaded";
    retryLog("3.asset_loaded", {
      assetId: asset?.id,
      candidateId: asset?.candidate_id,
      mimeType: asset?.mime_type,
      storagePathRedacted: asset?.storage_path
        ? asset.storage_path.split("/").slice(-2).join("/")
        : null,
    });

    if (!asset || asset.candidate_id !== candidate.id) {
      throw new PersonaDomainError(
        "Primary asset missing for retry evaluation.",
        "NOT_FOUND",
      );
    }

    const noveltyRepo =
      deps.noveltyRepo ??
      (creationRepo.kind === "memory"
        ? new MemoryNoveltyRepository()
        : new SupabaseNoveltyRepository());
    const embeddingRepo =
      deps.embeddingRepo ??
      (creationRepo.kind === "memory"
        ? new MemoryEmbeddingRepository()
        : new SupabaseEmbeddingRepository());
    const diagnosticStore =
      deps.diagnosticStore ??
      (creationRepo.kind === "memory"
        ? new MemoryLiveDiagnosticStore()
        : new SupabaseLiveDiagnosticStore());

    const project = await creationRepo.getProject(scope, candidate.creation_project_id);
    if (!project) {
      throw new PersonaDomainError("Creation project not found.", "NOT_FOUND");
    }

    const existingRecord = await noveltyRepo.findByCandidateId(
      candidate.id,
      scope.workspaceId,
    );
    const archetypeId = existingRecord?.archetypeId || "unknown";

    const loadBytes = deps.loadImageBytes ?? downloadPersonaCandidateBytes;
    const bytes = await loadBytes(asset.storage_path);
    lastCheckpoint = "image_bytes_loaded";
    retryLog("4.image_bytes_loaded", {
      byteLength: bytes.length,
      mimeType: asset.mime_type,
    });

    const dataUrl = `data:${asset.mime_type || "image/png"};base64,${bytes.toString("base64")}`;
    const imageSourceMap = new Map<string, string>([[asset.id, dataUrl]]);

    const buildEvaluator =
      deps.buildEvaluator ??
      (async (args) =>
        buildLiveFaceEvaluator({
          workspaceId: args.workspaceId,
          archetypeId: args.archetypeId,
          imageSourceMap: args.imageSourceMap,
        }));

    const evaluator = await buildEvaluator({
      workspaceId: scope.workspaceId,
      archetypeId,
      imageSourceMap,
    });
    lastCheckpoint = "face_evaluator_entered";
    retryLog("6.face_evaluator_entered", {
      evaluatorMethod: (evaluator as { method?: string }).method,
      archetypeId,
      priorNote: "canvas/detection logs emit from extractFaceEmbedding when TRACE=1",
    });

    const history = await loadDiscoveryHistory(
      noveltyRepo,
      scope.workspaceId,
      archetypeId,
      { excludeCandidateIds: [candidate.id] },
    );

    const priorEmbeddings = (
      await embeddingRepo.loadEmbeddingsForWorkspace(scope.workspaceId, archetypeId)
    ).filter((e) => e.candidateId !== candidate.id);

    const evaluation = await evaluateDiscoveryNovelty({
      candidateId: candidate.id,
      assetId: asset.id,
      creationProjectId: candidate.creation_project_id,
      identityFingerprint:
        existingRecord?.identityFingerprint ?? `retry:${candidate.id}`,
      assetRef: {
        candidateId: candidate.id,
        assetId: asset.id,
        storageObjectKey: asset.storage_path,
        imageChecksum: asset.checksum ?? undefined,
        signedUrl: dataUrl,
      },
      history,
      faceSimilarityEvaluator: evaluator,
    });

    const rawResult = evaluation.faceSimilarity as
      | (typeof evaluation.faceSimilarity & Record<string, unknown>)
      | undefined;
    const embeddingVector = rawResult?._embedding as number[] | undefined;
    const detectionConfidence = rawResult?._detectionConfidence as number | undefined;
    const faceCount = rawResult?._faceCount as number | undefined;
    const detectionStatus = rawResult?._detectionStatus as string | undefined;
    const safeErrorCode = rawResult?._safeErrorCode as string | undefined;
    const safeErrorMessage = rawResult?._safeErrorMessage as string | undefined;
    const errorStack =
      process.env.NODE_ENV !== "production"
        ? (rawResult?._safeErrorStack as string | undefined)
        : undefined;
    const thresholdVersion = rawResult?._thresholdVersion as string | undefined;
    const evaluationStatus = evaluation.faceSimilarity?.status;

    lastCheckpoint = "face_detection_completed";
    retryLog("7.face_detection_completed", {
      detectionStatus,
      evaluationStatus,
      faceCount,
      detectionConfidence,
      safeErrorCode,
    });

    if (embeddingVector && embeddingVector.length > 0) {
      lastCheckpoint = "embedding_extracted";
      retryLog("8.embedding_extracted", {
        embeddingDimension: embeddingVector.length,
        // Never log the vector itself.
      });
    } else {
      retryLog("8.embedding_extracted", { embeddingDimension: 0, missing: true });
    }

    const comparisonExecuted =
      evaluationStatus === "performed" && priorEmbeddings.length > 0;
    lastCheckpoint = "similarity_comparison_completed";
    retryLog("9.similarity_comparison_completed", {
      comparisonExecuted,
      priorEmbeddingsCompared: priorEmbeddings.length,
      hardReject: evaluation.hardReject,
      hardRejectReason: evaluation.hardRejectReason,
      isDuplicate: evaluation.faceSimilarity?.isDuplicate,
    });

    let embeddingStatus: "created" | "reused" | "missing" = "missing";
    let embeddingDimension: number | undefined;

    const recordId = existingRecord?.id;
    if (embeddingVector && embeddingVector.length > 0 && recordId) {
      const alreadyHas = await embeddingRepo.hasEmbedding(recordId, scope.workspaceId);
      if (!alreadyHas) {
        await embeddingRepo.saveEmbedding({
          noveltyRecordId: recordId,
          workspaceId: scope.workspaceId,
          embedding: embeddingVector,
          embeddingDimension: embeddingVector.length,
          embeddingModel: "faceRecognitionNet",
          embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
          detectionConfidence: detectionConfidence ?? 0,
          faceCount: faceCount ?? 0,
          detectionStatus: (evaluationStatus === "performed"
            ? "performed"
            : (detectionStatus ?? "unavailable")) as import("./similarity-threshold").FaceDetectionStatus,
          similarityThresholdVersion:
            thresholdVersion ?? FACE_SIMILARITY_THRESHOLD_VERSION,
        });
        embeddingStatus = "created";
        embeddingDimension = embeddingVector.length;
      } else {
        embeddingStatus = "reused";
        embeddingDimension = embeddingVector.length;
      }
    }

    if (evaluation.hardReject && recordId) {
      await noveltyRepo.updateState(recordId, scope.workspaceId, "exhausted", {
        exhaustedAt: new Date().toISOString(),
      });
    }

    const statusResult = resolveNoveltyCandidateStatus({
      hardReject: evaluation.hardReject,
      hardRejectReason: evaluation.hardRejectReason,
      softWarning: evaluation.softWarning,
      softWarningReason: evaluation.softWarningReason,
      evaluationStatus,
      detectionStatus:
        detectionStatus ??
        (evaluationStatus === "performed" ? "performed" : undefined),
      evaluatorActive: true,
    });

    assertCandidateMayBecomeReady({
      proposedStatus: statusResult.status,
      evaluationStatus,
      finalDecision: statusResult.finalDecision,
      detectionStatus:
        detectionStatus ??
        (evaluationStatus === "performed" ? "performed" : undefined),
    });

    const liveDebug = buildSafeFaceNoveltyLiveDebug({
      evaluatorStatus: "active",
      evaluatorModel: FACE_SIMILARITY_MODEL,
      evaluatorVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      failureMode: resolveEvaluatorFailureMode(),
      thresholdVersion: thresholdVersion ?? FACE_SIMILARITY_THRESHOLD_VERSION,
      duplicateThreshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
      warningThreshold: FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
      priorEmbeddingsLoaded: priorEmbeddings.length,
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
      closestPriorCandidateId: evaluation.closestPriorCandidateId,
      closestPriorAssetId: evaluation.faceSimilarity?.closestMatchAssetId,
      similarity: evaluation.faceSimilarity?.similarity,
      finalDecision: statusResult.finalDecision,
      hardRejectReason: statusResult.hardRejectReason ?? evaluation.hardRejectReason,
      requiresReplacementConfirmation: statusResult.requiresReplacementConfirmation,
      evaluationDurationMs: Date.now() - startedAt,
      evaluatedAt,
      slot: candidate.candidate_number,
      candidateId: candidate.id,
      assetId: asset.id,
      candidateProjectId: candidate.creation_project_id,
      evaluatorActive: true,
      duplicateDecision: evaluation.hardRejectReason === "face_similarity_duplicate",
      safeErrorCode,
      safeErrorMessage,
    });

    if (recordId) {
      await diagnosticStore.saveEvidence(recordId, scope.workspaceId, liveDebug);
    }

    // Always attach retry diagnostics in development so board/debug can show results
    // even when PERSONA_FACE_NOVELTY_DEBUG is unset (that flag only gates the Live Check panel).
    const settingsWithDebug =
      process.env.NODE_ENV === "production"
        ? maybeAttachNoveltyDebugToSettings(candidate.generation_settings ?? {}, null)
        : {
            ...maybeAttachNoveltyDebugToSettings(candidate.generation_settings ?? {}, null),
            faceNoveltyLiveDebug: liveDebug,
          };

    const nextStatus = statusResult.status;
    await creationRepo.updateCandidate(scope, candidate.id, {
      status: nextStatus,
      generation_settings: settingsWithDebug,
      rejection_reason:
        nextStatus === "ready"
          ? ""
          : statusResult.finalDecision === "blocked"
            ? FACE_SIMILARITY_REPLACEMENT_CONFIRMATION_MESSAGE
            : NOVELTY_REPLACEMENT_CONFIRMATION_MESSAGE,
      user_notes:
        nextStatus === "ready"
          ? ""
          : `[novelty] ${statusResult.hardRejectReason ?? statusResult.finalDecision}`,
    });

    lastCheckpoint = "candidate_state_updated";
    retryLog("10.candidate_state_updated", {
      previousStatus: candidate.status,
      nextStatus,
      finalDecision: statusResult.finalDecision,
    });

    if (statusResult.finalDecision === "allowed" && recordId) {
      await markCandidateShown(noveltyRepo, recordId, scope.workspaceId);
    }

    lastCheckpoint = "retry_completed";
    retryLog("11.retry_completed", {
      candidateId: candidate.id,
      candidateStatus: nextStatus,
      finalDecision: statusResult.finalDecision,
      durationMs: Date.now() - startedAt,
    });

    return {
      candidateId: candidate.id,
      reusedExistingImage: true,
      openaiCalls: 0,
      paidProviderCalls: 0,
      candidateStatus: nextStatus,
      finalDecision: statusResult.finalDecision,
      evaluationStatus,
      detectionStatus:
        detectionStatus ??
        (evaluationStatus === "performed" ? "performed" : evaluationStatus),
      safeErrorCode,
      safeErrorMessage,
      errorStack,
      visibleOnBoard: nextStatus === "ready" && statusResult.finalDecision === "allowed",
      lastCheckpoint,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    retryLog("RETRY_FAILED", {
      lastCheckpoint,
      errorCode:
        err instanceof PersonaDomainError ? err.code : "retry_execution_error",
      errorMessage: message,
      errorStack: process.env.NODE_ENV !== "production" ? stack : undefined,
    });
    // Never swallow — rethrow after logging / checkpoint capture.
    if (err instanceof Error) {
      (err as Error & { lastCheckpoint?: string }).lastCheckpoint = lastCheckpoint;
    }
    throw err;
  } finally {
    if (prevTrace === undefined) delete process.env[PERSONA_FACE_NOVELTY_RETRY_TRACE_ENV];
    else process.env[PERSONA_FACE_NOVELTY_RETRY_TRACE_ENV] = prevTrace;
  }
}
