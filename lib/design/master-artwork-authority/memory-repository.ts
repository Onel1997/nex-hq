import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type {
  CreateApprovedMasterArtwork,
  MasterArtworkAuthorityRepository,
} from "./repository";
import type { ApprovedMasterArtwork } from "./types";

export class MemoryMasterArtworkAuthorityRepository
  implements MasterArtworkAuthorityRepository
{
  private readonly records = new Map<string, ApprovedMasterArtwork>();

  async createOrGet(
    scope: WorkspaceScope & { actorId: string },
    input: CreateApprovedMasterArtwork,
  ) {
    const existing = [...this.records.values()].find(
      (record) =>
        record.workspaceId === scope.workspaceId &&
        record.designId === input.designId &&
        record.version === input.version &&
        record.checksum === input.checksum,
    );
    if (existing) return structuredClone(existing);
    const record: ApprovedMasterArtwork = {
      ...input,
      createdAt: input.approvedAt,
    };
    this.records.set(record.id, record);
    return structuredClone(record);
  }

  async get(scope: WorkspaceScope, id: string) {
    const record = this.records.get(id);
    return record?.workspaceId === scope.workspaceId
      ? structuredClone(record)
      : null;
  }

  async list(scope: WorkspaceScope, designId?: string) {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.workspaceId === scope.workspaceId &&
          (!designId || record.designId === designId),
      )
      .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))
      .map((record) => structuredClone(record));
  }
}
