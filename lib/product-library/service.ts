import { randomUUID } from "node:crypto";
import { z } from "zod";

import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import {
  printRegionSchema,
  printSurfaceSchema,
  type PrintSurface,
} from "@/lib/image/print-surface/types";
import { assertUsableNormalizedQuad } from "@/lib/image/print-surface/validate-quad";
import {
  normalizedPrintAreaSchema,
  printAreaQuad,
  productFamilySideSchema,
} from "@/lib/product-library/product-family";
import { detectMarketPrintGreenArea } from "@/lib/product-library/product-family-green-detection";
import { buildShopifyProductReferencePackage } from "@/lib/product-library/product-reference-package";
import type { ProductProfileRepository } from "@/lib/product-library/repository";
import { SupabaseProductProfileRepository } from "@/lib/product-library/supabase-repository";
import {
  productFamilyConfigSchema,
  productConstructionSchema,
  productProfileSchema,
  productReferenceRoleSchema,
  productVisualReferenceSchema,
  type ProductProfile,
  type ProductVisualReference,
} from "@/lib/product-library/types";
import {
  productPrintMethodSchema,
  productStatusSchema,
} from "@/lib/product-library/product-taxonomy";
import {
  createProductReferencePreview,
  persistManualProductReference,
} from "@/lib/product-library/storage";
import { fetchShopifyProductDetail } from "@/lib/shopify/fetch-product-detail";
import {
  deriveShopifyProductSourceContext,
  preserveOwnerConfirmedProductSource,
} from "@/lib/product-library/product-source-context";

const nullableText = z.string().trim().max(5000).nullable().optional();
const stringList = z.array(z.string().trim().min(1).max(120)).max(100);

function productColorKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "farbe";
}

export const createManualProductProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    productType: z.string().trim().min(1).max(120),
    status: productStatusSchema.default("DRAFT"),
    description: nullableText,
    colorways: stringList.default([]),
    sizes: stringList.default([]),
    collections: stringList.default([]),
    construction: productConstructionSchema.partial().default({}),
    productFamily: z
      .object({
        enabled: z.boolean(),
        supplierName: z.string().trim().min(1).max(120).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (!input.productFamily?.enabled && input.colorways.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["colorways"],
        message: "Mindestens eine Farbe ist erforderlich.",
      });
    }
  });

export const updateProductKnowledgeSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    status: productStatusSchema.optional(),
    name: z.string().trim().min(1).max(160).optional(),
    productType: z.string().trim().min(1).max(120).optional(),
    description: nullableText,
    colorways: stringList.optional(),
    sizes: stringList.optional(),
    collections: stringList.optional(),
    construction: productConstructionSchema.partial().optional(),
  })
  .strict();

export const syncShopifyProductProfileSchema = z
  .object({
    productId: z.string().min(1),
    expectedVersion: z.number().int().positive().nullable().optional(),
    enrichment: productConstructionSchema.partial().optional(),
  })
  .strict();

export const assignProductReferenceRoleSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    role: productReferenceRoleSchema,
  })
  .strict();

export const saveProductSurfaceSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    printSurfaceId: z.string().trim().min(1).max(160),
    displayName: z.string().trim().min(1).max(120),
    region: printRegionSchema,
    variantId: z.string().min(1).nullable(),
    surfaceKind: z.enum(["PRINT", "EMBROIDERY", "BOTH"]).default("PRINT"),
    supportedPrintMethods: z.array(productPrintMethodSchema).default([]),
    quad: z.tuple([
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
    ]),
    calibrationAttestation: z.literal(true),
  })
  .strict()
  .superRefine((input, ctx) => {
    try {
      assertUsableNormalizedQuad(input.quad);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["quad"],
        message:
          error instanceof Error ? error.message : "Ungültige Druckfläche.",
      });
    }
  });

export const linkManualProductToShopifySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    shopifyProductId: z.string().min(1),
    ownerAttestation: z.literal(true),
    colorKey: z.string().min(1).optional(),
    shopifyVariantIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const addProductFamilyColorSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    colorName: z.string().trim().min(1).max(80),
    colorKey: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const correctProductFamilyPlacementSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    side: productFamilySideSchema,
    normalizedRegion: normalizedPrintAreaSchema,
  })
  .strict();

type Dependencies = {
  repository: ProductProfileRepository;
  fetchShopifyDetail: typeof fetchShopifyProductDetail;
  storeManualReference: typeof persistManualProductReference;
  createPreview: typeof createProductReferencePreview;
  now: () => string;
  id: () => string;
};

function dependencies(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    repository: new SupabaseProductProfileRepository(),
    fetchShopifyDetail: fetchShopifyProductDetail,
    storeManualReference: persistManualProductReference,
    createPreview: createProductReferencePreview,
    now: () => new Date().toISOString(),
    id: randomUUID,
    ...overrides,
  };
}

