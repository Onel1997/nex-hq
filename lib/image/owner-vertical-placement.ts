import { z } from "zod";

import { resolveStrictContainFit } from "@/lib/image/artwork-compositing/strict-contain-fit";
import { FRONT_TORSO_PRINT_ENVELOPE_VERSION } from "@/lib/image/deterministic-runtime/front-torso-print-envelope";
import {
  semanticPlacementPresetSchema,
  type SemanticPlacementPreset,
} from "@/lib/image/semantic-print-placement";
import {
  normalizedPrintAreaSchema,
  ownerArtworkPlacementSchema,
} from "@/lib/product-library/product-family";

export const OWNER_VERTICAL_PLACEMENT_VERSION =
  "nexhq-owner-vertical-placement-v1" as const;
export const OWNER_VERTICAL_PLACEMENT_ERROR =
  "Die gewählte Höhe konnte auf diesem Bild nicht sicher beibehalten werden." as const;

// This is the same bounded linear deviation already allowed by the frozen
// owner-footprint contract. It permits a small collar/hem safety correction,
// but never licenses hidden re-centring.
export const OWNER_VERTICAL_MAXIMUM_CLAMP_RATIO = 0.04;

const boxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict();

export const ownerVerticalPlacementSchema = z
  .object({
    contractVersion: z.literal(OWNER_VERTICAL_PLACEMENT_VERSION),
    placementPreset: semanticPlacementPresetSchema,
    side: z.literal("FRONT"),
    ownerScale: z.number().min(0.1).max(1),
    ownerOffsetX: z.number().min(-1).max(1),
    ownerOffsetY: z.number().min(-1).max(1),
    canonicalContainedArtworkRectangle: boxSchema,
    previewCenterY: z.number().min(0).max(1),
    printableAreaCenterY: z.number().min(0).max(1),
    torsoEnvelopeReference: z
      .object({
        contractVersion: z.literal(FRONT_TORSO_PRINT_ENVELOPE_VERSION),
        mapping: z.literal("PRODUCT_TEMPLATE_TO_GENERATED_FRONT_TORSO"),
      })
      .strict(),
    expectedFinalFootprint: z
      .object({
        width: z.number().positive().max(1),
        height: z.number().positive().max(1),
        centerY: z.number().min(0).max(1),
      })
      .strict(),
    containApplicationCount: z.literal(1),
    globalScaleApplicationCount: z.literal(1),
    globalTranslationApplicationCount: z.literal(1),
    maximumVerticalClampRatio: z.literal(
      OWNER_VERTICAL_MAXIMUM_CLAMP_RATIO,
    ),
    failureMode: z.literal("FAIL_CLOSED"),
  })
  .strict();

export type OwnerVerticalPlacement = z.infer<
  typeof ownerVerticalPlacementSchema
>;

export const ownerVerticalPlacementEvidenceSchema = z
  .object({
    contractVersion: z.literal(OWNER_VERTICAL_PLACEMENT_VERSION),
    placementPreset: semanticPlacementPresetSchema,
    ownerYRequested: z.number().min(-1).max(1),
    previewY: z.number().min(0).max(1),
    requestedRegisteredY: z.number().min(0).max(1),
    registeredY: z.number().min(0).max(1),
    finalY: z.number().min(0).max(1),
    yPreserved: z.boolean(),
    withinSafetyTolerance: z.boolean(),
    clampApplied: z.boolean(),
    clampDelta: z.number().min(-1).max(1),
    clampReason: z
      .enum([
        "COLLAR_CLEARANCE",
        "GARMENT_HEM",
        "TORSO_ENVELOPE",
        "SAM_MASK",
      ])
      .nullable(),
    footprintPreserved: z.boolean(),
    secondContainApplied: z.literal(false),
    secondGlobalScaleApplied: z.literal(false),
    secondGlobalTranslationApplied: z.literal(false),
  })
  .strict();

export type OwnerVerticalPlacementEvidence = z.infer<
  typeof ownerVerticalPlacementEvidenceSchema
>;

export function supportsOwnerVerticalPlacement(
  preset: SemanticPlacementPreset | null | undefined,
): preset is
  | "FRONT_LARGE"
  | "FRONT_CENTER_CHEST"
  | "FRONT_LEFT_CHEST" {
  return (
    preset === "FRONT_LARGE" ||
    preset === "FRONT_CENTER_CHEST" ||
    preset === "FRONT_LEFT_CHEST"
  );
}

export function createOwnerVerticalPlacement(input: {
  placementPreset: SemanticPlacementPreset;
  printableArea: z.infer<typeof normalizedPrintAreaSchema>;
  ownerPlacement: z.infer<typeof ownerArtworkPlacementSchema>;
  artworkWidth: number;
  artworkHeight: number;
  referenceWidth: number;
  referenceHeight: number;
  expectedTorsoFootprint?: {
    width: number;
    height: number;
    centerY: number;
  };
}): OwnerVerticalPlacement {
  if (!supportsOwnerVerticalPlacement(input.placementPreset)) {
    throw new Error(OWNER_VERTICAL_PLACEMENT_ERROR);
  }
  const printableArea = normalizedPrintAreaSchema.parse(input.printableArea);
  const placement = ownerArtworkPlacementSchema.parse(input.ownerPlacement);
  const fit = resolveStrictContainFit({
    sourceWidth: input.artworkWidth,
    sourceHeight: input.artworkHeight,
    target: {
      x: printableArea.x * input.referenceWidth,
      y: printableArea.y * input.referenceHeight,
      width: printableArea.width * input.referenceWidth,
      height: printableArea.height * input.referenceHeight,
    },
    ownerPlacement: placement,
  });
  const rectangle = {
    x: fit.rect.x / input.referenceWidth,
    y: fit.rect.y / input.referenceHeight,
    width: fit.rect.width / input.referenceWidth,
    height: fit.rect.height / input.referenceHeight,
  };
  const previewCenterY = rectangle.y + rectangle.height / 2;
  const printableAreaCenterY =
    (previewCenterY - printableArea.y) / printableArea.height;
  return ownerVerticalPlacementSchema.parse({
    contractVersion: OWNER_VERTICAL_PLACEMENT_VERSION,
    placementPreset: input.placementPreset,
    side: "FRONT",
    ownerScale: placement.uniformScale,
    ownerOffsetX: placement.offsetX,
    ownerOffsetY: placement.offsetY,
    canonicalContainedArtworkRectangle: rectangle,
    previewCenterY,
    printableAreaCenterY,
    torsoEnvelopeReference: {
      contractVersion: FRONT_TORSO_PRINT_ENVELOPE_VERSION,
      mapping: "PRODUCT_TEMPLATE_TO_GENERATED_FRONT_TORSO",
    },
    expectedFinalFootprint: input.expectedTorsoFootprint ?? {
      width: rectangle.width,
      height: rectangle.height,
      centerY: printableAreaCenterY,
    },
    containApplicationCount: 1,
    globalScaleApplicationCount: 1,
    globalTranslationApplicationCount: 1,
    maximumVerticalClampRatio: OWNER_VERTICAL_MAXIMUM_CLAMP_RATIO,
    failureMode: "FAIL_CLOSED",
  });
}
