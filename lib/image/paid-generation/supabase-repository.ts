import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError, PersonaStoreError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import {
  normalizeOptionalRfc3339Timestamp,
  normalizeRfc3339Timestamp,
} from "@/lib/datetime/rfc3339";
import { imageGenerationJobSchema, type ImageGenerationJob } from "./types";
import type { CreateImageGenerationJob, ImageGenerationJobRepository } from "./repository";

function mapJob(row: Record<string, unknown>): ImageGenerationJob {
  return imageGenerationJobSchema.parse({
    id: row.id, workspaceId: row.workspace_id, createdBy: row.created_by,
    createdAt: normalizeRfc3339Timestamp(row.created_at),
    updatedAt: normalizeRfc3339Timestamp(row.updated_at),
    inputSnapshot: row.input_snapshot, inputFingerprint: row.input_fingerprint,
    productionProjectId: row.production_project_id,
    productionProjectVersion: Number(row.production_project_version),
    artworkStoragePath: row.artwork_storage_path,
    estimate: {
      currency: row.cost_currency, minimum: Number(row.estimated_cost_min),
      maximum: Number(row.estimated_cost_max), isMaximumOperatorConfigured: true,
      pricingVersion: row.pricing_version, basis: row.cost_estimate_basis,
    },
    status: row.status, confirmationToken: row.confirmation_token,
    confirmationFingerprint: row.confirmation_fingerprint,
    confirmationExpiresAt: normalizeRfc3339Timestamp(row.confirmation_expires_at),
    confirmedBy: row.confirmed_by, confirmedAt: normalizeOptionalRfc3339Timestamp(row.confirmed_at),
    attemptCount: Number(row.attempt_count ?? 0), providerRequestId: row.provider_request_id,
    resultAssetIds: Array.isArray(row.result_asset_ids) ? row.result_asset_ids : [],
    failureCode: row.failure_code, failureMessage: row.failure_message,
    safeRetryAllowed: Boolean(row.safe_retry_allowed),
    unknownOutcomeReason: row.unknown_outcome_reason,
    reconciliationState: row.reconciliation_state,
    startedAt: normalizeOptionalRfc3339Timestamp(row.started_at),
    completedAt: normalizeOptionalRfc3339Timestamp(row.completed_at),
    cancelledAt: normalizeOptionalRfc3339Timestamp(row.cancelled_at),
  });
}

async function one(scope: WorkspaceScope, id: string): Promise<ImageGenerationJob | null> {
  const { data, error } = await createAdminClient().from("image_generation_jobs")
    .select("*").eq("workspace_id", scope.workspaceId).eq("id", id)
    .is("input_contract_version", null).is("production_mode", null).maybeSingle();
  if (error) throw new PersonaStoreError(error.message);
  return data ? mapJob(data as Record<string, unknown>) : null;
}

export class SupabaseImageGenerationJobRepository implements ImageGenerationJobRepository {
  async assertCanPrepare(
    scope: WorkspaceScope,
    reportRecordId: string,
    assetId: string,
  ) {
    const { data, error } = await createAdminClient()
      .from("image_generation_jobs")
      .select("id,status")
      .eq("workspace_id", scope.workspaceId)
      .eq("report_record_id", reportRecordId)
      .eq("asset_id", assetId)
      .in("status", ["running", "unknown_outcome"])
      .limit(1)
      .maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    if (data) {
      throw new PersonaDomainError(
        data.status === "unknown_outcome"
          ? "A prior provider outcome for this shot is unknown and must be reconciled before changed input is prepared."
          : "A paid execution for this shot is already running.",
        "WORKFLOW",
      );
    }
  }