function requireActor(
  scope: WorkspaceScope,
): asserts scope is WorkspaceScope & { actorId: string } {
  if (!scope.actorId)
    throw new PersonaDomainError(
      "Authenticated owner is required.",
      "AUTHENTICATION_REQUIRED",
    );
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function manualVariants(profileId: string, colors: string[], sizes: string[]) {
  const dimensions = sizes.length
    ? colors.flatMap((color) => sizes.map((size) => ({ color, size })))
    : colors.map((color) => ({ color, size: null }));
  return dimensions.map((item, index) => ({
    variantId: `manual:${profileId}:variant:${index + 1}`,
    shopifyVariantId: null,
    title: [item.color, item.size].filter(Boolean).join(" / "),
    color: item.color,
    size: item.size,
    sku: null,
    available: null,
    active: null,
    updatedAt: null,
  }));
}

function nextVersion(
  profile: ProductProfile,
  actorId: string,
  now: string,
  patch: Partial<ProductProfile>,
): ProductProfile {
  return productProfileSchema.parse({
    ...profile,
    ...patch,
    version: profile.version + 1,
    createdAt: profile.createdAt,
    createdBy: profile.createdBy,
    updatedBy: actorId,
    updatedAt: now,
  });
}

function assertExpectedVersion(
  profile: ProductProfile,
  expectedVersion: number,
) {
  if (profile.version !== expectedVersion) {
    throw new PersonaDomainError(
      "Product profile changed. Reload before saving a new version.",
      "WORKFLOW",
    );
  }
}

export async function listProductProfiles(
  scope: WorkspaceScope,
  overrides: Partial<Dependencies> = {},
) {
  return dependencies(overrides).repository.listLatest(scope);
}

export async function getProductProfile(
  scope: WorkspaceScope,
  profileId: string,
  version?: number,
  overrides: Partial<Dependencies> = {},
) {
  const repository = dependencies(overrides).repository;
  return version
    ? repository.getVersion(scope, profileId, version)
    : repository.getLatest(scope, profileId);
}

export async function createManualProductProfile(
  scope: WorkspaceScope,
  input: unknown,
  overrides: Partial<Dependencies> = {},
) {
  requireActor(scope);
  const parsed = createManualProductProfileSchema.parse(input);
  const d = dependencies(overrides);
  const now = d.now();
  const id = d.id();
  const colorways = dedupe(parsed.colorways);
  const sizes = dedupe(parsed.sizes);
  const profile = productProfileSchema.parse({
    schemaVersion: "product-profile-v1",
    productProfileId: `manual:${id}`,
    workspaceId: scope.workspaceId,
    version: 1,
    authority: "MANUAL_PROFILE",
    status: parsed.status,
    name: parsed.name,
    productType: parsed.productType,
    description: parsed.description ?? null,
    shopifyProductId: null,
    shopify: null,
    shopifyLink: null,
    productFamily: parsed.productFamily?.enabled
      ? productFamilyConfigSchema.parse({
          contractVersion: "product-family-v1",
          familyId: `manual:${id}`,
          garmentType: parsed.productType,
          supplierName: parsed.productFamily.supplierName ?? null,
          active: true,
          shopifyMappingMode: "NONE",
          colors: colorways.map((color, index) => ({
            colorId: `manual:${id}:color:${index + 1}`,
            colorName: color,
            colorKey: productColorKey(color),
            active: true,
            shopifyMappings: [],
          })),
          placementTemplates: [],
        })
      : null,
    variants: manualVariants(id, colorways, sizes),
    colorways,
    sizes,
    collections: dedupe(parsed.collections),
    active: null,
    available: null,
    construction: {
      ...parsed.construction,
      metadataSource: "PRODUCTION_METADATA_MANUAL",
    },
    references: [],
    printSurfaces: [],
    embroideryRegions: [],
    provenance: {
      source: "Owner-created Manual Product Profile",
      capturedAt: now,
      sourceVersion: null,
    },
    createdBy: scope.actorId,
    updatedBy: scope.actorId,
    createdAt: now,
    updatedAt: now,
  });
  return d.repository.createVersion(scope, profile);
}

export async function updateProductKnowledge(
  scope: WorkspaceScope,
  profileId: string,
  input: unknown,
  overrides: Partial<Dependencies> = {},
) {
  requireActor(scope);
  const parsed = updateProductKnowledgeSchema.parse(input);
  const d = dependencies(overrides);
  const current = await d.repository.getLatest(scope, profileId);
  if (!current)
    throw new PersonaDomainError("Product profile was not found.", "NOT_FOUND");
  assertExpectedVersion(current, parsed.expectedVersion);
  const manual = current.authority === "MANUAL_PROFILE";
  const colorways = parsed.colorways
    ? dedupe(parsed.colorways)
    : current.colorways;
  const sizes = parsed.sizes ? dedupe(parsed.sizes) : current.sizes;
  const next = nextVersion(current, scope.actorId, d.now(), {
    status: manual ? (parsed.status ?? current.status) : current.status,
    name: manual ? (parsed.name ?? current.name) : current.name,
    productType: manual
      ? (parsed.productType ?? current.productType)
      : current.productType,
    description:
      parsed.description === undefined
        ? current.description
        : parsed.description,
    colorways: manual ? colorways : current.colorways,
    sizes: manual ? sizes : current.sizes,
    collections:
      manual && parsed.collections
        ? dedupe(parsed.collections)
        : current.collections,
    variants:
      manual && (parsed.colorways || parsed.sizes)
        ? manualVariants(
            current.productProfileId.replace(/^manual:/, ""),
            colorways,
            sizes,
          )
        : current.variants,
    construction: {
      ...current.construction,
      ...(parsed.construction ?? {}),
      metadataSource: "PRODUCTION_METADATA_MANUAL",
    },
    provenance: {
      ...current.provenance,
      capturedAt: d.now(),
      source:
        current.authority === "SHOPIFY_LIVE"
          ? "Shopify canonical catalog + NexHQ owner production metadata"
          : "Owner-managed Manual Product Profile",
    },
  });
  return d.repository.createVersion(scope, next);
}

function shopifyStatus(status: string): ProductProfile["status"] {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") return "ACTIVE";
  if (normalized === "ARCHIVED") return "ARCHIVED";
  return "DRAFT";
}

function optionValue(
  options: Array<{ name: string; value: string }>,
  matcher: RegExp,
) {
  return options.find((option) => matcher.test(option.name))?.value ?? null;
}

function mergeShopifyReferences(
  existing: ProductVisualReference[],
  incoming: ProductVisualReference[],
) {
  const previous = new Map(
    existing.map((reference) => [
      reference.sourceImageId ?? reference.referenceId,
      reference,
    ]),
  );
  return incoming.map((reference) => {
    const old = previous.get(reference.sourceImageId ?? reference.referenceId);
    if (!old) return reference;
    const ownerRole = old.roleProvenance?.source === "OWNER_ASSIGNED";
    return {
      ...reference,
      role: ownerRole ? old.role : reference.role,
      roleProvenance: ownerRole ? old.roleProvenance : reference.roleProvenance,
      privateStoragePath:
        old.sourceUrl === reference.sourceUrl ? old.privateStoragePath : null,
      contentChecksumSha256:
        old.sourceUrl === reference.sourceUrl
          ? old.contentChecksumSha256
          : null,
      mimeType: old.sourceUrl === reference.sourceUrl ? old.mimeType : null,
      byteLength: old.sourceUrl === reference.sourceUrl ? old.byteLength : null,
      createdAt: old.createdAt ?? reference.createdAt,
    };
  });
}

export async function syncShopifyProductProfile(
  scope: WorkspaceScope,
  input: unknown,
  overrides: Partial<Dependencies> = {},
) {
  requireActor(scope);
  const parsed = syncShopifyProductProfileSchema.parse(input);
  const d = dependencies(overrides);
  const detail = await d.fetchShopifyDetail(parsed.productId);
  if (!detail || detail.id !== parsed.productId)
    throw new PersonaDomainError(
      "Shopify Product was not found in the live catalog.",
      "NOT_FOUND",
    );
  const current = await d.repository.getLatestByShopifyProductId(
    scope,
    detail.id,
  );
  if (parsed.expectedVersion != null && current)
    assertExpectedVersion(current, parsed.expectedVersion);
  const now = d.now();
  const remote = buildShopifyProductReferencePackage(detail, now);
  const selectedOptions = detail.variants.flatMap((variant) => variant.options);
  const values = (matcher: RegExp) =>
    dedupe(
      selectedOptions
        .filter((option) => matcher.test(option.name))
        .map((option) => option.value),
    );
  const construction = {
    ...(current?.construction ?? {}),
    ...(parsed.enrichment ?? {}),
    metadataSource:
      parsed.enrichment ||
      current?.construction.metadataSource === "PRODUCTION_METADATA_MANUAL"
        ? ("PRODUCTION_METADATA_MANUAL" as const)
        : ("UNKNOWN" as const),
  };
  const candidate = productProfileSchema.parse({
    schemaVersion: "product-profile-v1",
    productProfileId: current?.productProfileId ?? `shopify:${detail.id}`,
    workspaceId: scope.workspaceId,
    version: (current?.version ?? 0) + 1,
    authority: "SHOPIFY_LIVE",
    status: shopifyStatus(detail.status),
    name: detail.title,
    productType: detail.productType,
    description: detail.description || current?.description || null,
    shopifyProductId: detail.id,
    shopify: {
      productId: detail.id,
      handle: detail.handle || null,
      vendor: detail.vendor,
      productType: detail.productType || null,
      updatedAt: detail.updatedAt,
      syncedAt: now,
    },
    shopifyLink: null,
    productFamily: current?.productFamily ?? null,
    sourceContext: preserveOwnerConfirmedProductSource(
      current?.sourceContext,
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
      color: optionValue(variant.options, /^(color|colour|farbe|couleur)$/i),
      size: optionValue(variant.options, /^(size|größe|groesse|taille)$/i),
      sku: variant.sku,
      available: variant.available,
      active: detail.status.toUpperCase() === "ACTIVE",
      updatedAt: variant.updatedAt,
    })),
    colorways: values(/^(color|colour|farbe|couleur)$/i),
    sizes: values(/^(size|größe|groesse|taille)$/i),
    collections: detail.collections,
    active: detail.status.toUpperCase() === "ACTIVE",
    available: detail.variants.some((variant) => variant.available),
    construction,
    references: mergeShopifyReferences(
      current?.references ?? [],
      remote.references,
    ),
    printSurfaces: current?.printSurfaces ?? [],
    embroideryRegions: current?.embroideryRegions ?? [],
    provenance: {
      source: "Shopify Admin GraphQL canonical catalog + NexHQ enrichment",
      capturedAt: now,
      sourceVersion: detail.updatedAt,
    },
    createdBy: current?.createdBy ?? scope.actorId,
    updatedBy: scope.actorId,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  });
  if (current) {
    const comparableCurrent = {
      ...current,
      version: candidate.version,
      updatedAt: candidate.updatedAt,
      updatedBy: candidate.updatedBy,
      provenance: candidate.provenance,
      shopify: candidate.shopify,
    };
    if (JSON.stringify(comparableCurrent) === JSON.stringify(candidate))
      return current;
  }
  return d.repository.createVersion(scope, candidate);
}

