import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ApprovedMasterArtwork } from "./types";

export type CreateApprovedMasterArtwork = Omit<
  ApprovedMasterArtwork,
  "createdAt"
>;

export interface MasterArtworkAuthorityRepository {
  createOrGet(
    scope: WorkspaceScope & { actorId: string },
    artwork: CreateApprovedMasterArtwork,
  ): Promise<ApprovedMasterArtwork>;
  get(scope: WorkspaceScope, id: string): Promise<ApprovedMasterArtwork | null>;
  list(scope: WorkspaceScope, designId?: string): Promise<ApprovedMasterArtwork[]>;
}
