import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaStoreError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ProductProfileRepository } from "@/lib/product-library/repository";
import { productProfileSchema, type ProductProfile } from "@/lib/product-library/types";
import { normalizeRfc3339Timestamp } from "@/lib/datetime/rfc3339";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function deriveLegacyStatus(row: Record<string, unknown>, provenance: Record<string, unknown>) {
  if (typeof provenance.productStatus === "string") return provenance.productStatus;
  if (row.active === true) return "ACTIVE";
  return "DRAFT";
}

export function mapProductProfileRow(row: Record<string, unknown>): ProductProfile {
  const provenance = object(row.provenance);
  return productProfileSchema.parse({
    schemaVersion: "product-profile-v1",
    productProfileId: row.profile_key,
    workspaceId: row.workspace_id,
    version: Number(row.version),
    authority: row.authority,
    status: deriveLegacyStatus(row, provenance),
    name: row.name,
    productType: row.product_type,
    description: typeof provenance.description === "string" ? provenance.description : null,
    shopifyProductId: row.shopify_product_id,
    shopify: provenance.shopify ?? null,
    shopifyLink: provenance.shopifyLink ?? null,
    productFamily: provenance.productFamily ?? null,
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
    provenance: {
      source: provenance.source,
      capturedAt: provenance.capturedAt,
      sourceVersion: provenance.sourceVersion ?? null,
    },
    createdBy: row.created_by,
    updatedBy: typeof provenance.updatedBy === "string" ? provenance.updatedBy : null,
    createdAt: normalizeRfc3339Timestamp(row.created_at),
    updatedAt: normalizeRfc3339Timestamp(row.updated_at),
  });
}

function persistenceRow(scope: WorkspaceScope & { actorId: string }, profile: ProductProfile) {
  return {
    workspace_id: scope.workspaceId,
    profile_key: profile.productProfileId,
    version: profile.version,
    name: profile.name,
    product_type: profile.productType,
    authority: profile.authority,
    shopify_product_id: profile.shopifyProductId,
    variants: profile.variants,
    colorways: profile.colorways,
    sizes: profile.sizes,
    collections: profile.collections,
    active: profile.active,
    available: profile.available,
    construction: profile.construction,
    visual_references: profile.references,
    print_regions: profile.printSurfaces,
    embroidery_regions: profile.embroideryRegions,
    provenance: {
      ...profile.provenance,
      productStatus: profile.status,
      description: profile.description,
      shopify: profile.shopify,
      shopifyLink: profile.shopifyLink,
      productFamily: profile.productFamily,
      updatedBy: scope.actorId,
    },
    created_by: profile.createdBy,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

function profilesEqual(left: ProductProfile, right: ProductProfile): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class SupabaseProductProfileRepository implements ProductProfileRepository {
  async listLatest(scope: WorkspaceScope) {
    const { data, error } = await createAdminClient().from("product_profiles")
      .select("*").eq("workspace_id", scope.workspaceId)
      .order("version", { ascending: false }).order("updated_at", { ascending: false }).limit(1000);
    if (error) throw new PersonaStoreError(error.message);
    const latest = new Map<string, ProductProfile>();
    for (const row of data ?? []) {
      const profile = mapProductProfileRow(row as Record<string, unknown>);
      if (!latest.has(profile.productProfileId)) latest.set(profile.productProfileId, profile);
    }
    return [...latest.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listVersions(scope: WorkspaceScope, profileKey: string) {
    const { data, error } = await createAdminClient().from("product_profiles")
      .select("*").eq("workspace_id", scope.workspaceId).eq("profile_key", profileKey)
      .order("version", { ascending: false });
    if (error) throw new PersonaStoreError(error.message);
    return (data ?? []).map((row) => mapProductProfileRow(row as Record<string, unknown>));
  }

  async getLatest(scope: WorkspaceScope, profileKey: string) {
    const { data, error } = await createAdminClient().from("product_profiles")
      .select("*").eq("workspace_id", scope.workspaceId).eq("profile_key", profileKey)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? mapProductProfileRow(data as Record<string, unknown>) : null;
  }

  async getVersion(scope: WorkspaceScope, profileKey: string, version: number) {
    const { data, error } = await createAdminClient().from("product_profiles")
      .select("*").eq("workspace_id", scope.workspaceId).eq("profile_key", profileKey)
      .eq("version", version).maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? mapProductProfileRow(data as Record<string, unknown>) : null;
  }

  async getLatestByShopifyProductId(scope: WorkspaceScope, shopifyProductId: string) {
    const { data, error } = await createAdminClient().from("product_profiles")
      .select("*").eq("workspace_id", scope.workspaceId).eq("shopify_product_id", shopifyProductId)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? mapProductProfileRow(data as Record<string, unknown>) : null;
  }

  async createVersion(scope: WorkspaceScope & { actorId: string }, profile: ProductProfile) {
    const parsed = productProfileSchema.parse(profile);
    if (parsed.workspaceId !== scope.workspaceId || parsed.createdBy !== scope.actorId && parsed.version === 1) {
      throw new PersonaStoreError("Product profile scope/actor mismatch.");
    }
    const { data, error } = await createAdminClient().from("product_profiles")
      .insert(persistenceRow(scope, parsed)).select("*").single();
    if (error || !data) {
      const replay = await this.getVersion(scope, parsed.productProfileId, parsed.version);
      if (replay && profilesEqual(replay, parsed)) return replay;
      if (replay) throw new PersonaStoreError("Product profile version conflict. Reload the latest version before saving.");
      throw new PersonaStoreError(error?.message ?? "Failed to persist Product profile version.");
    }
    return mapProductProfileRow(data as Record<string, unknown>);
  }
}