  async createOrGet(scope: WorkspaceScope & { actorId: string }, input: CreateImageGenerationJob) {
    const snapshot = input.inputSnapshot;
    const db = createAdminClient();
    const existing = await db.from("image_generation_jobs").select("*")
      .eq("workspace_id", scope.workspaceId).eq("input_fingerprint", input.inputFingerprint)
      .is("input_contract_version", null).is("production_mode", null).maybeSingle();
    if (existing.error) throw new PersonaStoreError(existing.error.message);
    if (existing.data) {
      const job = mapJob(existing.data as Record<string, unknown>);
      const reopen =
        job.status === "cancelled" ||
        (["awaiting_confirmation", "confirmed"].includes(job.status) &&
          job.confirmationExpiresAt < input.preparedAt);
      if (!reopen) return job;
      const now = new Date().toISOString();
      const { data, error } = await db
        .from("image_generation_jobs")
        .update({
          status: "awaiting_confirmation",
          confirmation_token: null,
          confirmation_fingerprint: null,
          confirmed_by: null,
          confirmed_at: null,
          confirmation_expires_at: input.confirmationExpiresAt,
          cancelled_at: null,
          failure_code: null,
          failure_message: null,
          safe_retry_allowed: false,
          updated_at: now,
        })
        .eq("workspace_id", scope.workspaceId)
        .eq("id", job.id)
        .is("input_contract_version", null)
        .is("production_mode", null)
        .in("status", ["awaiting_confirmation", "confirmed", "cancelled"])
        .select("*")
        .maybeSingle();
      if (error || !data) {
        throw new PersonaStoreError(
          error?.message ?? "Image job changed while reopening confirmation",
        );
      }
      return mapJob(data as Record<string, unknown>);
    }

    const unresolved = await db.from("image_generation_jobs").select("id,status")
      .eq("workspace_id", scope.workspaceId)
      .eq("report_record_id", snapshot.production.reportRecordId)
      .eq("asset_id", snapshot.production.assetId)
      .is("input_contract_version", null)
      .in("status", ["running", "unknown_outcome"])
      .limit(1)
      .maybeSingle();
    if (unresolved.error) throw new PersonaStoreError(unresolved.error.message);
    if (unresolved.data) {
      throw new PersonaDomainError(
        unresolved.data.status === "unknown_outcome"
          ? "A prior provider outcome for this shot is unknown and must be reconciled before changed input is prepared."
          : "A paid execution for this shot is already running.",
        "WORKFLOW",
      );
    }

    // A newly prepared truth supersedes unexecuted confirmation for the same shot.
    const now = new Date().toISOString();
    const cancelled = await db.from("image_generation_jobs").update({
      status: "cancelled", cancelled_at: now, updated_at: now,
      failure_code: "SUPERSEDED_INPUT", failure_message: "A changed paid-critical input was prepared.",
    }).eq("workspace_id", scope.workspaceId)
      .eq("report_record_id", snapshot.production.reportRecordId)
      .eq("asset_id", snapshot.production.assetId)
      .is("input_contract_version", null)
      .is("production_mode", null)
      .in("status", ["awaiting_confirmation", "confirmed", "failed"])
      .neq("input_fingerprint", input.inputFingerprint);
    if (cancelled.error) throw new PersonaStoreError(cancelled.error.message);

    const { data, error } = await db.from("image_generation_jobs").insert({
      workspace_id: scope.workspaceId,
      report_record_id: snapshot.production.reportRecordId,
      report_id: snapshot.production.reportId,
      asset_id: snapshot.production.assetId,
      created_by: scope.actorId,
      input_snapshot: snapshot,
      input_fingerprint: input.inputFingerprint,
      artwork_storage_path: input.artworkStoragePath,
      production_project_id: snapshot.production.projectId,
      production_project_version: snapshot.production.projectVersion,
      provider: snapshot.production.provider,
      model: snapshot.production.model,
      estimated_cost_min: input.estimate.minimum,
      estimated_cost_max: input.estimate.maximum,
      cost_currency: input.estimate.currency,
      cost_estimate_basis: input.estimate.basis,
      pricing_version: input.estimate.pricingVersion,
      confirmation_expires_at: input.confirmationExpiresAt,
      status: "awaiting_confirmation",
    }).select("*").single();
    if (error || !data) {
      // Concurrent prepare: unique fingerprint wins and is returned idempotently.
      const replay = await db.from("image_generation_jobs").select("*")
        .eq("workspace_id", scope.workspaceId).eq("input_fingerprint", input.inputFingerprint)
        .is("input_contract_version", null).is("production_mode", null).maybeSingle();
      if (replay.data) return mapJob(replay.data as Record<string, unknown>);
      throw new PersonaStoreError(error?.message ?? "Failed to create Image generation job");
    }
    return mapJob(data as Record<string, unknown>);
  }

  get(scope: WorkspaceScope, id: string) { return one(scope, id); }

