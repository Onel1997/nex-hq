/**
 * Phase 2.0C — Supabase historical backfill job / eligibility repository.
 * Server-only. Never returns embedding vectors to callers of eligibility APIs.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "../domain/errors";
import type {
  CreateBackfillJobInput,
  HistoricalBackfillRepository,
  UpsertBackfillResultInput,
} from "./historical-backfill-repository";
import {
  HISTORICAL_BACKFILL_DEFAULT_BATCH_SIZE,
  HISTORICAL_BACKFILL_FORBIDDEN_STATES,
  type BackfillResultStatus,
  type FaceEmbeddingBackfillJob,
  type FaceEmbeddingBackfillResult,
  type HistoricalBackfillEligibilityRecord,
} from "./historical-backfill-types";
import type { FaceNoveltyState } from "./types";
import {
  logHistoricalDiscoveryAudit,
  resolveHistoricalNoveltyArchetypeFilter,
} from "./historical-backfill-archetype-filter";

const JOBS = "persona_face_embedding_backfill_jobs";
const RESULTS = "persona_face_embedding_backfill_results";
const NOVELTY = "persona_face_novelty_records";

function throwDb(error: { message: string } | null, msg: string) {
  if (error) throw new PersonaDomainError(msg, "VALIDATION", { message: error.message });
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function nullableStr(v: unknown): string | null {
  if (v == null) return null;
  return str(v);
}

function mapJob(row: Record<string, unknown>): FaceEmbeddingBackfillJob {
  return {
    id: str(row.id),
    workspaceId: str(row.workspace_id),
    archetypeId: nullableStr(row.archetype_id),
    status: str(row.status) as FaceEmbeddingBackfillJob["status"],
    totalRecords: num(row.total_records),
    processedRecords: num(row.processed_records),
    embeddedRecords: num(row.embedded_records),
    skippedRecords: num(row.skipped_records),
    failedRecords: num(row.failed_records),
    batchSize: num(row.batch_size, HISTORICAL_BACKFILL_DEFAULT_BATCH_SIZE),
    retryFailedOnly: Boolean(row.retry_failed_only),
    startedAt: nullableStr(row.started_at),
    completedAt: nullableStr(row.completed_at),
    evaluatorModel: nullableStr(row.evaluator_model),
    evaluatorVersion: nullableStr(row.evaluator_version),
    createdBy: nullableStr(row.created_by),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

function mapResult(row: Record<string, unknown>): FaceEmbeddingBackfillResult {
  return {
    id: str(row.id),
    jobId: str(row.job_id),
    workspaceId: str(row.workspace_id),
    noveltyRecordId: str(row.novelty_record_id),
    candidateId: nullableStr(row.candidate_id),
    assetId: nullableStr(row.asset_id),
    resultStatus: str(row.result_status) as BackfillResultStatus,
    safeErrorCode: nullableStr(row.safe_error_code),
    safeErrorMessage: nullableStr(row.safe_error_message),
    durationMs:
      typeof row.duration_ms === "number" ? row.duration_ms : null,
    processedAt: str(row.processed_at),
  };
}

function isValidEmbeddingJson(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

export class SupabaseHistoricalBackfillRepository
  implements HistoricalBackfillRepository
{
  async createJob(input: CreateBackfillJobInput): Promise<FaceEmbeddingBackfillJob> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(JOBS)
      .insert({
        workspace_id: input.workspaceId,
        archetype_id: input.archetypeId ?? null,
        status: "pending",
        total_records: input.totalRecords,
        batch_size: input.batchSize ?? HISTORICAL_BACKFILL_DEFAULT_BATCH_SIZE,
        retry_failed_only: input.retryFailedOnly ?? false,
        evaluator_model: input.evaluatorModel ?? null,
        evaluator_version: input.evaluatorVersion ?? null,
        created_by: input.createdBy ?? null,
      })
      .select("*")
      .single();
    throwDb(error, "Failed to create face embedding backfill job");
    return mapJob(data as Record<string, unknown>);
  }

  async getJob(
    jobId: string,
    workspaceId: string,
  ): Promise<FaceEmbeddingBackfillJob | null> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(JOBS)
      .select("*")
      .eq("id", jobId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    throwDb(error, "Failed to load backfill job");
    if (!data) return null;
    return mapJob(data as Record<string, unknown>);
  }

  async getLatestJob(
    workspaceId: string,
    archetypeId?: string | null,
  ): Promise<FaceEmbeddingBackfillJob | null> {
    const client = createAdminClient();
    let query = client
      .from(JOBS)
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (archetypeId) {
      query = query.or(`archetype_id.eq.${archetypeId},archetype_id.is.null`);
    }
    const { data, error } = await query.maybeSingle();
    throwDb(error, "Failed to load latest backfill job");
    if (!data) return null;
    return mapJob(data as Record<string, unknown>);
  }

  async getRunningJob(
    workspaceId: string,
  ): Promise<FaceEmbeddingBackfillJob | null> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(JOBS)
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("status", "running")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwDb(error, "Failed to load running backfill job");
    if (!data) return null;
    return mapJob(data as Record<string, unknown>);
  }

  async updateJob(
    jobId: string,
    workspaceId: string,
    patch: Partial<FaceEmbeddingBackfillJob>,
  ): Promise<FaceEmbeddingBackfillJob> {
    const client = createAdminClient();
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.totalRecords !== undefined) update.total_records = patch.totalRecords;
    if (patch.processedRecords !== undefined) {
      update.processed_records = patch.processedRecords;
    }
    if (patch.embeddedRecords !== undefined) {
      update.embedded_records = patch.embeddedRecords;
    }
    if (patch.skippedRecords !== undefined) update.skipped_records = patch.skippedRecords;
    if (patch.failedRecords !== undefined) update.failed_records = patch.failedRecords;
    if (patch.startedAt !== undefined) update.started_at = patch.startedAt;
    if (patch.completedAt !== undefined) update.completed_at = patch.completedAt;
    if (patch.evaluatorModel !== undefined) {
      update.evaluator_model = patch.evaluatorModel;
    }
    if (patch.evaluatorVersion !== undefined) {
      update.evaluator_version = patch.evaluatorVersion;
    }

    const { data, error } = await client
      .from(JOBS)
      .update(update)
      .eq("id", jobId)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();
    throwDb(error, "Failed to update backfill job");
    return mapJob(data as Record<string, unknown>);
  }

  async upsertResult(
    input: UpsertBackfillResultInput,
  ): Promise<FaceEmbeddingBackfillResult> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(RESULTS)
      .upsert(
        {
          job_id: input.jobId,
          workspace_id: input.workspaceId,
          novelty_record_id: input.noveltyRecordId,
          candidate_id: input.candidateId ?? null,
          asset_id: input.assetId ?? null,
          result_status: input.resultStatus,
          safe_error_code: input.safeErrorCode ?? null,
          safe_error_message: input.safeErrorMessage ?? null,
          duration_ms: input.durationMs ?? null,
          processed_at: new Date().toISOString(),
        },
        { onConflict: "job_id,novelty_record_id" },
      )
      .select("*")
      .single();
    throwDb(error, "Failed to upsert backfill result");
    return mapResult(data as Record<string, unknown>);
  }

  async listResults(
    jobId: string,
    workspaceId: string,
  ): Promise<FaceEmbeddingBackfillResult[]> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(RESULTS)
      .select("*")
      .eq("job_id", jobId)
      .eq("workspace_id", workspaceId);
    throwDb(error, "Failed to list backfill results");
    return (data ?? []).map((row) => mapResult(row as Record<string, unknown>));
  }

  async listFailedNoveltyRecordIds(
    workspaceId: string,
    options?: { retryableOnly?: boolean },
  ): Promise<Set<string>> {
    const client = createAdminClient();
    const statuses: BackfillResultStatus[] = [
      "no_face",
      "multiple_faces",
      "low_confidence",
      "too_small",
      "asset_load_failed",
      "evaluator_error",
    ];
    if (!options?.retryableOnly) {
      statuses.push("missing_asset");
    }
    const { data, error } = await client
      .from(RESULTS)
      .select("novelty_record_id, result_status, processed_at")
      .eq("workspace_id", workspaceId)
      .in("result_status", statuses)
      .order("processed_at", { ascending: false });
    throwDb(error, "Failed to list failed backfill novelty ids");
    const latest = new Set<string>();
    for (const row of data ?? []) {
      latest.add(str((row as Record<string, unknown>).novelty_record_id));
    }
    return latest;
  }

  async loadEligibilityRecords(input: {
    workspaceId: string;
    archetypeId?: string | null;
  }): Promise<HistoricalBackfillEligibilityRecord[]> {
    const client = createAdminClient();
    const forbiddenStates = [...HISTORICAL_BACKFILL_FORBIDDEN_STATES];

    // --- Audit funnel (Phase 2.0C.2) ---
    const { count: startTotalRows, error: startErr } = await client
      .from(NOVELTY)
      .select("id", { count: "exact", head: true });
    throwDb(startErr, "Failed to count novelty records");

    const { count: afterWorkspaceFilter, error: wsErr } = await client
      .from(NOVELTY)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId);
    throwDb(wsErr, "Failed to count workspace novelty records");

    const requested = input.archetypeId?.trim() || null;
    let matchingForRequested = 0;
    if (requested) {
      const { count, error } = await client
        .from(NOVELTY)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", input.workspaceId)
        .eq("archetype_id", requested)
        .in("state", forbiddenStates);
      throwDb(error, "Failed to count novelty records for requested archetype");
      matchingForRequested = count ?? 0;
    }

    const resolution = resolveHistoricalNoveltyArchetypeFilter({
      requestedArchetypeId: requested,
      matchingRowCountForRequested: matchingForRequested,
    });

    const { count: afterForbiddenStateFilter, error: forbErr } = await client
      .from(NOVELTY)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .in("state", forbiddenStates);
    throwDb(forbErr, "Failed to count forbidden novelty records");

    // Select embedding presence metadata only — never return the vector to callers.
    let query = client
      .from(NOVELTY)
      .select(
        "id, workspace_id, archetype_id, creation_project_id, candidate_id, asset_id, state, " +
          "image_checksum, perceptual_hash, storage_object_key, " +
          "face_embedding_dimension, face_detection_status, live_evaluation_evidence, " +
          "face_embedding",
      )
      .eq("workspace_id", input.workspaceId)
      .in("state", forbiddenStates);

    if (resolution.effectiveArchetypeId) {
      query = query.eq("archetype_id", resolution.effectiveArchetypeId);
    }

    const { data, error } = await query;
    throwDb(error, "Failed to load historical backfill eligibility records");

    const mapped = (data ?? []).map((row) => {
      const r = row as unknown as Record<string, unknown>;
      const embedding = r.face_embedding;
      const hasValidEmbedding = isValidEmbeddingJson(embedding);
      // Drop vector immediately — never keep it on the eligibility DTO.
      return {
        noveltyRecordId: str(r.id),
        workspaceId: str(r.workspace_id),
        archetypeId: str(r.archetype_id),
        creationProjectId: str(r.creation_project_id),
        candidateId: str(r.candidate_id),
        assetId: str(r.asset_id),
        state: str(r.state) as FaceNoveltyState,
        hasValidEmbedding,
        embeddingDimension: hasValidEmbedding
          ? num(r.face_embedding_dimension, Array.isArray(embedding) ? embedding.length : 0)
          : null,
        detectionStatus: nullableStr(r.face_detection_status),
        hasChecksumOrPHash: Boolean(r.image_checksum || r.perceptual_hash),
        imageChecksum: nullableStr(r.image_checksum),
        perceptualHash: nullableStr(r.perceptual_hash),
        storageObjectKey: nullableStr(r.storage_object_key),
        liveEvaluationFinalDecision:
          typeof (r.live_evaluation_evidence as { finalDecision?: unknown } | null)
            ?.finalDecision === "string"
            ? ((r.live_evaluation_evidence as { finalDecision: string }).finalDecision)
            : null,
      } satisfies HistoricalBackfillEligibilityRecord;
    });

    const withAssetId = mapped.filter((r) => Boolean(r.assetId?.trim())).length;
    const withEmbedding = mapped.filter((r) => r.hasValidEmbedding).length;
    const eligibleMissingEmbedding = mapped.filter(
      (r) => r.assetId?.trim() && !r.hasValidEmbedding,
    ).length;

    logHistoricalDiscoveryAudit({
      workspaceId: input.workspaceId,
      requestedArchetypeId: resolution.requestedArchetypeId,
      effectiveArchetypeId: resolution.effectiveArchetypeId,
      filterBypassReason: resolution.bypassed ? resolution.reason : null,
      startTotalRows: startTotalRows ?? 0,
      afterWorkspaceFilter: afterWorkspaceFilter ?? 0,
      afterArchetypeFilter: resolution.effectiveArchetypeId
        ? matchingForRequested
        : afterForbiddenStateFilter ?? 0,
      afterForbiddenStateFilter: mapped.length,
      withAssetId,
      withEmbedding,
      eligibleMissingEmbedding,
      queryPath:
        "persona_face_novelty_records" +
        " | .eq(workspace_id)" +
        " | .in(state, forbidden)" +
        (resolution.effectiveArchetypeId
          ? ` | .eq(archetype_id, ${resolution.effectiveArchetypeId})`
          : " | archetype_filter=BYPASSED_workspace_scope"),
    });

    return mapped;
  }

  async saveDetectionMetadata(input: {
    noveltyRecordId: string;
    workspaceId: string;
    detectionStatus: string;
    detectionConfidence: number;
    faceCount: number;
    embeddingModel?: string;
    embeddingVersion?: string;
    similarityThresholdVersion?: string;
  }): Promise<void> {
    const client = createAdminClient();
    const update: Record<string, unknown> = {
      face_detection_status: input.detectionStatus,
      face_detection_confidence: input.detectionConfidence,
      face_count: input.faceCount,
    };
    if (input.embeddingModel) update.face_embedding_model = input.embeddingModel;
    if (input.embeddingVersion) {
      update.face_embedding_version = input.embeddingVersion;
    }
    if (input.similarityThresholdVersion) {
      update.similarity_threshold_version = input.similarityThresholdVersion;
    }
    const { error } = await client
      .from(NOVELTY)
      .update(update)
      .eq("id", input.noveltyRecordId)
      .eq("workspace_id", input.workspaceId);
    throwDb(error, "Failed to save face detection metadata");
  }
}
