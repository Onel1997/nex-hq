/**
 * Durable persona generation job + paid confirmation persistence.
 */

import type {
  CreateCreationProjectInput,
  GenerationJobStatus,
  GenerationStage,
  PersonaGenerationConfirmation,
  PersonaGenerationJob,
  QualityMode,
  CandidateAssetType,
} from "../domain/creation-types";
import type { WorkspaceScope } from "../domain/types";

export type CreateGenerationJobInput = {
  creation_project_id: string;
  candidate_id?: string | null;
  stage: GenerationStage;
  provider: string;
  provider_job_id?: string | null;
  status?: GenerationJobStatus;
  requested_asset_types: CandidateAssetType[];
  quality_mode: QualityMode;
  estimated_cost_min: number;
  estimated_cost_max: number;
  actual_cost?: number;
  cost_is_estimated?: boolean;
  confirmation_token?: string | null;
  estimate_hash?: string | null;
  confirmation_payload?: Record<string, unknown>;
  confirmed_at?: string | null;
  retry_count?: number;
  error_code?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  created_by?: string | null;
};

export type UpdateGenerationJobInput = Partial<
  Omit<PersonaGenerationJob, "id" | "workspace_id" | "created_at" | "updated_at">
>;

export type CreateGenerationConfirmationInput = {
  creation_project_id: string;
  generation_job_id?: string | null;
  confirmation_token: string;
  estimate_hash: string;
  stage: GenerationStage;
  quality_mode: QualityMode;
  candidate_count: number;
  asset_count: number;
  estimated_cost_min: number;
  estimated_cost_max: number;
  payload?: Record<string, unknown>;
  created_by?: string | null;
};

export interface PersonaGenerationJobRepository {
  readonly kind: "supabase" | "memory";

  createJob(
    scope: WorkspaceScope,
    input: CreateGenerationJobInput,
  ): Promise<PersonaGenerationJob>;
  getJob(scope: WorkspaceScope, id: string): Promise<PersonaGenerationJob | null>;
  listJobsForProject(
    scope: WorkspaceScope,
    projectId: string,
  ): Promise<PersonaGenerationJob[]>;
  updateJob(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateGenerationJobInput,
  ): Promise<PersonaGenerationJob>;

  createConfirmation(
    scope: WorkspaceScope,
    input: CreateGenerationConfirmationInput,
  ): Promise<PersonaGenerationConfirmation>;
  getConfirmationByToken(
    scope: WorkspaceScope,
    token: string,
  ): Promise<PersonaGenerationConfirmation | null>;
  consumeConfirmation(
    scope: WorkspaceScope,
    token: string,
  ): Promise<PersonaGenerationConfirmation>;
  listConfirmationsForProject(
    scope: WorkspaceScope,
    projectId: string,
  ): Promise<PersonaGenerationConfirmation[]>;
  updateConfirmationByToken(
    scope: WorkspaceScope,
    token: string,
    patch: {
      payload?: Record<string, unknown>;
      consumed_at?: string | null;
    },
  ): Promise<PersonaGenerationConfirmation>;
}

/** Re-export for create project typing convenience. */
export type { CreateCreationProjectInput };
