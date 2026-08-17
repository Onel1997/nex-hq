import { randomUUID } from "node:crypto";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { CreateImageGenerationJob, ImageGenerationJobRepository } from "./repository";
import type { ImageGenerationJob } from "./types";

export class MemoryImageGenerationJobRepository implements ImageGenerationJobRepository {
  private jobs = new Map<string, ImageGenerationJob>();

  async assertCanPrepare(scope: WorkspaceScope, reportRecordId: string, assetId: string) {
    const unresolved = [...this.jobs.values()].find(
      (job) =>
        job.workspaceId === scope.workspaceId &&
        job.inputSnapshot.production.reportRecordId === reportRecordId &&
        job.inputSnapshot.production.assetId === assetId &&
        (job.status === "running" || job.status === "unknown_outcome"),
    );
    if (unresolved) {
      throw new PersonaDomainError(
        unresolved.status === "unknown_outcome"
          ? "Prior provider outcome is unknown."
          : "Paid execution is running.",
        "WORKFLOW",
      );
    }
  }

  async createOrGet(scope: WorkspaceScope & { actorId: string }, input: CreateImageGenerationJob) {
    const existing = [...this.jobs.values()].find((j) => j.workspaceId === scope.workspaceId && j.inputFingerprint === input.inputFingerprint);
    if (existing) {
      if (
        existing.status === "cancelled" ||
        (["awaiting_confirmation", "confirmed"].includes(existing.status) &&
          existing.confirmationExpiresAt < input.preparedAt)
      ) {
        const reopened: ImageGenerationJob = {
          ...existing,
          status: "awaiting_confirmation",
          confirmationToken: null,
          confirmationFingerprint: null,
          confirmedBy: null,
          confirmedAt: null,
          confirmationExpiresAt: input.confirmationExpiresAt,
          cancelledAt: null,
          failureCode: null,
          failureMessage: null,
          safeRetryAllowed: false,
          updatedAt: new Date().toISOString(),
        };
        this.jobs.set(existing.id, reopened);
        return structuredClone(reopened);
      }
      return structuredClone(existing);
    }
    const unresolved = [...this.jobs.values()].find((j) =>
      j.workspaceId === scope.workspaceId &&
      j.inputSnapshot.production.reportRecordId === input.inputSnapshot.production.reportRecordId &&
      j.inputSnapshot.production.assetId === input.inputSnapshot.production.assetId &&
      (j.status === "running" || j.status === "unknown_outcome"),
    );
    if (unresolved) {
      throw new PersonaDomainError(
        unresolved.status === "unknown_outcome"
          ? "Prior provider outcome is unknown."
          : "Paid execution is running.",
        "WORKFLOW",
      );
    }
    const now = new Date().toISOString();
    for (const [id, job] of this.jobs) {
      if (job.workspaceId === scope.workspaceId && job.inputSnapshot.production.reportRecordId === input.inputSnapshot.production.reportRecordId && job.inputSnapshot.production.assetId === input.inputSnapshot.production.assetId && ["awaiting_confirmation", "confirmed", "failed"].includes(job.status)) {
        this.jobs.set(id, { ...job, status: "cancelled", cancelledAt: now, failureCode: "SUPERSEDED_INPUT", failureMessage: "A changed paid-critical input was prepared.", updatedAt: now });
      }
    }
    const job: ImageGenerationJob = {
      id: randomUUID(), workspaceId: scope.workspaceId, createdBy: scope.actorId, createdAt: now, updatedAt: now,
      inputSnapshot: input.inputSnapshot, inputFingerprint: input.inputFingerprint,
      productionProjectId: input.inputSnapshot.production.projectId,
      productionProjectVersion: input.inputSnapshot.production.projectVersion,
      artworkStoragePath: input.artworkStoragePath, estimate: input.estimate,
      status: "awaiting_confirmation", confirmationToken: null, confirmationFingerprint: null,
      confirmationExpiresAt: input.confirmationExpiresAt,
      confirmedBy: null, confirmedAt: null, attemptCount: 0, providerRequestId: null,
      resultAssetIds: [], failureCode: null, failureMessage: null, safeRetryAllowed: false,
      unknownOutcomeReason: null, reconciliationState: null, startedAt: null,
      completedAt: null, cancelledAt: null,
    };
    this.jobs.set(job.id, job); return structuredClone(job);
  }
  async get(scope: WorkspaceScope, id: string) {
    const job = this.jobs.get(id);
    return job?.workspaceId === scope.workspaceId ? structuredClone(job) : null;
  }
  async list(
    scope: WorkspaceScope,
    filters: { productionProjectId?: string; reportRecordId?: string; assetId?: string } = {},
  ) {
    return [...this.jobs.values()]
      .filter(
        (job) =>
          job.workspaceId === scope.workspaceId &&
          (!filters.productionProjectId ||
            job.productionProjectId === filters.productionProjectId) &&
          (!filters.reportRecordId ||
            job.inputSnapshot.production.reportRecordId === filters.reportRecordId) &&
          (!filters.assetId ||
            job.inputSnapshot.production.assetId === filters.assetId),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((job) => structuredClone(job));
  }
  private require(scope: WorkspaceScope, id: string) {
    const job = this.jobs.get(id);
    if (!job || job.workspaceId !== scope.workspaceId) throw new PersonaDomainError("Job not found.", "NOT_FOUND");
    return job;
  }
  async confirm(scope: WorkspaceScope & { actorId: string }, id: string, fingerprint: string, token: string, now: string) {
    const job = this.require(scope, id);
    if (job.status === "confirmed" && job.confirmationFingerprint === fingerprint) return structuredClone(job);
    if (job.status !== "awaiting_confirmation" || job.inputFingerprint !== fingerprint || job.confirmationExpiresAt < now) throw new PersonaDomainError("Confirmation mismatch or expired.", "WORKFLOW");
    const next: ImageGenerationJob = { ...job, status: "confirmed", confirmationToken: token, confirmationFingerprint: fingerprint, confirmedBy: scope.actorId, confirmedAt: now, updatedAt: now };
    this.jobs.set(id, next); return structuredClone(next);
  }
  async cancel(scope: WorkspaceScope, id: string, fingerprint: string, now: string) {
    const job = this.require(scope, id);
    if (job.inputFingerprint !== fingerprint || !["awaiting_confirmation", "confirmed", "failed"].includes(job.status)) throw new PersonaDomainError("Cannot cancel.", "WORKFLOW");
    const next: ImageGenerationJob = { ...job, status: "cancelled", cancelledAt: now, updatedAt: now };
    this.jobs.set(id, next); return structuredClone(next);
  }
  async claim(scope: WorkspaceScope, id: string, fingerprint: string, retryKnownFailure: boolean, now: string) {
    const job = this.require(scope, id);
    const valid = job.inputFingerprint === fingerprint && job.confirmationFingerprint === fingerprint && Boolean(job.confirmedAt) && job.confirmationExpiresAt >= now && (job.status === "confirmed" || (retryKnownFailure && job.status === "failed" && job.safeRetryAllowed));
    if (!valid) return null;
    const next: ImageGenerationJob = { ...job, status: "running", attemptCount: job.attemptCount + 1, startedAt: now, completedAt: null, safeRetryAllowed: false, failureCode: null, failureMessage: null, updatedAt: now };
    this.jobs.set(id, next); return structuredClone(next);
  }
  private patch(scope: WorkspaceScope, id: string, patch: Partial<ImageGenerationJob>) {
    const job = this.require(scope, id);
    if (job.status !== "running") throw new PersonaDomainError("Job is not running.", "WORKFLOW");
    const next = { ...job, ...patch };
    this.jobs.set(id, next); return structuredClone(next);
  }
  async markSucceeded(scope: WorkspaceScope, id: string, input: { providerRequestId: string | null; resultAssetIds: string[]; now: string }) { return this.patch(scope, id, { status: "succeeded", providerRequestId: input.providerRequestId, resultAssetIds: input.resultAssetIds, completedAt: input.now, updatedAt: input.now }); }
  async markFailed(scope: WorkspaceScope, id: string, input: { code: string; message: string; safeRetryAllowed: boolean; now: string }) { return this.patch(scope, id, { status: "failed", failureCode: input.code, failureMessage: input.message, safeRetryAllowed: input.safeRetryAllowed, completedAt: input.now, updatedAt: input.now }); }
  async markUnknown(scope: WorkspaceScope, id: string, input: { providerRequestId: string | null; reason: string; now: string }) { return this.patch(scope, id, { status: "unknown_outcome", providerRequestId: input.providerRequestId, unknownOutcomeReason: input.reason, reconciliationState: "required", safeRetryAllowed: false, completedAt: input.now, updatedAt: input.now }); }
}
