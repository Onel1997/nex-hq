/**
 * Supabase-backed durable generation jobs + confirmations.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError, PersonaStoreError } from "../domain/errors";
import type {
  CandidateAssetType,
  PersonaGenerationConfirmation,
  PersonaGenerationJob,
} from "../domain/creation-types";
import type { WorkspaceScope } from "../domain/types";
import type {
  CreateGenerationConfirmationInput,
  CreateGenerationJobInput,
  PersonaGenerationJobRepository,
  UpdateGenerationJobInput,
} from "./generation-job-repository";

function mapJob(row: Record<string, unknown>): PersonaGenerationJob {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    creation_project_id: String(row.creation_project_id),
    candidate_id: row.candidate_id ? String(row.candidate_id) : null,
    stage: row.stage as PersonaGenerationJob["stage"],
    provider: String(row.provider ?? ""),
    provider_job_id: row.provider_job_id ? String(row.provider_job_id) : null,
    status: row.status as PersonaGenerationJob["status"],
    requested_asset_types: Array.isArray(row.requested_asset_types)
      ? (row.requested_asset_types as CandidateAssetType[])
      : [],
    quality_mode: row.quality_mode as PersonaGenerationJob["quality_mode"],
    estimated_cost_min: Number(row.estimated_cost_min ?? 0),
    estimated_cost_max: Number(row.estimated_cost_max ?? 0),
    actual_cost: Number(row.actual_cost ?? 0),
    cost_is_estimated: Boolean(row.cost_is_estimated ?? true),
    confirmation_token: row.confirmation_token ? String(row.confirmation_token) : null,
    estimate_hash: row.estimate_hash ? String(row.estimate_hash) : null,
    confirmation_payload:
      (row.confirmation_payload as Record<string, unknown>) ?? {},
    confirmed_at: row.confirmed_at ? String(row.confirmed_at) : null,
    retry_count: Number(row.retry_count ?? 0),
    error_code: row.error_code ? String(row.error_code) : null,
    error_message: row.error_message ? String(row.error_message) : null,
    started_at: row.started_at ? String(row.started_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    cancelled_at: row.cancelled_at ? String(row.cancelled_at) : null,
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapConfirmation(row: Record<string, unknown>): PersonaGenerationConfirmation {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    creation_project_id: String(row.creation_project_id),
    generation_job_id: row.generation_job_id ? String(row.generation_job_id) : null,
    confirmation_token: String(row.confirmation_token),
    estimate_hash: String(row.estimate_hash),
    stage: row.stage as PersonaGenerationConfirmation["stage"],
    quality_mode: row.quality_mode as PersonaGenerationConfirmation["quality_mode"],
    candidate_count: Number(row.candidate_count),
    asset_count: Number(row.asset_count),
    estimated_cost_min: Number(row.estimated_cost_min),
    estimated_cost_max: Number(row.estimated_cost_max),
    payload: (row.payload as Record<string, unknown>) ?? {},
    confirmed_at: String(row.confirmed_at),
    consumed_at: row.consumed_at ? String(row.consumed_at) : null,
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
  };
}

export class SupabaseGenerationJobRepository implements PersonaGenerationJobRepository {
  readonly kind = "supabase" as const;

  async createJob(scope: WorkspaceScope, input: CreateGenerationJobInput) {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_generation_jobs")
      .insert({
        workspace_id: scope.workspaceId,
        creation_project_id: input.creation_project_id,
        candidate_id: input.candidate_id ?? null,
        stage: input.stage,
        provider: input.provider,
        provider_job_id: input.provider_job_id ?? null,
        status: input.status ?? "pending_confirmation",
        requested_asset_types: input.requested_asset_types,
        quality_mode: input.quality_mode,
        estimated_cost_min: input.estimated_cost_min,
        estimated_cost_max: input.estimated_cost_max,
        actual_cost: input.actual_cost ?? 0,
        cost_is_estimated: input.cost_is_estimated ?? true,
        confirmation_token: input.confirmation_token ?? null,
        estimate_hash: input.estimate_hash ?? null,
        confirmation_payload: input.confirmation_payload ?? {},
        confirmed_at: input.confirmed_at ?? null,
        retry_count: input.retry_count ?? 0,
        error_code: input.error_code ?? null,
        error_message: input.error_message ?? null,
        started_at: input.started_at ?? null,
        completed_at: input.completed_at ?? null,
        cancelled_at: input.cancelled_at ?? null,
        created_by: input.created_by ?? scope.actorId ?? null,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new PersonaStoreError(error?.message ?? "Failed to create generation job");
    }
    return mapJob(data as Record<string, unknown>);
  }

  async getJob(scope: WorkspaceScope, id: string) {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_generation_jobs")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? mapJob(data as Record<string, unknown>) : null;
  }

  async listJobsForProject(scope: WorkspaceScope, projectId: string) {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_generation_jobs")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("creation_project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw new PersonaStoreError(error.message);
    return (data ?? []).map((row) => mapJob(row as Record<string, unknown>));
  }

  async updateJob(scope: WorkspaceScope, id: string, patch: UpdateGenerationJobInput) {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_generation_jobs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    if (error || !data) {
      throw new PersonaDomainError(
        error?.message ?? `Generation job not found: ${id}`,
        "NOT_FOUND",
      );
    }
    return mapJob(data as Record<string, unknown>);
  }

  async createConfirmation(scope: WorkspaceScope, input: CreateGenerationConfirmationInput) {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_generation_confirmations")
      .insert({
        workspace_id: scope.workspaceId,
        creation_project_id: input.creation_project_id,
        generation_job_id: input.generation_job_id ?? null,
        confirmation_token: input.confirmation_token,
        estimate_hash: input.estimate_hash,
        stage: input.stage,
        quality_mode: input.quality_mode,
        candidate_count: input.candidate_count,
        asset_count: input.asset_count,
        estimated_cost_min: input.estimated_cost_min,
        estimated_cost_max: input.estimated_cost_max,
        payload: input.payload ?? {},
        created_by: input.created_by ?? scope.actorId ?? null,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new PersonaStoreError(error?.message ?? "Failed to create confirmation");
    }
    return mapConfirmation(data as Record<string, unknown>);
  }

  async getConfirmationByToken(scope: WorkspaceScope, token: string) {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_generation_confirmations")
      .select("*")
      .eq("confirmation_token", token)
      .eq("workspace_id", scope.workspaceId)
      .maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? mapConfirmation(data as Record<string, unknown>) : null;
  }

  async consumeConfirmation(scope: WorkspaceScope, token: string) {
    const existing = await this.getConfirmationByToken(scope, token);
    if (!existing) {
      throw new PersonaDomainError("Bestätigung ungültig oder abgelaufen.", "WORKFLOW");
    }
    if (existing.consumed_at) {
      throw new PersonaDomainError(
        "Bestätigung wurde bereits verwendet — neue Kostenschätzung erforderlich.",
        "WORKFLOW",
      );
    }
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_generation_confirmations")
      .update({ consumed_at: new Date().toISOString() })
      .eq("confirmation_token", token)
      .eq("workspace_id", scope.workspaceId)
      .is("consumed_at", null)
      .select("*")
      .single();
    if (error || !data) {
      throw new PersonaDomainError(
        "Bestätigung konnte nicht verbraucht werden.",
        "WORKFLOW",
      );
    }
    return mapConfirmation(data as Record<string, unknown>);
  }

  async listConfirmationsForProject(scope: WorkspaceScope, projectId: string) {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_generation_confirmations")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("creation_project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw new PersonaStoreError(error.message);
    return (data ?? []).map((row) => mapConfirmation(row as Record<string, unknown>));
  }

  async updateConfirmationByToken(
    scope: WorkspaceScope,
    token: string,
    patch: { payload?: Record<string, unknown>; consumed_at?: string | null },
  ) {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_generation_confirmations")
      .update({
        ...(patch.payload !== undefined ? { payload: patch.payload } : {}),
        ...(patch.consumed_at !== undefined
          ? { consumed_at: patch.consumed_at }
          : {}),
      })
      .eq("confirmation_token", token)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    if (error || !data) {
      throw new PersonaDomainError(
        error?.message ?? "Bestätigung nicht gefunden.",
        "NOT_FOUND",
      );
    }
    return mapConfirmation(data as Record<string, unknown>);
  }
}
