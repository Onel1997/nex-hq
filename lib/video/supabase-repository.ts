import { createAdminClient } from "@/lib/supabase/admin";
import {
  PersonaDomainError,
  PersonaStoreError,
} from "@/lib/persona/domain/errors";
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
const p = (r: Record<string, unknown>) =>
  videoProjectSchema.parse({
    id: r.id,
    workspaceId: r.workspace_id,
    version: Number(r.version),
    name: r.name,
    status: r.status,
    currentSnapshot: r.current_snapshot,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
const j = (r: Record<string, unknown>) =>
  videoJobSchema.parse({
    id: r.id,
    workspaceId: r.workspace_id,
    projectId: r.project_id,
    createdBy: r.created_by,
    inputSnapshot: r.input_snapshot,
    inputFingerprint: r.input_fingerprint,
    estimate: r.estimate,
    status: r.status,
    confirmationExpiresAt: r.confirmation_expires_at,
    confirmedBy: r.confirmed_by,
    confirmedAt: r.confirmed_at,
    attemptCount: Number(r.attempt_count),
    providerRequestId: r.provider_request_id,
    resultAssetId: r.result_asset_id,
    failureCode: r.failure_code,
    failureMessage: r.failure_message,
    safeRetryAllowed: r.safe_retry_allowed,
    unknownOutcomeReason: r.unknown_outcome_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
const a = (r: Record<string, unknown>) =>
  videoAssetSchema.parse({
    id: r.id,
    workspaceId: r.workspace_id,
    projectId: r.project_id,
    jobId: r.job_id,
    inputFingerprint: r.input_fingerprint,
    storagePath: r.storage_path,
    checksum: r.checksum,
    mimeType: r.mime_type,
    provider: r.provider,
    model: r.model,
    providerRequestId: r.provider_request_id,
    sourceImageAssetId: r.source_image_asset_id,
    durationSeconds: Number(r.duration_seconds),
    aspectRatio: r.aspect_ratio,
    width: r.width,
    height: r.height,
    codec: r.codec,
    container: r.container,
    provenance: r.provenance,
    reviewStatus: r.review_status,
    reviewChecklist: r.review_checklist,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    reviewNote: r.review_note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
export class SupabaseVideoRepository implements VideoRepository {
  async createProject(
    scope: WorkspaceScope & { actorId: string },
    v: VideoProject,
  ) {
    const { data, error } = await createAdminClient()
      .from("video_production_projects")
      .insert({
        id: v.id,
        workspace_id: scope.workspaceId,
        version: v.version,
        name: v.name,
        status: v.status,
        current_snapshot: v.currentSnapshot,
        created_by: scope.actorId,
        created_at: v.createdAt,
        updated_at: v.updatedAt,
      })
      .select("*")
      .single();
    if (data) return p(data as Record<string, unknown>);
    const replay = await createAdminClient()
      .from("video_production_projects")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("id", v.id)
      .maybeSingle();
    if (replay.data) return p(replay.data as Record<string, unknown>);
    throw new PersonaStoreError(
      error?.message ?? "Video project persistence failed.",
    );
  }
  async getProject(scope: WorkspaceScope, id: string) {
    const { data, error } = await createAdminClient()
      .from("video_production_projects")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? p(data as Record<string, unknown>) : null;
  }
  async createJob(scope: WorkspaceScope & { actorId: string }, v: VideoJob) {
    const values = {
      id: v.id,
      workspace_id: scope.workspaceId,
      project_id: v.projectId,
      created_by: scope.actorId,
      input_snapshot: v.inputSnapshot,
      input_fingerprint: v.inputFingerprint,
      estimate: v.estimate,
      status: v.status,
      confirmation_expires_at: v.confirmationExpiresAt,
      confirmed_by: null,
      confirmed_at: null,
      attempt_count: 0,
      safe_retry_allowed: false,
      created_at: v.createdAt,
      updated_at: v.updatedAt,
    };
    const { data, error } = await createAdminClient()
      .from("video_generation_jobs")
      .insert(values)
      .select("*")
      .single();
    let persisted = data ? j(data as Record<string, unknown>) : null;
    if (!persisted) {
      const replay = await createAdminClient()
        .from("video_generation_jobs")
        .select("*")
        .eq("workspace_id", scope.workspaceId)
        .eq("input_fingerprint", v.inputFingerprint)
        .maybeSingle();
      if (replay.data) persisted = j(replay.data as Record<string, unknown>);
      else
        throw new PersonaStoreError(
          error?.message ?? "Video job persistence failed.",
        );
    }
    const { error: projectError } = await createAdminClient()
      .from("video_production_projects")
      .update({
        status: "READY",
        current_snapshot: persisted.inputSnapshot,
        updated_at: persisted.updatedAt,
      })
      .eq("workspace_id", scope.workspaceId)
      .eq("id", persisted.projectId);
    if (projectError) throw new PersonaStoreError(projectError.message);
    return persisted;
  }
  async getJob(scope: WorkspaceScope, id: string) {
    const { data, error } = await createAdminClient()
      .from("video_generation_jobs")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? j(data as Record<string, unknown>) : null;
  }
  async listJobs(scope: WorkspaceScope, limit = 50) {
    const { data, error } = await createAdminClient()
      .from("video_generation_jobs")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));
    if (error) throw new PersonaStoreError(error.message);
    return (data ?? []).map((r) => j(r as Record<string, unknown>));
  }
  async getAssetsByJobs(scope: WorkspaceScope, jobIds: readonly string[]) {
    const result = new Map<string, VideoAsset>();
    if (!jobIds.length) return result;
    const { data, error } = await createAdminClient()
      .from("video_production_assets")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .in("job_id", [...jobIds]);
    if (error) throw new PersonaStoreError(error.message);
    for (const row of data ?? []) {
      const asset = a(row as Record<string, unknown>);
      result.set(asset.jobId, asset);
    }
    return result;
  }
  async confirm(
    scope: WorkspaceScope & { actorId: string },
    id: string,
    f: string,
    now: string,
  ) {
    const { data, error } = await createAdminClient()
      .from("video_generation_jobs")
      .update({
        status: "confirmed",
        confirmed_by: scope.actorId,
        confirmed_at: now,
        updated_at: now,
      })
      .eq("workspace_id", scope.workspaceId)
      .eq("id", id)
      .eq("status", "awaiting_confirmation")
      .eq("input_fingerprint", f)
      .gt("confirmation_expires_at", now)
      .select("*")
      .maybeSingle();
    if (error || !data)
      throw new PersonaDomainError(
        error?.message ?? "Bestätigung ist ungültig oder abgelaufen.",
        "WORKFLOW",
      );
    return j(data as Record<string, unknown>);
  }
  async claim(scope: WorkspaceScope, id: string, f: string, now: string) {
    const { data, error } = await createAdminClient().rpc(
      "claim_video_generation_job",
      {
        p_job_id: id,
        p_workspace_id: scope.workspaceId,
        p_fingerprint: f,
        p_now: now,
      },
    );
    if (error) throw new PersonaStoreError(error.message);
    return data?.[0] ? j(data[0] as Record<string, unknown>) : null;
  }
  async cancel(
    scope: WorkspaceScope & { actorId: string },
    id: string,
    now: string,
  ) {
    const { data, error } = await createAdminClient()
      .from("video_generation_jobs")
      .update({ status: "cancelled", updated_at: now })
      .eq("workspace_id", scope.workspaceId)
      .eq("id", id)
      .in("status", ["awaiting_confirmation", "confirmed"])
      .select("*")
      .maybeSingle();
    if (error || !data)
      throw new PersonaDomainError(
        error?.message ?? "Nur ein wartender oder bestätigter Video-Auftrag kann abgebrochen werden.",
        "WORKFLOW",
      );
    return j(data as Record<string, unknown>);
  }
  async markUnknown(
    scope: WorkspaceScope,
    id: string,
    reason: string,
    now: string,
  ) {
    return this.update(scope, id, {
      status: "unknown_outcome",
      unknown_outcome_reason: reason,
      safe_retry_allowed: false,
      updated_at: now,
    });
  }
  async finish(
    scope: WorkspaceScope,
    jobId: string,
    v: VideoAsset,
    now: string,
  ) {
    const { data, error } = await createAdminClient()
      .from("video_production_assets")
      .insert({
        id: v.id,
        workspace_id: scope.workspaceId,
        project_id: v.projectId,
        job_id: jobId,
        input_fingerprint: v.inputFingerprint,
        storage_path: v.storagePath,
        checksum: v.checksum,
        mime_type: v.mimeType,
        provider: v.provider,
        model: v.model,
        provider_request_id: v.providerRequestId,
        source_image_asset_id: v.sourceImageAssetId,
        duration_seconds: v.durationSeconds,
        aspect_ratio: v.aspectRatio,
        width: v.width,
        height: v.height,
        codec: v.codec,
        container: v.container,
        provenance: v.provenance,
        review_status: "REVIEW_REQUIRED",
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();
    if (error || !data)
      throw new PersonaStoreError(
        error?.message ?? "Video asset persistence failed.",
      );
    const asset = a(data as Record<string, unknown>);
    const job = await this.update(scope, jobId, {
      status: "succeeded",
      provider_request_id: v.providerRequestId,
      result_asset_id: v.id,
      updated_at: now,
    });
    await createAdminClient()
      .from("video_production_projects")
      .update({ status: "REVIEW", updated_at: now })
      .eq("workspace_id", scope.workspaceId)
      .eq("id", v.projectId);
    return { job, asset };
  }
  async fail(
    scope: WorkspaceScope,
    id: string,
    code: string,
    message: string,
    safeRetry: boolean,
    now: string,
  ) {
    return this.update(scope, id, {
      status: "failed",
      failure_code: code,
      failure_message: message,
      safe_retry_allowed: safeRetry,
      updated_at: now,
    });
  }
  async getAssetByJob(scope: WorkspaceScope, jobId: string) {
    const { data, error } = await createAdminClient()
      .from("video_production_assets")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("job_id", jobId)
      .maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? a(data as Record<string, unknown>) : null;
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
    if (
      input.decision === "APPROVED" &&
      !Object.values(input.checklist).every(Boolean)
    )
      throw new PersonaDomainError(
        "Freigabe erfordert vollständige Prüfliste.",
        "WORKFLOW",
      );
    const { data, error } = await createAdminClient()
      .from("video_production_assets")
      .update({
        review_status: input.decision,
        review_checklist: input.checklist,
        reviewed_by: scope.actorId,
        reviewed_at: now,
        review_note: input.note,
        updated_at: now,
      })
      .eq("workspace_id", scope.workspaceId)
      .eq("id", assetId)
      .select("*")
      .maybeSingle();
    if (error || !data)
      throw new PersonaDomainError(
        error?.message ?? "Video asset not found.",
        "NOT_FOUND",
      );
    return a(data as Record<string, unknown>);
  }
  private async update(
    scope: WorkspaceScope,
    id: string,
    patch: Record<string, unknown>,
  ) {
    const { data, error } = await createAdminClient()
      .from("video_generation_jobs")
      .update(patch)
      .eq("workspace_id", scope.workspaceId)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error || !data)
      throw new PersonaDomainError(
        error?.message ?? "Video job not found.",
        "NOT_FOUND",
      );
    return j(data as Record<string, unknown>);
  }
}
