import { loadImage } from "canvas";
import { z } from "zod";

import type { NormalizedBounds } from "@/lib/image/deterministic-runtime/garment-registration-v3";

export const PRINT_READY_STAGE_A_VERSION =
  "nexhq-print-ready-stage-a-v1" as const;

export const printReadyStageAContractSchema = z
  .object({
    contractVersion: z.literal(PRINT_READY_STAGE_A_VERSION),
    placementPreset: z.literal("FRONT_LARGE"),
    side: z.literal("FRONT"),
    productKind: z.literal("TSHIRT"),
    framing: z.literal("MEDIUM_OR_MEDIUM_FULL_FASHION"),
    completeCollarRequired: z.literal(true),
    continuousTorsoRequired: z.literal(true),
    lowerGarmentVisibilityRequired: z.literal(true),
    centralOcclusionAllowed: z.literal(false),
    severeRotationAllowed: z.literal(false),
    failureMode: z.literal("FAIL_CLOSED"),
  })
  .strict();
export type PrintReadyStageAContract = z.infer<
  typeof printReadyStageAContractSchema
>;

export const printReadyStageAAssessmentSchema = z
  .object({
    contractVersion: z.literal(PRINT_READY_STAGE_A_VERSION),
    status: z.enum(["PASS", "FAIL"]),
    phase: z.enum(["LOCAL_PREFLIGHT", "SAM_TORSO_POSTFLIGHT"]),
    reason: z.enum([
      "READY",
      "FACE_OR_FRAMING_UNREADABLE",
      "TIGHT_PORTRAIT_CROP",
      "LOWER_TORSO_NOT_VISIBLE",
      "COLLAR_VISIBILITY_UNCERTAIN",
      "TORSO_ENVELOPE_UNSAFE",
      "TORSO_TOO_CROPPED",
      "CENTRAL_OCCLUSION_UNSAFE",
    ]),
    imageWidth: z.number().int().positive(),
    imageHeight: z.number().int().positive(),
    visibleGarmentRatio: z.number().min(0).max(1).nullable(),
    torsoVisibility: z.number().min(0).max(1),
    collarVisibility: z.enum(["LIKELY", "CONFIRMED", "UNSAFE"]),
    occlusionStatus: z.enum(["CLEAR", "UNSAFE", "NOT_YET_ASSESSED"]),
    faceBounds: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type PrintReadyStageAAssessment = z.infer<
  typeof printReadyStageAAssessmentSchema
>;

export const DEFAULT_PRINT_READY_STAGE_A: PrintReadyStageAContract =
  Object.freeze({
    contractVersion: PRINT_READY_STAGE_A_VERSION,
    placementPreset: "FRONT_LARGE",
    side: "FRONT",
    productKind: "TSHIRT",
    framing: "MEDIUM_OR_MEDIUM_FULL_FASHION",
    completeCollarRequired: true,
    continuousTorsoRequired: true,
    lowerGarmentVisibilityRequired: true,
    centralOcclusionAllowed: false,
    severeRotationAllowed: false,
    failureMode: "FAIL_CLOSED",
  });

export function printReadyStageAPromptLines(): string[] {
  return [
    "PRINT-READY FRONT_LARGE CONTRACT (higher priority than scene novelty): use a medium or medium-full fashion framing, never a tight portrait or chest-only crop.",
    "Show the complete blank T-shirt front continuously from the clearly visible collar through the lower abdomen and as near to the hem as the composition allows.",
    "Keep a large continuous central front-torso print zone visible; arms, hands, hair, straps, accessories, jackets, props, and foreground objects must not cover it.",
    "Use a mostly front-facing shirt plane. Mild lean, mild turn, editorial posture, and subtle natural folds are allowed; severe twist, extreme perspective, bunching, or crossed arms are not.",
    "Priority order: exact approved Brand Model identity; exact garment truth; print-ready garment visibility; scene and lighting; creative novelty. Print usability wins any framing conflict.",
  ];
}

export async function assessLocalPrintReadyStageA(input: {
  bytes: Buffer;
  faceBounds: NormalizedBounds | null;
}): Promise<PrintReadyStageAAssessment> {
  const image = await loadImage(input.bytes);
  const face = input.faceBounds;
  const fail = (
    reason: PrintReadyStageAAssessment["reason"],
    torsoVisibility = 0,
    collarVisibility: PrintReadyStageAAssessment["collarVisibility"] = "UNSAFE",
  ) =>
    printReadyStageAAssessmentSchema.parse({
      contractVersion: PRINT_READY_STAGE_A_VERSION,
      status: "FAIL",
      phase: "LOCAL_PREFLIGHT",
      reason,
      imageWidth: image.width,
      imageHeight: image.height,
      visibleGarmentRatio: null,
      torsoVisibility,
      collarVisibility,
      occlusionStatus: "NOT_YET_ASSESSED",
      faceBounds: face,
    });
  if (!face) return fail("FACE_OR_FRAMING_UNREADABLE");
  const availableBelowFace = 1 - (face.y + face.height);
  const torsoVisibility = Math.max(0, Math.min(1, availableBelowFace / 0.62));
  if (face.height > 0.25 || face.y + face.height > 0.43) {
    return fail("TIGHT_PORTRAIT_CROP", torsoVisibility);
  }
  if (availableBelowFace < 0.52) {
    return fail("LOWER_TORSO_NOT_VISIBLE", torsoVisibility, "LIKELY");
  }
  return printReadyStageAAssessmentSchema.parse({
    contractVersion: PRINT_READY_STAGE_A_VERSION,
    status: "PASS",
    phase: "LOCAL_PREFLIGHT",
    reason: "READY",
    imageWidth: image.width,
    imageHeight: image.height,
    visibleGarmentRatio: null,
    torsoVisibility,
    collarVisibility: "LIKELY",
    occlusionStatus: "NOT_YET_ASSESSED",
    faceBounds: face,
  });
}

export function assessRegisteredPrintReadyStageA(input: {
  imageWidth: number;
  imageHeight: number;
  faceBounds: NormalizedBounds | null;
  garmentBounds: NormalizedBounds | null;
  torsoBounds: NormalizedBounds | null;
  torsoStatus: "READY" | "UNSAFE";
  torsoConfidence: number;
  maskCoverage: number;
}): PrintReadyStageAAssessment {
  const visibleGarmentRatio = input.garmentBounds
    ? input.garmentBounds.width * input.garmentBounds.height
    : 0;
  const torsoVisibility = input.torsoBounds
    ? Math.min(1, input.torsoBounds.height / 0.38)
    : 0;
  const ready =
    input.torsoStatus === "READY" &&
    Boolean(input.torsoBounds) &&
    input.torsoConfidence >= 0.58 &&
    input.maskCoverage >= 0.985 &&
    (input.torsoBounds?.height ?? 0) >= 0.26;
  return printReadyStageAAssessmentSchema.parse({
    contractVersion: PRINT_READY_STAGE_A_VERSION,
    status: ready ? "PASS" : "FAIL",
    phase: "SAM_TORSO_POSTFLIGHT",
    reason: ready
      ? "READY"
      : input.torsoStatus === "UNSAFE"
        ? "TORSO_ENVELOPE_UNSAFE"
        : input.maskCoverage < 0.985
          ? "CENTRAL_OCCLUSION_UNSAFE"
          : "TORSO_TOO_CROPPED",
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
    visibleGarmentRatio,
    torsoVisibility,
    collarVisibility: ready ? "CONFIRMED" : "UNSAFE",
    occlusionStatus: input.maskCoverage >= 0.985 ? "CLEAR" : "UNSAFE",
    faceBounds: input.faceBounds,
  });
}