export async function addManualProductReference(
  scope: WorkspaceScope,
  profileId: string,
  input: {
    expectedVersion: number;
    role: unknown;
    bytes: Buffer;
    mimeType: string;
    altText?: string | null;
    purpose?: "PRODUCT_REFERENCE" | "BLANK_PRODUCT";
    familyColorKey?: string | null;
    productSide?: "FRONT" | "BACK" | null;
  },
  overrides: Partial<Dependencies> = {},
) {
  requireActor(scope);
  const d = dependencies(overrides);
  const role = productReferenceRoleSchema.parse(input.role);
  const current = await d.repository.getLatest(scope, profileId);
  if (!current)
    throw new PersonaDomainError("Product profile was not found.", "NOT_FOUND");
  if (current.authority !== "MANUAL_PROFILE")
    throw new PersonaDomainError(
      "Manual uploads are allowed only for Manual Product Profiles.",
      "WORKFLOW",
    );
  assertExpectedVersion(current, input.expectedVersion);
  const purpose = input.purpose ?? "PRODUCT_REFERENCE";
  if (purpose === "BLANK_PRODUCT") {
    if (!current.productFamily)
      throw new PersonaDomainError(
        "Blank-Produktbilder gehören zu einer Produktfamilie.",
        "WORKFLOW",
      );
    if (
      !input.familyColorKey ||
      !current.productFamily.colors.some(
        (color) => color.colorKey === input.familyColorKey,
      )
    )
      throw new PersonaDomainError("Wähle eine gültige Produktfarbe.", "WORKFLOW");
    if (!input.productSide)
      throw new PersonaDomainError("Wähle Vorder- oder Rückseite.", "WORKFLOW");
  }
  const stored = await d.storeManualReference({
    workspaceId: scope.workspaceId,
    productProfileId: profileId,
    bytes: input.bytes,
    mimeType: input.mimeType,
  });
  const now = d.now();
  const reference = productVisualReferenceSchema.parse({
    referenceId: d.id(),
    source: "MANUAL_UPLOAD",
    purpose,
    familyColorKey: purpose === "BLANK_PRODUCT" ? input.familyColorKey : null,
    productSide: purpose === "BLANK_PRODUCT" ? input.productSide : null,
    providerEligible: true,
    role,
    sourceImageId: null,
    sourceUrl: null,
    privateStoragePath: stored.path,
    contentChecksumSha256: stored.checksum,
    mimeType: stored.mimeType,
    byteLength: stored.byteLength,
    width: stored.width,
    height: stored.height,
    altText: input.altText?.trim() || null,
    variantIds: [],
    roleProvenance: {
      source: "OWNER_ASSIGNED",
      assignedBy: scope.actorId,
      assignedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  });
  return d.repository.createVersion(
    scope,
    nextVersion(current, scope.actorId, now, {
      references: [
        ...current.references.filter(
          (existing) =>
            !(
              purpose === "BLANK_PRODUCT" &&
              existing.purpose === "BLANK_PRODUCT" &&
              existing.familyColorKey === input.familyColorKey &&
              existing.productSide === input.productSide
            ),
        ),
        reference,
      ],
      provenance: { ...current.provenance, capturedAt: now },
    }),
  );
}

export async function addProductFamilyColor(
  scope: WorkspaceScope,
  profileId: string,
  input: unknown,
  overrides: Partial<Dependencies> = {},
) {
  requireActor(scope);
  const parsed = addProductFamilyColorSchema.parse(input);
  const d = dependencies(overrides);
  const current = await d.repository.getLatest(scope, profileId);
  if (!current?.productFamily || current.authority !== "MANUAL_PROFILE")
    throw new PersonaDomainError("Produktfamilie wurde nicht gefunden.", "NOT_FOUND");
  assertExpectedVersion(current, parsed.expectedVersion);
  const colorKey = productColorKey(parsed.colorKey ?? parsed.colorName);
  if (current.productFamily.colors.some((color) => color.colorKey === colorKey))
    throw new PersonaDomainError("Diese Farbe ist bereits vorhanden.", "WORKFLOW");
  const now = d.now();
  const colors = [
    ...current.productFamily.colors,
    {
      colorId: d.id(),
      colorName: parsed.colorName,
      colorKey,
      active: true,
      shopifyMappings: [],
    },
  ];
  const colorways = colors.map((color) => color.colorName);
  return d.repository.createVersion(
    scope,
    nextVersion(current, scope.actorId, now, {
      colorways,
      variants: manualVariants(
        current.productProfileId.replace(/^manual:/, ""),
        colorways,
        current.sizes,
      ),
      productFamily: { ...current.productFamily, colors },
      provenance: { ...current.provenance, capturedAt: now },
    }),
  );
}

function familySurface(input: {
  profile: ProductProfile;
  side: "FRONT" | "BACK";
  normalizedRegion: z.infer<typeof normalizedPrintAreaSchema>;
  actorId: string;
  now: string;
}): PrintSurface {
  const printSurfaceId = `family:${input.profile.productProfileId}:${input.side.toLocaleLowerCase("en-US")}`;
  const previous = input.profile.printSurfaces.find(
    (surface) => surface.printSurfaceId === printSurfaceId,
  );
  return printSurfaceSchema.parse({
    contractVersion: "print-surface-v1",
    printSurfaceId,
    version: (previous?.version ?? 0) + 1,
    productProfileId: input.profile.productProfileId,
    variantId: null,
    region: input.side === "FRONT" ? "front_center" : "back_center",
    displayName: input.side === "FRONT" ? "Vorne" : "Hinten",
    surfaceKind: "PRINT",
    supportedPrintMethods: input.profile.construction.supportedPrintMethods,
    geometryStatus: "HUMAN_DEFINED",
    quad: printAreaQuad(input.normalizedRegion),
    boundingBox: input.normalizedRegion,
    orientationDegrees: 0,
    perspectiveAnchors: [],
    clippingMaskReference: null,
    safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
    artworkScale: 1,
    rotationDegrees: 0,
    warpMode: "NONE",
    provenance: {
      source: "OWNER_CALIBRATION",
      calibratedBy: input.actorId,
      calibratedAt: input.now,
    },
  });
}

export async function saveProductFamilyPlacementOverlay(
  scope: WorkspaceScope,
  profileId: string,
  input: {
    expectedVersion: number;
    side: unknown;
    bytes: Buffer;
    mimeType: string;
  },
  overrides: Partial<Dependencies> = {},
) {
  requireActor(scope);
  const side = productFamilySideSchema.parse(input.side);
  const d = dependencies(overrides);
  const current = await d.repository.getLatest(scope, profileId);
  if (!current?.productFamily || current.authority !== "MANUAL_PROFILE")
    throw new PersonaDomainError("Produktfamilie wurde nicht gefunden.", "NOT_FOUND");
  assertExpectedVersion(current, input.expectedVersion);
  let normalizedRegion: z.infer<typeof normalizedPrintAreaSchema>;
  let detection: "AUTO_DETECTED" | "MANUAL_REQUIRED";
  try {
    normalizedRegion = await detectMarketPrintGreenArea(input.bytes);
    detection = "AUTO_DETECTED";
  } catch {
    // Keep the private upload available for the visual fallback. This draft
    // cannot become production truth until the owner explicitly saves it.
    normalizedRegion = normalizedPrintAreaSchema.parse({
      x: 0.25,
      y: 0.2,
      width: 0.5,
      height: 0.55,
    });
    detection = "MANUAL_REQUIRED";
  }
  const stored = await d.storeManualReference({
    workspaceId: scope.workspaceId,
    productProfileId: profileId,
    bytes: input.bytes,
    mimeType: input.mimeType,
  });
  const now = d.now();
  const referenceId = d.id();
  const reference = productVisualReferenceSchema.parse({
    referenceId,
    source: "MANUAL_UPLOAD",
    purpose: "PRINT_AREA_CALIBRATION",
    familyColorKey: null,
    productSide: side,
    providerEligible: false,
    role: "OTHER",
    sourceImageId: null,
    sourceUrl: null,
    privateStoragePath: stored.path,
    contentChecksumSha256: stored.checksum,
    mimeType: stored.mimeType,
    byteLength: stored.byteLength,
    width: stored.width,
    height: stored.height,
    altText: `${current.name} · ${side === "FRONT" ? "Vorne" : "Hinten"} · grüne Druckfläche`,
    variantIds: [],
    roleProvenance: {
      source: "OWNER_ASSIGNED",
      assignedBy: scope.actorId,
      assignedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  });
  const previousTemplate = current.productFamily.placementTemplates.find(
    (template) => template.side === side,
  );
  const template = {
    templateId: `family:${current.productProfileId}:${side.toLocaleLowerCase("en-US")}`,
    side,
    version: (previousTemplate?.version ?? 0) + 1,
    normalizedRegion,
    calibrationAssetReferenceId: referenceId,
    detection,
    status: "DRAFT" as const,
    appliesTo: "ALL_COLORS" as const,
    updatedBy: scope.actorId,
    updatedAt: now,
  };
  const next = nextVersion(current, scope.actorId, now, {
    references: [
      ...current.references.filter(
        (item) =>
          !(
            item.purpose === "PRINT_AREA_CALIBRATION" &&
            item.productSide === side
          ),
      ),
      reference,
    ],
    printSurfaces: current.printSurfaces,
    productFamily: {
      ...current.productFamily,
      placementTemplates: [
        ...current.productFamily.placementTemplates.filter(
          (item) => item.side !== side,
        ),
        template,
      ],
    },
    provenance: { ...current.provenance, capturedAt: now },
  });
  return { profile: await d.repository.createVersion(scope, next), template };
}

export async function correctProductFamilyPlacement(
  scope: WorkspaceScope,
  profileId: string,
  input: unknown,
  overrides: Partial<Dependencies> = {},
) {
  requireActor(scope);
  const parsed = correctProductFamilyPlacementSchema.parse(input);
  const d = dependencies(overrides);
  const current = await d.repository.getLatest(scope, profileId);
  if (!current?.productFamily || current.authority !== "MANUAL_PROFILE")
    throw new PersonaDomainError("Produktfamilie wurde nicht gefunden.", "NOT_FOUND");
  assertExpectedVersion(current, parsed.expectedVersion);
  const previous = current.productFamily.placementTemplates.find(
    (template) => template.side === parsed.side,
  );
  if (!previous)
    throw new PersonaDomainError("Lade zuerst ein Bild mit grüner Druckfläche hoch.", "WORKFLOW");
  const now = d.now();
  const surface = familySurface({
    profile: current,
    side: parsed.side,
    normalizedRegion: parsed.normalizedRegion,
    actorId: scope.actorId,
    now,
  });
  const template = {
    ...previous,
    version: previous.version + 1,
    normalizedRegion: parsed.normalizedRegion,
    detection: "OWNER_CORRECTED" as const,
    status: "READY" as const,
    updatedBy: scope.actorId,
    updatedAt: now,
  };
  const next = nextVersion(current, scope.actorId, now, {
    printSurfaces: [
      ...current.printSurfaces.filter(
        (item) => item.printSurfaceId !== surface.printSurfaceId,
      ),
      surface,
    ],
    productFamily: {
      ...current.productFamily,
      placementTemplates: [
        ...current.productFamily.placementTemplates.filter(
          (item) => item.side !== parsed.side,
        ),
        template,
      ],
    },
    provenance: { ...current.provenance, capturedAt: now },
  });
  return { profile: await d.repository.createVersion(scope, next), template };
}

export async function assignProductReferenceRole(
  scope: WorkspaceScope,
  profileId: string,
  referenceId: string,
  input: unknown,
  overrides: Partial<Dependencies> = {},
) {
  requireActor(scope);
  const parsed = assignProductReferenceRoleSchema.parse(input);
  const d = dependencies(overrides);
  const current = await d.repository.getLatest(scope, profileId);
  if (!current)
    throw new PersonaDomainError("Product profile was not found.", "NOT_FOUND");
  assertExpectedVersion(current, parsed.expectedVersion);
  if (
    !current.references.some(
      (reference) => reference.referenceId === referenceId,
    )
  )
    throw new PersonaDomainError(
      "Product reference was not found.",
      "NOT_FOUND",
    );
  const now = d.now();
  return d.repository.createVersion(
    scope,
    nextVersion(current, scope.actorId, now, {
      references: current.references.map((reference) =>
        reference.referenceId === referenceId
          ? {
              ...reference,
              role: parsed.role,
              roleProvenance: {
                source: "OWNER_ASSIGNED",
                assignedBy: scope.actorId,
                assignedAt: now,
              },
              updatedAt: now,
            }
          : reference,
      ),
      provenance: { ...current.provenance, capturedAt: now },
    }),
  );
}

export async function saveProductPrintSurface(
  scope: WorkspaceScope,
  profileId: string,
  input: unknown,
  overrides: Partial<Dependencies> = {},
) {
  requireActor(scope);
  const parsed = saveProductSurfaceSchema.parse(input);
  const d = dependencies(overrides);
  const current = await d.repository.getLatest(scope, profileId);
  if (!current)
    throw new PersonaDomainError("Product profile was not found.", "NOT_FOUND");
  assertExpectedVersion(current, parsed.expectedVersion);
  if (
    parsed.variantId &&
    !current.variants.some((variant) => variant.variantId === parsed.variantId)
  )
    throw new PersonaDomainError(
      "PrintSurface variant is not part of this Product Profile.",
      "WORKFLOW",
    );
  const previous = current.printSurfaces.find(
    (surface) => surface.printSurfaceId === parsed.printSurfaceId,
  );
  if (previous?.reuse?.scope === "PRODUCT_FAMILY" && parsed.variantId) {
    throw new PersonaDomainError(
      "Eine Produktfamilien-Druckfläche darf nicht still auf eine einzelne Variante eingeschränkt werden.",
      "WORKFLOW",
    );
  }
  const now = d.now();
  const surface: PrintSurface = printSurfaceSchema.parse({
    contractVersion: "print-surface-v1",
    printSurfaceId: parsed.printSurfaceId,
    version: (previous?.version ?? 0) + 1,
    productProfileId: current.productProfileId,
    variantId: parsed.variantId,
    region: parsed.region,
    displayName: parsed.displayName,
    surfaceKind: parsed.surfaceKind,
    supportedPrintMethods: parsed.supportedPrintMethods,
    geometryStatus: "HUMAN_DEFINED",
    quad: parsed.quad,
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
    reuse: previous?.reuse
      ? {
          ...previous.reuse,
          sourceProductProfileVersion: current.version + 1,
        }
      : undefined,
  });
  return d.repository.createVersion(
    scope,
    nextVersion(current, scope.actorId, now, {
      printSurfaces: [
        ...current.printSurfaces.filter(
          (item) => item.printSurfaceId !== surface.printSurfaceId,
        ),
        surface,
      ],
      provenance: { ...current.provenance, capturedAt: now },
    }),
  );
}

export async function linkManualProductToShopify(
  scope: WorkspaceScope,
  profileId: string,
  input: unknown,
  overrides: Partial<Dependencies> = {},
) {
  requireActor(scope);
  const parsed = linkManualProductToShopifySchema.parse(input);
  const d = dependencies(overrides);
  const current = await d.repository.getLatest(scope, profileId);
  if (!current)
    throw new PersonaDomainError("Product profile was not found.", "NOT_FOUND");
  if (current.authority !== "MANUAL_PROFILE")
    throw new PersonaDomainError(
      "Only Manual Product Profiles can be explicitly linked.",
      "WORKFLOW",
    );
  assertExpectedVersion(current, parsed.expectedVersion);
  if (
    parsed.colorKey &&
    !current.productFamily?.colors.some(
      (color) => color.colorKey === parsed.colorKey,
    )
  )
    throw new PersonaDomainError(
      "Wähle eine gültige Produktfarbe für die Shopify-Zuordnung.",
      "WORKFLOW",
    );
  const shopify = await d.fetchShopifyDetail(parsed.shopifyProductId);
  if (!shopify || shopify.id !== parsed.shopifyProductId)
    throw new PersonaDomainError(
      "Shopify Product was not found in the live catalog.",
      "NOT_FOUND",
    );
  const now = d.now();
  return d.repository.createVersion(
    scope,
    nextVersion(current, scope.actorId, now, {
      shopifyLink: {
        shopifyProductId: shopify.id,
        linkedBy: scope.actorId,
        linkedAt: now,
        relationship: "EXPLICIT_OWNER_LINK",
      },
      productFamily:
        current.productFamily && parsed.colorKey
          ? {
              ...current.productFamily,
              shopifyMappingMode: "EXPLICIT",
              colors: current.productFamily.colors.map((color) =>
                color.colorKey === parsed.colorKey
                  ? {
                      ...color,
                      shopifyMappings: [
                        ...color.shopifyMappings.filter(
                          (mapping) =>
                            mapping.shopifyProductId !== shopify.id,
                        ),
                        {
                          shopifyProductId: shopify.id,
                          shopifyVariantIds: parsed.shopifyVariantIds,
                        },
                      ],
                    }
                  : color,
              ),
            }
          : current.productFamily,
      provenance: {
        ...current.provenance,
        capturedAt: now,
        source:
          "Owner-managed Manual Product Profile with explicit Shopify link",
      },
    }),
  );
}

export type ManualProductEligibility = {
  eligible: boolean;
  blockers: Array<{ code: string; message: string }>;
  selectedVariant: ProductProfile["variants"][number] | null;
  selectedSurface: PrintSurface | null;
};

export function assessManualProductEligibility(
  profile: ProductProfile,
  variantId: string | null,
  printSurfaceId: string | null,
): ManualProductEligibility {
  const blockers: ManualProductEligibility["blockers"] = [];
  if (profile.authority !== "MANUAL_PROFILE")
    blockers.push({
      code: "NOT_MANUAL",
      message: "Das Produkt ist kein manuelles Produktprofil.",
    });
  if (["ARCHIVED", "DRAFT"].includes(profile.status))
    blockers.push({
      code: "STATUS",
      message:
        "Das manuelle Produkt muss mindestens als Muster, geplant oder aktiv gekennzeichnet sein.",
    });
  if (!profile.productType.trim())
    blockers.push({ code: "PRODUCT_TYPE", message: "Der Produkttyp fehlt." });
  const selectedVariant =
    profile.variants.find((variant) => variant.variantId === variantId) ?? null;
  if (!selectedVariant)
    blockers.push({
      code: "VARIANT",
      message: "Wähle eine genaue manuelle Variante oder Farbausprägung.",
    });
  const primaryReferences = profile.references.filter(
    (reference) =>
      ["FEATURED", "FRONT"].includes(reference.role) &&
      reference.privateStoragePath &&
      reference.contentChecksumSha256,
  );
  if (!primaryReferences.length)
    blockers.push({
      code: "REFERENCE",
      message:
        "Mindestens ein privates Vorderseiten- oder Hauptbild ist erforderlich.",
    });
  const selectedSurface =
    profile.printSurfaces.find(
      (surface) => surface.printSurfaceId === printSurfaceId,
    ) ?? null;
  if (
    !selectedSurface ||
    selectedSurface.geometryStatus === "REQUIRES_CALIBRATION" ||
    !selectedSurface.quad
  )
    blockers.push({
      code: "PRINT_SURFACE",
      message:
        "Wähle eine ausdrücklich definierte und kalibrierte Druckfläche.",
    });
  if (selectedSurface?.variantId && selectedSurface.variantId !== variantId)
    blockers.push({
      code: "SURFACE_VARIANT",
      message: "Die Druckfläche gehört zu einer anderen Variante.",
    });
  return {
    eligible: blockers.length === 0,
    blockers,
    selectedVariant,
    selectedSurface,
  };
}

export async function toOwnerProductProfileView(
  scope: WorkspaceScope,
  profile: ProductProfile,
  overrides: Partial<Dependencies> = {},
) {
  const d = dependencies(overrides);
  const references = await Promise.all(
    profile.references.map(async (reference) => {
      const preview = reference.privateStoragePath
        ? await d
            .createPreview({
              workspaceId: scope.workspaceId,
              path: reference.privateStoragePath,
            })
            .catch(() => null)
        : null;
      return {
        ...reference,
        privateStoragePath: undefined,
        sourceUrl: null,
        previewUrl: preview?.accessUrl ?? reference.sourceUrl,
        previewExpiresAt: preview?.expiresAt ?? null,
      };
    }),
  );
  return { ...profile, references };
}

/**
 * Lean Image Studio read model. It contains the canonical family/color/
 * placement facts needed for selection, but deliberately avoids generating a
 * signed preview URL for every stored reference. That signing fan-out was on
 * the owner startup critical path even though the selector renders no asset
 * previews.
 */
export function toImageStudioProductFamilyProductionView(
  profile: ProductProfile,
) {
  return {
    ...profile,
    references: profile.references.map((reference) => ({
      ...reference,
      privateStoragePath: undefined,
      sourceUrl: null,
      previewUrl: null,
      previewExpiresAt: null,
    })),
  };
}
