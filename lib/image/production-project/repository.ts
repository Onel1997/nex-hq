import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type {
  ImageProductionAsset,
  ImageProductionProject,
} from "./types";

export type ProjectPreparation = Omit<
  ImageProductionProject,
  "id" | "version" | "status" | "createdAt" | "updatedAt"
>;

export type GeneratedProductionAsset = Omit<
  ImageProductionAsset,
  "id" | "createdAt" | "updatedAt" | "reviewedBy" | "reviewedAt" | "reviewNote"
>;

export interface ImageProductionProjectRepository {
  upsertFromPreparation(
    scope: WorkspaceScope & { actorId: string },
    input: ProjectPreparation,
  ): Promise<ImageProductionProject>;
  get(scope: WorkspaceScope, id: string): Promise<ImageProductionProject | null>;
  list(scope: WorkspaceScope): Promise<ImageProductionProject[]>;
  recordGeneratedAsset(
    scope: WorkspaceScope,
    input: GeneratedProductionAsset,
  ): Promise<ImageProductionAsset>;
  listAssets(scope: WorkspaceScope, projectId: string): Promise<ImageProductionAsset[]>;
  reviewAsset(
    scope: WorkspaceScope & { actorId: string },
    assetId: string,
    status: "APPROVED" | "REJECTED",
    note: string | null,
    now: string,
  ): Promise<ImageProductionAsset>;
}
