import { z } from "zod";

import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import {
  assertPrintSurfaceReady,
  printRegionSchema,
  printSurfaceSchema,
  type PrintSurface,
} from "@/lib/image/print-surface/types";
import { assertUsableNormalizedQuad } from "@/lib/image/print-surface/validate-quad";
import {
  resolveProductProductionContext,
  type ProductProductionContext,
} from "@/lib/image/product-production-context";
import {
  buildShopifyProductReferencePackage,
  productVisualInputSchema,
  type ProductVisualInput,
} from "@/lib/product-library/product-reference-package";
import { freezeShopifyProductReferences } from "@/lib/product-library/freeze-product-references";
import type { ProductProfileRepository } from "@/lib/product-library/repository";
import { SupabaseProductProfileRepository } from "@/lib/product-library/supabase-repository";
import { persistFrozenProductReference } from "@/lib/product-library/storage";
import {
  productProfileSchema,
  type ProductProfile,
} from "@/lib/product-library/types";
import { fetchShopifyProductDetail } from "@/lib/shopify/fetch-product-detail";
import {
  deriveShopifyProductSourceContext,
  preserveOwnerConfirmedProductSource,
} from "@/lib/product-library/product-source-context";

export const calibrateProductSurfaceRequestSchema = z
  .object({
    authority: z.literal("SHOPIFY_LIVE"),
    productId: z.string().min(1),
    variantId: z.string().min(1),
    reuse: z
      .object({
        scope: z.enum(["PRODUCT_PROFILE", "PRODUCT_FAMILY"]),
        physicalProductKey: z.string().min(1).max(200),
        physicalProductLabel: z.string().min(1).max(160),
        compatibleShopifyProductIds: z.array(z.string().min(1)).min(1).max(200),
        variantPolicy: z
          .enum(["ALL_COMPATIBLE_VARIANTS", "EXACT_VARIANT"])
          .default("ALL_COMPATIBLE_VARIANTS"),
        normalizedVariantGeometryAttestation: z.boolean(),
        familyEquivalenceAttestation: z.boolean(),
      })
      .strict()
      .superRefine((reuse, ctx) => {
        if (
          reuse.scope === "PRODUCT_FAMILY" &&
          (!reuse.familyEquivalenceAttestation ||
            reuse.compatibleShopifyProductIds.length < 2)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["familyEquivalenceAttestation"],
            message:
              "Family reuse requires explicit owner confirmation of equivalent physical listings.",
          });
        }
        if (
          reuse.variantPolicy === "ALL_COMPATIBLE_VARIANTS" &&
          !reuse.normalizedVariantGeometryAttestation
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["normalizedVariantGeometryAttestation"],
            message:
              "Cross-variant normalized geometry requires explicit owner confirmation.",
          });
        }
        if (
          reuse.scope === "PRODUCT_FAMILY" &&
          reuse.variantPolicy !== "ALL_COMPATIBLE_VARIANTS"
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["variantPolicy"],
            message: "Product-family reuse must cover compatible variants.",
          });
        }
      })
      .optional(),
    reuseFrom: z
      .object({
        ownerProfileKey: z.string().min(1),
        ownerProfileVersion: z.number().int().positive(),
        printSurfaceId: z.string().min(1),
        printSurfaceVersion: z.number().int().positive(),
      })
      .strict()
      .optional(),
    surface: z
      .object({
        printSurfaceId: z.string().min(1),
        region: printRegionSchema,
        displayName: z.string().trim().min(1).max(120).optional(),
        quad: z
          .tuple([
            z.object({
              x: z.number().min(0).max(1),
              y: z.number().min(0).max(1),
            }),
            z.object({
              x: z.number().min(0).max(1),
              y: z.number().min(0).max(1),
            }),
            z.object({
              x: z.number().min(0).max(1),
              y: z.number().min(0).max(1),
            }),
            z.object({
              x: z.number().min(0).max(1),
              y: z.number().min(0).max(1),
            }),
          ])
          .superRefine((quad, ctx) => {
            try {
              assertUsableNormalizedQuad(quad);
            } catch (error) {
              ctx.addIssue({
                code: "custom",
                message:
                  error instanceof Error
                    ? error.message
                    : "PrintSurface quad is invalid.",
              });
            }
          }),
        calibrationAttestation: z.literal(true),
      })
      .strict(),
  })
  .strict();

