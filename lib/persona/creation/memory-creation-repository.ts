/**
 * In-memory creation repository — tests only.
 */

import { randomUUID } from "node:crypto";
import { PersonaDomainError } from "../domain/errors";
import type {
  CreateCandidateAssetInput,
  CreateCandidateInput,
  CreateCreationProjectInput,
  IdentityReviewChecklist,
  PersonaBrandCastRequirements,
  PersonaCandidate,
  PersonaCandidateAsset,
  PersonaCreationProject,
  PersonaIdentityReview,
  UpdateCandidateAssetInput,
  UpdateCandidateInput,
  UpdateCreationProjectInput,
} from "../domain/creation-types";
import type { WorkspaceScope } from "../domain/types";
import type { PersonaCreationRepository } from "./creation-repository";

function nowIso() {
  return new Date().toISOString();
}

export class MemoryCreationRepository implements PersonaCreationRepository {
  readonly kind = "memory" as const;

  private projects: PersonaCreationProject[] = [];
  private candidates: PersonaCandidate[] = [];
  private assets: PersonaCandidateAsset[] = [];
  private reviews: PersonaIdentityReview[] = [];
  private requirements: PersonaBrandCastRequirements[] = [];

  reset(): void {
    this.projects = [];
    this.candidates = [];
    this.assets = [];
    this.reviews = [];
    this.requirements = [];
  }

  private assertWs(
    row: { workspace_id: string; id: string },
    scope: WorkspaceScope,
    label: string,
  ) {
    if (row.workspace_id !== scope.workspaceId) {
      throw new PersonaDomainError(
        `${label} belongs to a different workspace`,
        "UNAUTHORIZED_WORKSPACE",
        { id: row.id },
      );
    }
  }

  async listProjects(scope: WorkspaceScope) {
    return structuredClone(
      this.projects.filter((p) => p.workspace_id === scope.workspaceId),
    );
  }

  async getProject(scope: WorkspaceScope, id: string) {
    const row = this.projects.find((p) => p.id === id) ?? null;
    if (!row) return null;
    this.assertWs(row, scope, "Creation project");
    return structuredClone(row);
  }

