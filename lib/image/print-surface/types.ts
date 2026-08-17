import { z } from "zod";

import { assertUsableNormalizedQuad } from "@/lib/image/print-surface/validate-quad";

export const PRINT_SURFACE_CONTRACT_VERSION = "print-surface-v1" as const;

export const printRegionSchema = z.enum([
  "front_center",
  "front_left_chest",
  "front_right_chest",
  "back_center",
  "left_sleeve",
  "right_sleeve",
  "left_leg",
  "right_leg",
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

export const normalizedBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
}).refine((box) => box.x + box.width <= 1 && box.y + box.height <= 1, {
  message: "Normalized bounding box must remain inside the base image.",
});

export const printSurfaceSchema = z.object({
  contractVersion: z.literal(PRINT_SURFACE_CONTRACT_VERSION),
  printSurfaceId: z.string().min(1),
  version: z.number().int().positive().default(1),
  productProfileId: z.string().min(1),
  variantId: z.string().min(1).nullable(),
  region: printRegionSchema,
  geometryStatus: z.enum(["CALIBRATED", "HUMAN_DEFINED", "REQUIRES_CALIBRATION"]),
  quad: normalizedQuadSchema.nullable(),
  boundingBox: normalizedBoxSchema.nullable(),
  orientationDegrees: z.number().min(-180).max(180).default(0),
  perspectiveAnchors: z.array(normalizedPointSchema).default([]),
  clippingMaskReference: z.string().min(1).nullable(),
  safeMargin: z.object({
    top: z.number().min(0).max(0.49),
    right: z.number().min(0).max(0.49),
    bottom: z.number().min(0).max(0.49),
    left: z.number().min(0).max(0.49),
  }).default({ top: 0, right: 0, bottom: 0, left: 0 }),
  artworkScale: z.number().positive().max(4).default(1),
  rotationDegrees: z.number().min(-180).max(180).default(0),
  warpMode: z.enum(["NONE", "AFFINE", "PERSPECTIVE"]).default("PERSPECTIVE"),
  provenance: z.object({
    source: z.enum(["PRODUCT_PROFILE", "OWNER_CALIBRATION", "SHOT_CALIBRATION", "UNKNOWN"]),
    calibratedBy: z.string().min(1).nullable(),
    calibratedAt: z.string().datetime().nullable(),
  }),
}).superRefine((surface, ctx) => {
  if (surface.geometryStatus === "REQUIRES_CALIBRATION" && surface.quad !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["quad"],
      message: "Uncalibrated surfaces must not contain fabricated geometry.",
    });
  }
  if (surface.geometryStatus !== "REQUIRES_CALIBRATION" && surface.quad === null) {
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
        message: error instanceof Error ? error.message : "PrintSurface quad is invalid.",
      });
    }
  }
});

export type NormalizedPoint = z.infer<typeof normalizedPointSchema>;
export type NormalizedQuad = z.infer<typeof normalizedQuadSchema>;
export type PrintSurface = z.infer<typeof printSurfaceSchema>;

export function assertPrintSurfaceReady(surface: PrintSurface): asserts surface is PrintSurface & {
  quad: NormalizedQuad;
} {
  if (surface.geometryStatus === "REQUIRES_CALIBRATION" || !surface.quad) {
    throw new Error("Print surface requires explicit human or shot calibration.");
  }
}
