import { z } from "zod";

import type { NormalizedQuad } from "@/lib/image/print-surface/types";
import type {
  FrontTorsoPrintEnvelope,
  GarmentRowSpan,
} from "@/lib/image/deterministic-runtime/front-torso-print-envelope";
import type { SemanticPlacementPreset } from "@/lib/image/semantic-print-placement";
import {
  combineNormalAndSilhouette,
} from "@/lib/image/normal-estimation/analysis";
import {
  normalOrientationEvidenceSchema,
  type NormalOrientationEvidence,
} from "@/lib/image/normal-estimation/types";

export const ORIENTED_FRONT_PRINT_PLANE_V2_LEGACY_VERSION =
  "nexhq-oriented-front-print-plane-v2" as const;
export const ORIENTED_FRONT_PRINT_PLANE_VERSION =
  "nexhq-oriented-front-print-plane-v2.1-torso-frame" as const;
export const ORIENTED_FRONT_PRINT_PLANE_NORMAL_ASSISTED_VERSION =
  "nexhq-oriented-front-print-plane-v2.2-normal-assisted" as const;
export const TORSO_BOUNDARY_TAPER_TO_PERSPECTIVE_WEIGHT = 0.3;

const boundsSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict();

const pointSchema = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
  .strict();

export const orientedFrontPrintPlanePolicySchema = z
  .object({
    contractVersion: z.enum([
      ORIENTED_FRONT_PRINT_PLANE_V2_LEGACY_VERSION,
      ORIENTED_FRONT_PRINT_PLANE_VERSION,
      ORIENTED_FRONT_PRINT_PLANE_NORMAL_ASSISTED_VERSION,
    ]),
    maximumRotationDegrees: z.number().positive().max(10),
    maximumPerspectiveRatio: z.number().positive().max(0.1),
    minimumSamContainment: z.number().min(0.98).max(1),
    backgroundEvidenceAllowed: z.literal(false),
    failureMode: z.literal("FAIL_CLOSED"),
  })
  .strict();

export type OrientedFrontPrintPlanePolicy = z.infer<
  typeof orientedFrontPrintPlanePolicySchema
>;

export const DEFAULT_ORIENTED_FRONT_PRINT_PLANE_POLICY =
  Object.freeze<OrientedFrontPrintPlanePolicy>({
    contractVersion: ORIENTED_FRONT_PRINT_PLANE_VERSION,
    maximumRotationDegrees: 8,
    maximumPerspectiveRatio: 0.06,
    minimumSamContainment: 0.985,
    backgroundEvidenceAllowed: false,
    failureMode: "FAIL_CLOSED",
  });
export const DEFAULT_NORMAL_ASSISTED_ORIENTED_FRONT_PRINT_PLANE_POLICY =
  Object.freeze<OrientedFrontPrintPlanePolicy>({
    ...DEFAULT_ORIENTED_FRONT_PRINT_PLANE_POLICY,
    contractVersion: ORIENTED_FRONT_PRINT_PLANE_NORMAL_ASSISTED_VERSION,
  });

