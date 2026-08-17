import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaStoreError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ProductProfileRepository } from "@/lib/product-library/repository";
import { productProfileSchema, type ProductProfile } from "@/lib/product-library/types";
import { normalizeRfc3339Timestamp } from "@/lib/datetime/rfc3339";

function mapProductProfile(row: Record<string, unknown>): ProductProfile {
  return productProfileSchema.parse({
    schemaVersion: "product-profile-v1",
    productProfileId: row.profile_key,
    workspaceId: row.workspace_id,
    name: row.name,
    productType: row.product_type,
    authority: row.authority,
    shopifyProductId: row.shopify_product_id,
    variants: row.variants,
    colorways: row.colorways,
    sizes: row.sizes,
    collections: row.collections,
    active: row.active,
    available: row.available,
    construction: row.construction,
    references: row.visual_references,
    printSurfaces: row.print_regions,
    embroideryRegions: row.embroidery_regions,
    provenance: row.provenance,
    version: Number(row.version),
    createdBy: row.created_by,
    createdAt: normalizeRfc3339Timestamp(row.created_at),
    updatedAt: normalizeRfc3339Timestamp(row.updated_at),
  });
}

export class SupabaseProductProfileRepository implements ProductProfileRepository {
  async getLatest(scope: WorkspaceScope, profileKey: string) {
    const { data, error } = await createAdminClient().from("product_profiles")
      .select("*").eq("workspace_id", scope.workspaceId).eq("profile_key", profileKey)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? mapProductProfile(data as Record<string, unknown>) : null;
  }

  async getVersion(scope: WorkspaceScope, profileKey: string, version: number) {
    const { data, error } = await createAdminClient().from("product_profiles")
      .select("*").eq("workspace_id", scope.workspaceId).eq("profile_key", profileKey)
      .eq("version", version).maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? mapProductProfile(data as Record<string, unknown>) : null;
  }

  async createVersion(
    scope: WorkspaceScope & { actorId: string },
    profile: ProductProfile,
  ) {
    const parsed = productProfileSchema.parse(profile);
    if (parsed.workspaceId !== scope.workspaceId || parsed.createdBy !== scope.actorId) {
      throw new PersonaStoreError("Product profile scope/actor mismatch.");
    }
    const { data, error } = await createAdminClient().from("product_profiles").insert({
      workspace_id: scope.workspaceId,
      profile_key: parsed.productProfileId,
      version: parsed.version,
      name: parsed.name,
      product_type: parsed.productType,
      authority: parsed.authority,
      shopify_product_id: parsed.shopifyProductId,
      variants: parsed.variants,
      colorways: parsed.colorways,
      sizes: parsed.sizes,
      collections: parsed.collections,
      active: parsed.active,
      available: parsed.available,
      construction: parsed.construction,
      visual_references: parsed.references,
      print_regions: parsed.printSurfaces,
      embroidery_regions: parsed.embroideryRegions,
      provenance: parsed.provenance,
      created_by: scope.actorId,
      created_at: parsed.createdAt,
      updated_at: parsed.updatedAt,
    }).select("*").single();
    if (error || !data) {
      const replay = await this.getVersion(scope, parsed.productProfileId, parsed.version);
      if (replay) return replay;
      throw new PersonaStoreError(error?.message ?? "Failed to persist Product profile version.");
    }
    return mapProductProfile(data as Record<string, unknown>);
  }
}
