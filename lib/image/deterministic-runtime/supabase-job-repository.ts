import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError, PersonaStoreError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { normalizeOptionalRfc3339Timestamp, normalizeRfc3339Timestamp } from "@/lib/datetime/rfc3339";
import type { CreateDeterministicJob, DeterministicJobRepository } from "@/lib/image/deterministic-runtime/repository";
import { deterministicImageJobSchema, type DeterministicImageJob } from "@/lib/image/deterministic-runtime/types";

function map(row: Record<string, unknown>): DeterministicImageJob {
  return deterministicImageJobSchema.parse({
    id: row.id, workspaceId: row.workspace_id, createdBy: row.created_by,
    createdAt: normalizeRfc3339Timestamp(row.created_at), updatedAt: normalizeRfc3339Timestamp(row.updated_at),
    inputSnapshot: row.input_snapshot, inputFingerprint: row.input_fingerprint,
    productionProjectId: row.production_project_id, productionProjectVersion: Number(row.production_project_version),
    artworkStoragePath: row.artwork_storage_path,
    estimate: { currency: row.cost_currency, minimum: Number(row.estimated_cost_min), maximum: Number(row.estimated_cost_max), isMaximumOperatorConfigured: true, pricingVersion: row.pricing_version, basis: row.cost_estimate_basis },
    status: row.status, confirmationToken: row.confirmation_token, confirmationFingerprint: row.confirmation_fingerprint,
    confirmationExpiresAt: normalizeRfc3339Timestamp(row.confirmation_expires_at), confirmedBy: row.confirmed_by,
    confirmedAt: normalizeOptionalRfc3339Timestamp(row.confirmed_at), attemptCount: Number(row.attempt_count ?? 0),
    providerRequestId: row.provider_request_id, resultAssetIds: Array.isArray(row.result_asset_ids) ? row.result_asset_ids : [],
    failureCode: row.failure_code, failureMessage: row.failure_message, safeRetryAllowed: Boolean(row.safe_retry_allowed),
    unknownOutcomeReason: row.unknown_outcome_reason, reconciliationState: row.reconciliation_state,
    startedAt: normalizeOptionalRfc3339Timestamp(row.started_at), completedAt: normalizeOptionalRfc3339Timestamp(row.completed_at),
    cancelledAt: normalizeOptionalRfc3339Timestamp(row.cancelled_at),
  });
}

