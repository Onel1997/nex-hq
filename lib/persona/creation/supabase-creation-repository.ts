/**
 * Supabase creation repository — production persistence.
 */

import { createAdminClient } from "@/lib/supabase/admin";
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

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}
function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function nullableStr(v: unknown): string | null {
  if (v == null) return null;
  return str(v);
}
function throwDb(error: { message: string } | null, msg: string) {
  if (error) throw new PersonaDomainError(msg, "VALIDATION", { message: error.message });
}

function mapProject(row: Record<string, unknown>): PersonaCreationProject {
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    name: str(row.name),
    description: str(row.description),
    gender_presentation: str(row.gender_presentation),
    age_range: str(row.age_range),
    height_range: str(row.height_range),
    body_type: str(row.body_type),
    skin_tone_direction: str(row.skin_tone_direction),
    face_shape_direction: str(row.face_shape_direction),
    hair_direction: str(row.hair_direction),
    facial_hair_direction: str(row.facial_hair_direction),
    eye_direction: str(row.eye_direction),
    expression_direction: str(row.expression_direction),
    personality: str(row.personality),
    fashion_style: str(row.fashion_style),
    brand_role: str(row.brand_role, "primary_male") as PersonaCreationProject["brand_role"],
    visual_keywords: str(row.visual_keywords),
    excluded_features: str(row.excluded_features),
    preferred_brand_looks: str(row.preferred_brand_looks),
    preferred_outfits: str(row.preferred_outfits),
    intended_usage: str(
      row.intended_usage,
      "image_and_video",
    ) as PersonaCreationProject["intended_usage"],
    candidate_count: num(row.candidate_count, 4),
    provider_mode: str(
      row.provider_mode,
      "disabled",
    ) as PersonaCreationProject["provider_mode"],
    quality_mode: str(
      row.quality_mode,
      "premium_editorial",
    ) as PersonaCreationProject["quality_mode"],
    status: str(row.status, "draft") as PersonaCreationProject["status"],
    generation_stage: str(
      row.generation_stage,
      "discovery",
    ) as PersonaCreationProject["generation_stage"],
    estimated_cost_min: num(row.estimated_cost_min),
    estimated_cost_max: num(row.estimated_cost_max),
    actual_cost: num(row.actual_cost),
    cost_confirmed_at: nullableStr(row.cost_confirmed_at),
    last_estimate_hash: nullableStr(row.last_estimate_hash),
    last_estimate_at: nullableStr(row.last_estimate_at),
    last_confirmation_token: nullableStr(row.last_confirmation_token),
    additional_description: str(row.additional_description),
    created_by: nullableStr(row.created_by),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function mapCandidate(row: Record<string, unknown>): PersonaCandidate {
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    creation_project_id: str(row.creation_project_id),
    candidate_number: num(row.candidate_number, 1),
    candidate_name: str(row.candidate_name),
    status: str(row.status, "queued") as PersonaCandidate["status"],
    provider: str(row.provider, "none"),
    provider_job_id: nullableStr(row.provider_job_id),
    generation_seed: nullableStr(row.generation_seed),
    generation_prompt: str(row.generation_prompt),
    negative_prompt: str(row.negative_prompt),
    generation_settings:
      (row.generation_settings as Record<string, unknown>) ?? {},
    primary_preview_asset_id: nullableStr(row.primary_preview_asset_id),
    identity_summary: str(row.identity_summary),
    distinguishing_features: str(row.distinguishing_features),
    visual_strengths: str(row.visual_strengths),
    visual_risks: str(row.visual_risks),
    brand_fit_score: row.brand_fit_score == null ? null : num(row.brand_fit_score),
    identity_consistency_score:
      row.identity_consistency_score == null
        ? null
        : num(row.identity_consistency_score),
    realism_score: row.realism_score == null ? null : num(row.realism_score),
    video_suitability_score:
      row.video_suitability_score == null
        ? null
        : num(row.video_suitability_score),
    user_rating: row.user_rating == null ? null : num(row.user_rating),
    user_notes: str(row.user_notes),
    rejection_reason: str(row.rejection_reason),
    fashion_fit_review: str(row.fashion_fit_review),
    body_proportion_review: str(row.body_proportion_review),
    hand_anatomy_review: str(row.hand_anatomy_review),
    face_consistency_review: str(row.face_consistency_review),
    realism_review: str(row.realism_review),
    image_suitability_label: str(row.image_suitability_label),
    video_suitability_label: str(row.video_suitability_label),
    parent_candidate_id: nullableStr(row.parent_candidate_id),
    variation_of_asset_id: nullableStr(row.variation_of_asset_id),
    actual_generation_cost: num(row.actual_generation_cost),
    selected_at: nullableStr(row.selected_at),
    converted_persona_id: nullableStr(row.converted_persona_id),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function mapAsset(row: Record<string, unknown>): PersonaCandidateAsset {
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    candidate_id: str(row.candidate_id),
    asset_type: str(row.asset_type) as PersonaCandidateAsset["asset_type"],
    storage_path: str(row.storage_path),
    mime_type: str(row.mime_type),
    width: row.width == null ? null : num(row.width),
    height: row.height == null ? null : num(row.height),
    file_size_bytes: num(row.file_size_bytes),
    checksum: str(row.checksum),
    provider_output_id: nullableStr(row.provider_output_id),
    generation_metadata:
      (row.generation_metadata as Record<string, unknown>) ?? {},
    status: str(row.status, "uploaded") as PersonaCandidateAsset["status"],
    is_primary: bool(row.is_primary),
    retention_until: nullableStr(row.retention_until),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function mapReview(row: Record<string, unknown>): PersonaIdentityReview {
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    persona_id: str(row.persona_id),
    checklist: (row.checklist as IdentityReviewChecklist) ?? ({} as IdentityReviewChecklist),
    all_passed: bool(row.all_passed),
    reviewer_notes: str(row.reviewer_notes),
    reviewed_by: nullableStr(row.reviewed_by),
    reviewed_at: nullableStr(row.reviewed_at),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

function mapRequirements(row: Record<string, unknown>): PersonaBrandCastRequirements {
  return {
    id: str(row.id),
    workspace_id: str(row.workspace_id),
    required_male_approved: num(row.required_male_approved, 2),
    required_female_approved: num(row.required_female_approved, 1),
    milestone_label: str(row.milestone_label, "BRAND CAST APPROVED"),
    active: bool(row.active, true),
    created_at: str(row.created_at),
    updated_at: str(row.updated_at),
  };
}

export class SupabaseCreationRepository implements PersonaCreationRepository {
  readonly kind = "supabase" as const;
  private get db() {
    return createAdminClient();
  }

  private assertWs(
    row: Record<string, unknown>,
    scope: WorkspaceScope,
    label: string,
  ) {
    if (str(row.workspace_id) !== scope.workspaceId) {
      throw new PersonaDomainError(
        `${label} belongs to a different workspace`,
        "UNAUTHORIZED_WORKSPACE",
        { id: str(row.id) },
      );
    }
  }

  async listProjects(scope: WorkspaceScope) {
    const { data, error } = await this.db
      .from("persona_creation_projects")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .order("created_at", { ascending: false });
    throwDb(error, `Projekte laden fehlgeschlagen: ${error?.message}`);
    return (data ?? []).map((r) => mapProject(r as Record<string, unknown>));
  }

  async getProject(scope: WorkspaceScope, id: string) {
    const { data, error } = await this.db
      .from("persona_creation_projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwDb(error, `Projekt laden fehlgeschlagen: ${error?.message}`);
    if (!data) return null;
    this.assertWs(data as Record<string, unknown>, scope, "Creation project");
    return mapProject(data as Record<string, unknown>);
  }

  async createProject(scope: WorkspaceScope, input: CreateCreationProjectInput) {
    const payload = {
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
    };
    const { data, error } = await this.db
      .from("persona_creation_projects")
      .insert(payload)
      .select("*")
      .single();
    throwDb(error, `Projekt anlegen fehlgeschlagen: ${error?.message}`);
    return mapProject(data as Record<string, unknown>);
  }

  async updateProject(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCreationProjectInput,
  ) {
    await this.getProject(scope, id);
    const { data, error } = await this.db
      .from("persona_creation_projects")
      .update(patch)
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    throwDb(error, `Projekt aktualisieren fehlgeschlagen: ${error?.message}`);
    return mapProject(data as Record<string, unknown>);
  }

  async deleteProject(scope: WorkspaceScope, id: string) {
    await this.getProject(scope, id);
    const { error } = await this.db
      .from("persona_creation_projects")
      .delete()
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId);
    throwDb(error, `Projekt löschen fehlgeschlagen: ${error?.message}`);
  }

  async listCandidates(scope: WorkspaceScope, projectId: string) {
    await this.getProject(scope, projectId);
    const { data, error } = await this.db
      .from("persona_candidates")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("creation_project_id", projectId)
      .order("candidate_number", { ascending: true });
    throwDb(error, `Kandidaten laden fehlgeschlagen: ${error?.message}`);
    return (data ?? []).map((r) => mapCandidate(r as Record<string, unknown>));
  }

  async getCandidate(scope: WorkspaceScope, id: string) {
    const { data, error } = await this.db
      .from("persona_candidates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwDb(error, `Kandidat laden fehlgeschlagen: ${error?.message}`);
    if (!data) return null;
    this.assertWs(data as Record<string, unknown>, scope, "Candidate");
    return mapCandidate(data as Record<string, unknown>);
  }

  async createCandidate(scope: WorkspaceScope, input: CreateCandidateInput) {
    await this.getProject(scope, input.creation_project_id);
    const payload = {
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
    };
    const { data, error } = await this.db
      .from("persona_candidates")
      .insert(payload)
      .select("*")
      .single();
    throwDb(error, `Kandidat anlegen fehlgeschlagen: ${error?.message}`);
    return mapCandidate(data as Record<string, unknown>);
  }

  async updateCandidate(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCandidateInput,
  ) {
    await this.getCandidate(scope, id);
    const { data, error } = await this.db
      .from("persona_candidates")
      .update(patch)
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    if (error) {
      if (/idx_persona_candidates_one_selected|unique/i.test(error.message)) {
        throw new PersonaDomainError(
          "Pro Projekt darf nur ein Kandidat ausgewählt sein.",
          "WORKFLOW",
        );
      }
      throwDb(error, `Kandidat aktualisieren fehlgeschlagen: ${error.message}`);
    }
    return mapCandidate(data as Record<string, unknown>);
  }

  async deleteCandidate(scope: WorkspaceScope, id: string) {
    await this.getCandidate(scope, id);
    const { error } = await this.db
      .from("persona_candidates")
      .delete()
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId);
    throwDb(error, `Kandidat löschen fehlgeschlagen: ${error?.message}`);
  }

  async findSelectedCandidate(scope: WorkspaceScope, projectId: string) {
    const { data, error } = await this.db
      .from("persona_candidates")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("creation_project_id", projectId)
      .eq("status", "selected")
      .maybeSingle();
    throwDb(error, `Auswahl laden fehlgeschlagen: ${error?.message}`);
    return data ? mapCandidate(data as Record<string, unknown>) : null;
  }

  async listCandidateAssets(scope: WorkspaceScope, candidateId: string) {
    await this.getCandidate(scope, candidateId);
    const { data, error } = await this.db
      .from("persona_candidate_assets")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: true });
    throwDb(error, `Assets laden fehlgeschlagen: ${error?.message}`);
    return (data ?? []).map((r) => mapAsset(r as Record<string, unknown>));
  }

  async getCandidateAsset(scope: WorkspaceScope, id: string) {
    const { data, error } = await this.db
      .from("persona_candidate_assets")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwDb(error, `Asset laden fehlgeschlagen: ${error?.message}`);
    if (!data) return null;
    this.assertWs(data as Record<string, unknown>, scope, "Candidate asset");
    return mapAsset(data as Record<string, unknown>);
  }

  async createCandidateAsset(scope: WorkspaceScope, input: CreateCandidateAssetInput) {
    await this.getCandidate(scope, input.candidate_id);
    if (input.is_primary) {
      await this.db
        .from("persona_candidate_assets")
        .update({ is_primary: false })
        .eq("candidate_id", input.candidate_id)
        .eq("workspace_id", scope.workspaceId);
    }
    const payload = {
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
    };
    const { data, error } = await this.db
      .from("persona_candidate_assets")
      .insert(payload)
      .select("*")
      .single();
    throwDb(error, `Asset anlegen fehlgeschlagen: ${error?.message}`);
    return mapAsset(data as Record<string, unknown>);
  }

  async updateCandidateAsset(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateCandidateAssetInput,
  ) {
    const existing = await this.getCandidateAsset(scope, id);
    if (!existing) throw new PersonaDomainError("Asset not found", "NOT_FOUND");
    if (patch.is_primary) {
      await this.db
        .from("persona_candidate_assets")
        .update({ is_primary: false })
        .eq("candidate_id", existing.candidate_id)
        .eq("workspace_id", scope.workspaceId);
    }
    const { data, error } = await this.db
      .from("persona_candidate_assets")
      .update(patch)
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    throwDb(error, `Asset aktualisieren fehlgeschlagen: ${error?.message}`);
    return mapAsset(data as Record<string, unknown>);
  }

  async deleteCandidateAsset(scope: WorkspaceScope, id: string) {
    await this.getCandidateAsset(scope, id);
    const { error } = await this.db
      .from("persona_candidate_assets")
      .delete()
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId);
    throwDb(error, `Asset löschen fehlgeschlagen: ${error?.message}`);
  }

  async listIdentityReviews(scope: WorkspaceScope, personaId: string) {
    const { data, error } = await this.db
      .from("persona_identity_reviews")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("persona_id", personaId)
      .order("created_at", { ascending: false });
    throwDb(error, `Reviews laden fehlgeschlagen: ${error?.message}`);
    return (data ?? []).map((r) => mapReview(r as Record<string, unknown>));
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
    const payload = {
      workspace_id: scope.workspaceId,
      persona_id: input.persona_id,
      checklist: input.checklist,
      all_passed: input.all_passed,
      reviewer_notes: input.reviewer_notes ?? "",
      reviewed_by: input.reviewed_by ?? scope.actorId ?? null,
      reviewed_at: input.reviewed_at ?? new Date().toISOString(),
    };
    const { data, error } = await this.db
      .from("persona_identity_reviews")
      .insert(payload)
      .select("*")
      .single();
    throwDb(error, `Review speichern fehlgeschlagen: ${error?.message}`);
    return mapReview(data as Record<string, unknown>);
  }

  async getBrandCastRequirements(scope: WorkspaceScope) {
    const { data, error } = await this.db
      .from("persona_brand_cast_requirements")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .maybeSingle();
    throwDb(error, `Brand-Cast-Anforderungen laden fehlgeschlagen: ${error?.message}`);
    return data ? mapRequirements(data as Record<string, unknown>) : null;
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
    const existing = await this.getBrandCastRequirements(scope);
    if (existing) {
      const { data, error } = await this.db
        .from("persona_brand_cast_requirements")
        .update({
          required_male_approved:
            input.required_male_approved ?? existing.required_male_approved,
          required_female_approved:
            input.required_female_approved ?? existing.required_female_approved,
          milestone_label: input.milestone_label ?? existing.milestone_label,
          active: input.active ?? existing.active,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      throwDb(error, `Brand-Cast-Anforderungen aktualisieren fehlgeschlagen: ${error?.message}`);
      return mapRequirements(data as Record<string, unknown>);
    }
    const { data, error } = await this.db
      .from("persona_brand_cast_requirements")
      .insert({
        workspace_id: scope.workspaceId,
        required_male_approved: input.required_male_approved ?? 2,
        required_female_approved: input.required_female_approved ?? 1,
        milestone_label: input.milestone_label ?? "BRAND CAST APPROVED",
        active: input.active ?? true,
      })
      .select("*")
      .single();
    throwDb(error, `Brand-Cast-Anforderungen anlegen fehlgeschlagen: ${error?.message}`);
    return mapRequirements(data as Record<string, unknown>);
  }

  async sumActualGenerationCostToday(scope: WorkspaceScope) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await this.db
      .from("persona_creation_projects")
      .select("actual_cost")
      .eq("workspace_id", scope.workspaceId)
      .gte("updated_at", start.toISOString());
    throwDb(error, `Tageskosten laden fehlgeschlagen: ${error?.message}`);
    return (data ?? []).reduce(
      (sum, row) => sum + num((row as { actual_cost: unknown }).actual_cost),
      0,
    );
  }
}
