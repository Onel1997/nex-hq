import { z } from "zod";
import { printSurfaceSchema } from "@/lib/image/print-surface/types";
import {
  productFabricWeightClassSchema,
  productPrintMethodSchema,
  productStatusSchema,
} from "@/lib/product-library/product-taxonomy";
import { productSourceContextSchema } from "@/lib/product-library/product-source-context";

export const productFamilyColorSchema = z
  .object({
    colorId: z.string().min(1),
    colorName: z.string().trim().min(1).max(80),
    colorKey: z.string().trim().min(1).max(80),
    active: z.boolean().default(true),
    shopifyMappings: z
      .array(
        z.object({
          shopifyProductId: z.string().min(1),
          shopifyVariantIds: z.array(z.string().min(1)).default([]),
        }),
      )
      .default([]),
  })
  .strict();

export const productFamilyPlacementTemplateSchema = z
  .object({
    templateId: z.string().min(1),
    side: z.enum(["FRONT", "BACK"]),
    version: z.number().int().positive(),
    normalizedRegion: z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().positive().max(1),
      height: z.number().positive().max(1),
    }).refine(
      (box) => box.x + box.width <= 1 && box.y + box.height <= 1,
      "Die Druckfläche muss vollständig im Kalibrierungsbild liegen.",
    ),
    calibrationAssetReferenceId: z.string().min(1),
    detection: z.enum(["AUTO_DETECTED", "MANUAL_REQUIRED", "OWNER_CORRECTED"]),
    status: z.enum(["DRAFT", "READY"]).default("READY"),
    appliesTo: z.literal("ALL_COLORS"),
    updatedBy: z.string().min(1),
    updatedAt: z.string().datetime(),
  })
  .strict();

/**
 * Additive ProductProfile-owned family knowledge. It is stored in the existing
 * versioned Product Profile JSON provenance, so it does not create a competing
 * Product authority or require a new table.
 */
export const productFamilyConfigSchema = z
  .object({
    contractVersion: z.literal("product-family-v1"),
    familyId: z.string().min(1),
    garmentType: z.string().trim().min(1).max(120),
    supplierName: z.string().trim().min(1).max(120).nullable(),
    active: z.boolean(),
    shopifyMappingMode: z.enum(["NONE", "EXPLICIT"]),
    colors: z.array(productFamilyColorSchema).default([]),
    placementTemplates: z
      .array(productFamilyPlacementTemplateSchema)
      .default([]),
  })
  .strict();

export const PRODUCT_PROFILE_SCHEMA_VERSION = "product-profile-v1" as const;

export const productAuthoritySchema = z.enum([
  "SHOPIFY_LIVE",
  "MANUAL_PROFILE",
  "SEED",
  "UNKNOWN",
]);

export const productReferenceRoleSchema = z.enum([
  "FEATURED",
  "FRONT",
  "BACK",
  "LEFT_SIDE",
  "RIGHT_SIDE",
  "SIDE",
  "DETAIL",
  "MATERIAL",
  "COLLAR",
  "SLEEVE",
  "ZIPPER",
  "POCKET",
  "WAISTBAND",
  "OTHER",
  "UNCLASSIFIED",
]);

export const productVisualReferenceSchema = z.object({
  referenceId: z.string().min(1),
  source: z.enum(["SHOPIFY_MEDIA", "MANUAL_UPLOAD", "SEED"]),
  purpose: z
    .enum(["PRODUCT_REFERENCE", "BLANK_PRODUCT", "PRINT_AREA_CALIBRATION"])
    .optional(),
  familyColorKey: z.string().min(1).nullable().optional(),
  productSide: z.enum(["FRONT", "BACK"]).nullable().optional(),
  providerEligible: z.boolean().optional(),
  role: productReferenceRoleSchema,
  sourceImageId: z.string().min(1).nullable().default(null),
  sourceUrl: z.string().url().nullable().default(null),
  privateStoragePath: z.string().min(1).nullable().default(null),
  contentChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable().default(null),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]).nullable().optional(),
  byteLength: z.number().int().positive().nullable().optional(),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  altText: z.string().nullable().default(null),
  variantIds: z.array(z.string().min(1)).default([]),
  roleProvenance: z.object({
    source: z.enum(["SHOPIFY_METADATA", "OWNER_ASSIGNED", "UPLOAD_DEFAULT", "UNKNOWN"]),
    assignedBy: z.string().min(1).nullable(),
    assignedAt: z.string().datetime().nullable(),
  }).nullable().optional(),
  createdAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime().nullable().optional(),
});

