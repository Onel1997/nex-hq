import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError, PersonaStoreError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import {
  normalizeOptionalRfc3339Timestamp,
  normalizeRfc3339Timestamp,
} from "@/lib/datetime/rfc3339";
import type {
  GeneratedProductionAsset,
  ImageProductionProjectRepository,
  ProjectPreparation,
} from "./repository";
import {
  imageProductionAssetSchema,
  imageProductionProjectSchema,
  type ImageProductionAsset,
  type ImageProductionProject,
} from "./types";

function mapProject(row: Record<string, unknown>): ImageProductionProject {
  return imageProductionProjectSchema.parse({
    contractVersion: "image-production-project-v1",
    id: row.id,
    workspaceId: row.workspace_id,
    reportRecordId: row.report_record_id,
    reportId: row.report_id,
    projectName: row.project_name,
    campaignDirection: row.campaign_direction,
    brandModel: row.brand_model,
    masterArtwork: row.master_artwork,
    productContext: row.product_context,
    shotPlan: row.shot_plan,
    status: row.status,
    version: Number(row.version),
    createdBy: row.created_by,
    createdAt: normalizeRfc3339Timestamp(row.created_at),
    updatedAt: normalizeRfc3339Timestamp(row.updated_at),
  });
}

function mapAsset(row: Record<string, unknown>): ImageProductionAsset {
  return imageProductionAssetSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    productionProjectId: row.production_project_id,
    generationJobId: row.generation_job_id,
    shotId: row.shot_id,
    inputFingerprint: row.input_fingerprint,
    brandModel: row.brand_model,
    masterArtwork: row.master_artwork,
    productContext: row.product_context,
    provider: row.provider,
    model: row.model,
    providerRequestId: row.provider_request_id,
    storagePath: row.storage_path,
    provenance: row.provenance,
    reviewStatus: row.review_status,
    reviewedBy: row.reviewed_by,
    reviewedAt: normalizeOptionalRfc3339Timestamp(row.reviewed_at),
    reviewNote: row.review_note,
    generatedAt: normalizeRfc3339Timestamp(row.generated_at),
    createdAt: normalizeRfc3339Timestamp(row.created_at),
    updatedAt: normalizeRfc3339Timestamp(row.updated_at),
  });
}

function projectCriticalState(input: ProjectPreparation | ImageProductionProject) {
  return JSON.stringify({
    campaignDirection: input.campaignDirection,
    brandModel: input.brandModel,
    masterArtwork: input.masterArtwork,
    productContext: input.productContext,
    shotPlan: input.shotPlan,
  });
}

