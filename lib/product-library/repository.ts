import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ProductProfile } from "@/lib/product-library/types";

export interface ProductProfileRepository {
  listLatest(scope: WorkspaceScope): Promise<ProductProfile[]>;
  listVersions(scope: WorkspaceScope, profileKey: string): Promise<ProductProfile[]>;
  getLatest(scope: WorkspaceScope, profileKey: string): Promise<ProductProfile | null>;
  getVersion(scope: WorkspaceScope, profileKey: string, version: number): Promise<ProductProfile | null>;
  getLatestByShopifyProductId(scope: WorkspaceScope, shopifyProductId: string): Promise<ProductProfile | null>;
  createVersion(
    scope: WorkspaceScope & { actorId: string },
    profile: ProductProfile,
  ): Promise<ProductProfile>;
}
