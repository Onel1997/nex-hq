import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { VideoRepository } from "./repository";
import {
  videoAssetSchema,
  videoJobSchema,
  videoProjectSchema,
  type VideoAsset,
  type VideoJob,
  type VideoProject,
} from "./types";
export class MemoryVideoRepository implements VideoRepository {
  private projects = new Map<string, VideoProject>();
  private jobs = new Map<string, VideoJob>();
  private assets = new Map<string, VideoAsset>();
  async createProject(
    scope: WorkspaceScope & { actorId: string },
    p: VideoProject,
  ) {
    const parsed = videoProjectSchema.parse(p);
    if (parsed.workspaceId !== scope.workspaceId)
      throw new PersonaDomainError(
        "Wrong workspace.",
        "UNAUTHORIZED_WORKSPACE",
      );
    this.projects.set(parsed.id, structuredClone(parsed));
    return structuredClone(parsed);
  }
  async getProject(scope: WorkspaceScope, id: string) {
    const p = this.projects.get(id);
    return p?.workspaceId === scope.workspaceId ? structuredClone(p) : null;
  }
  async createJob(scope: WorkspaceScope & { actorId: string }, j: VideoJob) {
    const p = videoJobSchema.parse(j);
    if (p.workspaceId !== scope.workspaceId)
      throw new PersonaDomainError(
        "Wrong workspace.",
        "UNAUTHORIZED_WORKSPACE",
      );
    const duplicate = [...this.jobs.values()].find(
      (x) =>
        x.workspaceId === scope.workspaceId &&
        x.inputFingerprint === p.inputFingerprint &&
        !["failed", "cancelled"].includes(x.status),
    );
    if (duplicate) return structuredClone(duplicate);
    const project = this.projects.get(p.projectId);
    if (!project || project.workspaceId !== scope.workspaceId)
      throw new PersonaDomainError("Video project not found.", "NOT_FOUND");
    this.projects.set(
      project.id,
      videoProjectSchema.parse({
        ...project,
        status: "READY",
        currentSnapshot: structuredClone(p.inputSnapshot),
        updatedAt: p.updatedAt,
      }),
    );
    this.jobs.set(p.id, structuredClone(p));
    return structuredClone(p);
  }
  async getJob(scope: WorkspaceScope, id: string) {
    const j = this.jobs.get(id);
    return j?.workspaceId === scope.workspaceId ? structuredClone(j) : null;
  }
  async listJobs(scope: WorkspaceScope, limit = 50) {
    return [...this.jobs.values()]
      .filter((j) => j.workspaceId === scope.workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((job) => structuredClone(job));
  }
  async confirm(
    scope: WorkspaceScope & { actorId: string },
    id: string,
    f: string,
    now: string,
  ) {
    const j = await this.requireJob(scope, id);
    if (
      j.status !== "awaiting_confirmation" ||
      j.inputFingerprint !== f ||
      new Date(j.confirmationExpiresAt) <= new Date(now)
    )
      throw new PersonaDomainError(
        "Bestätigung ist ungültig oder abgelaufen.",
        "WORKFLOW",
      );
    return this.save({
      ...j,
      status: "confirmed",
      confirmedBy: scope.actorId,
      confirmedAt: now,
      updatedAt: now,
    });
  }
  async claim(scope: WorkspaceScope, id: string, f: string, now: string) {
    const j = await this.requireJob(scope, id);
    if (
      j.status !== "confirmed" ||
      j.inputFingerprint !== f ||
      !j.confirmedAt ||
      new Date(j.confirmationExpiresAt) <= new Date(now)
    )
      return null;
    return this.save({
      ...j,
      status: "running",
      attemptCount: j.attemptCount + 1,
      updatedAt: now,
    });
  }
  async cancel(
    scope: WorkspaceScope & { actorId: string },
    id: string,
    now: string,
  ) {
    const j = await this.requireJob(scope, id);
    if (!["awaiting_confirmation", "confirmed"].includes(j.status))
      throw new PersonaDomainError("Nur ein wartender oder bestätigter Video-Auftrag kann abgebrochen werden.", "WORKFLOW");
    return this.save({ ...j, status: "cancelled", updatedAt: now });
  }
  async markUnknown(
    scope: WorkspaceScope,
    id: string,
    reason: string,
    now: string,
  ) {
    const j = await this.requireJob(scope, id);
    return this.save({
      ...j,
      status: "unknown_outcome",
      unknownOutcomeReason: reason,
      safeRetryAllowed: false,
      updatedAt: now,
    });
  }
  async finish(
    scope: WorkspaceScope,
    jobId: string,
    asset: VideoAsset,
    now: string,
  ) {
    const j = await this.requireJob(scope, jobId);
    if (j.status !== "running")
      throw new PersonaDomainError("Video job is not running.", "WORKFLOW");
    const a = videoAssetSchema.parse(asset);
    if (a.workspaceId !== scope.workspaceId || a.jobId !== jobId)
      throw new PersonaDomainError("Video asset lineage mismatch.", "WORKFLOW");
    this.assets.set(a.id, structuredClone(a));
    const job = this.save({
      ...j,
      status: "succeeded",
      providerRequestId: a.providerRequestId,
      resultAssetId: a.id,
      updatedAt: now,
    });
    return { job, asset: structuredClone(a) };
  }
  async fail(
    scope: WorkspaceScope,
    id: string,
    code: string,
    message: string,
    safeRetry: boolean,
    now: string,
  ) {
    const j = await this.requireJob(scope, id);
    return this.save({
      ...j,
      status: "failed",
      failureCode: code,
      failureMessage: message,
      safeRetryAllowed: safeRetry,
      updatedAt: now,
    });
  }
  async getAssetByJob(scope: WorkspaceScope, jobId: string) {
    const a = [...this.assets.values()].find(
      (x) => x.workspaceId === scope.workspaceId && x.jobId === jobId,
    );
    return a ? structuredClone(a) : null;
  }
  async review(
    scope: WorkspaceScope & { actorId: string },
    assetId: string,
    input: {
      decision: "APPROVED" | "REJECTED";
      checklist: NonNullable<VideoAsset["reviewChecklist"]>;
      note: string | null;
    },
    now: string,
  ) {
    const a = this.assets.get(assetId);
    if (!a || a.workspaceId !== scope.workspaceId)
      throw new PersonaDomainError("Video asset not found.", "NOT_FOUND");
    if (
      input.decision === "APPROVED" &&
      !Object.values(input.checklist).every(Boolean)
    )
      throw new PersonaDomainError(
        "Freigabe erfordert eine vollständig bestätigte Prüfliste.",
        "WORKFLOW",
      );
    const next = videoAssetSchema.parse({
      ...a,
      reviewStatus: input.decision,
      reviewChecklist: input.checklist,
      reviewedBy: scope.actorId,
      reviewedAt: now,
      reviewNote: input.note,
      updatedAt: now,
    });
    this.assets.set(next.id, structuredClone(next));
    return structuredClone(next);
  }
  private async requireJob(scope: WorkspaceScope, id: string) {
    const j = await this.getJob(scope, id);
    if (!j) throw new PersonaDomainError("Video job not found.", "NOT_FOUND");
    return j;
  }
  private save(job: VideoJob) {
    const p = videoJobSchema.parse(job);
    this.jobs.set(p.id, structuredClone(p));
    return structuredClone(p);
  }
}