  async createProject(scope: WorkspaceScope, input: CreateCreationProjectInput) {
    const created_at = nowIso();
    const row: PersonaCreationProject = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      name: input.name ?? "",
      description: input.description ?? "",
      gender_presentation: input.gender_presentation ?? "",
      age_range: input.age_range ?? "",
      height_range: input.height_range ?? "",
      body_type: input.body_type ?? "",
      skin_tone_direction: input.skin_tone_direction ?? "",
      face_shape_direction: input.face_shape_direction ?? "",
      hair_direction: input.hair_direction ?? "",
      facial_hair_direction: input.facial_hair_direction ?? "",
      eye_direction: input.eye_direction ?? "",
      expression_direction: input.expression_direction ?? "",
      personality: input.personality ?? "",
      fashion_style: input.fashion_style ?? "",
      brand_role: input.brand_role ?? "primary_male",
      visual_keywords: input.visual_keywords ?? "",
      excluded_features: input.excluded_features ?? "",
      preferred_brand_looks: input.preferred_brand_looks ?? "",
      preferred_outfits: input.preferred_outfits ?? "",
      intended_usage: input.intended_usage ?? "image_and_video",
      candidate_count: input.candidate_count ?? 4,
      provider_mode: input.provider_mode ?? "manual_upload",
      quality_mode: input.quality_mode ?? "premium_editorial",
      status: input.status ?? "draft",
      generation_stage: input.generation_stage ?? "discovery",
      estimated_cost_min: input.estimated_cost_min ?? 0,
      estimated_cost_max: input.estimated_cost_max ?? 0,
      actual_cost: input.actual_cost ?? 0,
      cost_confirmed_at: input.cost_confirmed_at ?? null,
      last_estimate_hash: input.last_estimate_hash ?? null,
      last_estimate_at: input.last_estimate_at ?? null,
      last_confirmation_token: input.last_confirmation_token ?? null,
      additional_description: input.additional_description ?? "",
      created_by: input.created_by ?? scope.actorId ?? null,
      created_at,
      updated_at: created_at,
    };
    this.projects.push(row);
    return structuredClone(row);
  }

  async updateProject(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCreationProjectInput,
  ) {
    const idx = this.projects.findIndex((p) => p.id === id);
    if (idx < 0) throw new PersonaDomainError("Project not found", "NOT_FOUND");
    this.assertWs(this.projects[idx], scope, "Creation project");
    this.projects[idx] = {
      ...this.projects[idx],
      ...patch,
      updated_at: nowIso(),
    };
    return structuredClone(this.projects[idx]);
  }

  async deleteProject(scope: WorkspaceScope, id: string) {
    const row = await this.getProject(scope, id);
    if (!row) throw new PersonaDomainError("Project not found", "NOT_FOUND");
    const candidateIds = this.candidates
      .filter((c) => c.creation_project_id === id)
      .map((c) => c.id);
    this.assets = this.assets.filter((a) => !candidateIds.includes(a.candidate_id));
    this.candidates = this.candidates.filter((c) => c.creation_project_id !== id);
    this.projects = this.projects.filter((p) => p.id !== id);
  }

  async listCandidates(scope: WorkspaceScope, projectId: string) {
    await this.getProject(scope, projectId);
    return structuredClone(
      this.candidates.filter(
        (c) =>
          c.workspace_id === scope.workspaceId &&
          c.creation_project_id === projectId,
      ),
    );
  }

  async getCandidate(scope: WorkspaceScope, id: string) {
    const row = this.candidates.find((c) => c.id === id) ?? null;
    if (!row) return null;
    this.assertWs(row, scope, "Candidate");
    return structuredClone(row);
  }

  async createCandidate(scope: WorkspaceScope, input: CreateCandidateInput) {
    const project = await this.getProject(scope, input.creation_project_id);
    if (!project) {
      throw new PersonaDomainError("Project not found", "NOT_FOUND");
    }
    const created_at = nowIso();
    const row: PersonaCandidate = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      creation_project_id: input.creation_project_id,
      candidate_number: input.candidate_number,
      candidate_name: input.candidate_name ?? `Kandidat ${input.candidate_number}`,
      status: input.status ?? "queued",
      provider: input.provider ?? "none",
      provider_job_id: input.provider_job_id ?? null,
      generation_seed: input.generation_seed ?? null,
      generation_prompt: input.generation_prompt ?? "",
      negative_prompt: input.negative_prompt ?? "",
      generation_settings: input.generation_settings ?? {},
      primary_preview_asset_id: input.primary_preview_asset_id ?? null,
      identity_summary: input.identity_summary ?? "",
      distinguishing_features: input.distinguishing_features ?? "",
      visual_strengths: input.visual_strengths ?? "",
      visual_risks: input.visual_risks ?? "",
      brand_fit_score: input.brand_fit_score ?? null,
      identity_consistency_score: input.identity_consistency_score ?? null,
      realism_score: input.realism_score ?? null,
      video_suitability_score: input.video_suitability_score ?? null,
      user_rating: input.user_rating ?? null,
      user_notes: input.user_notes ?? "",
      rejection_reason: input.rejection_reason ?? "",
      fashion_fit_review: input.fashion_fit_review ?? "",
      body_proportion_review: input.body_proportion_review ?? "",
      hand_anatomy_review: input.hand_anatomy_review ?? "",
      face_consistency_review: input.face_consistency_review ?? "",
      realism_review: input.realism_review ?? "",
      image_suitability_label: input.image_suitability_label ?? "",
      video_suitability_label: input.video_suitability_label ?? "",
      parent_candidate_id: input.parent_candidate_id ?? null,
      variation_of_asset_id: input.variation_of_asset_id ?? null,
      actual_generation_cost: input.actual_generation_cost ?? 0,
      selected_at: input.selected_at ?? null,
      converted_persona_id: input.converted_persona_id ?? null,
      created_at,
      updated_at: created_at,
    };
    this.candidates.push(row);
    return structuredClone(row);
  }

  async updateCandidate(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCandidateInput,
  ) {
    const idx = this.candidates.findIndex((c) => c.id === id);
    if (idx < 0) throw new PersonaDomainError("Candidate not found", "NOT_FOUND");
    this.assertWs(this.candidates[idx], scope, "Candidate");

    if (patch.status === "selected") {
      const existing = this.candidates.find(
        (c) =>
          c.creation_project_id === this.candidates[idx].creation_project_id &&
          c.status === "selected" &&
          c.id !== id,
      );
      if (existing) {
        throw new PersonaDomainError(
          "Pro Projekt darf nur ein Kandidat ausgewählt sein.",
          "WORKFLOW",
          { existingId: existing.id },
        );
      }
    }

    this.candidates[idx] = {
      ...this.candidates[idx],
      ...patch,
      updated_at: nowIso(),
    };
    return structuredClone(this.candidates[idx]);
  }

  async deleteCandidate(scope: WorkspaceScope, id: string) {
    const row = await this.getCandidate(scope, id);
    if (!row) throw new PersonaDomainError("Candidate not found", "NOT_FOUND");
    this.assets = this.assets.filter((a) => a.candidate_id !== id);
    this.candidates = this.candidates.filter((c) => c.id !== id);
  }

  async findSelectedCandidate(scope: WorkspaceScope, projectId: string) {
    const row =
      this.candidates.find(
        (c) =>
          c.workspace_id === scope.workspaceId &&
          c.creation_project_id === projectId &&
          c.status === "selected",
      ) ?? null;
    return row ? structuredClone(row) : null;
  }

  async listCandidateAssets(scope: WorkspaceScope, candidateId: string) {
    await this.getCandidate(scope, candidateId);
    return structuredClone(
      this.assets.filter(
        (a) => a.workspace_id === scope.workspaceId && a.candidate_id === candidateId,
      ),
    );
  }

  async getCandidateAsset(scope: WorkspaceScope, id: string) {
    const row = this.assets.find((a) => a.id === id) ?? null;
    if (!row) return null;
    this.assertWs(row, scope, "Candidate asset");
    return structuredClone(row);
  }

  async createCandidateAsset(scope: WorkspaceScope, input: CreateCandidateAssetInput) {
    const candidate = await this.getCandidate(scope, input.candidate_id);
    if (!candidate) {
      throw new PersonaDomainError("Candidate not found", "NOT_FOUND");
    }
    const created_at = nowIso();
    const row: PersonaCandidateAsset = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      candidate_id: input.candidate_id,
      asset_type: input.asset_type,
      storage_path: input.storage_path,
      mime_type: input.mime_type,
      width: input.width ?? null,
      height: input.height ?? null,
      file_size_bytes: input.file_size_bytes ?? 0,
      checksum: input.checksum ?? "",
      provider_output_id: input.provider_output_id ?? null,
      generation_metadata: input.generation_metadata ?? {},
      status: input.status ?? "uploaded",
      is_primary: input.is_primary ?? false,
      retention_until: input.retention_until ?? null,
      created_at,
      updated_at: created_at,
    };
    if (row.is_primary) {
      for (const a of this.assets) {
        if (a.candidate_id === row.candidate_id) a.is_primary = false;
      }
    }
    this.assets.push(row);
    return structuredClone(row);
  }

  async updateCandidateAsset(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCandidateAssetInput,
  ) {
    const idx = this.assets.findIndex((a) => a.id === id);
    if (idx < 0) throw new PersonaDomainError("Asset not found", "NOT_FOUND");
    this.assertWs(this.assets[idx], scope, "Candidate asset");
    if (patch.is_primary) {
      for (const a of this.assets) {
        if (a.candidate_id === this.assets[idx].candidate_id) a.is_primary = false;
      }
    }
    this.assets[idx] = { ...this.assets[idx], ...patch, updated_at: nowIso() };
    return structuredClone(this.assets[idx]);
  }

  async deleteCandidateAsset(scope: WorkspaceScope, id: string) {
    const row = await this.getCandidateAsset(scope, id);
    if (!row) throw new PersonaDomainError("Asset not found", "NOT_FOUND");
    this.assets = this.assets.filter((a) => a.id !== id);
  }

  async listIdentityReviews(scope: WorkspaceScope, personaId: string) {
    return structuredClone(
      this.reviews.filter(
        (r) => r.workspace_id === scope.workspaceId && r.persona_id === personaId,
      ),
    );
  }

  async createIdentityReview(
    scope: WorkspaceScope,
    input: {
      persona_id: string;
      checklist: IdentityReviewChecklist;
      all_passed: boolean;
      reviewer_notes?: string;
      reviewed_by?: string | null;
      reviewed_at?: string | null;
    },
  ) {
    const created_at = nowIso();
    const row: PersonaIdentityReview = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      persona_id: input.persona_id,
      checklist: input.checklist,
      all_passed: input.all_passed,
      reviewer_notes: input.reviewer_notes ?? "",
      reviewed_by: input.reviewed_by ?? scope.actorId ?? null,
      reviewed_at: input.reviewed_at ?? created_at,
      created_at,
      updated_at: created_at,
    };
    this.reviews.push(row);
    return structuredClone(row);
  }

  async getBrandCastRequirements(scope: WorkspaceScope) {
    const row =
      this.requirements.find((r) => r.workspace_id === scope.workspaceId) ?? null;
    return row ? structuredClone(row) : null;
  }

  async upsertBrandCastRequirements(
    scope: WorkspaceScope,
    input: {
      required_male_approved?: number;
      required_female_approved?: number;
      milestone_label?: string;
      active?: boolean;
    },
  ) {
    const existing = this.requirements.find(
      (r) => r.workspace_id === scope.workspaceId,
    );
    if (existing) {
      Object.assign(existing, {
        required_male_approved:
          input.required_male_approved ?? existing.required_male_approved,
        required_female_approved:
          input.required_female_approved ?? existing.required_female_approved,
        milestone_label: input.milestone_label ?? existing.milestone_label,
        active: input.active ?? existing.active,
        updated_at: nowIso(),
      });
      return structuredClone(existing);
    }
    const created_at = nowIso();
    const row: PersonaBrandCastRequirements = {
      id: randomUUID(),
      workspace_id: scope.workspaceId,
      required_male_approved: input.required_male_approved ?? 2,
      required_female_approved: input.required_female_approved ?? 1,
      milestone_label: input.milestone_label ?? "BRAND CAST APPROVED",
      active: input.active ?? true,
      created_at,
      updated_at: created_at,
    };
    this.requirements.push(row);
    return structuredClone(row);
  }

  async sumActualGenerationCostToday(scope: WorkspaceScope) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.projects
      .filter(
        (p) =>
          p.workspace_id === scope.workspaceId &&
          new Date(p.updated_at) >= start,
      )
      .reduce((sum, p) => sum + (p.actual_cost || 0), 0);
  }
}
