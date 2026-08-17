import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ProductProfileRepository } from "@/lib/product-library/repository";
import { productProfileSchema, type ProductProfile } from "@/lib/product-library/types";

export class MemoryProductProfileRepository implements ProductProfileRepository {
  private profiles: ProductProfile[] = [];
  async getLatest(scope: WorkspaceScope, profileKey: string) {
    return structuredClone(this.profiles.filter((p) => p.workspaceId === scope.workspaceId && p.productProfileId === profileKey).sort((a, b) => b.version - a.version)[0] ?? null);
  }
  async getVersion(scope: WorkspaceScope, profileKey: string, version: number) {
    return structuredClone(this.profiles.find((p) => p.workspaceId === scope.workspaceId && p.productProfileId === profileKey && p.version === version) ?? null);
  }
  async createVersion(scope: WorkspaceScope & { actorId: string }, profile: ProductProfile) {
    const parsed = productProfileSchema.parse(profile);
    if (parsed.workspaceId !== scope.workspaceId || parsed.createdBy !== scope.actorId) throw new Error("Product profile scope/actor mismatch.");
    const replay = await this.getVersion(scope, parsed.productProfileId, parsed.version);
    if (replay) return replay;
    this.profiles.push(structuredClone(parsed));
    return structuredClone(parsed);
  }
}
