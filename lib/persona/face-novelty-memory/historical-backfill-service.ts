/**
 * Phase 2.0C — Historical face embedding backfill service.
 *
 * Development-only. Loads stored private portrait bytes, runs
 * LocalFaceEmbeddingEvaluator locally, persists embeddings once.
 * Never calls OpenAI or any paid provider. Never generates images.
 */

import type { WorkspaceScope } from "../domain/types";
import { PersonaDomainError } from "../domain/errors";
import { downloadPersonaCandidateBytes } from "../creation/candidate-storage";
import { getCreationRepository } from "../creation/creation-factory";
import { extractFaceEmbedding } from "./local-face-embedding-evaluator";
import type { EmbeddingRepository } from "./embedding-repository";
import { MemoryEmbeddingRepository } from "./embedding-repository";
import { SupabaseEmbeddingRepository } from "./supabase-embedding-repository";
import {
  FACE_SIMILARITY_EVALUATOR_VERSION,
  FACE_SIMILARITY_MODEL,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  type FaceDetectionStatus,
} from "./similarity-threshold";
import {
  buildHistoricalBackfillPreflightSummary,
  dedupeEligibleByAsset,
  hasValidStoredEmbedding,
  isBackfillEligible,
  isForbiddenBackfillState,
  mapDetectionStatusToResultStatus,
} from "./historical-backfill-eligibility";
import {
  HISTORICAL_BACKFILL_DEFAULT_BATCH_SIZE,
  type BackfillResultStatus,
  type HistoricalBackfillBatchOutcome,
  type HistoricalBackfillEligibilityRecord,
  type HistoricalBackfillPreflightSummary,
  type SafeBackfillJobSummary,
} from "./historical-backfill-types";
import {
  MemoryHistoricalBackfillRepository,
  toSafeBackfillJobSummary,
  type HistoricalBackfillRepository,
} from "./historical-backfill-repository";
import { SupabaseHistoricalBackfillRepository } from "./supabase-historical-backfill-repository";
import { calculateExtendedHistoricalCoverage } from "./historical-backfill-coverage";
import { runFaceNoveltyPreflight } from "./preflight";
import { assertSafeFaceNoveltyDebugDto } from "./live-debug";

function backfillLog(
  checkpoint: string,
  detail?: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "production") return;
  const safe = detail
    ? Object.fromEntries(
        Object.entries(detail).map(([k, v]) => {
          if (
            typeof v === "string" &&
            (v.includes("?token=") ||
              v.startsWith("data:") ||
              v.includes("/object/sign/"))
          ) {
            return [k, "[redacted]"];
          }
          if (k.toLowerCase().includes("embedding") && Array.isArray(v)) {
            return [k, `[redacted-vector:${v.length}]`];
          }
          return [k, v];
        }),
      )
    : undefined;
  console.info(`[persona.novelty.backfill] ${checkpoint}`, safe ?? "");
}