export const orientedFrontPrintPlaneEvidenceSchema = z
  .object({
    contractVersion: z.enum([
      ORIENTED_FRONT_PRINT_PLANE_V2_LEGACY_VERSION,
      ORIENTED_FRONT_PRINT_PLANE_VERSION,
      ORIENTED_FRONT_PRINT_PLANE_NORMAL_ASSISTED_VERSION,
    ]),
    status: z.enum(["READY", "REFUSED"]),
    reason: z.enum([
      "READY",
      "ORIENTED_PLANE_EVIDENCE_INSUFFICIENT",
      "ORIENTED_PLANE_UNSAFE_ROTATION",
      "ORIENTED_PLANE_OUTSIDE_TORSO",
      "ORIENTED_PLANE_COLLAR_UNSAFE",
      "ORIENTED_PLANE_TYPOGRAPHY_UNSAFE",
      "ORIENTED_PLANE_CONTRADICTORY_DEPTH",
      "MIDAS_NORMAL_MISSING",
      "MIDAS_NORMAL_INVALID",
      "NORMAL_EVIDENCE_INSUFFICIENT",
      "NORMAL_SILHOUETTE_CONTRADICTORY",
      "NORMAL_FIELD_UNSTABLE",
      "NORMAL_ASSISTED_PLANE_UNSAFE",
      "DEPTH_NORMAL_CONTRADICTORY",
    ]),
    evidenceClass: z.enum([
      "ORIENTATION_STRONG",
      "ORIENTATION_MODERATE",
      "ORIENTATION_LOW_STABLE",
      "ORIENTATION_UNSAFE",
    ]),
    orientationConfidence: z.number().min(0).max(1),
    estimatedRotationDegrees: z.number().min(-20).max(20),
    appliedRotationDegrees: z.number().min(-10).max(10),
    topEdgeTiltDegrees: z.number().min(-15).max(15),
    bottomEdgeTiltDegrees: z.number().min(-15).max(15),
    leftSideTiltDegrees: z.number().min(-15).max(15),
    rightSideTiltDegrees: z.number().min(-15).max(15),
    perspectiveAmount: z.number().min(-0.15).max(0.15),
    rawBoundaryTaper: z.number().min(-1).max(1).optional(),
    sampleCount: z.number().int().nonnegative(),
    rejectedSampleCount: z.number().int().nonnegative(),
    torsoEdgeStability: z.number().min(0).max(1),
    centerlineStability: z.number().min(0).max(1),
    shoulderCollarAgreement: z.number().min(0).max(1),
    backgroundEvidenceExcluded: z.literal(true),
    realDepthSupportUsed: z.boolean(),
    requestedAxisAlignedBounds: boundsSchema,
    orientedQuad: z.tuple([pointSchema, pointSchema, pointSchema, pointSchema]).nullable(),
    allCornersInsideTorso: z.boolean().nullable(),
    samContainment: z.number().min(0).max(1).nullable(),
    collarClearanceApplied: z.boolean().nullable(),
    hemClearanceApplied: z.boolean().nullable(),
    registrationTypographyRisk: z.number().min(0).max(1),
    finalCombinedTypographyRisk: z.number().min(0).max(1).optional(),
    ownerScale: z.number().min(0.1).max(1),
    ownerOffsetX: z.number().min(-1).max(1),
    ownerOffsetY: z.number().min(-1).max(1),
    globalFootprintPreserved: z.literal(true),
    secondContainApplied: z.literal(false),
    secondGlobalScaleApplied: z.literal(false),
    secondGlobalTranslationApplied: z.literal(false),
    clampReasons: z.array(z.string()),
    failureReason: z.string().nullable(),
    torsoFrame: z
      .object({
        contractVersion: z.enum([
          ORIENTED_FRONT_PRINT_PLANE_VERSION,
          ORIENTED_FRONT_PRINT_PLANE_NORMAL_ASSISTED_VERSION,
        ]),
        origin: pointSchema,
        uAxis: z.object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1), angleDegrees: z.number().min(-15).max(15) }).strict(),
        vAxis: z.object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1), angleDegrees: z.number().min(-15).max(15) }).strict(),
        safeLocalWidth: z.number().positive().max(1.5),
        safeLocalHeight: z.number().positive().max(1.5),
        torsoSafePolygon: z.tuple([pointSchema, pointSchema, pointSchema, pointSchema]),
        confidence: z.number().min(0).max(1),
        sourceEvidence: z.enum(["SAM_TORSO_BOUNDARIES", "SAM_TORSO_PLUS_MIDAS_NORMAL"]),
        backgroundEvidenceExcluded: z.literal(true),
      })
      .strict()
      .optional(),
    normalAssistance: z
      .object({
        contractVersion: z.literal("nexhq-normal-assisted-oriented-torso-v1"),
        normalEvidence: normalOrientationEvidenceSchema,
        silhouetteOrientationDegrees: z.number().min(-20).max(20),
        silhouetteConfidence: z.number().min(0).max(1),
        normalOrientationDegrees: z.number().min(-20).max(20),
        normalConfidence: z.number().min(0).max(1),
        relationship: z.enum(["AGREES", "PARTIAL_AGREEMENT", "NORMAL_RESCUES_SILHOUETTE", "SILHOUETTE_RESCUES_NORMAL", "CONTRADICTORY", "INSUFFICIENT"]),
        silhouetteContributionWeight: z.number().min(0).max(1),
        normalContributionWeight: z.number().min(0).max(1),
        finalOrientationDegrees: z.number().min(-20).max(20),
        finalConfidence: z.number().min(0).max(1),
        agreementDeltaDegrees: z.number().min(0).max(40),
      })
      .strict()
      .optional(),
    depthNormalCrossCheck: z
      .object({
        depthPlaneSlopeX: z.number(),
        normalFacingX: z.number().min(-1).max(1),
        normalizedAgreementDelta: z.number().nonnegative(),
        agreementClass: z.enum([
          "DEPTH_AGREES",
          "DEPTH_MILD_DIFFERENCE",
          "DEPTH_CONTRADICTORY",
          "NOT_EVALUATED",
        ]),
        globalPlaneReoriented: z.literal(false),
      })
      .strict()
      .optional(),
    ownerLocalFootprint: z
      .object({
        requestedLocalWidth: z.number().positive().max(2),
        requestedLocalHeight: z.number().positive().max(2),
        localX: z.number().min(-1).max(2),
        localY: z.number().min(-1).max(2),
        ownerScale: z.number().min(0.1).max(1),
        ownerOffsetX: z.number().min(-1).max(1),
        ownerOffsetY: z.number().min(-1).max(1),
        projectedQuad: z.tuple([pointSchema, pointSchema, pointSchema, pointSchema]).nullable(),
      })
      .strict()
      .optional(),
    containment: z
      .object({
        torsoPolygon: z.object({ status: z.enum(["PASS", "FAIL", "NOT_EVALUATED"]), value: z.number().min(0).max(1).nullable() }).strict(),
        samMask: z.object({ status: z.enum(["PASS", "FAIL", "NOT_EVALUATED"]), value: z.number().min(0).max(1).nullable() }).strict(),
        collar: z.object({ status: z.enum(["PASS", "FAIL", "NOT_EVALUATED"]), clearance: z.number().nullable() }).strict(),
        hem: z.object({ status: z.enum(["PASS", "FAIL", "NOT_EVALUATED"]), clearance: z.number().nullable() }).strict(),
        left: z.object({ status: z.enum(["PASS", "FAIL", "NOT_EVALUATED"]), clearance: z.number().nullable() }).strict(),
        right: z.object({ status: z.enum(["PASS", "FAIL", "NOT_EVALUATED"]), clearance: z.number().nullable() }).strict(),
        overflow: z.object({ top: z.number().nonnegative(), right: z.number().nonnegative(), bottom: z.number().nonnegative(), left: z.number().nonnegative() }).strict().nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type OrientedFrontPrintPlaneEvidence = z.infer<
  typeof orientedFrontPrintPlaneEvidenceSchema
>;

export class OrientedFrontPrintPlaneUnsafeError extends Error {
  readonly code = "ORIENTED_PLANE_TYPOGRAPHY_UNSAFE" as const;

  constructor(readonly evidence: OrientedFrontPrintPlaneEvidence) {
    super(
      "Die Front-Druckfläche konnte nicht sicher an die sichtbare Shirt-Ausrichtung angepasst werden.",
    );
    this.name = "OrientedFrontPrintPlaneUnsafeError";
  }
}

export function orientedFrontPrintPlaneEvidenceFromError(error: unknown) {
  return error instanceof OrientedFrontPrintPlaneUnsafeError
    ? error.evidence
    : null;
}

type Bounds = OrientedFrontPrintPlaneEvidence["requestedAxisAlignedBounds"];

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)] ?? 0;
}

type Fit = { slope: number; intercept: number; residual: number; kept: number };

function robustLineFit(samples: Array<{ y: number; value: number }>): Fit | null {
  const solve = (values: typeof samples) => {
    const meanY = values.reduce((sum, sample) => sum + sample.y, 0) / values.length;
    const meanValue =
      values.reduce((sum, sample) => sum + sample.value, 0) / values.length;
    const denominator = values.reduce(
      (sum, sample) => sum + (sample.y - meanY) ** 2,
      0,
    );
    if (denominator <= 1e-10) return null;
    const slope =
      values.reduce(
        (sum, sample) =>
          sum + (sample.y - meanY) * (sample.value - meanValue),
        0,
      ) / denominator;
    return { slope, intercept: meanValue - slope * meanY };
  };
  if (samples.length < 8) return null;
  const initial = solve(samples);
  if (!initial) return null;
  const residuals = samples.map((sample) =>
    Math.abs(sample.value - (initial.slope * sample.y + initial.intercept)),
  );
  const residualMedian = median(residuals);
  const limit = Math.max(0.0025, residualMedian * 3.5);
  const kept = samples.filter((_sample, index) => residuals[index]! <= limit);
  if (kept.length < Math.max(8, Math.floor(samples.length * 0.68))) return null;
  const final = solve(kept);
  if (!final) return null;
  const finalResidual = median(
    kept.map((sample) =>
      Math.abs(sample.value - (final.slope * sample.y + final.intercept)),
    ),
  );
  return { ...final, residual: finalResidual, kept: kept.length };
}

