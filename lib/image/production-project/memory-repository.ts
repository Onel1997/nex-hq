import { randomUUID } from "node:crypto";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type {
  GeneratedProductionAsset,
  ImageProductionProjectRepository,
  ProjectPreparation,
} from "./repository";
import type {
  ImageProductionAsset,
  ImageProductionProject,
} from "./types";

function criticalState(input: ProjectPreparation | ImageProductionProject): string {
  return JSON.stringify({
    campaignDirection: input.campaignDirection,
    brandModel: input.brandModel,
    masterArtwork: input.masterArtwork,
    productContext: input.productContext,
    shotPlan: input.shotPlan,
  });
}

export class MemoryImageProductionProjectRepository
  implements ImageProductionProjectRepository
{
  private readonly projects = new Map<string, ImageProductionProject>();
  private readonly assets = new Map<string, ImageProductionAsset>();

  async upsertFromPreparation(
    scope: WorkspaceScope & { actorId: string },
    input: ProjectPreparation,
  ) {
    const now = new Date().toISOString();
    const existing = [...this.projects.values()].find(
      (project) =>
        project.workspaceId === scope.workspaceId &&
        project.reportRecordId === input.reportRecordId,
    );
    if (existing) {
      if (criticalState(existing) === criticalState(input)) {
        return structuredClone(existing);
      }
      const next: ImageProductionProject = {
        ...existing,
        ...input,
        version: existing.version + 1,
        status: "READY",
        updatedAt: now,
      };
      this.projects.set(next.id, next);
      return structuredClone(next);
    }
    const created: ImageProductionProject = {
      ...input,
      contractVersion: "image-production-project-v1",
      id: randomUUID(),
      version: 1,
      status: "READY",
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(created.id, created);
    return structuredClone(created);
  }

  async get(scope: WorkspaceScope, id: string) {
    const project = this.projects.get(id);
    return project?.workspaceId === scope.workspaceId
      ? structuredClone(project)
      : null;
  }

  async list(scope: WorkspaceScope) {
    return [...this.projects.values()]
      .filter((project) => project.workspaceId === scope.workspaceId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((project) => structuredClone(project));
  }

  async recordGeneratedAsset(
    scope: WorkspaceScope,
    input: GeneratedProductionAsset,
  ) {
    const existing = [...this.assets.values()].find(
      (asset) =>
        asset.workspaceId === scope.workspaceId &&
        asset.generationJobId === input.generationJobId,
    );
    if (existing) return structuredClone(existing);
    const now = input.generatedAt;
    const asset: ImageProductionAsset = {
      ...input,
      id: randomUUID(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: now,
      updatedAt: now,
    };
    this.assets.set(asset.id, asset);
    return structuredClone(asset);
  }

  async listAssets(scope: WorkspaceScope, projectId: string) {
    return [...this.assets.values()]
      .filter(
        (asset) =>
          asset.workspaceId === scope.workspaceId &&
          asset.productionProjectId === projectId,
      )
      .map((asset) => structuredClone(asset));
  }

  async reviewAsset(
    scope: WorkspaceScope & { actorId: string },
    assetId: string,
    status: "APPROVED" | "REJECTED",
    note: string | null,
    now: string,
  ) {
    const asset = this.assets.get(assetId);
    if (!asset || asset.workspaceId !== scope.workspaceId) {
      throw new PersonaDomainError("Image production asset not found.", "NOT_FOUND");
    }
    const next = {
      ...asset,
      reviewStatus: status,
      reviewedBy: scope.actorId,
      reviewedAt: now,
      reviewNote: note,
      updatedAt: now,
    };
    this.assets.set(assetId, next);
    return structuredClone(next);
  }
}
