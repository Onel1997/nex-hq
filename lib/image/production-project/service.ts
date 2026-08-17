import type { BrainImageSections } from "@/brain/domains/reports";
import type { ImageStudioAsset } from "@/agents/image/studio-schema";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ApprovedMasterArtwork } from "@/lib/design/master-artwork-authority/types";
import type { BrandModelTrace } from "@/lib/persona/domain/brand-model-contract";
import type { ProductProductionContext } from "@/lib/image/product-production-context";
import type { ImageGenerateResult } from "@/agents/image/types-generation";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { ImageGenerationJob } from "@/lib/image/paid-generation/types";
import type { ImageProductionProjectRepository } from "./repository";
import { SupabaseImageProductionProjectRepository } from "./supabase-repository";
import { createImageProductionAssetAccess } from "./asset-access";
import type {
  ImageProductionAssetView,
  ImageProductionProject,
} from "./types";

function requireActor(
  scope: WorkspaceScope,
): asserts scope is WorkspaceScope & { actorId: string } {
  if (!scope.actorId) {
    throw new PersonaDomainError("Authenticated owner is required.", "AUTHENTICATION_REQUIRED");
  }
}

export function buildDurableShotPlan(sections: BrainImageSections) {
  return ((sections.productionAssets ?? []) as ImageStudioAsset[]).map((asset) => ({
    id: asset.id,
    assetType: asset.assetType,
    title: asset.title ?? asset.productName,
    prompt: asset.prompt.openai,
    scene: asset.location,
    lighting: asset.lighting,
    poseDirection: asset.photographyStyle || null,
    dimensions: asset.dimensions ?? "2048x2048",
  }));
}

export async function ensureImageProductionProject(
  scope: WorkspaceScope,
  input: {
    reportRecordId: string;
    reportId: string;
    sections: BrainImageSections;
    brandModel: BrandModelTrace;
    artwork: ApprovedMasterArtwork;
    productContext: ProductProductionContext;
  },
  repository: ImageProductionProjectRepository =
    new SupabaseImageProductionProjectRepository(),
): Promise<ImageProductionProject> {
  requireActor(scope);
  const { storagePath: _private, ...safeArtwork } = input.artwork;
  void _private;
  const shotPlan = buildDurableShotPlan(input.sections);
  if (!shotPlan.length) {
    throw new PersonaDomainError("Image project has no production shots.", "WORKFLOW");
  }
  return repository.upsertFromPreparation(scope, {
    contractVersion: "image-production-project-v1",
    workspaceId: scope.workspaceId,
    reportRecordId: input.reportRecordId,
    reportId: input.reportId,
    projectName: input.sections.projectName,
    campaignDirection: {
      visualDirection: input.sections.visualDirection ?? input.sections.projectName,
      collectionName: input.sections.collectionName ?? null,
    },
    brandModel: input.brandModel,
    masterArtwork: safeArtwork,
    productContext: input.productContext,
    shotPlan,
    createdBy: scope.actorId,
  });
}

export async function persistGeneratedProductionAsset(
  scope: WorkspaceScope,
  input: {
    project: ImageProductionProject;
    job: ImageGenerationJob;
    result: ImageGenerateResult;
  },
  repository: ImageProductionProjectRepository =
    new SupabaseImageProductionProjectRepository(),
) {
  const provenance = input.result.asset.generationProvenance;
  const storagePath = input.result.asset.storagePath;
  if (!provenance || !storagePath) {
    throw new PersonaDomainError(
      "Generated Image output is missing durable storage/provenance.",
      "WORKFLOW",
    );
  }
  const brandModel = input.project.brandModel;
  return repository.recordGeneratedAsset(scope, {
    workspaceId: scope.workspaceId,
    productionProjectId: input.project.id,
    generationJobId: input.job.id,
    shotId: input.job.inputSnapshot.production.assetId,
    inputFingerprint: input.job.inputFingerprint,
    brandModel,
    masterArtwork: {
      id: input.project.masterArtwork.id,
      designId: input.project.masterArtwork.designId,
      version: input.project.masterArtwork.version,
      checksum: input.project.masterArtwork.checksum,
    },
    productContext: input.project.productContext,
    provider: input.job.inputSnapshot.production.provider,
    model: input.job.inputSnapshot.production.model,
    providerRequestId: provenance.providerRequestId,
    storagePath,
    provenance,
    reviewStatus: "REVIEW_REQUIRED",
    generatedAt: input.result.asset.createdAt ?? new Date().toISOString(),
  });
}

export async function listImageProductionProjects(
  scope: WorkspaceScope,
  repository: ImageProductionProjectRepository =
    new SupabaseImageProductionProjectRepository(),
) {
  return repository.list(scope);
}

export async function listImageProductionAssets(
  scope: WorkspaceScope,
  projectId: string,
  options: {
    repository?: ImageProductionProjectRepository;
    createAccess?: typeof createImageProductionAssetAccess;
  } = {},
): Promise<ImageProductionAssetView[]> {
  const repository =
    options.repository ?? new SupabaseImageProductionProjectRepository();
  const project = await repository.get(scope, projectId);
  if (!project) throw new PersonaDomainError("Image project not found.", "NOT_FOUND");
  const assets = await repository.listAssets(scope, projectId);
  return Promise.all(
    assets.map(async ({ storagePath, ...asset }) => {
      try {
        const access = await (options.createAccess ?? createImageProductionAssetAccess)(
          scope.workspaceId,
          storagePath,
        );
        return {
          ...asset,
          accessUrl: access.accessUrl,
          accessExpiresAt: access.expiresAt,
        };
      } catch {
        return { ...asset, accessUrl: null, accessExpiresAt: null };
      }
    }),
  );
}

export async function reviewImageProductionAsset(
  scope: WorkspaceScope,
  assetId: string,
  status: "APPROVED" | "REJECTED",
  note: string | null,
  repository: ImageProductionProjectRepository =
    new SupabaseImageProductionProjectRepository(),
) {
  requireActor(scope);
  return repository.reviewAsset(
    scope,
    assetId,
    status,
    note,
    new Date().toISOString(),
  );
}