export class SupabaseDeterministicJobRepository implements DeterministicJobRepository {
  async get(scope: WorkspaceScope, id: string) {
    const { data, error } = await createAdminClient().from("image_generation_jobs").select("*")
      .eq("workspace_id", scope.workspaceId).eq("id", id)
      .eq("input_contract_version", "image-generation-input-v2").eq("production_mode", "DETERMINISTIC_COMPOSITE").maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? map(data as Record<string, unknown>) : null;
  }
  async list(scope: WorkspaceScope, filters: { projectId?: string } = {}) {
    let query = createAdminClient().from("image_generation_jobs").select("*").eq("workspace_id", scope.workspaceId)
      .eq("input_contract_version", "image-generation-input-v2").eq("production_mode", "DETERMINISTIC_COMPOSITE")
      .order("updated_at", { ascending: false });
    if (filters.projectId) query = query.eq("production_project_id", filters.projectId);
    const { data, error } = await query; if (error) throw new PersonaStoreError(error.message);
    return (data ?? []).map((row) => map(row as Record<string, unknown>));
  }
  async createOrGet(scope: WorkspaceScope & { actorId: string }, input: CreateDeterministicJob) {
    const db = createAdminClient();
    const existing = await db.from("image_generation_jobs").select("*").eq("workspace_id", scope.workspaceId)
      .eq("input_fingerprint", input.fingerprint).eq("input_contract_version", "image-generation-input-v2")
      .eq("production_mode", "DETERMINISTIC_COMPOSITE").maybeSingle();
    if (existing.error) throw new PersonaStoreError(existing.error.message);
    if (existing.data) {
      const job = map(existing.data as Record<string, unknown>);
      const reopen = job.status === "cancelled" || (["awaiting_confirmation", "confirmed"].includes(job.status) && job.confirmationExpiresAt < input.preparedAt);
      if (!reopen) return job;
      const reopened = await db.from("image_generation_jobs").update({ status: "awaiting_confirmation", confirmation_token: null, confirmation_fingerprint: null, confirmed_by: null, confirmed_at: null, confirmation_expires_at: input.confirmationExpiresAt, cancelled_at: null, failure_code: null, failure_message: null, safe_retry_allowed: false, updated_at: input.preparedAt })
        .eq("workspace_id", scope.workspaceId).eq("id", job.id).eq("input_contract_version", "image-generation-input-v2")
        .eq("production_mode", "DETERMINISTIC_COMPOSITE").in("status", ["awaiting_confirmation", "confirmed", "cancelled"]).select("*").maybeSingle();
      if (reopened.error || !reopened.data) throw new PersonaStoreError(reopened.error?.message ?? "V2 job changed while reopening confirmation.");
      return map(reopened.data as Record<string, unknown>);
    }
    const shot = input.snapshot.shot.assetId;
    const blocked = await db.from("image_generation_jobs").select("id,status").eq("workspace_id", scope.workspaceId)
      .eq("report_record_id", input.snapshot.production.reportRecordId).eq("asset_id", shot)
      .in("status", ["running", "unknown_outcome"]).limit(1).maybeSingle();
    if (blocked.error) throw new PersonaStoreError(blocked.error.message);
    if (blocked.data) throw new PersonaDomainError("This shot already has unresolved execution state.", "WORKFLOW");
    const supersededAt = input.preparedAt;
    const cancelled = await db.from("image_generation_jobs").update({ status: "cancelled", cancelled_at: supersededAt, updated_at: supersededAt, failure_code: "SUPERSEDED_INPUT", failure_message: "A changed v2 production input was prepared." })
      .eq("workspace_id", scope.workspaceId).eq("report_record_id", input.snapshot.production.reportRecordId).eq("asset_id", shot)
      .eq("input_contract_version", "image-generation-input-v2").in("status", ["awaiting_confirmation", "confirmed", "failed"]).neq("input_fingerprint", input.fingerprint);
    if (cancelled.error) throw new PersonaStoreError(cancelled.error.message);
    const { data, error } = await db.from("image_generation_jobs").insert({
      workspace_id: scope.workspaceId, report_record_id: input.snapshot.production.reportRecordId,
      report_id: input.snapshot.production.reportId, asset_id: shot, created_by: scope.actorId,
      input_snapshot: input.snapshot, input_fingerprint: input.fingerprint, artwork_storage_path: input.artworkStoragePath,
      provider: input.snapshot.baseGeneration.provider, model: input.snapshot.baseGeneration.model,
      production_project_id: input.snapshot.production.projectId, production_project_version: input.snapshot.production.projectVersion,
      estimated_cost_min: input.estimate.minimum, estimated_cost_max: input.estimate.maximum, cost_currency: input.estimate.currency,
      cost_estimate_basis: input.estimate.basis, pricing_version: input.estimate.pricingVersion,
      confirmation_expires_at: input.confirmationExpiresAt, status: "awaiting_confirmation",
      input_contract_version: "image-generation-input-v2", production_mode: "DETERMINISTIC_COMPOSITE",
    }).select("*").single();
    if (error || !data) throw new PersonaStoreError(error?.message ?? "Failed to persist deterministic Image job.");
    return map(data as Record<string, unknown>);
  }
  async confirm(scope: WorkspaceScope & { actorId: string }, id: string, fingerprint: string, token: string, now: string) {
    const { data, error } = await createAdminClient().from("image_generation_jobs").update({ status: "confirmed", confirmation_token: token, confirmation_fingerprint: fingerprint, confirmed_by: scope.actorId, confirmed_at: now, updated_at: now })
      .eq("workspace_id", scope.workspaceId).eq("id", id).eq("input_contract_version", "image-generation-input-v2")
      .eq("production_mode", "DETERMINISTIC_COMPOSITE").eq("input_fingerprint", fingerprint).eq("status", "awaiting_confirmation")
      .gte("confirmation_expires_at", now).select("*").maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    if (data) return map(data as Record<string, unknown>);
    const current = await this.get(scope, id);
    if (current?.status === "confirmed" && current.confirmationFingerprint === fingerprint) return current;
    throw new PersonaDomainError("Deterministic confirmation expired or no longer matches exact input.", "WORKFLOW");
  }
  async claimBase(scope: WorkspaceScope, id: string, fingerprint: string, now: string) {
    const current = await this.get(scope, id); if (!current) return null;
    const { data, error } = await createAdminClient().rpc("claim_image_generation_job", { p_workspace_id: scope.workspaceId, p_job_id: id, p_input_fingerprint: fingerprint, p_retry_known_failure: false, p_now: now });
    if (error) throw new PersonaStoreError(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return row ? map(row as Record<string, unknown>) : null;
  }
  async claimCompositeRetry(scope: WorkspaceScope, id: string, fingerprint: string, now: string) {
    const { data, error } = await createAdminClient().from("image_generation_jobs").update({ status: "running", failure_code: null, failure_message: null, safe_retry_allowed: false, completed_at: null, updated_at: now })
      .eq("workspace_id", scope.workspaceId).eq("id", id).eq("input_contract_version", "image-generation-input-v2")
      .eq("production_mode", "DETERMINISTIC_COMPOSITE").eq("input_fingerprint", fingerprint)
      .eq("status", "failed").eq("failure_code", "DETERMINISTIC_COMPOSITE_FAILED").select("id").maybeSingle();
    if (error) throw new PersonaStoreError(error.message); return Boolean(data);
  }
  private async patch(scope: WorkspaceScope, id: string, values: Record<string, unknown>) {
    const { data, error } = await createAdminClient().from("image_generation_jobs").update(values)
      .eq("workspace_id", scope.workspaceId).eq("id", id).eq("input_contract_version", "image-generation-input-v2")
      .eq("production_mode", "DETERMINISTIC_COMPOSITE").eq("status", "running").select("*").maybeSingle();
    if (error || !data) throw new PersonaStoreError(error?.message ?? "Deterministic Image job update failed."); return map(data as Record<string, unknown>);
  }
  markSucceeded(scope: WorkspaceScope, id: string, assetId: string, providerRequestId: string | null, now: string) { return this.patch(scope, id, { status: "succeeded", provider_request_id: providerRequestId, result_asset_ids: [assetId], safe_retry_allowed: false, completed_at: now, updated_at: now }); }
  markFailed(scope: WorkspaceScope, id: string, input: { code: string; message: string; now: string }) { return this.patch(scope, id, { status: "failed", failure_code: input.code, failure_message: input.message, safe_retry_allowed: false, completed_at: input.now, updated_at: input.now }); }
  markUnknown(scope: WorkspaceScope, id: string, reason: string, now: string) { return this.patch(scope, id, { status: "unknown_outcome", unknown_outcome_reason: reason, reconciliation_state: "required", safe_retry_allowed: false, completed_at: now, updated_at: now }); }
}