/** Exact private reference contract required by paid production execution. */
export const frozenProductVisualReferenceSchema =
  productVisualReferenceSchema.extend({
    privateStoragePath: z.string().min(1),
    contentChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    byteLength: z.number().int().positive(),
  });

export const productVariantProfileSchema = z.object({
  variantId: z.string().min(1),
  shopifyVariantId: z.string().min(1).nullable().default(null),
  title: z.string().min(1),
  color: z.string().min(1).nullable().default(null),
  size: z.string().min(1).nullable().default(null),
  sku: z.string().min(1).nullable().default(null),
  available: z.boolean().nullable().default(null),
  active: z.boolean().nullable().default(null),
  updatedAt: z.string().datetime().nullable().default(null),
});

export const productConstructionSchema = z.object({
  material: z.string().min(1).nullable().default(null),
  materials: z.array(z.object({
    name: z.string().min(1),
    percentage: z.number().min(0).max(100).nullable().default(null),
  })).default([]),
  primaryMaterial: z.string().min(1).nullable().default(null),
  gsm: z.number().positive().max(2000).nullable().default(null),
  fabricWeightClass: productFabricWeightClassSchema.default("UNKNOWN"),
  fit: z.string().min(1).nullable().default(null),
  silhouette: z.string().min(1).nullable().default(null),
  stretch: z.string().min(1).nullable().default(null),
  structure: z.string().min(1).nullable().default(null),
  construction: z.string().min(1).nullable().default(null),
  collar: z.string().min(1).nullable().default(null),
  neckline: z.string().min(1).nullable().default(null),
  sleeveType: z.string().min(1).nullable().default(null),
  sleeveLength: z.string().min(1).nullable().default(null),
  sleeves: z.string().min(1).nullable().default(null),
  zipper: z.string().min(1).nullable().default(null),
  hood: z.string().min(1).nullable().default(null),
  drawstrings: z.string().min(1).nullable().default(null),
  pockets: z.array(z.string().min(1)).default([]),
  waistband: z.string().min(1).nullable().default(null),
  cuffs: z.string().min(1).nullable().default(null),
  hem: z.string().min(1).nullable().default(null),
  seams: z.array(z.string().min(1)).default([]),
  lining: z.string().min(1).nullable().default(null),
  otherNotes: z.string().min(1).nullable().default(null),
  supportedPrintMethods: z.array(productPrintMethodSchema).default([]),
  metadataSource: z.enum(["PRODUCTION_METADATA_MANUAL", "SHOPIFY", "SEED", "UNKNOWN"]).default("UNKNOWN"),
});

export const productShopifyIdentitySchema = z.object({
  productId: z.string().min(1),
  handle: z.string().min(1).nullable().default(null),
  vendor: z.string().min(1).nullable().default(null),
  productType: z.string().min(1).nullable().default(null),
  updatedAt: z.string().datetime(),
  syncedAt: z.string().datetime(),
});

export const productShopifyLinkSchema = z.object({
  shopifyProductId: z.string().min(1),
  linkedBy: z.string().min(1),
  linkedAt: z.string().datetime(),
  relationship: z.literal("EXPLICIT_OWNER_LINK"),
}).nullable();

export const productProfileProvenanceSchema = z.object({
  source: z.string().min(1),
  capturedAt: z.string().datetime(),
  sourceVersion: z.string().min(1).nullable().default(null),
});

