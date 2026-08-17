import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ProductProfile } from "@/lib/product-library/types";

export interface ProductProfileRepository {
  getLatest(scope: WorkspaceScope, profileKey: string): Promise<ProductProfile | null>;
  getVersion(scope: WorkspaceScope, profileKey: string, version: number): Promise<ProductProfile | null>;
  createVersion(
    scope: WorkspaceScope & { actorId: string },
    profile: ProductProfile,
  ): Promise<ProductProfile>;
}
