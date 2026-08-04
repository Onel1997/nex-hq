/**
 * Phase 2.0C — Backfill job / result repository (memory + interface).
 */

import { randomUUID } from "crypto";
import {
  HISTORICAL_BACKFILL_FORBIDDEN_STATES,
  HISTORICAL_BACKFILL_DEFAULT_BATCH_SIZE,
} from "./historical-backfill-types";
import {
  resolveHistoricalNoveltyArchetypeFilter,
  logHistoricalDiscoveryAudit,
} from "./historical-backfill-archetype-filter";
import type { FaceNoveltyState } from "./types";
import type { NoveltyRepository } from "./novelty-repository";
import type { EmbeddingRepository } from "./embedding-repository";
import type {
  BackfillJobStatus,
  BackfillResultStatus,
  FaceEmbeddingBackfillJob,
  FaceEmbeddingBackfillResult,
  HistoricalBackfillEligibilityRecord,
  SafeBackfillJobSummary,
} from "./historical-backfill-types";
import type { FaceNoveltyRecord } from "./types";

export function toSafeBackfillJobSummary(
  job: FaceEmbeddingBackfillJob,
): SafeBackfillJobSummary {
  return {
    id: job.id,
    status: job.status,
    totalRecords: job.totalRecords,
    processedRecords: job.processedRecords,
    embeddedRecords: job.embeddedRecords,
    skippedRecords: job.skippedRecords,
    failedRecords: job.failedRecords,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    evaluatorModel: job.evaluatorModel,
    evaluatorVersion: job.evaluatorVersion,
    retryFailedOnly: job.retryFailedOnly,
  };
}

export type CreateBackfillJobInput = {
  workspaceId: string;
  archetypeId?: string | null;
  totalRecords: number;
  batchSize?: number;
  retryFailedOnly?: boolean;
  evaluatorModel?: string | null;
  evaluatorVersion?: string | null;
  createdBy?: string | null;
};

export type UpsertBackfillResultInput = {
  jobId: string;
  workspaceId: string;
  noveltyRecordId: string;
  candidateId?: string | null;
  assetId?: string | null;
  resultStatus: BackfillResultStatus;
  safeErrorCode?: string | null;
  safeErrorMessage?: string | null;
  durationMs?: number | null;
};