export type CalibrateProductSurfaceRequest = z.input<
  typeof calibrateProductSurfaceRequestSchema
>;

export interface CalibratedProductResult {
  profile: ProductProfile;
  productContext: ProductProductionContext;
  productVisualInput: ProductVisualInput;
  printSurface: PrintSurface;
}

function criticalProfileState(profile: ProductProfile): string {
  return JSON.stringify({
    authority: profile.authority,
    sourceContext: profile.sourceContext,
    shopifyProductId: profile.shopifyProductId,
    name: profile.name,
    productType: profile.productType,
    variants: profile.variants,
    construction: profile.construction,
    references: profile.references,
    printSurfaces: profile.printSurfaces,
    provenanceSourceVersion: profile.provenance.sourceVersion,
  });
}

function visualInput(
  profile: ProductProfile,
  context: ProductProductionContext,
): ProductVisualInput {
  return productVisualInputSchema.parse({
    contractVersion: "product-visual-input-v2",
    productProfileId: profile.productProfileId,
    profileVersion: profile.version,
    authority: profile.authority,
    status: profile.status,
    productType: profile.productType,
    sourceContext: profile.sourceContext,
    shopifyProductId: profile.shopifyProductId,
    variantId: context.variantId,
    color: context.color,
    size: context.size,
    material: context.material,
    gsm: profile.construction.gsm,
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
  if (!scope.actorId)
    throw new PersonaDomainError(
      "Authenticated owner is required.",
      "AUTHENTICATION_REQUIRED",
    );
  const parsed = calibrateProductSurfaceRequestSchema.parse(request);
  const repository =
    dependencies.repository ?? new SupabaseProductProfileRepository();
  const fetchDetail = dependencies.fetchDetail ?? fetchShopifyProductDetail;
  const now = (dependencies.now ?? (() => new Date().toISOString()))();
  const context = await (
    dependencies.resolveContext ?? resolveProductProductionContext
  )({
    authority: "SHOPIFY_LIVE",
    productId: parsed.productId,
    variantId: parsed.variantId,
  });
  const detail = await fetchDetail(parsed.productId);
  if (!detail || detail.id !== context.productId)
    throw new PersonaDomainError(
      "Shopify Product detail changed or is unavailable.",
      "WORKFLOW",
    );
  const profileKey = `shopify:${detail.id}`;
  const reuseInput = parsed.reuse ?? {
    scope: "PRODUCT_PROFILE" as const,
    physicalProductKey: `shopify-product:${detail.id}`,
    physicalProductLabel: detail.title,
    compatibleShopifyProductIds: [detail.id],
    normalizedVariantGeometryAttestation: true as const,
    variantPolicy: "ALL_COMPATIBLE_VARIANTS" as const,
    familyEquivalenceAttestation: false,
  };
  const existing = await repository.getLatest(scope, profileKey);
  if (!reuseInput.compatibleShopifyProductIds.includes(detail.id)) {
    throw new PersonaDomainError(
      "The selected Shopify Product is not part of the confirmed physical Product scope.",
      "WORKFLOW",
    );
  }
  const inheritedOwner = parsed.reuseFrom
    ? await repository.getVersion(
        scope,
        parsed.reuseFrom.ownerProfileKey,
        parsed.reuseFrom.ownerProfileVersion,
      )
    : null;
  const inheritedSurface = inheritedOwner?.printSurfaces.find(
    (item) =>
      item.printSurfaceId === parsed.reuseFrom?.printSurfaceId &&
      item.version === parsed.reuseFrom?.printSurfaceVersion,
  );
  if (parsed.reuseFrom) {
    const inheritedReuse = inheritedSurface?.reuse;
    if (
      !inheritedSurface ||
      !inheritedReuse ||
      inheritedReuse.scope !== "PRODUCT_FAMILY" ||
      inheritedReuse.equivalenceAuthority !== "OWNER_CONFIRMED" ||
      inheritedReuse.physicalProductKey !== reuseInput.physicalProductKey ||
      !inheritedReuse.compatibleShopifyProductIds.includes(detail.id)
    ) {
      throw new PersonaDomainError(
        "The inherited PrintSurface is not authorized for this physical Product family.",
        "WORKFLOW",
      );
    }
  }
  const previousSurface = existing?.printSurfaces.find(
    (surface) => surface.printSurfaceId === parsed.surface.printSurfaceId,
  );
  const surfaceUnchanged =
    Boolean(previousSurface) &&
    previousSurface?.variantId ===
      (reuseInput.variantPolicy === "EXACT_VARIANT" ? parsed.variantId : null) &&
    JSON.stringify(previousSurface.quad) ===
      JSON.stringify(parsed.surface.quad) &&
    previousSurface?.reuse?.scope === reuseInput.scope &&
    previousSurface?.reuse?.physicalProductKey ===
      reuseInput.physicalProductKey &&
    JSON.stringify(
      previousSurface?.reuse?.compatibleShopifyProductIds ?? [],
    ) === JSON.stringify(reuseInput.compatibleShopifyProductIds);
  const nextProfileVersion = (existing?.version ?? 0) + 1;
  const surface = inheritedSurface
    ? inheritedSurface
    : surfaceUnchanged
      ? previousSurface!
      : printSurfaceSchema.parse({
          contractVersion: "print-surface-v1",
          printSurfaceId: parsed.surface.printSurfaceId,
          version: previousSurface ? previousSurface.version + 1 : 1,
          productProfileId: profileKey,
          variantId:
            reuseInput.variantPolicy === "EXACT_VARIANT"
              ? parsed.variantId
              : null,
          region: parsed.surface.region,
          displayName: parsed.surface.displayName,
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
          provenance: {
            source: "OWNER_CALIBRATION",
            calibratedBy: scope.actorId,
            calibratedAt: now,
          },
          reuse: {
            scope: reuseInput.scope,
            physicalProductKey: reuseInput.physicalProductKey,
            physicalProductLabel: reuseInput.physicalProductLabel,
            sourceProductProfileId: profileKey,
            sourceProductProfileVersion: nextProfileVersion,
            variantPolicy: reuseInput.variantPolicy,
            compatibleShopifyProductIds: reuseInput.compatibleShopifyProductIds,
            equivalenceAuthority: "OWNER_CONFIRMED",
            confirmedBy: scope.actorId,
            confirmedAt: now,
          },
        });
  assertPrintSurfaceReady(surface);

  const remotePackage = buildShopifyProductReferencePackage(detail, now);
  const remoteIdentity = JSON.stringify(
    remotePackage.references.map((ref) => ({
      id: ref.sourceImageId,
      url: ref.sourceUrl,
      width: ref.width,
      height: ref.height,
    })),
  );
  const existingIdentity = JSON.stringify(
    (existing?.references ?? []).map((ref) => ({
      id: ref.sourceImageId,
      url: ref.sourceUrl,
      width: ref.width,
      height: ref.height,
    })),
  );
  const referencesCurrent =
    Boolean(existing?.references.length) &&
    existing?.provenance.sourceVersion === detail.updatedAt &&
    remoteIdentity === existingIdentity &&
    existing.references.every(
      (reference) =>
        reference.privateStoragePath &&
        reference.contentChecksumSha256 &&
        reference.mimeType &&
        reference.byteLength,
    );
  const ownerRoles = new Map(
    (existing?.references ?? [])
      .filter(
        (reference) => reference.roleProvenance?.source === "OWNER_ASSIGNED",
      )
      .map((reference) => [reference.sourceImageId, reference]),
  );
  const packageWithOwnerRoles = {
    ...remotePackage,
    references: remotePackage.references.map((reference) => {
      const owner = ownerRoles.get(reference.sourceImageId);
      return owner
        ? {
            ...reference,
            role: owner.role,
            roleProvenance: owner.roleProvenance,
          }
        : reference;
    }),
  };
  const references = referencesCurrent
    ? existing!.references
    : (
        await (dependencies.freezeReferences ?? freezeShopifyProductReferences)(
          {
            workspaceId: scope.workspaceId,
            package: packageWithOwnerRoles,
            persist: async ({ path, bytes, mimeType }) =>
              (dependencies.persistReference ?? persistFrozenProductReference)({
                workspaceId: scope.workspaceId,
                path,
                bytes,
                mimeType,
              }),
          },
        )
      ).references;
  if (
    !references.length ||
    references.some(
      (reference) =>
        !reference.contentChecksumSha256 ||
        !reference.privateStoragePath ||
        !reference.mimeType ||
        !reference.byteLength,
    )
  ) {
    throw new PersonaDomainError(
      "Product references must be privately frozen before calibration can become production-ready.",
      "WORKFLOW",
    );
  }

  const selectedOptions = detail.variants.flatMap((variant) => variant.options);
  const values = (matcher: RegExp) => [
    ...new Set(
      selectedOptions
        .filter((option) => matcher.test(option.name))
        .map((option) => option.value),
    ),
  ];
  const candidate = productProfileSchema.parse({
    schemaVersion: "product-profile-v1",
    productProfileId: profileKey,
    workspaceId: scope.workspaceId,
    version: nextProfileVersion,
    status:
      detail.status.toUpperCase() === "ACTIVE"
        ? "ACTIVE"
        : detail.status.toUpperCase() === "ARCHIVED"
          ? "ARCHIVED"
          : "DRAFT",
    name: detail.title,
    productType: detail.productType,
    description: detail.description || existing?.description || null,
    authority: "SHOPIFY_LIVE",
    shopifyProductId: detail.id,
    shopify: {
      productId: detail.id,
      handle: detail.handle || null,
      vendor: detail.vendor ?? null,
      productType: detail.productType || null,
      updatedAt: detail.updatedAt,
      syncedAt: now,
    },
    shopifyLink: null,
    sourceContext: preserveOwnerConfirmedProductSource(
      existing?.sourceContext,
      deriveShopifyProductSourceContext({
        vendor: detail.vendor,
        tags: detail.tags,
        capturedAt: now,
      }),
    ),
    variants: detail.variants.map((variant) => ({
      variantId: variant.id,
      shopifyVariantId: variant.id,
      title: variant.title,
      color:
        variant.options.find((option) =>
          /^(color|colour|farbe|couleur)$/i.test(option.name),
        )?.value ?? null,
      size:
        variant.options.find((option) =>
          /^(size|größe|groesse|taille)$/i.test(option.name),
        )?.value ?? null,
      sku: variant.sku ?? null,
      available: variant.available,
      active: detail.status.toUpperCase() === "ACTIVE",
      updatedAt: variant.updatedAt,
    })),
    colorways: values(/^(color|colour|farbe|couleur)$/i),
    sizes: values(/^(size|größe|groesse|taille)$/i),
    collections: detail.collections,
    active: detail.status.toUpperCase() === "ACTIVE",
    available: context.availability === "AVAILABLE",
    construction: existing?.construction ?? {
      material: context.material,
      fit: context.fit,
      metadataSource: "UNKNOWN",
    },
    references,
    printSurfaces: inheritedSurface
      ? (existing?.printSurfaces ?? [])
      : [
          ...(existing?.printSurfaces.filter(
            (item) => item.printSurfaceId !== surface.printSurfaceId,
          ) ?? []),
          surface,
        ],
    embroideryRegions: existing?.embroideryRegions ?? [],
    provenance: {
      source:
        existing?.construction.metadataSource === "PRODUCTION_METADATA_MANUAL"
          ? "Shopify canonical catalog + NexHQ owner production metadata + owner-defined PrintSurface"
          : "Shopify Admin GraphQL + owner-defined PrintSurface",
      capturedAt: now,
      sourceVersion: detail.updatedAt,
    },
    createdBy: existing?.createdBy ?? scope.actorId,
    updatedBy: scope.actorId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  if (
    existing &&
    criticalProfileState({
      ...candidate,
      version: existing.version,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    }) === criticalProfileState(existing)
  ) {
    return {
      profile: existing,
      productContext: context,
      productVisualInput: visualInput(existing, context),
      printSurface: surface,
    };
  }
  const profile = await repository.createVersion(
    scope as WorkspaceScope & { actorId: string },
    candidate,
  );
  return {
    profile,
    productContext: context,
    productVisualInput: visualInput(profile, context),
    printSurface: surface,
  };
}

export function toProductProfileView(profile: ProductProfile): ProductProfile {
  return productProfileSchema.parse({
    ...profile,
    references: profile.references.map((reference) => ({
      ...reference,
      privateStoragePath: null,
    })),
  });
}
