import { randomUUID } from "node:crypto";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { CreateDeterministicJob, DeterministicJobRepository } from "@/lib/image/deterministic-runtime/repository";
import type { DeterministicImageJob } from "@/lib/image/deterministic-runtime/types";

export class MemoryDeterministicJobRepository implements DeterministicJobRepository {
  jobs = new Map<string, DeterministicImageJob>();
  async createOrGet(scope: WorkspaceScope & { actorId: string }, input: CreateDeterministicJob) {
    const existing = [...this.jobs.values()].find((job) => job.workspaceId === scope.workspaceId && job.inputFingerprint === input.fingerprint);
    if (existing) {
      const reopen = existing.status === "cancelled" || (["awaiting_confirmation", "confirmed"].includes(existing.status) && existing.confirmationExpiresAt < input.preparedAt);
      if (!reopen) return structuredClone(existing);
      const next = { ...existing, status: "awaiting_confirmation" as const, confirmationToken: null, confirmationFingerprint: null, confirmationExpiresAt: input.confirmationExpiresAt, confirmedBy: null, confirmedAt: null, cancelledAt: null, failureCode: null, failureMessage: null, safeRetryAllowed: false, updatedAt: input.preparedAt };
      this.jobs.set(next.id, next);
      return structuredClone(next);
    }
    const now = input.preparedAt;
    const job: DeterministicImageJob = {
      id: randomUUID(), workspaceId: scope.workspaceId, createdBy: scope.actorId, createdAt: now, updatedAt: now,
      inputSnapshot: input.snapshot, inputFingerprint: input.fingerprint, productionProjectId: input.snapshot.production.projectId,
      productionProjectVersion: input.snapshot.production.projectVersion, artworkStoragePath: input.artworkStoragePath,
      estimate: input.estimate, status: "awaiting_confirmation", confirmationToken: null, confirmationFingerprint: null,
      confirmationExpiresAt: input.confirmationExpiresAt, confirmedBy: null, confirmedAt: null, attemptCount: 0,
      providerRequestId: null, resultAssetIds: [], failureCode: null, failureMessage: null, safeRetryAllowed: false,
      unknownOutcomeReason: null, reconciliationState: null, startedAt: null, completedAt: null, cancelledAt: null,
    };
    for (const [id, current] of this.jobs) {
      if (current.workspaceId === scope.workspaceId && current.inputSnapshot.production.reportRecordId === input.snapshot.production.reportRecordId && current.inputSnapshot.shot.assetId === input.snapshot.shot.assetId && ["awaiting_confirmation", "confirmed", "failed"].includes(current.status)) {
        this.jobs.set(id, { ...current, status: "cancelled", failureCode: "SUPERSEDED_INPUT", cancelledAt: now, updatedAt: now });
      }
    }
    this.jobs.set(job.id, job); return structuredClone(job);
  }
  async get(scope: WorkspaceScope, id: string) { const job = this.jobs.get(id); return job?.workspaceId === scope.workspaceId ? structuredClone(job) : null; }
  async list(scope: WorkspaceScope, filters: { projectId?: string; limit?: number } = {}) { const jobs = [...this.jobs.values()].filter((job) => job.workspaceId === scope.workspaceId && (!filters.projectId || job.productionProjectId === filters.projectId)).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)); return jobs.slice(0, filters.limit ?? jobs.length).map((job) => structuredClone(job)); }
  private require(scope: WorkspaceScope, id: string) { const job = this.jobs.get(id); if (!job || job.workspaceId !== scope.workspaceId) throw new Error("Job not found"); return job; }
  async confirm(scope: WorkspaceScope & { actorId: string }, id: string, fingerprint: string, token: string, now: string) { const job=this.require(scope,id); if(job.status!=="awaiting_confirmation"||job.inputFingerprint!==fingerprint||job.confirmationExpiresAt<now) throw new Error("Confirmation mismatch"); const next={...job,status:"confirmed" as const,confirmationToken:token,confirmationFingerprint:fingerprint,confirmedBy:scope.actorId,confirmedAt:now,updatedAt:now}; this.jobs.set(id,next); return structuredClone(next); }
  async claimBase(scope: WorkspaceScope,id:string,fingerprint:string,now:string){const job=this.require(scope,id);if(job.status!=="confirmed"||job.confirmationFingerprint!==fingerprint||job.confirmationExpiresAt<now)return null;const next={...job,status:"running" as const,attemptCount:job.attemptCount+1,startedAt:now,updatedAt:now};this.jobs.set(id,next);return structuredClone(next);}
  async claimCompositeRetry(scope:WorkspaceScope,id:string,fingerprint:string,now:string){const job=this.require(scope,id);if(job.status!=="failed"||!["DETERMINISTIC_COMPOSITE_FAILED","SURFACE_INTEGRATION_UNSAFE","DEPTH_AWARE_SURFACE_UNSAFE","SURFACE_REALISM_REFINEMENT_UNSAFE","DEPTH_ESTIMATION_FAILED"].includes(job.failureCode??"")||job.inputFingerprint!==fingerprint)return false;this.jobs.set(id,{...job,status:"running",failureCode:null,failureMessage:null,completedAt:null,updatedAt:now});return true;}
  async markSucceeded(scope:WorkspaceScope,id:string,assetId:string,providerRequestId:string|null,now:string){const job=this.require(scope,id);if(job.status!=="running")throw new Error("Job is not running");const next={...job,status:"succeeded" as const,providerRequestId,resultAssetIds:[assetId],completedAt:now,updatedAt:now};this.jobs.set(id,next);return structuredClone(next);}
  async markFailed(scope:WorkspaceScope,id:string,input:{code:string;message:string;now:string}){const job=this.require(scope,id);if(job.status!=="running")throw new Error("Job is not running");const next={...job,status:"failed" as const,failureCode:input.code,failureMessage:input.message,completedAt:input.now,updatedAt:input.now};this.jobs.set(id,next);return structuredClone(next);}
  async markUnknown(scope:WorkspaceScope,id:string,input:{providerRequestId:string|null;reason:string;now:string}){const job=this.require(scope,id);if(job.status!=="running")throw new Error("Job is not running");const next={...job,status:"unknown_outcome" as const,providerRequestId:input.providerRequestId,unknownOutcomeReason:input.reason,reconciliationState:"required" as const,completedAt:input.now,updatedAt:input.now};this.jobs.set(id,next);return structuredClone(next);}
}