function edgeTilt(first: { x: number; y: number }, second: { x: number; y: number }) {
  return (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI;
}

function sideTiltFromVertical(
  top: { x: number; y: number },
  bottom: { x: number; y: number },
) {
  return (Math.atan2(bottom.x - top.x, bottom.y - top.y) * 180) / Math.PI;
}

function pointInBounds(point: { x: number; y: number }, bounds: Bounds) {
  return (
    point.x >= bounds.x - 1e-8 &&
    point.x <= bounds.x + bounds.width + 1e-8 &&
    point.y >= bounds.y - 1e-8 &&
    point.y <= bounds.y + bounds.height + 1e-8
  );
}

function quadPoint(quad: NormalizedQuad, u: number, v: number) {
  const [tl, tr, br, bl] = quad;
  return {
    x:
      tl.x * (1 - u) * (1 - v) +
      tr.x * u * (1 - v) +
      br.x * u * v +
      bl.x * (1 - u) * v,
    y:
      tl.y * (1 - u) * (1 - v) +
      tr.y * u * (1 - v) +
      br.y * u * v +
      bl.y * (1 - u) * v,
  };
}

function refused(input: {
  reason: Exclude<OrientedFrontPrintPlaneEvidence["reason"], "READY">;
  policy: OrientedFrontPrintPlanePolicy;
  bounds: Bounds;
  ownerScale: number;
  ownerOffsetX: number;
  ownerOffsetY: number;
  evidenceClass?: OrientedFrontPrintPlaneEvidence["evidenceClass"];
  confidence?: number;
  estimatedRotation?: number;
  sampleCount?: number;
  rejectedSampleCount?: number;
  edgeStability?: number;
  centerStability?: number;
  shoulderAgreement?: number;
  samContainment?: number;
  typographyRisk?: number;
  quad?: NormalizedQuad | null;
  cornersInside?: boolean;
}): OrientedFrontPrintPlaneEvidence {
  const quad = input.quad ?? null;
  return orientedFrontPrintPlaneEvidenceSchema.parse({
    contractVersion: input.policy.contractVersion,
    status: "REFUSED",
    reason: input.reason,
    evidenceClass: input.evidenceClass ?? "ORIENTATION_UNSAFE",
    orientationConfidence: clamp(input.confidence ?? 0),
    estimatedRotationDegrees: input.estimatedRotation ?? 0,
    appliedRotationDegrees: 0,
    topEdgeTiltDegrees: quad ? edgeTilt(quad[0], quad[1]) : 0,
    bottomEdgeTiltDegrees: quad ? edgeTilt(quad[3], quad[2]) : 0,
    leftSideTiltDegrees: quad ? sideTiltFromVertical(quad[0], quad[3]) : 0,
    rightSideTiltDegrees: quad ? sideTiltFromVertical(quad[1], quad[2]) : 0,
    perspectiveAmount: 0,
    sampleCount: input.sampleCount ?? 0,
    rejectedSampleCount: input.rejectedSampleCount ?? 0,
    torsoEdgeStability: clamp(input.edgeStability ?? 0),
    centerlineStability: clamp(input.centerStability ?? 0),
    shoulderCollarAgreement: clamp(input.shoulderAgreement ?? 0),
    backgroundEvidenceExcluded: true,
    realDepthSupportUsed: false,
    requestedAxisAlignedBounds: input.bounds,
    orientedQuad: quad,
    allCornersInsideTorso: input.cornersInside ?? false,
    samContainment: clamp(input.samContainment ?? 0),
    collarClearanceApplied: false,
    hemClearanceApplied: false,
    registrationTypographyRisk: clamp(input.typographyRisk ?? 0),
    ownerScale: input.ownerScale,
    ownerOffsetX: input.ownerOffsetX,
    ownerOffsetY: input.ownerOffsetY,
    globalFootprintPreserved: true,
    secondContainApplied: false,
    secondGlobalScaleApplied: false,
    secondGlobalTranslationApplied: false,
    clampReasons: [],
    failureReason: input.reason,
  });
}

export function supportsOrientedFrontPrintPlane(
  productType: string,
  side: "FRONT" | "BACK",
  placementPreset: SemanticPlacementPreset | null | undefined,
) {
  return (
    /shirt|tee/i.test(productType) &&
    side === "FRONT" &&
    placementPreset != null &&
    ["FRONT_LARGE", "FRONT_CENTER_CHEST", "FRONT_LEFT_CHEST"].includes(
      placementPreset,
    )
  );
}

/**
 * Resolves a garment-only global receiving plane. It fits stable SAM torso
 * rows, never image/background lines. Owner size/X/Y are already represented
 * by `printBounds`; orientation changes shape around that exact center only.
 */
function resolveLegacyOrientedFrontPrintPlaneV2(input: {
  rows: GarmentRowSpan[];
  imageWidth: number;
  imageHeight: number;
  torsoEnvelope: FrontTorsoPrintEnvelope;
  printBounds: Bounds;
  ownerScale: number;
  ownerOffsetX: number;
  ownerOffsetY: number;
  policy: OrientedFrontPrintPlanePolicy;
  maskContains: (x: number, y: number) => boolean;
}): OrientedFrontPrintPlaneEvidence {
  const safe = input.torsoEnvelope.printableTorsoBounds;
  if (input.torsoEnvelope.status !== "READY" || !safe) {
    return refused({
      reason: "ORIENTED_PLANE_EVIDENCE_INSUFFICIENT",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
    });
  }
  const analysisTop = Math.max(
    safe.y,
    input.printBounds.y - input.printBounds.height * 0.18,
  );
  const analysisBottom = Math.min(
    safe.y + safe.height,
    input.printBounds.y + input.printBounds.height * 1.18,
  );
  const samples = input.rows
    .map((row) => ({
      y: row.row / input.imageHeight,
      left: row.left / input.imageWidth,
      right: row.right / input.imageWidth,
      center: (row.left + row.right + 1) / 2 / input.imageWidth,
      width: (row.right - row.left + 1) / input.imageWidth,
    }))
    .filter(
      (sample) =>
        sample.y >= analysisTop &&
        sample.y <= analysisBottom &&
        sample.width >= safe.width * 0.72 &&
        // Upper sleeve/shoulder rows can still overlap the print-height
        // neighborhood. They are garment pixels, but not torso-plane evidence.
        // Keep only spans close to the already sleeve-suppressed torso width.
        sample.width <= safe.width * 1.12 &&
        Math.abs(sample.center - (safe.x + safe.width / 2)) <=
          safe.width * 0.2,
    );
  const centerFit = robustLineFit(
    samples.map((sample) => ({ y: sample.y, value: sample.center })),
  );
  const leftFit = robustLineFit(
    samples.map((sample) => ({ y: sample.y, value: sample.left })),
  );
  const rightFit = robustLineFit(
    samples.map((sample) => ({ y: sample.y, value: sample.right })),
  );
  if (!centerFit || !leftFit || !rightFit) {
    return refused({
      reason: "ORIENTED_PLANE_EVIDENCE_INSUFFICIENT",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
      sampleCount: samples.length,
    });
  }

  const rejectedSampleCount = Math.max(
    0,
    samples.length - Math.min(centerFit.kept, leftFit.kept, rightFit.kept),
  );
  const centerlineStability = clamp(
    1 - centerFit.residual / Math.max(1e-6, safe.width * 0.025),
  );
  const torsoEdgeStability = clamp(
    1 -
      Math.max(leftFit.residual, rightFit.residual) /
        Math.max(1e-6, safe.width * 0.04),
  );
  const upperSamples = samples.filter(
    (sample) => sample.y <= analysisTop + (analysisBottom - analysisTop) * 0.3,
  );
  const shoulderCollarAgreement = upperSamples.length
    ? clamp(
        1 -
          median(
            upperSamples.map((sample) =>
              Math.abs(
                sample.center -
                  (centerFit.slope * sample.y + centerFit.intercept),
              ),
            ),
          ) /
            Math.max(1e-6, safe.width * 0.055),
      )
    : 0.5;
  const sampleCoverage = clamp(samples.length / Math.max(12, safe.height * input.imageHeight));
  const confidence = clamp(
    centerlineStability * 0.3 +
      torsoEdgeStability * 0.27 +
      input.torsoEnvelope.rowWidthStability * 0.18 +
      shoulderCollarAgreement * 0.12 +
      sampleCoverage * 0.13,
  );
  const evidenceClass: OrientedFrontPrintPlaneEvidence["evidenceClass"] =
    confidence >= 0.82
      ? "ORIENTATION_STRONG"
      : confidence >= 0.68
        ? "ORIENTATION_MODERATE"
        : confidence >= 0.55
          ? "ORIENTATION_LOW_STABLE"
          : "ORIENTATION_UNSAFE";
  if (evidenceClass === "ORIENTATION_UNSAFE") {
    return refused({
      reason: "ORIENTED_PLANE_EVIDENCE_INSUFFICIENT",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
      evidenceClass,
      confidence,
      sampleCount: samples.length,
      rejectedSampleCount,
      edgeStability: torsoEdgeStability,
      centerStability: centerlineStability,
      shoulderAgreement: shoulderCollarAgreement,
    });
  }

  // A vertical torso centerline x(y) has an image-plane rotation of
  // -atan(dx/dy) under screen coordinates (positive y points downward).
  const estimatedRotationDegrees =
    (-Math.atan(centerFit.slope) * 180) / Math.PI;
  const classRotationLimit =
    evidenceClass === "ORIENTATION_LOW_STABLE"
      ? 2
      : evidenceClass === "ORIENTATION_MODERATE"
        ? 5
        : input.policy.maximumRotationDegrees;
  if (Math.abs(estimatedRotationDegrees) > classRotationLimit + 1e-9) {
    return refused({
      reason: "ORIENTED_PLANE_UNSAFE_ROTATION",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
      evidenceClass,
      confidence,
      estimatedRotation: estimatedRotationDegrees,
      sampleCount: samples.length,
      rejectedSampleCount,
      edgeStability: torsoEdgeStability,
      centerStability: centerlineStability,
      shoulderAgreement: shoulderCollarAgreement,
    });
  }

  const topY = input.printBounds.y;
  const bottomY = input.printBounds.y + input.printBounds.height;
  const predictedWidth = (y: number) =>
    rightFit.slope * y + rightFit.intercept -
    (leftFit.slope * y + leftFit.intercept);
  const topWidth = predictedWidth(topY);
  const bottomWidth = predictedWidth(bottomY);
  const meanPredictedWidth = Math.max(1e-6, (topWidth + bottomWidth) / 2);
  const perspectiveAmount = clamp(
    (bottomWidth - topWidth) / meanPredictedWidth,
    -0.15,
    0.15,
  );
  const classPerspectiveLimit =
    evidenceClass === "ORIENTATION_LOW_STABLE"
      ? 0.02
      : evidenceClass === "ORIENTATION_MODERATE"
        ? 0.045
        : input.policy.maximumPerspectiveRatio;
  if (Math.abs(perspectiveAmount) > classPerspectiveLimit + 1e-9) {
    return refused({
      reason: "ORIENTED_PLANE_UNSAFE_ROTATION",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
      evidenceClass,
      confidence,
      estimatedRotation: estimatedRotationDegrees,
      sampleCount: samples.length,
      rejectedSampleCount,
      edgeStability: torsoEdgeStability,
      centerStability: centerlineStability,
      shoulderAgreement: shoulderCollarAgreement,
    });
  }

  const center = {
    x: input.printBounds.x + input.printBounds.width / 2,
    y: input.printBounds.y + input.printBounds.height / 2,
  };
  const radians = (estimatedRotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const topScale = 1 - perspectiveAmount / 2;
  const bottomScale = 1 + perspectiveAmount / 2;
  const rotate = (u: number, v: number) => ({
    x: center.x + u * cos - v * sin,
    y: center.y + u * sin + v * cos,
  });
  const halfHeight = input.printBounds.height / 2;
  const quad: NormalizedQuad = [
    rotate((-input.printBounds.width * topScale) / 2, -halfHeight),
    rotate((input.printBounds.width * topScale) / 2, -halfHeight),
    rotate((input.printBounds.width * bottomScale) / 2, halfHeight),
    rotate((-input.printBounds.width * bottomScale) / 2, halfHeight),
  ];
  const allCornersInsideTorso = quad.every((point) => pointInBounds(point, safe));
  let maskInside = 0;
  let maskTotal = 0;
  for (let row = 0; row < 16; row += 1) {
    for (let column = 0; column < 16; column += 1) {
      const point = quadPoint(quad, (column + 0.5) / 16, (row + 0.5) / 16);
      maskTotal += 1;
      if (input.maskContains(point.x, point.y)) maskInside += 1;
    }
  }
  const samContainment = maskTotal ? maskInside / maskTotal : 0;
  const collarClearanceApplied = Math.min(quad[0].y, quad[1].y) >= safe.y - 1e-8;
  const hemClearanceApplied =
    Math.max(quad[2].y, quad[3].y) <= safe.y + safe.height + 1e-8;
  if (!allCornersInsideTorso || samContainment < input.policy.minimumSamContainment) {
    return refused({
      reason: "ORIENTED_PLANE_OUTSIDE_TORSO",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
      evidenceClass,
      confidence,
      estimatedRotation: estimatedRotationDegrees,
      sampleCount: samples.length,
      rejectedSampleCount,
      edgeStability: torsoEdgeStability,
      centerStability: centerlineStability,
      shoulderAgreement: shoulderCollarAgreement,
      samContainment,
      quad,
      cornersInside: allCornersInsideTorso,
    });
  }
  if (!collarClearanceApplied) {
    return refused({
      reason: "ORIENTED_PLANE_COLLAR_UNSAFE",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
      evidenceClass,
      confidence,
      estimatedRotation: estimatedRotationDegrees,
      quad,
      cornersInside: true,
      samContainment,
    });
  }
  const registrationTypographyRisk = Math.abs(perspectiveAmount) / 2;
  if (registrationTypographyRisk > 0.075) {
    return refused({
      reason: "ORIENTED_PLANE_TYPOGRAPHY_UNSAFE",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
      evidenceClass,
      confidence,
      estimatedRotation: estimatedRotationDegrees,
      quad,
      cornersInside: true,
      samContainment,
      typographyRisk: registrationTypographyRisk,
    });
  }

  return orientedFrontPrintPlaneEvidenceSchema.parse({
    contractVersion: input.policy.contractVersion,
    status: "READY",
    reason: "READY",
    evidenceClass,
    orientationConfidence: confidence,
    estimatedRotationDegrees,
    appliedRotationDegrees: estimatedRotationDegrees,
    topEdgeTiltDegrees: edgeTilt(quad[0], quad[1]),
    bottomEdgeTiltDegrees: edgeTilt(quad[3], quad[2]),
    leftSideTiltDegrees: sideTiltFromVertical(quad[0], quad[3]),
    rightSideTiltDegrees: sideTiltFromVertical(quad[1], quad[2]),
    perspectiveAmount,
    sampleCount: samples.length,
    rejectedSampleCount,
    torsoEdgeStability,
    centerlineStability,
    shoulderCollarAgreement,
    backgroundEvidenceExcluded: true,
    realDepthSupportUsed: false,
    requestedAxisAlignedBounds: input.printBounds,
    orientedQuad: quad,
    allCornersInsideTorso,
    samContainment,
    collarClearanceApplied,
    hemClearanceApplied,
    registrationTypographyRisk,
    ownerScale: input.ownerScale,
    ownerOffsetX: input.ownerOffsetX,
    ownerOffsetY: input.ownerOffsetY,
    globalFootprintPreserved: true,
    secondContainApplied: false,
    secondGlobalScaleApplied: false,
    secondGlobalTranslationApplied: false,
    clampReasons: [],
    failureReason: null,
  });
}

type EvaluationStatus = "PASS" | "FAIL" | "NOT_EVALUATED";

function notEvaluatedContainment() {
  return {
    torsoPolygon: { status: "NOT_EVALUATED" as const, value: null },
    samMask: { status: "NOT_EVALUATED" as const, value: null },
    collar: { status: "NOT_EVALUATED" as const, clearance: null },
    hem: { status: "NOT_EVALUATED" as const, clearance: null },
    left: { status: "NOT_EVALUATED" as const, clearance: null },
    right: { status: "NOT_EVALUATED" as const, clearance: null },
    overflow: null,
  };
}

function newRefusal(input: {
  reason: Exclude<OrientedFrontPrintPlaneEvidence["reason"], "READY">;
  policy: OrientedFrontPrintPlanePolicy;
  bounds: Bounds;
  ownerScale: number;
  ownerOffsetX: number;
  ownerOffsetY: number;
  evidenceClass?: OrientedFrontPrintPlaneEvidence["evidenceClass"];
  confidence?: number;
  estimatedRotation?: number;
  sampleCount?: number;
  rejectedSampleCount?: number;
  edgeStability?: number;
  centerStability?: number;
  shoulderAgreement?: number;
  rawBoundaryTaper?: number;
  perspectiveAmount?: number;
  quad?: NormalizedQuad | null;
  torsoFrame?: NonNullable<OrientedFrontPrintPlaneEvidence["torsoFrame"]>;
  ownerLocalFootprint?: NonNullable<OrientedFrontPrintPlaneEvidence["ownerLocalFootprint"]>;
  containment?: NonNullable<OrientedFrontPrintPlaneEvidence["containment"]>;
  typographyRisk?: number;
  normalAssistance?: NonNullable<OrientedFrontPrintPlaneEvidence["normalAssistance"]>;
}): OrientedFrontPrintPlaneEvidence {
  const quad = input.quad ?? null;
  const containment = input.containment ?? notEvaluatedContainment();
  return orientedFrontPrintPlaneEvidenceSchema.parse({
    contractVersion: input.policy.contractVersion,
    status: "REFUSED",
    reason: input.reason,
    evidenceClass: input.evidenceClass ?? "ORIENTATION_UNSAFE",
    orientationConfidence: clamp(input.confidence ?? 0),
    estimatedRotationDegrees: input.estimatedRotation ?? 0,
    appliedRotationDegrees: 0,
    topEdgeTiltDegrees: quad ? edgeTilt(quad[0], quad[1]) : 0,
    bottomEdgeTiltDegrees: quad ? edgeTilt(quad[3], quad[2]) : 0,
    leftSideTiltDegrees: quad ? sideTiltFromVertical(quad[0], quad[3]) : 0,
    rightSideTiltDegrees: quad ? sideTiltFromVertical(quad[1], quad[2]) : 0,
    perspectiveAmount: input.perspectiveAmount ?? 0,
    ...(input.rawBoundaryTaper !== undefined
      ? { rawBoundaryTaper: input.rawBoundaryTaper }
      : {}),
    sampleCount: input.sampleCount ?? 0,
    rejectedSampleCount: input.rejectedSampleCount ?? 0,
    torsoEdgeStability: clamp(input.edgeStability ?? 0),
    centerlineStability: clamp(input.centerStability ?? 0),
    shoulderCollarAgreement: clamp(input.shoulderAgreement ?? 0),
    backgroundEvidenceExcluded: true,
    realDepthSupportUsed: false,
    requestedAxisAlignedBounds: input.bounds,
    orientedQuad: quad,
    allCornersInsideTorso:
      containment.torsoPolygon.status === "NOT_EVALUATED"
        ? null
        : containment.torsoPolygon.status === "PASS",
    samContainment: containment.samMask.value,
    collarClearanceApplied:
      containment.collar.status === "NOT_EVALUATED"
        ? null
        : containment.collar.status === "PASS",
    hemClearanceApplied:
      containment.hem.status === "NOT_EVALUATED"
        ? null
        : containment.hem.status === "PASS",
    registrationTypographyRisk: clamp(input.typographyRisk ?? 0),
    ownerScale: input.ownerScale,
    ownerOffsetX: input.ownerOffsetX,
    ownerOffsetY: input.ownerOffsetY,
    globalFootprintPreserved: true,
    secondContainApplied: false,
    secondGlobalScaleApplied: false,
    secondGlobalTranslationApplied: false,
    clampReasons: [],
    failureReason: input.reason,
    ...(input.torsoFrame ? { torsoFrame: input.torsoFrame } : {}),
    ...(input.ownerLocalFootprint
      ? { ownerLocalFootprint: input.ownerLocalFootprint }
      : {}),
    ...(input.normalAssistance ? { normalAssistance: input.normalAssistance } : {}),
    containment,
  });
}

function pointInConvexQuad(point: { x: number; y: number }, quad: NormalizedQuad) {
  let sign = 0;
  for (let index = 0; index < 4; index += 1) {
    const first = quad[index]!;
    const second = quad[(index + 1) % 4]!;
    const cross =
      (second.x - first.x) * (point.y - first.y) -
      (second.y - first.y) * (point.x - first.x);
    if (Math.abs(cross) <= 1e-10) continue;
    const current = Math.sign(cross);
    if (sign !== 0 && current !== sign) return false;
    sign = current;
  }
  return true;
}

function measured(status: EvaluationStatus, value: number | null) {
  return { status, value };
}

/**
 * V2.1 defines the owner's footprint in a garment-local UV frame and only
 * then projects it into image coordinates. This avoids rotating a large
 * image-space AABB and falsely rejecting its corners against the old AABB.
 */
function resolveOrientedTorsoFrameV21(input: {
  rows: GarmentRowSpan[];
  imageWidth: number;
  imageHeight: number;
  torsoEnvelope: FrontTorsoPrintEnvelope;
  printBounds: Bounds;
  ownerScale: number;
  ownerOffsetX: number;
  ownerOffsetY: number;
  policy: OrientedFrontPrintPlanePolicy;
  maskContains: (x: number, y: number) => boolean;
  normalOrientation?: NormalOrientationEvidence | null;
}): OrientedFrontPrintPlaneEvidence {
  const safe = input.torsoEnvelope.printableTorsoBounds;
  if (input.torsoEnvelope.status !== "READY" || !safe) {
    return newRefusal({
      reason: "ORIENTED_PLANE_EVIDENCE_INSUFFICIENT",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
    });
  }

  // Preserve the V2 garment-only orientation evidence window around the
  // owner's receiving footprint. V2.1 changes the coordinate system, not the
  // already-proven estimate of the visible local shirt direction.
  const analysisTop = Math.max(
    safe.y,
    input.printBounds.y - input.printBounds.height * 0.18,
  );
  const analysisBottom = Math.min(
    safe.y + safe.height,
    input.printBounds.y + input.printBounds.height * 1.18,
  );
  const samples = input.rows
    .map((row) => ({
      y: row.row / input.imageHeight,
      left: row.left / input.imageWidth,
      right: row.right / input.imageWidth,
      center: (row.left + row.right + 1) / 2 / input.imageWidth,
      width: (row.right - row.left + 1) / input.imageWidth,
    }))
    .filter(
      (sample) =>
        sample.y >= analysisTop &&
        sample.y <= analysisBottom &&
        sample.width >= safe.width * 0.72 &&
        sample.width <= safe.width * 1.12 &&
        Math.abs(sample.center - (safe.x + safe.width / 2)) <=
          safe.width * 0.2,
    );
  const centerFit = robustLineFit(
    samples.map((sample) => ({ y: sample.y, value: sample.center })),
  );
  const leftFit = robustLineFit(
    samples.map((sample) => ({ y: sample.y, value: sample.left })),
  );
  const rightFit = robustLineFit(
    samples.map((sample) => ({ y: sample.y, value: sample.right })),
  );
  if (!centerFit || !leftFit || !rightFit) {
    return newRefusal({
      reason: "ORIENTED_PLANE_EVIDENCE_INSUFFICIENT",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
      sampleCount: samples.length,
    });
  }

  const rejectedSampleCount = Math.max(
    0,
    samples.length - Math.min(centerFit.kept, leftFit.kept, rightFit.kept),
  );
  const centerlineStability = clamp(
    1 - centerFit.residual / Math.max(1e-6, safe.width * 0.025),
  );
  const torsoEdgeStability = clamp(
    1 -
      Math.max(leftFit.residual, rightFit.residual) /
        Math.max(1e-6, safe.width * 0.04),
  );
  const upperSamples = samples.filter(
    (sample) => sample.y <= analysisTop + safe.height * 0.3,
  );
  const shoulderCollarAgreement = upperSamples.length
    ? clamp(
        1 -
          median(
            upperSamples.map((sample) =>
              Math.abs(
                sample.center -
                  (centerFit.slope * sample.y + centerFit.intercept),
              ),
            ),
          ) /
            Math.max(1e-6, safe.width * 0.055),
      )
    : 0.5;
  const sampleCoverage = clamp(
    samples.length / Math.max(12, safe.height * input.imageHeight),
  );
  const silhouetteConfidence = clamp(
    centerlineStability * 0.3 +
      torsoEdgeStability * 0.27 +
      input.torsoEnvelope.rowWidthStability * 0.18 +
      shoulderCollarAgreement * 0.12 +
      sampleCoverage * 0.13,
  );
  const silhouetteRotationDegrees =
    (-Math.atan(centerFit.slope) * 180) / Math.PI;
  const combined =
    input.policy.contractVersion === ORIENTED_FRONT_PRINT_PLANE_NORMAL_ASSISTED_VERSION &&
    input.normalOrientation
      ? combineNormalAndSilhouette({
          silhouetteDegrees: silhouetteRotationDegrees,
          silhouetteConfidence,
          normal: input.normalOrientation,
        })
      : null;
  const normalAssistance = combined && input.normalOrientation
    ? {
        contractVersion: "nexhq-normal-assisted-oriented-torso-v1" as const,
        normalEvidence: input.normalOrientation,
        silhouetteOrientationDegrees: silhouetteRotationDegrees,
        silhouetteConfidence,
        normalOrientationDegrees: input.normalOrientation.orientationDegrees,
        normalConfidence:
          input.normalOrientation.status === "READY"
            ? input.normalOrientation.confidence
            : 0,
        relationship: combined.relationship,
        silhouetteContributionWeight: combined.silhouetteWeight,
        normalContributionWeight: combined.normalWeight,
        finalOrientationDegrees: combined.finalDegrees,
        finalConfidence: combined.finalConfidence,
        agreementDeltaDegrees: combined.deltaDegrees,
      }
    : undefined;
  if (
    input.policy.contractVersion === ORIENTED_FRONT_PRINT_PLANE_NORMAL_ASSISTED_VERSION &&
    (!combined || combined.relationship === "INSUFFICIENT")
  ) {
    return newRefusal({
      reason: input.normalOrientation?.reason === "NORMAL_FIELD_UNSTABLE"
        ? "NORMAL_FIELD_UNSTABLE"
        : "NORMAL_EVIDENCE_INSUFFICIENT",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
      confidence: silhouetteConfidence,
      estimatedRotation: silhouetteRotationDegrees,
      sampleCount: samples.length,
      rejectedSampleCount,
      edgeStability: torsoEdgeStability,
      centerStability: centerlineStability,
      shoulderAgreement: shoulderCollarAgreement,
      ...(normalAssistance ? { normalAssistance } : {}),
    });
  }
  if (combined?.relationship === "CONTRADICTORY") {
    return newRefusal({
      reason: "NORMAL_SILHOUETTE_CONTRADICTORY",
      policy: input.policy,
      bounds: input.printBounds,
      ownerScale: input.ownerScale,
      ownerOffsetX: input.ownerOffsetX,
      ownerOffsetY: input.ownerOffsetY,
      confidence: combined.finalConfidence,
      estimatedRotation: combined.finalDegrees,
      sampleCount: samples.length,
      rejectedSampleCount,
      edgeStability: torsoEdgeStability,
      centerStability: centerlineStability,
      shoulderAgreement: shoulderCollarAgreement,
      normalAssistance: normalAssistance!,
    });
  }
  const confidence = combined?.finalConfidence ?? silhouetteConfidence;
  const estimatedRotationDegrees = combined?.finalDegrees ?? silhouetteRotationDegrees;
  const evidenceClass: OrientedFrontPrintPlaneEvidence["evidenceClass"] =
    confidence >= 0.82
      ? "ORIENTATION_STRONG"
      : confidence >= 0.68
        ? "ORIENTATION_MODERATE"
        : confidence >= 0.55
          ? "ORIENTATION_LOW_STABLE"
          : "ORIENTATION_UNSAFE";
  const shared = {
    policy: input.policy,
    bounds: input.printBounds,
    ownerScale: input.ownerScale,
    ownerOffsetX: input.ownerOffsetX,
    ownerOffsetY: input.ownerOffsetY,
    evidenceClass,
    confidence,
    estimatedRotation: estimatedRotationDegrees,
    sampleCount: samples.length,
    rejectedSampleCount,
    edgeStability: torsoEdgeStability,
    centerStability: centerlineStability,
    shoulderAgreement: shoulderCollarAgreement,
    ...(normalAssistance ? { normalAssistance } : {}),
  };
  if (evidenceClass === "ORIENTATION_UNSAFE") {
    return newRefusal({
      ...shared,
      reason: "ORIENTED_PLANE_EVIDENCE_INSUFFICIENT",
    });
  }
  const classRotationLimit =
    evidenceClass === "ORIENTATION_LOW_STABLE"
      ? 2
      : evidenceClass === "ORIENTATION_MODERATE"
        ? 5
        : input.policy.maximumRotationDegrees;
  if (Math.abs(estimatedRotationDegrees) > classRotationLimit + 1e-9) {
    return newRefusal({ ...shared, reason: "ORIENTED_PLANE_UNSAFE_ROTATION" });
  }

  const predictedWidth = (y: number) =>
    rightFit.slope * y + rightFit.intercept -
    (leftFit.slope * y + leftFit.intercept);
  const topWidth = predictedWidth(input.printBounds.y);
  const bottomWidth = predictedWidth(
    input.printBounds.y + input.printBounds.height,
  );
  const meanWidth = Math.max(1e-6, (topWidth + bottomWidth) / 2);
  const rawBoundaryTaper = (bottomWidth - topWidth) / meanWidth;
  // Boundary taper includes garment cut and drape; it is not itself camera
  // perspective. Only a bounded supporting fraction enters the global quad.
  const classPerspectiveLimit =
    evidenceClass === "ORIENTATION_LOW_STABLE"
      ? 0.02
      : evidenceClass === "ORIENTATION_MODERATE"
        ? 0.045
        : input.policy.maximumPerspectiveRatio;
  if (!Number.isFinite(rawBoundaryTaper) || Math.abs(rawBoundaryTaper) > 0.4) {
    return newRefusal({
      ...shared,
      reason: "ORIENTED_PLANE_UNSAFE_ROTATION",
      rawBoundaryTaper: clamp(rawBoundaryTaper, -1, 1),
    });
  }
  const perspectiveAmount = clamp(
    rawBoundaryTaper * TORSO_BOUNDARY_TAPER_TO_PERSPECTIVE_WEIGHT,
    -classPerspectiveLimit,
    classPerspectiveLimit,
  );

  const radians = (estimatedRotationDegrees * Math.PI) / 180;
  const uAxis = { x: Math.cos(radians), y: Math.sin(radians) };
  const vAxis = { x: -Math.sin(radians), y: Math.cos(radians) };
  const originY = safe.y + safe.height / 2;
  const originX = clamp(centerFit.slope * originY + centerFit.intercept);
  const origin = { x: originX, y: originY };
  const halfHeight = safe.height / 2;
  const topCenter = {
    x: origin.x - vAxis.x * halfHeight,
    y: origin.y - vAxis.y * halfHeight,
  };
  const bottomCenter = {
    x: origin.x + vAxis.x * halfHeight,
    y: origin.y + vAxis.y * halfHeight,
  };
  const topHalfWidth = (safe.width * (1 - perspectiveAmount / 2)) / 2;
  const bottomHalfWidth = (safe.width * (1 + perspectiveAmount / 2)) / 2;
  const torsoSafePolygon: NormalizedQuad = [
    {
      x: topCenter.x - uAxis.x * topHalfWidth,
      y: topCenter.y - uAxis.y * topHalfWidth,
    },
    {
      x: topCenter.x + uAxis.x * topHalfWidth,
      y: topCenter.y + uAxis.y * topHalfWidth,
    },
    {
      x: bottomCenter.x + uAxis.x * bottomHalfWidth,
      y: bottomCenter.y + uAxis.y * bottomHalfWidth,
    },
    {
      x: bottomCenter.x - uAxis.x * bottomHalfWidth,
      y: bottomCenter.y - uAxis.y * bottomHalfWidth,
    },
  ];
  if (
    torsoSafePolygon.some(
      (point) => point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1,
    )
  ) {
    return newRefusal({
      ...shared,
      reason: "ORIENTED_PLANE_OUTSIDE_TORSO",
      rawBoundaryTaper,
      perspectiveAmount,
    });
  }
  const torsoFrame = {
    contractVersion: input.policy.contractVersion as
      | typeof ORIENTED_FRONT_PRINT_PLANE_VERSION
      | typeof ORIENTED_FRONT_PRINT_PLANE_NORMAL_ASSISTED_VERSION,
    origin,
    uAxis: {
      ...uAxis,
      angleDegrees: estimatedRotationDegrees,
    },
    vAxis: {
      ...vAxis,
      angleDegrees: estimatedRotationDegrees,
    },
    safeLocalWidth: safe.width,
    safeLocalHeight: safe.height,
    torsoSafePolygon,
    confidence,
    sourceEvidence: normalAssistance
      ? ("SAM_TORSO_PLUS_MIDAS_NORMAL" as const)
      : ("SAM_TORSO_BOUNDARIES" as const),
    backgroundEvidenceExcluded: true as const,
  };

  // Convert the already-authoritative owner footprint to torso-local UV once.
  // No size, translation, or contain operation is performed here.
  const localX = (input.printBounds.x - safe.x) / safe.width;
  const localY = (input.printBounds.y - safe.y) / safe.height;
  const requestedLocalWidth = input.printBounds.width / safe.width;
  const requestedLocalHeight = input.printBounds.height / safe.height;
  const localRight = localX + requestedLocalWidth;
  const localBottom = localY + requestedLocalHeight;
  const overflow = {
    top: Math.max(0, -localY),
    right: Math.max(0, localRight - 1),
    bottom: Math.max(0, localBottom - 1),
    left: Math.max(0, -localX),
  };
  const localInside = Object.values(overflow).every((value) => value <= 1e-9);
  const ownerLocalFootprintBase = {
    requestedLocalWidth,
    requestedLocalHeight,
    localX,
    localY,
    ownerScale: input.ownerScale,
    ownerOffsetX: input.ownerOffsetX,
    ownerOffsetY: input.ownerOffsetY,
  };
  if (!localInside) {
    const containment = {
      ...notEvaluatedContainment(),
      torsoPolygon: measured("FAIL", 0),
      collar: {
        status: (overflow.top > 0 ? "FAIL" : "PASS") as EvaluationStatus,
        clearance: localY * safe.height,
      },
      hem: {
        status: (overflow.bottom > 0 ? "FAIL" : "PASS") as EvaluationStatus,
        clearance: (1 - localBottom) * safe.height,
      },
      left: {
        status: (overflow.left > 0 ? "FAIL" : "PASS") as EvaluationStatus,
        clearance: localX * safe.width,
      },
      right: {
        status: (overflow.right > 0 ? "FAIL" : "PASS") as EvaluationStatus,
        clearance: (1 - localRight) * safe.width,
      },
      overflow,
    };
    return newRefusal({
      ...shared,
      reason:
        overflow.top > 0
          ? "ORIENTED_PLANE_COLLAR_UNSAFE"
          : "ORIENTED_PLANE_OUTSIDE_TORSO",
      rawBoundaryTaper,
      perspectiveAmount,
      torsoFrame,
      ownerLocalFootprint: {
        ...ownerLocalFootprintBase,
        projectedQuad: null,
      },
      containment,
    });
  }

  const quad: NormalizedQuad = [
    quadPoint(torsoSafePolygon, localX, localY),
    quadPoint(torsoSafePolygon, localRight, localY),
    quadPoint(torsoSafePolygon, localRight, localBottom),
    quadPoint(torsoSafePolygon, localX, localBottom),
  ];
  const ownerLocalFootprint = {
    ...ownerLocalFootprintBase,
    projectedQuad: quad,
  };
  let torsoInside = 0;
  let samInside = 0;
  let total = 0;
  for (let row = 0; row < 20; row += 1) {
    for (let column = 0; column < 20; column += 1) {
      const point = quadPoint(quad, (column + 0.5) / 20, (row + 0.5) / 20);
      total += 1;
      if (pointInConvexQuad(point, torsoSafePolygon)) torsoInside += 1;
      if (input.maskContains(point.x, point.y)) samInside += 1;
    }
  }
  const torsoContainment = total ? torsoInside / total : 0;
  const samContainment = total ? samInside / total : 0;
  const collarClearance = localY * safe.height;
  const hemClearance = (1 - localBottom) * safe.height;
  const leftClearance = localX * safe.width;
  const rightClearance = (1 - localRight) * safe.width;
  const containment = {
    torsoPolygon: measured(
      torsoContainment >= 0.999 ? "PASS" : "FAIL",
      torsoContainment,
    ),
    samMask: measured(
      samContainment >= input.policy.minimumSamContainment ? "PASS" : "FAIL",
      samContainment,
    ),
    collar: {
      status: (collarClearance >= -1e-9 ? "PASS" : "FAIL") as EvaluationStatus,
      clearance: collarClearance,
    },
    hem: {
      status: (hemClearance >= -1e-9 ? "PASS" : "FAIL") as EvaluationStatus,
      clearance: hemClearance,
    },
    left: {
      status: (leftClearance >= -1e-9 ? "PASS" : "FAIL") as EvaluationStatus,
      clearance: leftClearance,
    },
    right: {
      status: (rightClearance >= -1e-9 ? "PASS" : "FAIL") as EvaluationStatus,
      clearance: rightClearance,
    },
    overflow,
  };
  if (
    containment.torsoPolygon.status === "FAIL" ||
    containment.samMask.status === "FAIL"
  ) {
    return newRefusal({
      ...shared,
      reason: "ORIENTED_PLANE_OUTSIDE_TORSO",
      rawBoundaryTaper,
      perspectiveAmount,
      quad,
      torsoFrame,
      ownerLocalFootprint,
      containment,
    });
  }

  const registrationTypographyRisk = Math.abs(perspectiveAmount) / 2;
  if (registrationTypographyRisk > 0.075) {
    return newRefusal({
      ...shared,
      reason: "ORIENTED_PLANE_TYPOGRAPHY_UNSAFE",
      rawBoundaryTaper,
      perspectiveAmount,
      quad,
      torsoFrame,
      ownerLocalFootprint,
      containment,
      typographyRisk: registrationTypographyRisk,
    });
  }

  return orientedFrontPrintPlaneEvidenceSchema.parse({
    contractVersion: input.policy.contractVersion,
    status: "READY",
    reason: "READY",
    evidenceClass,
    orientationConfidence: confidence,
    estimatedRotationDegrees,
    appliedRotationDegrees: estimatedRotationDegrees,
    topEdgeTiltDegrees: edgeTilt(quad[0], quad[1]),
    bottomEdgeTiltDegrees: edgeTilt(quad[3], quad[2]),
    leftSideTiltDegrees: sideTiltFromVertical(quad[0], quad[3]),
    rightSideTiltDegrees: sideTiltFromVertical(quad[1], quad[2]),
    perspectiveAmount,
    rawBoundaryTaper,
    sampleCount: samples.length,
    rejectedSampleCount,
    torsoEdgeStability,
    centerlineStability,
    shoulderCollarAgreement,
    backgroundEvidenceExcluded: true,
    realDepthSupportUsed: false,
    requestedAxisAlignedBounds: input.printBounds,
    orientedQuad: quad,
    allCornersInsideTorso: true,
    samContainment,
    collarClearanceApplied: true,
    hemClearanceApplied: true,
    registrationTypographyRisk,
    ownerScale: input.ownerScale,
    ownerOffsetX: input.ownerOffsetX,
    ownerOffsetY: input.ownerOffsetY,
    globalFootprintPreserved: true,
    secondContainApplied: false,
    secondGlobalScaleApplied: false,
    secondGlobalTranslationApplied: false,
    clampReasons: [],
    failureReason: null,
    torsoFrame,
    ownerLocalFootprint,
    containment,
    ...(normalAssistance ? { normalAssistance } : {}),
  });
}

export function resolveOrientedFrontPrintPlaneV2(input: {
  rows: GarmentRowSpan[];
  imageWidth: number;
  imageHeight: number;
  torsoEnvelope: FrontTorsoPrintEnvelope;
  printBounds: Bounds;
  ownerScale: number;
  ownerOffsetX: number;
  ownerOffsetY: number;
  policy: OrientedFrontPrintPlanePolicy;
  maskContains: (x: number, y: number) => boolean;
  normalOrientation?: NormalOrientationEvidence | null;
}): OrientedFrontPrintPlaneEvidence {
  return input.policy.contractVersion ===
    ORIENTED_FRONT_PRINT_PLANE_V2_LEGACY_VERSION
    ? resolveLegacyOrientedFrontPrintPlaneV2(input)
    : resolveOrientedTorsoFrameV21(input);
}
