import { z } from "zod";

import { resolveStrictContainFit } from "@/lib/image/artwork-compositing/strict-contain-fit";
import { normalizedPrintAreaSchema, ownerArtworkPlacementSchema } from "@/lib/product-library/product-family";

export const OWNER_PRINT_FOOTPRINT_VERSION =
  "nexhq-owner-print-footprint-v1" as const;
export const OWNER_PRINT_FOOTPRINT_ERROR =
  "Der gewählte große Frontprint konnte auf diesem Bild nicht in der gewünschten Größe sicher erhalten werden." as const;

// Registration works on a 384 px analysis image and Surface-Conforming V1 is
// bounded to 2% local displacement. Four percent therefore covers raster-edge
// quantisation plus the bounded local envelope; it is not a licence to resize.
export const OWNER_PRINT_FOOTPRINT_MAX_LINEAR_DEVIATION = 0.04;

const boxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict();

export const ownerPrintFootprintSchema = z
  .object({
    contractVersion: z.literal(OWNER_PRINT_FOOTPRINT_VERSION),
    placementPreset: z.literal("FRONT_LARGE"),
    ownerPlacement: ownerArtworkPlacementSchema,
    marketPrintPrintableArea: normalizedPrintAreaSchema,
    templateReference: z
      .object({ width: z.number().int().positive(), height: z.number().int().positive() })
      .strict(),
    artwork: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        aspectRatio: z.number().positive(),
      })
      .strict(),
    templateGarmentBodyFrame: boxSchema,
    initialContainedArtworkRectangle: boxSchema,
    requestedTemplateGarmentWidthRatio: z.number().positive().max(1),
    requestedTemplateGarmentHeightRatio: z.number().positive().max(1),
    requestedCenterX: z.number().min(0).max(1),
    requestedCenterY: z.number().min(0).max(1),
    scaleAuthority: z.literal("OWNER_CONTAIN_FOOTPRINT"),
    mappingAxis: z.literal("GARMENT_BODY_WIDTH_UNIFORM"),
    containApplicationCount: z.literal(1),
    maximumLinearSafetyDeviation: z.literal(
      OWNER_PRINT_FOOTPRINT_MAX_LINEAR_DEVIATION,
    ),
    failureMode: z.literal("FAIL_CLOSED"),
  })
  .strict();

export type OwnerPrintFootprint = z.infer<typeof ownerPrintFootprintSchema>;

// Unlike the historical full-garment frame, this frame describes the printable
// shirt body and deliberately excludes sleeves. MarketPrint calibrates a torso
// print area, while V3 also registers a torso body; the coordinate spaces must
// therefore have the same semantics.
const TSHIRT_TEMPLATE_BODY_FRAME = {
  x: 0.2,
  y: 0.07,
  width: 0.6,
  height: 0.86,
} as const;

export function createOwnerPrintFootprint(input: {
  placementPreset: "FRONT_LARGE";
  printableArea: z.infer<typeof normalizedPrintAreaSchema>;
  ownerPlacement: z.infer<typeof ownerArtworkPlacementSchema>;
  artworkWidth: number;
  artworkHeight: number;
  referenceWidth: number;
  referenceHeight: number;
}): OwnerPrintFootprint {
  const printableArea = normalizedPrintAreaSchema.parse(input.printableArea);
  const ownerPlacement = ownerArtworkPlacementSchema.parse(input.ownerPlacement);
  const fit = resolveStrictContainFit({
    sourceWidth: input.artworkWidth,
    sourceHeight: input.artworkHeight,
    target: {
      x: printableArea.x * input.referenceWidth,
      y: printableArea.y * input.referenceHeight,
      width: printableArea.width * input.referenceWidth,
      height: printableArea.height * input.referenceHeight,
    },
    ownerPlacement,
  });
  const rectangle = {
    x: fit.rect.x / input.referenceWidth,
    y: fit.rect.y / input.referenceHeight,
    width: fit.rect.width / input.referenceWidth,
    height: fit.rect.height / input.referenceHeight,
  };
  const frame = TSHIRT_TEMPLATE_BODY_FRAME;
  const epsilon = 1e-6;
  if (
    rectangle.x < frame.x - epsilon ||
    rectangle.y < frame.y - epsilon ||
    rectangle.x + rectangle.width > frame.x + frame.width + epsilon ||
    rectangle.y + rectangle.height > frame.y + frame.height + epsilon
  ) {
    throw new Error(OWNER_PRINT_FOOTPRINT_ERROR);
  }
  const widthRatio = rectangle.width / frame.width;
  const heightRatio = rectangle.height / frame.height;
  const centerX =
    (rectangle.x + rectangle.width / 2 - frame.x) / frame.width;
  const centerY =
    (rectangle.y + rectangle.height / 2 - frame.y) / frame.height;
  if (Math.max(widthRatio, heightRatio) < 0.5) {
    throw new Error(OWNER_PRINT_FOOTPRINT_ERROR);
  }
  return ownerPrintFootprintSchema.parse({
    contractVersion: OWNER_PRINT_FOOTPRINT_VERSION,
    placementPreset: input.placementPreset,
    ownerPlacement,
    marketPrintPrintableArea: printableArea,
    templateReference: {
      width: input.referenceWidth,
      height: input.referenceHeight,
    },
    artwork: {
      width: input.artworkWidth,
      height: input.artworkHeight,
      aspectRatio: input.artworkWidth / input.artworkHeight,
    },
    templateGarmentBodyFrame: frame,
    initialContainedArtworkRectangle: rectangle,
    requestedTemplateGarmentWidthRatio: widthRatio,
    requestedTemplateGarmentHeightRatio: heightRatio,
    requestedCenterX: centerX,
    requestedCenterY: centerY,
    scaleAuthority: "OWNER_CONTAIN_FOOTPRINT",
    mappingAxis: "GARMENT_BODY_WIDTH_UNIFORM",
    containApplicationCount: 1,
    maximumLinearSafetyDeviation:
      OWNER_PRINT_FOOTPRINT_MAX_LINEAR_DEVIATION,
    failureMode: "FAIL_CLOSED",
  });
}