export const productProfileSchema = z.object({
  schemaVersion: z.literal(PRODUCT_PROFILE_SCHEMA_VERSION),
  productProfileId: z.string().min(1),
  workspaceId: z.string().uuid(),
  version: z.number().int().positive(),
  authority: productAuthoritySchema,
  status: productStatusSchema.default("DRAFT"),
  name: z.string().trim().min(1).max(160),
  productType: z.string().trim().min(1).max(120),
  description: z.string().max(5000).nullable().default(null),
  shopifyProductId: z.string().min(1).nullable().default(null),
  shopify: productShopifyIdentitySchema.nullable().default(null),
  shopifyLink: productShopifyLinkSchema.default(null),
  sourceContext: productSourceContextSchema.default(() => productSourceContextSchema.parse({})),
  productFamily: productFamilyConfigSchema.nullable().default(null),
  variants: z.array(productVariantProfileSchema).default([]),
  colorways: z.array(z.string().min(1)).default([]),
  sizes: z.array(z.string().min(1)).default([]),
  collections: z.array(z.string().min(1)).default([]),
  active: z.boolean().nullable().default(null),
  available: z.boolean().nullable().default(null),
  construction: productConstructionSchema.default(() => productConstructionSchema.parse({})),
  references: z.array(productVisualReferenceSchema).default([]),
  printSurfaces: z.array(printSurfaceSchema).default([]),
  embroideryRegions: z.array(z.string().min(1)).default([]),
  provenance: productProfileProvenanceSchema,
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1).nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((profile, ctx) => {
  if (profile.authority === "SHOPIFY_LIVE" && !profile.shopifyProductId) {
    ctx.addIssue({ code: "custom", path: ["shopifyProductId"], message: "SHOPIFY_LIVE profiles require an exact Shopify product ID." });
  }
  if (profile.authority === "SHOPIFY_LIVE" && profile.shopify && profile.shopify.productId !== profile.shopifyProductId) {
    ctx.addIssue({ code: "custom", path: ["shopify"], message: "Shopify identity must match the canonical Shopify Product ID." });
  }
  if (profile.authority === "MANUAL_PROFILE" && (profile.shopifyProductId || profile.shopify)) {
    ctx.addIssue({ code: "custom", path: ["shopifyProductId"], message: "Manual profiles must not claim Shopify authority." });
  }
});

export type ProductAuthority = z.infer<typeof productAuthoritySchema>;
export type ProductReferenceRole = z.infer<typeof productReferenceRoleSchema>;
export type FrozenProductVisualReference = z.infer<
  typeof frozenProductVisualReferenceSchema
>;
/** Accepts historical references whose additive family fields predate V1. */
export type ProductVisualReference = z.input<typeof productVisualReferenceSchema>;
export type ProductFamilyConfig = z.infer<typeof productFamilyConfigSchema>;
export type ProductFamilyColor = z.infer<typeof productFamilyColorSchema>;
export type ProductFamilyPlacementTemplate = z.infer<
  typeof productFamilyPlacementTemplateSchema
>;
export type ProductVariantProfile = z.infer<typeof productVariantProfileSchema>;
export type ProductProfile = z.infer<typeof productProfileSchema>;

/** Exact Product selection frozen into Image input v2. */
export const productProductionBindingV2Schema = z.object({
  version: z.literal("product-production-binding-v2"),
  productProfileId: z.string().min(1),
  profileVersion: z.number().int().positive(),
  authority: productAuthoritySchema,
  shopifyProductId: z.string().min(1).nullable(),
  variantId: z.string().min(1).nullable(),
  productName: z.string().min(1),
  productType: z.string().min(1),
  color: z.string().min(1).nullable(),
  size: z.string().min(1).nullable(),
  material: z.string().min(1).nullable(),
  fit: z.string().min(1).nullable(),
  collection: z.string().min(1).nullable(),
  availability: z.enum(["AVAILABLE", "UNAVAILABLE", "UNKNOWN"]),
  active: z.boolean().nullable(),
  sourceContext: productSourceContextSchema.default(() => productSourceContextSchema.parse({})),
  provenance: productProfileProvenanceSchema,
}).superRefine((binding, ctx) => {
  if (binding.authority === "SHOPIFY_LIVE" && !binding.shopifyProductId) {
    ctx.addIssue({ code: "custom", path: ["shopifyProductId"], message: "SHOPIFY_LIVE binding requires an exact Shopify product ID." });
  }
  if (binding.authority === "MANUAL_PROFILE" && binding.shopifyProductId) {
    ctx.addIssue({ code: "custom", path: ["shopifyProductId"], message: "Manual Product binding must not claim Shopify identity." });
  }
});

export type ProductProductionBindingV2 = z.infer<typeof productProductionBindingV2Schema>;