  async list(
    scope: WorkspaceScope,
    filters: { productionProjectId?: string; reportRecordId?: string; assetId?: string } = {},
  ) {
    let query = createAdminClient()
      .from("image_generation_jobs")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .is("input_contract_version", null)
      .is("production_mode", null)
      .order("updated_at", { ascending: false });
    if (filters.productionProjectId) {
      query = query.eq("production_project_id", filters.productionProjectId);
    }
    if (filters.reportRecordId) {
      query = query.eq("report_record_id", filters.reportRecordId);
    }
    if (filters.assetId) query = query.eq("asset_id", filters.assetId);
    const { data, error } = await query;
    if (error) throw new PersonaStoreError(error.message);
    return (data ?? []).map((row) => mapJob(row as Record<string, unknown>));
  }

  async confirm(scope: WorkspaceScope & { actorId: string }, id: string, fingerprint: string, token: string, now: string) {
    const { data, error } = await createAdminClient().from("image_generation_jobs").update({
      status: "confirmed", confirmation_token: token, confirmation_fingerprint: fingerprint,
      confirmed_by: scope.actorId, confirmed_at: now, updated_at: now,
    }).eq("workspace_id", scope.workspaceId).eq("id", id).eq("input_fingerprint", fingerprint)
      .is("input_contract_version", null).is("production_mode", null)
      .eq("status", "awaiting_confirmation")
      .gte("confirmation_expires_at", now).select("*").maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    if (data) return mapJob(data as Record<string, unknown>);
    const current = await one(scope, id);
    if (current?.status === "confirmed" && current.confirmationFingerprint === fingerprint) return current;
    throw new PersonaDomainError("Paid confirmation no longer matches the prepared input.", "WORKFLOW");
  }

  async cancel(scope: WorkspaceScope, id: string, fingerprint: string, now: string) {
    const { data, error } = await createAdminClient().from("image_generation_jobs").update({ status: "cancelled", cancelled_at: now, updated_at: now })
      .eq("workspace_id", scope.workspaceId).eq("id", id).eq("input_fingerprint", fingerprint)
      .is("input_contract_version", null).is("production_mode", null)
      .in("status", ["awaiting_confirmation", "confirmed", "failed"]).select("*").maybeSingle();
    if (error || !data) throw new PersonaDomainError(error?.message ?? "Job cannot be cancelled in its current state.", "WORKFLOW");
    return mapJob(data as Record<string, unknown>);
  }

  async claim(scope: WorkspaceScope, id: string, fingerprint: string, retryKnownFailure: boolean, now: string) {
    const { data, error } = await createAdminClient().rpc("claim_image_generation_job", {
      p_workspace_id: scope.workspaceId, p_job_id: id, p_input_fingerprint: fingerprint,
      p_retry_known_failure: retryKnownFailure, p_now: now,
    });
    if (error) throw new PersonaStoreError(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return row ? mapJob(row as Record<string, unknown>) : null;
  }

  private async patch(scope: WorkspaceScope, id: string, patch: Record<string, unknown>) {
    const { data, error } = await createAdminClient().from("image_generation_jobs").update(patch)
      .eq("workspace_id", scope.workspaceId).eq("id", id).eq("status", "running")
      .is("input_contract_version", null).is("production_mode", null).select("*").maybeSingle();
    if (error || !data) throw new PersonaDomainError(error?.message ?? "Running Image generation job was not found.", "WORKFLOW");
    return mapJob(data as Record<string, unknown>);
  }
  markSucceeded(scope: WorkspaceScope, id: string, input: { providerRequestId: string | null; resultAssetIds: string[]; now: string }) {
    return this.patch(scope, id, { status: "succeeded", provider_request_id: input.providerRequestId, result_asset_ids: input.resultAssetIds, safe_retry_allowed: false, completed_at: input.now, updated_at: input.now });
  }
  markFailed(scope: WorkspaceScope, id: string, input: { code: string; message: string; safeRetryAllowed: boolean; now: string }) {
    return this.patch(scope, id, { status: "failed", failure_code: input.code, failure_message: input.message, safe_retry_allowed: input.safeRetryAllowed, completed_at: input.now, updated_at: input.now });
  }
  markUnknown(scope: WorkspaceScope, id: string, input: { providerRequestId: string | null; reason: string; now: string }) {
    return this.patch(scope, id, { status: "unknown_outcome", provider_request_id: input.providerRequestId, unknown_outcome_reason: input.reason, reconciliation_state: "required", safe_retry_allowed: false, completed_at: input.now, updated_at: input.now });
  }
}