function assertDevOnlyBackfill(): void {
  if (process.env.NODE_ENV === "production") {
    throw new PersonaDomainError(
      "Historical face embedding backfill is development-only.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }
}

export type HistoricalBackfillDeps = {
  backfillRepo?: HistoricalBackfillRepository;
  embeddingRepo?: EmbeddingRepository;
  loadImageBytes?: (storagePath: string) => Promise<Buffer>;
  extractEmbedding?: typeof extractFaceEmbedding;
  /** Injected for tests — skip real preflight TF checks. */
  evaluatorReady?: boolean;
  resolveAsset?: (input: {
    scope: WorkspaceScope;
    candidateId: string;
    assetId: string;
  }) => Promise<{
    id: string;
    candidateId: string;
    storagePath: string;
    mimeType: string;
  } | null>;
};

function defaultRepos(deps: HistoricalBackfillDeps): {
  backfillRepo: HistoricalBackfillRepository;
  embeddingRepo: EmbeddingRepository;
} {
  const creationRepo = getCreationRepository();
  const backfillRepo =
    deps.backfillRepo ??
    (creationRepo.kind === "memory"
      ? new MemoryHistoricalBackfillRepository()
      : new SupabaseHistoricalBackfillRepository());
  const embeddingRepo =
    deps.embeddingRepo ??
    (creationRepo.kind === "memory"
      ? new MemoryEmbeddingRepository()
      : new SupabaseEmbeddingRepository());
  return { backfillRepo, embeddingRepo };
}

async function defaultResolveAsset(input: {
  scope: WorkspaceScope;
  candidateId: string;
  assetId: string;
}): Promise<{
  id: string;
  candidateId: string;
  storagePath: string;
  mimeType: string;
} | null> {
  const creationRepo = getCreationRepository();
  const candidate = await creationRepo.getCandidate(input.scope, input.candidateId);
  if (!candidate) return null;
  const assetId =
    candidate.primary_preview_asset_id?.trim() || input.assetId;
  if (!assetId) return null;
  const asset = await creationRepo.getCandidateAsset(input.scope, assetId);
  if (!asset || asset.candidate_id !== candidate.id) return null;
  if (!asset.storage_path?.trim()) return null;
  return {
    id: asset.id,
    candidateId: candidate.id,
    storagePath: asset.storage_path,
    mimeType: asset.mime_type || "image/png",
  };
}

export async function loadHistoricalBackfillPreflight(
  scope: WorkspaceScope,
  options?: {
    archetypeId?: string | null;
    deps?: HistoricalBackfillDeps;
  },
): Promise<HistoricalBackfillPreflightSummary & {
  openaiCalls: 0;
  paidProviderCalls: 0;
}> {
  assertDevOnlyBackfill();
  const { backfillRepo } = defaultRepos(options?.deps ?? {});
  const records = await backfillRepo.loadEligibilityRecords({
    workspaceId: scope.workspaceId,
    archetypeId: options?.archetypeId,
  });

  let evaluatorReady = options?.deps?.evaluatorReady;
  if (evaluatorReady === undefined) {
    const report = await runFaceNoveltyPreflight();
    evaluatorReady = report.ready && report.verdict === "READY FOR CONTROLLED LIVE TEST";
  }

  const failedIds = await backfillRepo.listFailedNoveltyRecordIds(scope.workspaceId);
  const missingAssetIds = new Set<string>();
  for (const r of records) {
    if (!r.assetId?.trim()) missingAssetIds.add(r.assetId || r.noveltyRecordId);
  }

  const summary = buildHistoricalBackfillPreflightSummary({
    records,
    evaluatorReady,
    batchSize: HISTORICAL_BACKFILL_DEFAULT_BATCH_SIZE,
    missingAssetIds,
    priorDetectionFailureIds: failedIds,
  });

  const payload = {
    ...summary,
    openaiCalls: 0 as const,
    paidProviderCalls: 0 as const,
  };
  assertSafeFaceNoveltyDebugDto(payload);
  return payload;
}

export async function loadHistoricalProtectionSnapshot(
  scope: WorkspaceScope,
  options?: {
    archetypeId?: string | null;
    deps?: HistoricalBackfillDeps;
  },
) {
  const { backfillRepo } = defaultRepos(options?.deps ?? {});
  const records = await backfillRepo.loadEligibilityRecords({
    workspaceId: scope.workspaceId,
    archetypeId: options?.archetypeId,
  });
  const failedIds = await backfillRepo.listFailedNoveltyRecordIds(scope.workspaceId);
  const latest = await backfillRepo.getLatestJob(
    scope.workspaceId,
    options?.archetypeId,
  );
  const running = await backfillRepo.getRunningJob(scope.workspaceId);
  const job = running ?? latest;

  const missingAssetIds = new Set<string>();
  for (const r of records) {
    if (!r.assetId?.trim()) missingAssetIds.add("");
  }

  // Pull missing_asset results from latest job if present.
  if (job) {
    const results = await backfillRepo.listResults(job.id, scope.workspaceId);
    for (const res of results) {
      if (res.resultStatus === "missing_asset" && res.assetId) {
        missingAssetIds.add(res.assetId);
      }
    }
  }

  return calculateExtendedHistoricalCoverage({
    records,
    missingAssetIds,
    failedProcessingIds: failedIds,
    lastBackfillJob: job ? toSafeBackfillJobSummary(job) : null,
  });
}

function classifySkip(
  record: HistoricalBackfillEligibilityRecord,
  processedAssetIds: Set<string>,
  completedNoveltyIds: Set<string>,
): BackfillResultStatus | null {
  if (completedNoveltyIds.has(record.noveltyRecordId)) {
    return "skipped";
  }
  if (hasValidStoredEmbedding(record)) {
    return "already_embedded";
  }
  if (record.assetId && processedAssetIds.has(record.assetId)) {
    return "skipped";
  }
  return null;
}

async function processOneRecord(input: {
  scope: WorkspaceScope;
  record: HistoricalBackfillEligibilityRecord;
  embeddingRepo: EmbeddingRepository;
  backfillRepo: HistoricalBackfillRepository;
  loadImageBytes: (storagePath: string) => Promise<Buffer>;
  extract: typeof extractFaceEmbedding;
  resolveAsset: NonNullable<HistoricalBackfillDeps["resolveAsset"]>;
  processedAssetIds: Set<string>;
}): Promise<{
  resultStatus: BackfillResultStatus;
  safeErrorCode: string | null;
  safeErrorMessage: string | null;
  durationMs: number;
  assetId: string | null;
}> {
  const started = Date.now();
  const { record, scope } = input;

  if (record.workspaceId !== scope.workspaceId) {
    return {
      resultStatus: "skipped",
      safeErrorCode: "workspace_mismatch",
      safeErrorMessage: "Record workspace does not match active workspace",
      durationMs: Date.now() - started,
      assetId: record.assetId || null,
    };
  }

  if (!isForbiddenBackfillState(record.state)) {
    return {
      resultStatus: "skipped",
      safeErrorCode: "non_forbidden_state",
      safeErrorMessage: `State ${record.state} is not eligible for historical backfill`,
      durationMs: Date.now() - started,
      assetId: record.assetId || null,
    };
  }

  const already = await input.embeddingRepo.hasEmbedding(
    record.noveltyRecordId,
    scope.workspaceId,
  );
  if (already || hasValidStoredEmbedding(record)) {
    return {
      resultStatus: "already_embedded",
      safeErrorCode: null,
      safeErrorMessage: null,
      durationMs: Date.now() - started,
      assetId: record.assetId || null,
    };
  }

  if (record.assetId && input.processedAssetIds.has(record.assetId)) {
    return {
      resultStatus: "skipped",
      safeErrorCode: "duplicate_asset",
      safeErrorMessage: "Same asset already processed in this job",
      durationMs: Date.now() - started,
      assetId: record.assetId,
    };
  }

  if (!record.candidateId?.trim() || !record.assetId?.trim()) {
    await input.backfillRepo.saveDetectionMetadata({
      noveltyRecordId: record.noveltyRecordId,
      workspaceId: scope.workspaceId,
      detectionStatus: "unavailable",
      detectionConfidence: 0,
      faceCount: 0,
    });
    return {
      resultStatus: "missing_asset",
      safeErrorCode: "missing_asset_id",
      safeErrorMessage: "Novelty record has no valid candidate or asset id",
      durationMs: Date.now() - started,
      assetId: record.assetId || null,
    };
  }

  let asset: Awaited<ReturnType<typeof defaultResolveAsset>>;
  try {
    asset = await input.resolveAsset({
      scope,
      candidateId: record.candidateId,
      assetId: record.assetId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      resultStatus: "asset_load_failed",
      safeErrorCode: "asset_resolve_error",
      safeErrorMessage: message.slice(0, 400),
      durationMs: Date.now() - started,
      assetId: record.assetId,
    };
  }

  if (!asset) {
    await input.backfillRepo.saveDetectionMetadata({
      noveltyRecordId: record.noveltyRecordId,
      workspaceId: scope.workspaceId,
      detectionStatus: "unavailable",
      detectionConfidence: 0,
      faceCount: 0,
    });
    return {
      resultStatus: "missing_asset",
      safeErrorCode: "asset_not_found",
      safeErrorMessage: "Primary private portrait asset not found",
      durationMs: Date.now() - started,
      assetId: record.assetId,
    };
  }

  if (input.processedAssetIds.has(asset.id)) {
    return {
      resultStatus: "skipped",
      safeErrorCode: "duplicate_asset",
      safeErrorMessage: "Same asset already processed in this job",
      durationMs: Date.now() - started,
      assetId: asset.id,
    };
  }

  let bytes: Buffer;
  try {
    bytes = await input.loadImageBytes(asset.storagePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      resultStatus: "asset_load_failed",
      safeErrorCode: "storage_download_failed",
      safeErrorMessage: message
        .replace(/https?:\/\/[^\s]+/g, "[redacted-url]")
        .replace(/\?token=[^\s&]+/g, "?token=[redacted]")
        .slice(0, 400),
      durationMs: Date.now() - started,
      assetId: asset.id,
    };
  }

  if (!bytes?.length) {
    return {
      resultStatus: "asset_load_failed",
      safeErrorCode: "empty_image_bytes",
      safeErrorMessage: "Downloaded asset was empty",
      durationMs: Date.now() - started,
      assetId: asset.id,
    };
  }

  // Prefer buffer extraction — never log bytes.
  let extraction: Awaited<ReturnType<typeof extractFaceEmbedding>>;
  try {
    extraction = await input.extract(bytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await input.backfillRepo.saveDetectionMetadata({
      noveltyRecordId: record.noveltyRecordId,
      workspaceId: scope.workspaceId,
      detectionStatus: "error",
      detectionConfidence: 0,
      faceCount: 0,
      embeddingModel: FACE_SIMILARITY_MODEL,
      embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    });
    return {
      resultStatus: "evaluator_error",
      safeErrorCode: "extract_threw",
      safeErrorMessage: message.slice(0, 400),
      durationMs: Date.now() - started,
      assetId: asset.id,
    };
  }

  input.processedAssetIds.add(asset.id);

  if (extraction.status !== "performed" || !extraction.embedding?.length) {
    const resultStatus = mapDetectionStatusToResultStatus(extraction.status);
    await input.backfillRepo.saveDetectionMetadata({
      noveltyRecordId: record.noveltyRecordId,
      workspaceId: scope.workspaceId,
      detectionStatus: extraction.status,
      detectionConfidence: extraction.detectionConfidence,
      faceCount: extraction.faceCount,
      embeddingModel: extraction.embeddingModel,
      embeddingVersion: extraction.embeddingVersion,
      similarityThresholdVersion: extraction.similarityThresholdVersion,
    });
    return {
      resultStatus:
        resultStatus === "embedded" ? "evaluator_error" : resultStatus,
      safeErrorCode: extraction.safeErrorCode ?? extraction.status,
      safeErrorMessage:
        extraction.safeErrorMessage ??
        `Face detection status: ${extraction.status}`,
      durationMs: Date.now() - started,
      assetId: asset.id,
    };
  }

  // Persist embedding once.
  const stillMissing = !(await input.embeddingRepo.hasEmbedding(
    record.noveltyRecordId,
    scope.workspaceId,
  ));
  if (stillMissing) {
    await input.embeddingRepo.saveEmbedding({
      noveltyRecordId: record.noveltyRecordId,
      workspaceId: scope.workspaceId,
      embedding: extraction.embedding,
      embeddingDimension: extraction.embeddingDimension,
      embeddingModel: extraction.embeddingModel,
      embeddingVersion: extraction.embeddingVersion,
      detectionConfidence: extraction.detectionConfidence,
      faceCount: extraction.faceCount,
      detectionStatus: "performed" as FaceDetectionStatus,
      similarityThresholdVersion: extraction.similarityThresholdVersion,
    });
  }

  return {
    resultStatus: stillMissing ? "embedded" : "already_embedded",
    safeErrorCode: null,
    safeErrorMessage: null,
    durationMs: Date.now() - started,
    assetId: asset.id,
  };
}

export type StartHistoricalBackfillOptions = {
  archetypeId?: string | null;
  batchSize?: number;
  /** Continue an interrupted job instead of creating a new one. */
  resumeJobId?: string;
  /** Only re-process previously failed novelty records. */
  retryFailedOnly?: boolean;
  /** Required explicit confirmation from UI. */
  confirmed: boolean;
  createdBy?: string | null;
  deps?: HistoricalBackfillDeps;
};

/**
 * Start or resume a historical embedding backfill and process one batch.
 * Call repeatedly (or with processAllBatches) until job completes.
 */
export async function runHistoricalFaceEmbeddingBackfillBatch(
  scope: WorkspaceScope,
  options: StartHistoricalBackfillOptions,
): Promise<HistoricalBackfillBatchOutcome> {
  assertDevOnlyBackfill();
  if (!options.confirmed) {
    throw new PersonaDomainError(
      "Explicit confirmation is required before historical backfill.",
      "VALIDATION",
    );
  }

  const deps = options.deps ?? {};
  const { backfillRepo, embeddingRepo } = defaultRepos(deps);
  const loadImageBytes = deps.loadImageBytes ?? downloadPersonaCandidateBytes;
  const extract = deps.extractEmbedding ?? extractFaceEmbedding;
  const resolveAsset = deps.resolveAsset ?? defaultResolveAsset;
  const batchSize = Math.max(
    1,
    options.batchSize ?? HISTORICAL_BACKFILL_DEFAULT_BATCH_SIZE,
  );

  let evaluatorReady = deps.evaluatorReady;
  if (evaluatorReady === undefined) {
    const report = await runFaceNoveltyPreflight();
    evaluatorReady =
      report.ready && report.verdict === "READY FOR CONTROLLED LIVE TEST";
  }
  if (!evaluatorReady) {
    throw new PersonaDomainError(
      "Local face evaluator is not READY — cannot start historical backfill.",
      "WORKFLOW",
    );
  }

  let allRecords = await backfillRepo.loadEligibilityRecords({
    workspaceId: scope.workspaceId,
    archetypeId: options.archetypeId,
  });

  // Exclude other workspaces (defense in depth — repo already scopes).
  allRecords = allRecords.filter((r) => r.workspaceId === scope.workspaceId);

  if (options.retryFailedOnly) {
    const failedIds = await backfillRepo.listFailedNoveltyRecordIds(
      scope.workspaceId,
      { retryableOnly: true },
    );
    allRecords = allRecords.filter((r) => failedIds.has(r.noveltyRecordId));
  }

  const eligible = allRecords.filter((r) =>
    isBackfillEligible(r, scope.workspaceId),
  );
  const { unique: uniqueEligible } = dedupeEligibleByAsset(eligible);

  let job =
    options.resumeJobId
      ? await backfillRepo.getJob(options.resumeJobId, scope.workspaceId)
      : await backfillRepo.getRunningJob(scope.workspaceId);

  if (job && job.status !== "running" && job.status !== "pending") {
    // Completed job — only reuse when explicitly resuming the same id for retry.
    if (!options.resumeJobId || !options.retryFailedOnly) {
      job = null;
    }
  }

  if (!job) {
    job = await backfillRepo.createJob({
      workspaceId: scope.workspaceId,
      archetypeId: options.archetypeId,
      totalRecords: uniqueEligible.length,
      batchSize,
      retryFailedOnly: options.retryFailedOnly ?? false,
      evaluatorModel: FACE_SIMILARITY_MODEL,
      evaluatorVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      createdBy: options.createdBy ?? null,
    });
  }

  job = await backfillRepo.updateJob(job.id, scope.workspaceId, {
    status: "running",
    startedAt: job.startedAt ?? new Date().toISOString(),
    totalRecords: Math.max(job.totalRecords, uniqueEligible.length),
    evaluatorModel: FACE_SIMILARITY_MODEL,
    evaluatorVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
  });

  const existingResults = await backfillRepo.listResults(job.id, scope.workspaceId);
  const completedNoveltyIds = new Set(
    existingResults
      .filter((r) => r.resultStatus === "embedded" || r.resultStatus === "already_embedded")
      .map((r) => r.noveltyRecordId),
  );
  // On resume, also skip non-retryable completed failures unless retryFailedOnly.
  if (!options.retryFailedOnly) {
    for (const r of existingResults) {
      if (
        r.resultStatus === "missing_asset" ||
        r.resultStatus === "skipped"
      ) {
        completedNoveltyIds.add(r.noveltyRecordId);
      }
    }
  }

  const processedAssetIds = new Set<string>();
  for (const r of existingResults) {
    if (
      r.assetId &&
      (r.resultStatus === "embedded" || r.resultStatus === "already_embedded")
    ) {
      processedAssetIds.add(r.assetId);
    }
  }

  const queue = uniqueEligible.filter(
    (r) => !completedNoveltyIds.has(r.noveltyRecordId),
  );
  const batch = queue.slice(0, batchSize);

  backfillLog("batch_start", {
    jobId: job.id,
    batchSize: batch.length,
    remaining: queue.length,
    processedCount: job.processedRecords,
  });

  const batchResults: HistoricalBackfillBatchOutcome["results"] = [];
  let embeddedDelta = 0;
  let skippedDelta = 0;
  let failedDelta = 0;

  for (const record of batch) {
    const skip = classifySkip(record, processedAssetIds, completedNoveltyIds);
    let outcome: {
      resultStatus: BackfillResultStatus;
      safeErrorCode: string | null;
      safeErrorMessage: string | null;
      durationMs: number;
      assetId: string | null;
    };

    if (skip) {
      outcome = {
        resultStatus: skip,
        safeErrorCode: skip === "already_embedded" ? null : "preclassified_skip",
        safeErrorMessage: null,
        durationMs: 0,
        assetId: record.assetId || null,
      };
    } else {
      try {
        outcome = await processOneRecord({
          scope,
          record,
          embeddingRepo,
          backfillRepo,
          loadImageBytes,
          extract,
          resolveAsset,
          processedAssetIds,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outcome = {
          resultStatus: "evaluator_error",
          safeErrorCode: "batch_item_threw",
          safeErrorMessage: message.slice(0, 400),
          durationMs: 0,
          assetId: record.assetId || null,
        };
      }
    }

    await backfillRepo.upsertResult({
      jobId: job.id,
      workspaceId: scope.workspaceId,
      noveltyRecordId: record.noveltyRecordId,
      candidateId: record.candidateId,
      assetId: outcome.assetId,
      resultStatus: outcome.resultStatus,
      safeErrorCode: outcome.safeErrorCode,
      safeErrorMessage: outcome.safeErrorMessage,
      durationMs: outcome.durationMs,
    });

    if (outcome.resultStatus === "embedded") embeddedDelta += 1;
    else if (
      outcome.resultStatus === "already_embedded" ||
      outcome.resultStatus === "skipped"
    ) {
      skippedDelta += 1;
    } else {
      failedDelta += 1;
    }

    batchResults.push({
      noveltyRecordId: record.noveltyRecordId,
      candidateId: record.candidateId,
      assetId: outcome.assetId,
      resultStatus: outcome.resultStatus,
      safeErrorCode: outcome.safeErrorCode,
      safeErrorMessage: outcome.safeErrorMessage,
      durationMs: outcome.durationMs,
    });

    backfillLog("record_done", {
      jobId: job.id,
      candidateId: record.candidateId,
      assetId: outcome.assetId,
      resultStatus: outcome.resultStatus,
      durationMs: outcome.durationMs,
    });
  }

  const processedRecords =
    job.processedRecords + batchResults.length;
  const embeddedRecords = job.embeddedRecords + embeddedDelta;
  const skippedRecords = job.skippedRecords + skippedDelta;
  const failedRecords = job.failedRecords + failedDelta;

  const remainingAfter = Math.max(0, queue.length - batch.length);
  let status: SafeBackfillJobSummary["status"] = "running";
  let completedAt: string | null = null;
  if (remainingAfter === 0) {
    status = failedRecords > 0 ? "completed_with_errors" : "completed";
    completedAt = new Date().toISOString();
  }

  job = await backfillRepo.updateJob(job.id, scope.workspaceId, {
    status,
    processedRecords,
    embeddedRecords,
    skippedRecords,
    failedRecords,
    completedAt,
  });

  backfillLog("batch_complete", {
    jobId: job.id,
    status: job.status,
    processedCount: job.processedRecords,
    embedded: job.embeddedRecords,
    failed: job.failedRecords,
  });

  const outcome: HistoricalBackfillBatchOutcome = {
    job: toSafeBackfillJobSummary(job),
    results: batchResults,
    openaiCalls: 0,
    paidProviderCalls: 0,
  };
  assertSafeFaceNoveltyDebugDto(outcome);
  return outcome;
}

/**
 * Process all remaining batches until the job completes.
 */
export async function runHistoricalFaceEmbeddingBackfillUntilDone(
  scope: WorkspaceScope,
  options: StartHistoricalBackfillOptions,
): Promise<HistoricalBackfillBatchOutcome> {
  let last = await runHistoricalFaceEmbeddingBackfillBatch(scope, options);
  while (
    last.job.status === "running" ||
    last.job.status === "pending"
  ) {
    last = await runHistoricalFaceEmbeddingBackfillBatch(scope, {
      ...options,
      resumeJobId: last.job.id,
      confirmed: true,
    });
  }
  return last;
}
