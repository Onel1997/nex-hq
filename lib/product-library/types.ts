import { z } from "zod";
import { printSurfaceSchema } from "@/lib/image/print-surface/types";

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
  "SIDE",
  "DETAIL",
  "UNCLASSIFIED",
]);

export const productVisualReferenceSchema = z.object({
  referenceId: z.string().min(1),
  source: z.enum(["SHOPIFY_MEDIA", "MANUAL_UPLOAD", "SEED"]),
  role: productReferenceRoleSchema,
  sourceImageId: z.string().min(1).nullable().default(null),
  sourceUrl: z.string().url().nullable().default(null),
  privateStoragePath: z.string().min(1).nullable().default(null),
  contentChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable().default(null),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  altText: z.string().nullable().default(null),
  variantIds: z.array(z.string().min(1)).default([]),
});

export const productVariantProfileSchema = z.object({
  variantId: z.string().min(1),
  shopifyVariantId: z.string().min(1).nullable().default(null),
  title: z.string().min(1),
  color: z.string().min(1).nullable().default(null),
  size: z.string().min(1).nullable().default(null),
  available: z.boolean().nullable().default(null),
  active: z.boolean().nullable().default(null),
  updatedAt: z.string().datetime().nullable().default(null),
});

export const productConstructionSchema = z.object({
  material: z.string().min(1).nullable().default(null),
  gsm: z.number().positive().nullable().default(null),
  fit: z.string().min(1).nullable().default(null),
  construction: z.string().min(1).nullable().default(null),
  collar: z.string().min(1).nullable().default(null),
  sleeves: z.string().min(1).nullable().default(null),
  zipper: z.string().min(1).nullable().default(null),
  pockets: z.array(z.string().min(1)).default([]),
  seams: z.array(z.string().min(1)).default([]),
});

export const productProfileSchema = z.object({
  schemaVersion: z.literal(PRODUCT_PROFILE_SCHEMA_VERSION),
  productProfileId: z.string().min(1),
  workspaceId: z.string().uuid(),
  name: z.string().min(1),
  productType: z.string().min(1),
  authority: productAuthoritySchema,
  shopifyProductId: z.string().min(1).nullable().default(null),
  variants: z.array(productVariantProfileSchema).default([]),
  colorways: z.array(z.string().min(1)).default([]),
  sizes: z.array(z.string().min(1)).default([]),
  collections: z.array(z.string().min(1)).default([]),
  active: z.boolean().nullable().default(null),
  available: z.boolean().nullable().default(null),
  construction: productConstructionSchema.default({
    material: null,
    gsm: null,
    fit: null,
    construction: null,
    collar: null,
    sleeves: null,
    zipper: null,
    pockets: [],
    seams: [],
  }),
  references: z.array(productVisualReferenceSchema).default([]),
  printSurfaces: z.array(printSurfaceSchema).default([]),
  embroideryRegions: z.array(z.string().min(1)).default([]),
  provenance: z.object({
    source: z.string().min(1),
    capturedAt: z.string().datetime(),
    sourceVersion: z.string().min(1).nullable().default(null),
  }),
  version: z.number().int().positive(),
  createdBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((profile, ctx) => {
  if (profile.authority === "SHOPIFY_LIVE" && !profile.shopifyProductId) {
    ctx.addIssue({
      code: "custom",
      path: ["shopifyProductId"],
      message: "SHOPIFY_LIVE profiles require an exact Shopify product ID.",
    });
  }
  if (profile.authority === "MANUAL_PROFILE" && profile.shopifyProductId) {
    ctx.addIssue({
      code: "custom",
      path: ["shopifyProductId"],
      message: "Manual profiles must not claim Shopify identity.",
    });
  }
});

export type ProductAuthority = z.infer<typeof productAuthoritySchema>;
export type ProductVisualReference = z.infer<typeof productVisualReferenceSchema>;
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
  provenance: z.object({
    source: z.string().min(1),
    capturedAt: z.string().datetime(),
    sourceVersion: z.string().min(1).nullable(),
  }),
}).superRefine((binding, ctx) => {
  if (binding.authority === "SHOPIFY_LIVE" && !binding.shopifyProductId) {
    ctx.addIssue({ code: "custom", path: ["shopifyProductId"], message: "SHOPIFY_LIVE binding requires an exact Shopify product ID." });
  }
  if (binding.authority === "MANUAL_PROFILE" && binding.shopifyProductId) {
    ctx.addIssue({ code: "custom", path: ["shopifyProductId"], message: "Manual Product binding must not claim Shopify identity." });
  }
});

export type ProductProductionBindingV2 = z.infer<typeof productProductionBindingV2Schema>;