export class SupabaseImageProductionProjectRepository
  implements ImageProductionProjectRepository
{
  async upsertFromPreparation(
    scope: WorkspaceScope & { actorId: string },
    input: ProjectPreparation,
  ) {
    const db = createAdminClient();
    const current = await db
      .from("image_production_projects")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("report_record_id", input.reportRecordId)
      .maybeSingle();
    if (current.error) throw new PersonaStoreError(current.error.message);
    const existing = current.data
      ? mapProject(current.data as Record<string, unknown>)
      : null;
    if (existing && projectCriticalState(existing) === projectCriticalState(input)) {
      return existing;
    }
    const now = new Date().toISOString();
    const values = {
      workspace_id: scope.workspaceId,
      report_record_id: input.reportRecordId,
      report_id: input.reportId,
      project_name: input.projectName,
      campaign_direction: input.campaignDirection,
      brand_model: input.brandModel,
      master_artwork_id: input.masterArtwork.id,
      master_artwork: input.masterArtwork,
      product_context: input.productContext,
      shot_plan: input.shotPlan,
      status: "READY",
      updated_at: now,
    };
    if (existing) {
      const updated = await db
        .from("image_production_projects")
        .update({ ...values, version: existing.version + 1 })
        .eq("workspace_id", scope.workspaceId)
        .eq("id", existing.id)
        .eq("version", existing.version)
        .select("*")
        .maybeSingle();
      if (updated.error) throw new PersonaStoreError(updated.error.message);
      if (!updated.data) {
        throw new PersonaDomainError(
          "Image production project changed concurrently. Reload before preparing.",
          "WORKFLOW",
        );
      }
      return mapProject(updated.data as Record<string, unknown>);
    }
    const inserted = await db
      .from("image_production_projects")
      .insert({ ...values, created_by: scope.actorId })
      .select("*")
      .single();
    if (inserted.error || !inserted.data) {
      throw new PersonaStoreError(
        inserted.error?.message ?? "Failed to create Image production project",
      );
    }
    return mapProject(inserted.data as Record<string, unknown>);
  }

  async get(scope: WorkspaceScope, id: string) {
    const { data, error } = await createAdminClient()
      .from("image_production_projects")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? mapProject(data as Record<string, unknown>) : null;
  }

  async list(scope: WorkspaceScope) {
    const { data, error } = await createAdminClient()
      .from("image_production_projects")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .order("updated_at", { ascending: false });
    if (error) throw new PersonaStoreError(error.message);
    return (data ?? []).map((row) => mapProject(row as Record<string, unknown>));
  }

  async recordGeneratedAsset(
    scope: WorkspaceScope,
    input: GeneratedProductionAsset,
  ) {
    const db = createAdminClient();
    const values = {
      workspace_id: scope.workspaceId,
      production_project_id: input.productionProjectId,
      generation_job_id: input.generationJobId,
      shot_id: input.shotId,
      input_fingerprint: input.inputFingerprint,
      brand_model: input.brandModel,
      master_artwork: input.masterArtwork,
      product_context: input.productContext,
      provider: input.provider,
      model: input.model,
      provider_request_id: input.providerRequestId,
      storage_path: input.storagePath,
      provenance: input.provenance,
      review_status: input.reviewStatus,
      generated_at: input.generatedAt,
    };
    const { data, error } = await db
      .from("image_production_assets")
      .insert(values)
      .select("*")
      .single();
    if (error || !data) {
      const replay = await db
        .from("image_production_assets")
        .select("*")
        .eq("workspace_id", scope.workspaceId)
        .eq("generation_job_id", input.generationJobId)
        .maybeSingle();
      if (replay.data) return mapAsset(replay.data as Record<string, unknown>);
      throw new PersonaStoreError(
        error?.message ?? "Failed to persist generated Image asset",
      );
    }
    await db
      .from("image_production_projects")
      .update({ status: "REVIEW", updated_at: input.generatedAt })
      .eq("workspace_id", scope.workspaceId)
      .eq("id", input.productionProjectId);
    return mapAsset(data as Record<string, unknown>);
  }

  async listAssets(scope: WorkspaceScope, projectId: string) {
    const { data, error } = await createAdminClient()
      .from("image_production_assets")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("production_project_id", projectId)
      .order("generated_at", { ascending: false });
    if (error) throw new PersonaStoreError(error.message);
    return (data ?? []).map((row) => mapAsset(row as Record<string, unknown>));
  }

  async reviewAsset(
    scope: WorkspaceScope & { actorId: string },
    assetId: string,
    status: "APPROVED" | "REJECTED",
    note: string | null,
    now: string,
  ) {
    const { data, error } = await createAdminClient()
      .from("image_production_assets")
      .update({
        review_status: status,
        reviewed_by: scope.actorId,
        reviewed_at: now,
        review_note: note,
        updated_at: now,
      })
      .eq("workspace_id", scope.workspaceId)
      .eq("id", assetId)
      .in("review_status", ["GENERATED", "REVIEW_REQUIRED", "APPROVED", "REJECTED"])
      .select("*")
      .maybeSingle();
    if (error || !data) {
      throw new PersonaDomainError(
        error?.message ?? "Image production asset not found.",
        "NOT_FOUND",
      );
    }
    return mapAsset(data as Record<string, unknown>);
  }
}
