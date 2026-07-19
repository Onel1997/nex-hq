/**
 * Creation / candidate repository contract.
 */

import type {
  CreateCandidateAssetInput,
  CreateCandidateInput,
  CreateCreationProjectInput,
  PersonaBrandCastRequirements,
  PersonaCandidate,
  PersonaCandidateAsset,
  PersonaCreationProject,
  PersonaIdentityReview,
  UpdateCandidateAssetInput,
  UpdateCandidateInput,
  UpdateCreationProjectInput,
  IdentityReviewChecklist,
} from "../domain/creation-types";
import type { WorkspaceScope } from "../domain/types";

export interface PersonaCreationRepository {
  readonly kind: "supabase" | "memory";

  listProjects(scope: WorkspaceScope): Promise<PersonaCreationProject[]>;
  getProject(scope: WorkspaceScope, id: string): Promise<PersonaCreationProject | null>;
  createProject(
    scope: WorkspaceScope,
    input: CreateCreationProjectInput,
  ): Promise<PersonaCreationProject>;
  updateProject(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCreationProjectInput,
  ): Promise<PersonaCreationProject>;
  deleteProject(scope: WorkspaceScope, id: string): Promise<void>;

  listCandidates(
    scope: WorkspaceScope,
    projectId: string,
  ): Promise<PersonaCandidate[]>;
  getCandidate(scope: WorkspaceScope, id: string): Promise<PersonaCandidate | null>;
  createCandidate(
    scope: WorkspaceScope,
    input: CreateCandidateInput,
  ): Promise<PersonaCandidate>;
  updateCandidate(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCandidateInput,
  ): Promise<PersonaCandidate>;
  deleteCandidate(scope: WorkspaceScope, id: string): Promise<void>;
  findSelectedCandidate(
    scope: WorkspaceScope,
    projectId: string,
  ): Promise<PersonaCandidate | null>;

  listCandidateAssets(
    scope: WorkspaceScope,
    candidateId: string,
  ): Promise<PersonaCandidateAsset[]>;
  getCandidateAsset(
    scope: WorkspaceScope,
    id: string,
  ): Promise<PersonaCandidateAsset | null>;
  createCandidateAsset(
    scope: WorkspaceScope,
    input: CreateCandidateAssetInput,
  ): Promise<PersonaCandidateAsset>;
  updateCandidateAsset(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCandidateAssetInput,
  ): Promise<PersonaCandidateAsset>;
  deleteCandidateAsset(scope: WorkspaceScope, id: string): Promise<void>;

  listIdentityReviews(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<PersonaIdentityReview[]>;
  createIdentityReview(
    scope: WorkspaceScope,
    input: {
      persona_id: string;
      checklist: IdentityReviewChecklist;
      all_passed: boolean;
      reviewer_notes?: string;
      reviewed_by?: string | null;
      reviewed_at?: string | null;
    },
  ): Promise<PersonaIdentityReview>;

  getBrandCastRequirements(
    scope: WorkspaceScope,
  ): Promise<PersonaBrandCastRequirements | null>;
  upsertBrandCastRequirements(
    scope: WorkspaceScope,
    input: {
      required_male_approved?: number;
      required_female_approved?: number;
      milestone_label?: string;
      active?: boolean;
    },
  ): Promise<PersonaBrandCastRequirements>;

  sumActualGenerationCostToday(scope: WorkspaceScope): Promise<number>;
}
