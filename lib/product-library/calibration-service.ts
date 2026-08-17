import { z } from "zod";

import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import { assertPrintSurfaceReady, printSurfaceSchema, type PrintSurface } from "@/lib/image/print-surface/types";
import { assertUsableNormalizedQuad } from "@/lib/image/print-surface/validate-quad";
import { resolveProductProductionContext, type ProductProductionContext } from "@/lib/image/product-production-context";
import { buildShopifyProductReferencePackage, productVisualInputSchema, type ProductVisualInput } from "@/lib/product-library/product-reference-package";
import { freezeShopifyProductReferences } from "@/lib/product-library/freeze-product-references";
import type { ProductProfileRepository } from "@/lib/product-library/repository";
import { SupabaseProductProfileRepository } from "@/lib/product-library/supabase-repository";
import { persistFrozenProductReference } from "@/lib/product-library/storage";
import { productProfileSchema, type ProductProfile } from "@/lib/product-library/types";
import { fetchShopifyProductDetail } from "@/lib/shopify/fetch-product-detail";

export const calibrateProductSurfaceRequestSchema = z.object({
  authority: z.literal("SHOPIFY_LIVE"),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  surface: z.object({
    printSurfaceId: z.string().min(1),
    region: z.literal("front_center"),
    quad: z.tuple([
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
    ]).superRefine((quad, ctx) => {
      try {
        assertUsableNormalizedQuad(quad);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          message: error instanceof Error ? error.message : "PrintSurface quad is invalid.",
        });
      }
    }),
    calibrationAttestation: z.literal(true),
  }).strict(),
}).strict();

export type CalibrateProductSurfaceRequest = z.infer<typeof calibrateProductSurfaceRequestSchema>;

export interface CalibratedProductResult {
  profile: ProductProfile;
  productContext: ProductProductionContext;
  productVisualInput: ProductVisualInput;
  printSurface: PrintSurface;
}

function criticalProfileState(profile: ProductProfile): string {
  return JSON.stringify({
    authority: profile.authority,
    shopifyProductId: profile.shopifyProductId,
    name: profile.name,
    productType: profile.productType,
    variants: profile.variants,
    references: profile.references,
    printSurfaces: profile.printSurfaces,
    provenanceSourceVersion: profile.provenance.sourceVersion,
  });
}

function visualInput(profile: ProductProfile, context: ProductProductionContext): ProductVisualInput {
  return productVisualInputSchema.parse({
    contractVersion: "product-visual-input-v1",
    productProfileId: profile.productProfileId,
    authority: profile.authority,
    shopifyProductId: profile.shopifyProductId,
    variantId: context.variantId,
    color: context.color,
    material: context.material,
    fit: context.fit,
    construction: profile.construction,
    referencePackage: {
      schemaVersion: "product-reference-package-v1",
      packageId: `${profile.productProfileId}:v${profile.version}`,
      authority: profile.authority,
      productProfileId: profile.productProfileId,
      shopifyProductId: profile.shopifyProductId,
      productVersion: profile.provenance.sourceVersion,
      references: profile.references,
      capturedAt: profile.provenance.capturedAt,
      provenance: profile.provenance.source,
    },
  });
}

