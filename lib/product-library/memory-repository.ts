import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ProductProfileRepository } from "@/lib/product-library/repository";
import { productProfileSchema, type ProductProfile } from "@/lib/product-library/types";

export class MemoryProductProfileRepository implements ProductProfileRepository {
  private profiles: ProductProfile[] = [];
  async listLatest(scope: WorkspaceScope) {
    const latest = new Map<string, ProductProfile>();
    for (const profile of this.profiles.filter((item) => item.workspaceId === scope.workspaceId)) {
      const current = latest.get(profile.productProfileId);
      if (!current || current.version < profile.version) latest.set(profile.productProfileId, profile);
    }
    return structuredClone([...latest.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }
  async listVersions(scope: WorkspaceScope, profileKey: string) {
    return structuredClone(this.profiles.filter((p) => p.workspaceId === scope.workspaceId && p.productProfileId === profileKey).sort((a, b) => b.version - a.version));
  }
  async getLatest(scope: WorkspaceScope, profileKey: string) {
    return structuredClone(this.profiles.filter((p) => p.workspaceId === scope.workspaceId && p.productProfileId === profileKey).sort((a, b) => b.version - a.version)[0] ?? null);
  }
  async getVersion(scope: WorkspaceScope, profileKey: string, version: number) {
    return structuredClone(this.profiles.find((p) => p.workspaceId === scope.workspaceId && p.productProfileId === profileKey && p.version === version) ?? null);
  }
  async getLatestByShopifyProductId(scope: WorkspaceScope, shopifyProductId: string) {
    return structuredClone(this.profiles.filter((p) => p.workspaceId === scope.workspaceId && p.shopifyProductId === shopifyProductId).sort((a, b) => b.version - a.version)[0] ?? null);
  }
  async createVersion(scope: WorkspaceScope & { actorId: string }, profile: ProductProfile) {
    const parsed = productProfileSchema.parse(profile);
    if (parsed.workspaceId !== scope.workspaceId || parsed.createdBy !== scope.actorId) throw new Error("Product profile scope/actor mismatch.");
    const replay = await this.getVersion(scope, parsed.productProfileId, parsed.version);
    if (replay) {
      if (JSON.stringify(replay) === JSON.stringify(parsed)) return replay;
      throw new Error("Product profile version conflict.");
    }
    this.profiles.push(structuredClone(parsed));
    return structuredClone(parsed);
  }
}
