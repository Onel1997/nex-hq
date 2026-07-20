/**
 * In-memory durable job store for tests — survives repository instance via module map
 * when using the shared test singleton pattern.
 */

import { randomUUID } from "node:crypto";
import { PersonaDomainError } from "../domain/errors";
import type {
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

function nowIso() {
  return new Date().toISOString();
}

/** Module-level store so jobs persist across "service restart" simulations in tests. */
const sharedJobs = new Map<string, PersonaGenerationJob>();
const sharedConfirmations = new Map<string, PersonaGenerationConfirmation>();

export function resetMemoryGenerationJobStoreForTests() {
  sharedJobs.clear();
  sharedConfirmations.clear();
}

export class MemoryGenerationJobRepository implements PersonaGenerationJobRepository {
  readonly kind = "memory" as const;

  async createJob(scope: WorkspaceScope, input: CreateGenerationJobInput) {
    const created_at = nowIso();
    const row: PersonaGenerationJob = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      creation_project_id: input.creation_project_id,
      candidate_id: input.candidate_id ?? null,
      stage: input.stage,
      provider: input.provider,
      provider_job_id: input.provider_job_id ?? null,
      status: input.status ?? "pending_confirmation",
      requested_asset_types: [...input.requested_asset_types],
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
      created_at,
      updated_at: created_at,
    };
    sharedJobs.set(row.id, row);
    return structuredClone(row);
  }

  async getJob(scope: WorkspaceScope, id: string) {
    const row = sharedJobs.get(id) ?? null;
    if (!row) return null;
    if (row.workspace_id !== scope.workspaceId) {
      throw new PersonaDomainError("Job belongs to a different workspace", "UNAUTHORIZED_WORKSPACE");
    }
    return structuredClone(row);
  }

  async listJobsForProject(scope: WorkspaceScope, projectId: string) {
    return structuredClone(
      [...sharedJobs.values()]
        .filter(
          (j) =>
            j.workspace_id === scope.workspaceId && j.creation_project_id === projectId,
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  }

  async updateJob(scope: WorkspaceScope, id: string, patch: UpdateGenerationJobInput) {
    const existing = await this.getJob(scope, id);
    if (!existing) {
      throw new PersonaDomainError(`Generation job not found: ${id}`, "NOT_FOUND");
    }
    const updated: PersonaGenerationJob = {
      ...existing,
      ...patch,
      updated_at: nowIso(),
    };
    sharedJobs.set(id, updated);
    return structuredClone(updated);
  }

  async createConfirmation(scope: WorkspaceScope, input: CreateGenerationConfirmationInput) {
    const created_at = nowIso();
    const row: PersonaGenerationConfirmation = {
      id: randomUUID(),
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
      confirmed_at: created_at,
      consumed_at: null,
      created_by: input.created_by ?? scope.actorId ?? null,
      created_at,
    };
    sharedConfirmations.set(row.confirmation_token, row);
    return structuredClone(row);
  }

  async getConfirmationByToken(scope: WorkspaceScope, token: string) {
    const row = sharedConfirmations.get(token) ?? null;
    if (!row) return null;
    if (row.workspace_id !== scope.workspaceId) {
      throw new PersonaDomainError(
        "Confirmation belongs to a different workspace",
        "UNAUTHORIZED_WORKSPACE",
      );
    }
    return structuredClone(row);
  }

  async consumeConfirmation(scope: WorkspaceScope, token: string) {
    const row = await this.getConfirmationByToken(scope, token);
    if (!row) {
      throw new PersonaDomainError("Bestätigung ungültig oder abgelaufen.", "WORKFLOW");
    }
    if (row.consumed_at) {
      throw new PersonaDomainError(
        "Bestätigung wurde bereits verwendet — neue Kostenschätzung erforderlich.",
        "WORKFLOW",
      );
    }
    const updated: PersonaGenerationConfirmation = {
      ...row,
      consumed_at: nowIso(),
    };
    sharedConfirmations.set(token, updated);
    return structuredClone(updated);
  }

  async listConfirmationsForProject(scope: WorkspaceScope, projectId: string) {
    return structuredClone(
      [...sharedConfirmations.values()]
        .filter(
          (c) =>
            c.workspace_id === scope.workspaceId &&
            c.creation_project_id === projectId,
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  }

  async updateConfirmationByToken(
    scope: WorkspaceScope,
    token: string,
    patch: { payload?: Record<string, unknown>; consumed_at?: string | null },
  ) {
    const row = await this.getConfirmationByToken(scope, token);
    if (!row) {
      throw new PersonaDomainError("Bestätigung nicht gefunden.", "NOT_FOUND");
    }
    const updated: PersonaGenerationConfirmation = {
      ...row,
      payload: patch.payload ?? row.payload,
      consumed_at:
        patch.consumed_at !== undefined ? patch.consumed_at : row.consumed_at,
    };
    sharedConfirmations.set(token, updated);
    return structuredClone(updated);
  }
}
