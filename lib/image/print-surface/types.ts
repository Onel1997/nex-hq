import { z } from "zod";

import { assertUsableNormalizedQuad } from "@/lib/image/print-surface/validate-quad";

export const PRINT_SURFACE_CONTRACT_VERSION = "print-surface-v1" as const;

/**
 * Optional additive ownership metadata for reusable Product geometry.
 *
 * Historical surfaces without this object remain profile-owned. A family
 * surface is reusable only after an owner explicitly confirmed the concrete
 * Shopify listings that represent the same physical blank. Supplier or title
 * similarity alone never authorizes inheritance.
 */
export const printSurfaceReuseSchema = z
  .object({
    scope: z.enum(["PRODUCT_PROFILE", "PRODUCT_FAMILY"]),
    physicalProductKey: z.string().min(1).max(200),
    physicalProductLabel: z.string().min(1).max(160),
    sourceProductProfileId: z.string().min(1),
    sourceProductProfileVersion: z.number().int().positive(),
    variantPolicy: z.enum(["ALL_COMPATIBLE_VARIANTS", "EXACT_VARIANT"]),
    compatibleShopifyProductIds: z.array(z.string().min(1)).max(200),
    equivalenceAuthority: z.enum([
      "OWNER_CONFIRMED",
      "SUPPLIER_CATALOG_VERIFIED",
    ]),
    confirmedBy: z.string().min(1),
    confirmedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((reuse, ctx) => {
    if (
      reuse.scope === "PRODUCT_FAMILY" &&
      reuse.compatibleShopifyProductIds.length < 2
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["compatibleShopifyProductIds"],
        message:
          "A reusable Product-family surface requires at least two explicitly confirmed Shopify listings.",
      });
    }
    if (
      reuse.scope === "PRODUCT_FAMILY" &&
      reuse.variantPolicy !== "ALL_COMPATIBLE_VARIANTS"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["variantPolicy"],
        message:
          "Product-family normalized geometry must explicitly cover compatible variants.",
      });
    }
  });

export const printRegionSchema = z.enum([
  "front_center",
  "front_left_chest",
  "front_right_chest",
  "front_left",
  "front_right",
  "back_center",
  "back_upper",
  "front_panel",
  "left_side",
  "right_side",
  "left_sleeve",
  "right_sleeve",
  "left_leg",
  "right_leg",
  "upper_left_leg",
  "upper_right_leg",
  "custom",
]);

export const normalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const normalizedQuadSchema = z.tuple([
  normalizedPointSchema,
  normalizedPointSchema,
  normalizedPointSchema,
  normalizedPointSchema,
]);

export const normalizedBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine((box) => box.x + box.width <= 1 && box.y + box.height <= 1, {
    message: "Normalized bounding box must remain inside the base image.",
  });

export const printSurfaceSchema = z
  .object({
    contractVersion: z.literal(PRINT_SURFACE_CONTRACT_VERSION),
    printSurfaceId: z.string().min(1),
    version: z.number().int().positive().default(1),
    productProfileId: z.string().min(1),
    variantId: z.string().min(1).nullable(),
    region: printRegionSchema,
    displayName: z.string().min(1).max(120).optional(),
    surfaceKind: z.enum(["PRINT", "EMBROIDERY", "BOTH"]).optional(),
    supportedPrintMethods: z
      .array(
        z.enum([
          "SCREEN_PRINT",
          "DTG",
          "EMBROIDERY",
          "DTF",
          "TRANSFER",
          "UNKNOWN",
          "CUSTOM",
        ]),
      )
      .optional(),
    geometryStatus: z.enum([
      "CALIBRATED",
      "HUMAN_DEFINED",
      "REQUIRES_CALIBRATION",
    ]),
    quad: normalizedQuadSchema.nullable(),
    boundingBox: normalizedBoxSchema.nullable(),
    orientationDegrees: z.number().min(-180).max(180).default(0),
    perspectiveAnchors: z.array(normalizedPointSchema).default([]),
    clippingMaskReference: z.string().min(1).nullable(),
    safeMargin: z
      .object({
        top: z.number().min(0).max(0.49),
        right: z.number().min(0).max(0.49),
        bottom: z.number().min(0).max(0.49),
        left: z.number().min(0).max(0.49),
      })
      .default({ top: 0, right: 0, bottom: 0, left: 0 }),
    artworkScale: z.number().positive().max(4).default(1),
    rotationDegrees: z.number().min(-180).max(180).default(0),
    warpMode: z.enum(["NONE", "AFFINE", "PERSPECTIVE"]).default("PERSPECTIVE"),
    provenance: z.object({
      source: z.enum([
        "PRODUCT_PROFILE",
        "OWNER_CALIBRATION",
        "SHOT_CALIBRATION",
        "NEXHQ_PRODUCT_TEMPLATE",
        "UNKNOWN",
      ]),
      calibratedBy: z.string().min(1).nullable(),
      calibratedAt: z.string().datetime().nullable(),
    }),
    reuse: printSurfaceReuseSchema.optional(),
  })
  .superRefine((surface, ctx) => {
    if (
      surface.geometryStatus === "REQUIRES_CALIBRATION" &&
      surface.quad !== null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["quad"],
        message: "Uncalibrated surfaces must not contain fabricated geometry.",
      });
    }
    if (
      surface.geometryStatus !== "REQUIRES_CALIBRATION" &&
      surface.quad === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["quad"],
        message: "Calibrated or human-defined surfaces require an exact quad.",
      });
    }
    if (surface.quad) {
      try {
        assertUsableNormalizedQuad(surface.quad);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          path: ["quad"],
          message:
            error instanceof Error
              ? error.message
              : "PrintSurface quad is invalid.",
        });
      }
    }
    if (surface.reuse) {
      if (surface.reuse.sourceProductProfileId !== surface.productProfileId) {
        ctx.addIssue({
          code: "custom",
          path: ["reuse", "sourceProductProfileId"],
          message:
            "PrintSurface reuse must identify its canonical owner profile.",
        });
      }
      if (
        surface.reuse.variantPolicy === "EXACT_VARIANT" &&
        surface.variantId === null
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["variantId"],
          message: "An exact-variant PrintSurface requires a variant identity.",
        });
      }
      if (
        surface.reuse.variantPolicy === "ALL_COMPATIBLE_VARIANTS" &&
        surface.variantId !== null
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["variantId"],
          message:
            "A normalized reusable Product-family surface must not be tied to one listing variant.",
        });
      }
    }
  });

export type NormalizedPoint = z.infer<typeof normalizedPointSchema>;
export type NormalizedQuad = z.infer<typeof normalizedQuadSchema>;
export type PrintSurface = z.infer<typeof printSurfaceSchema>;
export type PrintSurfaceReuse = z.infer<typeof printSurfaceReuseSchema>;

export function assertPrintSurfaceReady(
  surface: PrintSurface,
): asserts surface is PrintSurface & {
  quad: NormalizedQuad;
} {
  if (surface.geometryStatus === "REQUIRES_CALIBRATION" || !surface.quad) {
    throw new Error(
      "Print surface requires explicit human or shot calibration.",
    );
  }
}