export interface HistoricalBackfillRepository {
  createJob(input: CreateBackfillJobInput): Promise<FaceEmbeddingBackfillJob>;
  getJob(
    jobId: string,
    workspaceId: string,
  ): Promise<FaceEmbeddingBackfillJob | null>;
  getLatestJob(
    workspaceId: string,
    archetypeId?: string | null,
  ): Promise<FaceEmbeddingBackfillJob | null>;
  getRunningJob(
    workspaceId: string,
  ): Promise<FaceEmbeddingBackfillJob | null>;
  updateJob(
    jobId: string,
    workspaceId: string,
    patch: Partial<
      Pick<
        FaceEmbeddingBackfillJob,
        | "status"
        | "totalRecords"
        | "processedRecords"
        | "embeddedRecords"
        | "skippedRecords"
        | "failedRecords"
        | "startedAt"
        | "completedAt"
        | "evaluatorModel"
        | "evaluatorVersion"
      >
    >,
  ): Promise<FaceEmbeddingBackfillJob>;
  upsertResult(
    input: UpsertBackfillResultInput,
  ): Promise<FaceEmbeddingBackfillResult>;
  listResults(
    jobId: string,
    workspaceId: string,
  ): Promise<FaceEmbeddingBackfillResult[]>;
  listFailedNoveltyRecordIds(
    workspaceId: string,
    options?: { retryableOnly?: boolean },
  ): Promise<Set<string>>;
  /** Load eligibility rows for forbidden states (no embedding vectors). */
  loadEligibilityRecords(input: {
    workspaceId: string;
    archetypeId?: string | null;
  }): Promise<HistoricalBackfillEligibilityRecord[]>;
  /** Persist detection metadata without embedding (failure path). */
  saveDetectionMetadata(input: {
    noveltyRecordId: string;
    workspaceId: string;
    detectionStatus: string;
    detectionConfidence: number;
    faceCount: number;
    embeddingModel?: string;
    embeddingVersion?: string;
    similarityThresholdVersion?: string;
  }): Promise<void>;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** In-memory backfill repo — tests / ephemeral. */
export class MemoryHistoricalBackfillRepository
  implements HistoricalBackfillRepository
{
  private readonly jobs = new Map<string, FaceEmbeddingBackfillJob>();
  private readonly results = new Map<string, FaceEmbeddingBackfillResult>();
  private readonly detectionMeta = new Map<
    string,
    {
      detectionStatus: string;
      detectionConfidence: number;
      faceCount: number;
    }
  >();

  constructor(
    private readonly noveltyRepo?: NoveltyRepository,
    private readonly embeddingRepo?: EmbeddingRepository,
    /** Optional override map: noveltyRecordId → hasValidEmbedding */
    private readonly embeddingPresence = new Map<string, boolean>(),
  ) {}

  /** Test helper — mark embedding presence without vectors. */
  setEmbeddingPresence(noveltyRecordId: string, present: boolean): void {
    this.embeddingPresence.set(noveltyRecordId, present);
  }

  async createJob(input: CreateBackfillJobInput): Promise<FaceEmbeddingBackfillJob> {
    const ts = nowIso();
    const job: FaceEmbeddingBackfillJob = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      archetypeId: input.archetypeId ?? null,
      status: "pending",
      totalRecords: input.totalRecords,
      processedRecords: 0,
      embeddedRecords: 0,
      skippedRecords: 0,
      failedRecords: 0,
      batchSize: input.batchSize ?? HISTORICAL_BACKFILL_DEFAULT_BATCH_SIZE,
      retryFailedOnly: input.retryFailedOnly ?? false,
      startedAt: null,
      completedAt: null,
      evaluatorModel: input.evaluatorModel ?? null,
      evaluatorVersion: input.evaluatorVersion ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
    this.jobs.set(job.id, job);
    return { ...job };
  }

  async getJob(
    jobId: string,
    workspaceId: string,
  ): Promise<FaceEmbeddingBackfillJob | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.workspaceId !== workspaceId) return null;
    return { ...job };
  }

  async getLatestJob(
    workspaceId: string,
    archetypeId?: string | null,
  ): Promise<FaceEmbeddingBackfillJob | null> {
    const matches = [...this.jobs.values()]
      .filter((j) => j.workspaceId === workspaceId)
      .filter((j) =>
        archetypeId == null || archetypeId === ""
          ? true
          : j.archetypeId === archetypeId || j.archetypeId == null,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return matches[0] ? { ...matches[0] } : null;
  }

  async getRunningJob(
    workspaceId: string,
  ): Promise<FaceEmbeddingBackfillJob | null> {
    for (const job of this.jobs.values()) {
      if (job.workspaceId === workspaceId && job.status === "running") {
        return { ...job };
      }
    }
    return null;
  }

  async updateJob(
    jobId: string,
    workspaceId: string,
    patch: Partial<FaceEmbeddingBackfillJob>,
  ): Promise<FaceEmbeddingBackfillJob> {
    const existing = await this.getJob(jobId, workspaceId);
    if (!existing) throw new Error(`Backfill job not found: ${jobId}`);
    const next: FaceEmbeddingBackfillJob = {
      ...existing,
      ...patch,
      id: existing.id,
      workspaceId: existing.workspaceId,
      updatedAt: nowIso(),
    };
    this.jobs.set(jobId, next);
    return { ...next };
  }

  async upsertResult(
    input: UpsertBackfillResultInput,
  ): Promise<FaceEmbeddingBackfillResult> {
    const existingKey = [...this.results.values()].find(
      (r) =>
        r.jobId === input.jobId &&
        r.noveltyRecordId === input.noveltyRecordId &&
        r.workspaceId === input.workspaceId,
    );
    const row: FaceEmbeddingBackfillResult = {
      id: existingKey?.id ?? randomUUID(),
      jobId: input.jobId,
      workspaceId: input.workspaceId,
      noveltyRecordId: input.noveltyRecordId,
      candidateId: input.candidateId ?? null,
      assetId: input.assetId ?? null,
      resultStatus: input.resultStatus,
      safeErrorCode: input.safeErrorCode ?? null,
      safeErrorMessage: input.safeErrorMessage ?? null,
      durationMs: input.durationMs ?? null,
      processedAt: nowIso(),
    };
    this.results.set(row.id, row);
    return { ...row };
  }

  async listResults(
    jobId: string,
    workspaceId: string,
  ): Promise<FaceEmbeddingBackfillResult[]> {
    return [...this.results.values()]
      .filter((r) => r.jobId === jobId && r.workspaceId === workspaceId)
      .map((r) => ({ ...r }));
  }

  async listFailedNoveltyRecordIds(
    workspaceId: string,
    options?: { retryableOnly?: boolean },
  ): Promise<Set<string>> {
    const failed = new Set([
      "no_face",
      "multiple_faces",
      "low_confidence",
      "too_small",
      "missing_asset",
      "asset_load_failed",
      "evaluator_error",
    ] as BackfillResultStatus[]);
    if (options?.retryableOnly) {
      failed.delete("missing_asset");
    }
    // Prefer latest result per novelty record.
    const latest = new Map<string, FaceEmbeddingBackfillResult>();
    for (const r of this.results.values()) {
      if (r.workspaceId !== workspaceId) continue;
      const prev = latest.get(r.noveltyRecordId);
      if (!prev || r.processedAt > prev.processedAt) {
        latest.set(r.noveltyRecordId, r);
      }
    }
    const out = new Set<string>();
    for (const r of latest.values()) {
      if (failed.has(r.resultStatus)) out.add(r.noveltyRecordId);
    }
    return out;
  }

  async loadEligibilityRecords(input: {
    workspaceId: string;
    archetypeId?: string | null;
  }): Promise<HistoricalBackfillEligibilityRecord[]> {
    if (!this.noveltyRepo) return [];
    const allInWorkspace = await this.noveltyRepo.findMany({
      workspaceId: input.workspaceId,
    });
    const forbiddenAll = allInWorkspace.filter((r) =>
      (HISTORICAL_BACKFILL_FORBIDDEN_STATES as readonly string[]).includes(r.state),
    );
    const requested = input.archetypeId?.trim() || null;
    const matchingForRequested = requested
      ? forbiddenAll.filter((r) => r.archetypeId === requested).length
      : 0;
    const resolution = resolveHistoricalNoveltyArchetypeFilter({
      requestedArchetypeId: requested,
      matchingRowCountForRequested: matchingForRequested,
    });

    const filtered = resolution.effectiveArchetypeId
      ? forbiddenAll.filter((r) => r.archetypeId === resolution.effectiveArchetypeId)
      : forbiddenAll;

    const out: HistoricalBackfillEligibilityRecord[] = [];
    for (const r of filtered) {
      out.push(await this.toEligibility(r));
    }

    logHistoricalDiscoveryAudit({
      workspaceId: input.workspaceId,
      requestedArchetypeId: resolution.requestedArchetypeId,
      effectiveArchetypeId: resolution.effectiveArchetypeId,
      filterBypassReason: resolution.bypassed ? resolution.reason : null,
      startTotalRows: allInWorkspace.length,
      afterWorkspaceFilter: allInWorkspace.length,
      afterArchetypeFilter: resolution.effectiveArchetypeId
        ? matchingForRequested
        : forbiddenAll.length,
      afterForbiddenStateFilter: out.length,
      withAssetId: out.filter((r) => Boolean(r.assetId?.trim())).length,
      withEmbedding: out.filter((r) => r.hasValidEmbedding).length,
      eligibleMissingEmbedding: out.filter(
        (r) => r.assetId?.trim() && !r.hasValidEmbedding,
      ).length,
      queryPath: "MemoryNoveltyRepository.findMany + forbidden states",
    });

    return out;
  }

  private async toEligibility(
    r: FaceNoveltyRecord,
  ): Promise<HistoricalBackfillEligibilityRecord> {
    let hasValidEmbedding = this.embeddingPresence.get(r.id) ?? false;
    if (!hasValidEmbedding && this.embeddingRepo) {
      hasValidEmbedding = await this.embeddingRepo.hasEmbedding(
        r.id,
        r.workspaceId,
      );
    }
    const meta = this.detectionMeta.get(r.id);
    return {
      noveltyRecordId: r.id,
      workspaceId: r.workspaceId,
      archetypeId: r.archetypeId,
      creationProjectId: r.creationProjectId,
      candidateId: r.candidateId,
      assetId: r.assetId,
      state: r.state,
      hasValidEmbedding,
      embeddingDimension: hasValidEmbedding ? 128 : null,
      detectionStatus: meta?.detectionStatus ?? null,
      hasChecksumOrPHash: Boolean(r.imageChecksum || r.perceptualHash),
      imageChecksum: r.imageChecksum ?? null,
      perceptualHash: r.perceptualHash ?? null,
      storageObjectKey: r.storageObjectKey ?? null,
    };
  }

  async saveDetectionMetadata(input: {
    noveltyRecordId: string;
    workspaceId: string;
    detectionStatus: string;
    detectionConfidence: number;
    faceCount: number;
  }): Promise<void> {
    this.detectionMeta.set(input.noveltyRecordId, {
      detectionStatus: input.detectionStatus,
      detectionConfidence: input.detectionConfidence,
      faceCount: input.faceCount,
    });
  }
}

export function isTerminalJobStatus(status: BackfillJobStatus): boolean {
  return (
    status === "completed" ||
    status === "completed_with_errors" ||
    status === "failed"
  );
}