export async function calibrateShopifyProductSurface(
  scope: WorkspaceScope,
  request: CalibrateProductSurfaceRequest,
  dependencies: {
    repository?: ProductProfileRepository;
    fetchDetail?: typeof fetchShopifyProductDetail;
    resolveContext?: typeof resolveProductProductionContext;
    freezeReferences?: typeof freezeShopifyProductReferences;
    persistReference?: typeof persistFrozenProductReference;
    now?: () => string;
  } = {},
): Promise<CalibratedProductResult> {
  if (!scope.actorId) throw new PersonaDomainError("Authenticated owner is required.", "AUTHENTICATION_REQUIRED");
  const parsed = calibrateProductSurfaceRequestSchema.parse(request);
  const repository = dependencies.repository ?? new SupabaseProductProfileRepository();
  const fetchDetail = dependencies.fetchDetail ?? fetchShopifyProductDetail;
  const now = (dependencies.now ?? (() => new Date().toISOString()))();
  const context = await (dependencies.resolveContext ?? resolveProductProductionContext)({
    authority: "SHOPIFY_LIVE",
    productId: parsed.productId,
    variantId: parsed.variantId,
  });
  const detail = await fetchDetail(parsed.productId);
  if (!detail || detail.id !== context.productId) throw new PersonaDomainError("Shopify Product detail changed or is unavailable.", "WORKFLOW");
  const profileKey = `shopify:${detail.id}`;
  const existing = await repository.getLatest(scope, profileKey);
  const previousSurface = existing?.printSurfaces.find((surface) => surface.printSurfaceId === parsed.surface.printSurfaceId);
  const surfaceUnchanged = Boolean(previousSurface) &&
    previousSurface?.variantId === context.variantId &&
    JSON.stringify(previousSurface.quad) === JSON.stringify(parsed.surface.quad);
  const surface = surfaceUnchanged
    ? previousSurface!
    : printSurfaceSchema.parse({
    contractVersion: "print-surface-v1",
    printSurfaceId: parsed.surface.printSurfaceId,
    version: previousSurface ? previousSurface.version + 1 : 1,
    productProfileId: profileKey,
    variantId: context.variantId,
    region: parsed.surface.region,
    geometryStatus: "HUMAN_DEFINED",
    quad: parsed.surface.quad,
    boundingBox: null,
    orientationDegrees: 0,
    perspectiveAnchors: [],
    clippingMaskReference: null,
    safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    artworkScale: 1,
    rotationDegrees: 0,
    warpMode: "PERSPECTIVE",
    provenance: { source: "OWNER_CALIBRATION", calibratedBy: scope.actorId, calibratedAt: now },
  });
  assertPrintSurfaceReady(surface);

  const remotePackage = buildShopifyProductReferencePackage(detail, now);
  const remoteIdentity = JSON.stringify(remotePackage.references.map((ref) => ({ id: ref.sourceImageId, url: ref.sourceUrl, width: ref.width, height: ref.height })));
  const existingIdentity = JSON.stringify((existing?.references ?? []).map((ref) => ({ id: ref.sourceImageId, url: ref.sourceUrl, width: ref.width, height: ref.height })));
  const referencesCurrent = Boolean(existing?.references.length) && existing?.provenance.sourceVersion === detail.updatedAt && remoteIdentity === existingIdentity;
  const references = referencesCurrent
    ? existing!.references
    : (await (dependencies.freezeReferences ?? freezeShopifyProductReferences)({
        workspaceId: scope.workspaceId,
        package: remotePackage,
        persist: async ({ path, bytes, mimeType }) => (dependencies.persistReference ?? persistFrozenProductReference)({ workspaceId: scope.workspaceId, path, bytes, mimeType }),
      })).references;
  if (!references.length || references.some((reference) => !reference.contentChecksumSha256 || !reference.privateStoragePath)) {
    throw new PersonaDomainError("Product references must be privately frozen before calibration can become production-ready.", "WORKFLOW");
  }

  const selectedOptions = detail.variants.flatMap((variant) => variant.options);
  const values = (matcher: RegExp) => [...new Set(selectedOptions.filter((option) => matcher.test(option.name)).map((option) => option.value))];
  const candidate = productProfileSchema.parse({
    schemaVersion: "product-profile-v1",
    productProfileId: profileKey,
    workspaceId: scope.workspaceId,
    name: detail.title,
    productType: detail.productType,
    authority: "SHOPIFY_LIVE",
    shopifyProductId: detail.id,
    variants: detail.variants.map((variant) => ({
      variantId: variant.id,
      shopifyVariantId: variant.id,
      title: variant.title,
      color: variant.options.find((option) => /^(color|colour|farbe|couleur)$/i.test(option.name))?.value ?? null,
      size: variant.options.find((option) => /^(size|größe|groesse|taille)$/i.test(option.name))?.value ?? null,
      available: variant.available,
      active: detail.status.toUpperCase() === "ACTIVE",
      updatedAt: variant.updatedAt,
    })),
    colorways: values(/^(color|colour|farbe|couleur)$/i),
    sizes: values(/^(size|größe|groesse|taille)$/i),
    collections: detail.collections,
    active: detail.status.toUpperCase() === "ACTIVE",
    available: context.availability === "AVAILABLE",
    construction: { material: context.material, gsm: null, fit: context.fit, construction: null, collar: null, sleeves: null, zipper: null, pockets: [], seams: [] },
    references,
    printSurfaces: [...(existing?.printSurfaces.filter((item) => item.printSurfaceId !== surface.printSurfaceId) ?? []), surface],
    embroideryRegions: existing?.embroideryRegions ?? [],
    provenance: { source: "Shopify Admin GraphQL + owner-defined PrintSurface", capturedAt: now, sourceVersion: detail.updatedAt },
    version: (existing?.version ?? 0) + 1,
    createdBy: scope.actorId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  if (existing && criticalProfileState({ ...candidate, version: existing.version, createdAt: existing.createdAt, updatedAt: existing.updatedAt }) === criticalProfileState(existing)) {
    const existingSurface = existing.printSurfaces.find((item) => item.printSurfaceId === surface.printSurfaceId)!;
    return { profile: existing, productContext: context, productVisualInput: visualInput(existing, context), printSurface: existingSurface };
  }
  const profile = await repository.createVersion(scope as WorkspaceScope & { actorId: string }, candidate);
  return { profile, productContext: context, productVisualInput: visualInput(profile, context), printSurface: surface };
}

export function toProductProfileView(profile: ProductProfile): ProductProfile {
  return productProfileSchema.parse({
    ...profile,
    references: profile.references.map((reference) => ({ ...reference, privateStoragePath: null })),
  });
}
