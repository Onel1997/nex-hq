import type {
  DepthAwareSurfaceEvidence,
  DepthAwareSurfaceIntegrationSettings,
  TypographyDeformationAnalysis,
} from "@/lib/image/artwork-compositing/types";
import {
  DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_1,
  DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_2,
} from "@/lib/image/artwork-compositing/types";
import type { PixelRect } from "@/lib/image/artwork-compositing/fabric-aware-v1";
import {
  analyzeTypographyDeformation,
  type ArtworkSurfaceContentAnalysis,
  type MeshNode,
  type SurfaceConformingPlan,
} from "@/lib/image/artwork-compositing/surface-conforming-v1";

export type DepthAwareSurfaceGuidance = {
  rect: PixelRect;
  columns: number;
  rows: number;
  nodes: MeshNode[];
  evidence: DepthAwareSurfaceEvidence;
};

export class DepthAwareSurfaceUnsafeError extends Error {
  readonly code = "DEPTH_AWARE_SURFACE_UNSAFE" as const;

  constructor(readonly evidence: DepthAwareSurfaceEvidence) {
    super(
      "Das Artwork konnte nicht sicher an Perspektive, Körperneigung und Stoffoberfläche angepasst werden. Es wurde kein Ergebnis zur Freigabe erstellt.",
    );
    this.name = "DepthAwareSurfaceUnsafeError";
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function luminanceAt(input: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  x: number;
  y: number;
}): number {
  const x = clamp(Math.round(input.x), 0, input.width - 1);
  const y = clamp(Math.round(input.y), 0, input.height - 1);
  const offset = (y * input.width + x) * 4;
  return (
    input.pixels[offset]! * 0.2126 +
    input.pixels[offset + 1]! * 0.7152 +
    input.pixels[offset + 2]! * 0.0722
  );
}

function meanPatch(input: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  x: number;
  y: number;
  radius: number;
}): number {
  let total = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(input.radius / 3));
  for (let dy = -input.radius; dy <= input.radius; dy += step) {
    for (let dx = -input.radius; dx <= input.radius; dx += step) {
      total += luminanceAt({
        pixels: input.pixels,
        width: input.width,
        height: input.height,
        x: input.x + dx,
        y: input.y + dy,
      });
      count += 1;
    }
  }
  return count ? total / count : 127.5;
}

function quantile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    clamp(Math.round((sorted.length - 1) * fraction), 0, sorted.length - 1)
  ]!;
}

function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const center = (values.length - 1) / 2;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < values.length; index += 1) {
    const delta = index - center;
    numerator += delta * values[index]!;
    denominator += delta * delta;
  }
  return denominator ? numerator / denominator : 0;
}

type DepthPlaneSample = {
  x: number;
  y: number;
  u: number;
  v: number;
  raw: number;
  normalized: number;
};

type RobustDepthPlaneFit = {
  rawSlopeX: number;
  rawSlopeY: number;
  normalizedSlopeX: number;
  normalizedSlopeY: number;
  normalizedIntercept: number;
  p05: number;
  p50: number;
  p95: number;
  range: number;
  samples: DepthPlaneSample[];
  rejectedSampleCount: number;
};

export type HybridDepthQualityClassification =
  | "DEPTH_STRONG"
  | "DEPTH_MODERATE"
  | "DEPTH_LOW_STABLE"
  | "DEPTH_UNSAFE";

export type HybridSurfaceGuidanceMode =
  | "REAL_DEPTH_DOMINANT"
  | "HYBRID"
  | "NEAR_PLANAR_HYBRID"
  | "REFUSED";

type HybridDepthQuality = {
  classification: HybridDepthQualityClassification;
  mode: HybridSurfaceGuidanceMode;
  realDepthConfidence: number;
  blendedConfidence: number;
  discontinuityStability: number;
  sampleCoverage: number;
  rangeToValidationFloor: number;
  stable: boolean;
};

/**
 * V1.2 keeps the validation floor authoritative and classifies the evidence
 * above that floor. The legacy confidence weights retained 24% SAM and 20%
 * geometry authority. For a low-range map, the old 50% amplitude term is
 * redistributed to discontinuity stability, usable masked samples, the
 * validation-floor margin, and local fabric corroboration. This is a distinct
 * policy, not a lowered global threshold.
 */
export function classifyHybridDepthQuality(input: {
  dynamicRange: number;
  minimumDynamicRange: number;
  discontinuityFraction: number;
  maximumDiscontinuityFraction: number;
  maskCoverage: number;
  torsoStability: number;
  planeTiltDegrees: number;
  perspectiveEstimate: number;
  localFabricEvidence: number;
  acceptedSampleCount: number;
  totalSampleCount: number;
  rejectedSampleCount: number;
  realDepthConfidence: number;
}): HybridDepthQuality {
  const floor = Math.max(1e-6, input.minimumDynamicRange);
  const discontinuityLimit = Math.max(
    1e-6,
    input.maximumDiscontinuityFraction,
  );
  const rangeToValidationFloor = input.dynamicRange / floor;
  const discontinuityStability = clamp(
    1 - input.discontinuityFraction / discontinuityLimit,
    0,
    1,
  );
  const sampleCoverage = clamp(
    input.acceptedSampleCount / Math.max(1, input.totalSampleCount),
    0,
    1,
  );
  const rejectedFraction = clamp(
    input.rejectedSampleCount /
      Math.max(1, input.acceptedSampleCount + input.rejectedSampleCount),
    0,
    1,
  );
  const validationFloorConfidence = clamp(
    (rangeToValidationFloor - 1) / 2,
    0,
    1,
  );
  const blendedConfidence = clamp(
    input.maskCoverage * 0.24 +
      input.torsoStability * 0.2 +
      discontinuityStability * 0.18 +
      sampleCoverage * 0.16 +
      validationFloorConfidence * 0.1 +
      input.localFabricEvidence * 0.12,
    0,
    1,
  );
  const validationSafe =
    input.dynamicRange + 1e-9 >= floor &&
    input.discontinuityFraction <= discontinuityLimit + 1e-9;
  const authorityStable =
    input.maskCoverage >= 0.985 &&
    input.torsoStability >= 0.72 &&
    sampleCoverage >= 0.72 &&
    rejectedFraction <= 0.35 &&
    input.localFabricEvidence >= 0.12;
  const nearPlanarConsistent =
    Math.abs(input.planeTiltDegrees) <= 6 &&
    input.perspectiveEstimate <= 0.35;
  const stable = validationSafe && authorityStable;

  if (!stable) {
    return {
      classification: "DEPTH_UNSAFE",
      mode: "REFUSED",
      realDepthConfidence: input.realDepthConfidence,
      blendedConfidence,
      discontinuityStability,
      sampleCoverage,
      rangeToValidationFloor,
      stable: false,
    };
  }
  if (rangeToValidationFloor >= 3) {
    return {
      classification: "DEPTH_STRONG",
      mode: "REAL_DEPTH_DOMINANT",
      realDepthConfidence: input.realDepthConfidence,
      blendedConfidence,
      discontinuityStability,
      sampleCoverage,
      rangeToValidationFloor,
      stable: true,
    };
  }
  if (rangeToValidationFloor >= 1.75) {
    return {
      classification: "DEPTH_MODERATE",
      mode: "HYBRID",
      realDepthConfidence: input.realDepthConfidence,
      blendedConfidence,
      discontinuityStability,
      sampleCoverage,
      rangeToValidationFloor,
      stable: true,
    };
  }
  if (nearPlanarConsistent) {
    return {
      classification: "DEPTH_LOW_STABLE",
      mode: "NEAR_PLANAR_HYBRID",
      realDepthConfidence: input.realDepthConfidence,
      blendedConfidence,
      discontinuityStability,
      sampleCoverage,
      rangeToValidationFloor,
      stable: true,
    };
  }
  return {
    classification: "DEPTH_UNSAFE",
    mode: "REFUSED",
    realDepthConfidence: input.realDepthConfidence,
    blendedConfidence,
    discontinuityStability,
    sampleCoverage,
    rangeToValidationFloor,
    stable: false,
  };
}

function median(values: number[]): number {
  return quantile(values, 0.5);
}

function intersectRects(left: PixelRect, right: PixelRect): PixelRect | null {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const maximumX = Math.min(left.x + left.width, right.x + right.width);
  const maximumY = Math.min(left.y + left.height, right.y + right.height);
  if (maximumX - x < 1 || maximumY - y < 1) return null;
  return { x, y, width: maximumX - x, height: maximumY - y };
}

function maskedMeanPatch(input: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  x: number;
  y: number;
  radius: number;
  analysisRect: PixelRect;
  maskContains: (x: number, y: number) => boolean;
}): number | null {
  let total = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(input.radius / 3));
  for (let dy = -input.radius; dy <= input.radius; dy += step) {
    for (let dx = -input.radius; dx <= input.radius; dx += step) {
      const x = clamp(Math.round(input.x + dx), 0, input.width - 1);
      const y = clamp(Math.round(input.y + dy), 0, input.height - 1);
      if (
        x < input.analysisRect.x ||
        x > input.analysisRect.x + input.analysisRect.width ||
        y < input.analysisRect.y ||
        y > input.analysisRect.y + input.analysisRect.height ||
        !input.maskContains(x, y)
      ) {
        continue;
      }
      total += luminanceAt({
        pixels: input.pixels,
        width: input.width,
        height: input.height,
        x,
        y,
      });
      count += 1;
    }
  }
  return count >= 4 ? total / count : null;
}

function solveDepthPlane(
  samples: DepthPlaneSample[],
  value: "raw" | "normalized",
): { slopeX: number; slopeY: number; intercept: number } | null {
  if (samples.length < 9) return null;
  let sumUU = 0;
  let sumUV = 0;
  let sumU = 0;
  let sumVV = 0;
  let sumV = 0;
  let sumUZ = 0;
  let sumVZ = 0;
  let sumZ = 0;
  for (const sample of samples) {
    const z = sample[value];
    sumUU += sample.u * sample.u;
    sumUV += sample.u * sample.v;
    sumU += sample.u;
    sumVV += sample.v * sample.v;
    sumV += sample.v;
    sumUZ += sample.u * z;
    sumVZ += sample.v * z;
    sumZ += z;
  }
  const matrix = [
    [sumUU, sumUV, sumU],
    [sumUV, sumVV, sumV],
    [sumU, sumV, samples.length],
  ];
  const vector = [sumUZ, sumVZ, sumZ];
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(matrix[row]![column]!) > Math.abs(matrix[pivot]![column]!)) {
        pivot = row;
      }
    }
    [matrix[column], matrix[pivot]] = [matrix[pivot]!, matrix[column]!];
    [vector[column], vector[pivot]] = [vector[pivot]!, vector[column]!];
    const divisor = matrix[column]![column]!;
    if (Math.abs(divisor) < 1e-10) return null;
    for (let index = column; index < 3; index += 1) {
      matrix[column]![index]! /= divisor;
    }
    vector[column]! /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = matrix[row]![column]!;
      for (let index = column; index < 3; index += 1) {
        matrix[row]![index]! -= factor * matrix[column]![index]!;
      }
      vector[row]! -= factor * vector[column]!;
    }
  }
  return {
    slopeX: vector[0]!,
    slopeY: vector[1]!,
    intercept: vector[2]!,
  };
}

function robustDepthPlaneFit(input: {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  analysisRect: PixelRect;
  maskContains: (x: number, y: number) => boolean;
  columns: number;
  rows: number;
  radius: number;
}): RobustDepthPlaneFit | null {
  const collected: Array<Omit<DepthPlaneSample, "normalized">> = [];
  for (let row = 0; row < input.rows; row += 1) {
    const v01 = row / (input.rows - 1);
    for (let column = 0; column < input.columns; column += 1) {
      const u01 = column / (input.columns - 1);
      const x = input.analysisRect.x + u01 * input.analysisRect.width;
      const y = input.analysisRect.y + v01 * input.analysisRect.height;
      const raw = maskedMeanPatch({
        pixels: input.pixels,
        width: input.width,
        height: input.height,
        x,
        y,
        radius: input.radius,
        analysisRect: input.analysisRect,
        maskContains: input.maskContains,
      });
      if (raw === null) continue;
      collected.push({
        x,
        y,
        u: (x - (input.analysisRect.x + input.analysisRect.width / 2)) /
          input.analysisRect.width,
        v: (y - (input.analysisRect.y + input.analysisRect.height / 2)) /
          input.analysisRect.height,
        raw,
      });
    }
  }
  if (collected.length < Math.ceil(input.columns * input.rows * 0.62)) {
    return null;
  }
  const values = collected.map((sample) => sample.raw);
  const p05 = quantile(values, 0.05);
  const p50 = median(values);
  const p95 = quantile(values, 0.95);
  const range = p95 - p05;
  if (range < 1) return null;
  const samples: DepthPlaneSample[] = collected.map((sample) => ({
    ...sample,
    normalized: (sample.raw - p50) / range,
  }));
  const initial = solveDepthPlane(samples, "normalized");
  if (!initial) return null;
  const residuals = samples.map(
    (sample) =>
      sample.normalized -
      (initial.slopeX * sample.u +
        initial.slopeY * sample.v +
        initial.intercept),
  );
  const residualMedian = median(residuals);
  const medianAbsoluteDeviation = median(
    residuals.map((residual) => Math.abs(residual - residualMedian)),
  );
  const residualLimit = Math.max(0.08, medianAbsoluteDeviation * 3.5);
  const kept = samples.filter(
    (_sample, index) =>
      Math.abs(residuals[index]! - residualMedian) <= residualLimit,
  );
  const normalizedFit = solveDepthPlane(kept, "normalized");
  const rawFit = solveDepthPlane(kept, "raw");
  if (!normalizedFit || !rawFit) return null;
  return {
    rawSlopeX: rawFit.slopeX,
    rawSlopeY: rawFit.slopeY,
    normalizedSlopeX: normalizedFit.slopeX,
    normalizedSlopeY: normalizedFit.slopeY,
    normalizedIntercept: normalizedFit.intercept,
    p05,
    p50,
    p95,
    range,
    samples: kept,
    rejectedSampleCount: samples.length - kept.length,
  };
}

function maskRowSpan(input: {
  y: number;
  centerX: number;
  searchLeft: number;
  searchRight: number;
  maskContains: (x: number, y: number) => boolean;
}): { center: number; width: number } | null {
  const y = Math.round(input.y);
  let seed = Math.round(input.centerX);
  if (!input.maskContains(seed, y)) {
    let found: number | null = null;
    for (
      let distance = 1;
      distance <= input.searchRight - input.searchLeft;
      distance += 1
    ) {
      const left = seed - distance;
      const right = seed + distance;
      if (left >= input.searchLeft && input.maskContains(left, y)) {
        found = left;
        break;
      }
      if (right <= input.searchRight && input.maskContains(right, y)) {
        found = right;
        break;
      }
    }
    if (found === null) return null;
    seed = found;
  }
  let left = seed;
  let right = seed;
  while (left > input.searchLeft && input.maskContains(left - 1, y)) left -= 1;
  while (right < input.searchRight && input.maskContains(right + 1, y)) {
    right += 1;
  }
  return { center: (left + right) / 2, width: right - left + 1 };
}

function refusal(input: {
  settings: DepthAwareSurfaceIntegrationSettings;
  reason: Exclude<DepthAwareSurfaceEvidence["reason"], "READY">;
  depthEvidenceAvailable?: boolean;
  planeTiltDegrees?: number;
  perspective?: number;
  depthConfidence?: number;
  surfaceConfidence?: number;
  warpStrength?: number;
  maximumWarpPx?: number;
  typographyRisk?: number;
  maskCoverage?: number;
  clampReasons?: DepthAwareSurfaceEvidence["clampReasons"];
  realDepth?: DepthAwareSurfaceEvidence["realDepth"];
  requestedMaximumWarpPx?: number;
  safeBoundedMaximumWarpPx?: number;
  rejectedWarpExcessPx?: number;
  nodesExceedingBounds?: number;
  analyzedNodeCount?: number;
  perspectiveNormalizationDenominator?: number;
  requestedPerspectiveWarpPx?: number;
  rawDepthPlaneSlopeX?: number;
  rawDepthPlaneSlopeY?: number;
  normalizedDepthPlaneSlopeX?: number;
  normalizedDepthPlaneSlopeY?: number;
  robustDepthRange?: number;
  depthPlaneSampleCount?: number;
  depthPlaneRejectedSampleCount?: number;
  depthPlaneFitMethod?: DepthAwareSurfaceEvidence["depthPlaneFitMethod"];
  depthAnalysisScope?: DepthAwareSurfaceEvidence["depthAnalysisScope"];
  depthQualityClassification?: DepthAwareSurfaceEvidence["depthQualityClassification"];
  surfaceGuidanceMode?: DepthAwareSurfaceEvidence["surfaceGuidanceMode"];
  realDepthConfidence?: number;
  torsoStability?: number;
  localFabricEvidence?: number;
  depthDiscontinuityStability?: number;
  depthSampleCoverage?: number;
  blendedSurfaceConfidence?: number;
}): DepthAwareSurfaceEvidence {
  const analyzedNodeCount = Math.max(0, input.analyzedNodeCount ?? 0);
  const nodesExceedingBounds = Math.max(0, input.nodesExceedingBounds ?? 0);
  return {
    contractVersion: input.settings.contractVersion,
    status: "REFUSED",
    reason: input.reason,
    estimator: input.realDepth
      ? "REAL_DEPTH_ANYTHING_V2"
      : "LOCAL_STAGE_A_RELATIVE_DEPTH_V1",
    ...(input.realDepth ? { realDepth: input.realDepth } : {}),
    depthEvidenceAvailable: input.depthEvidenceAvailable ?? false,
    localPlaneTiltDegrees: clamp(input.planeTiltDegrees ?? 0, -15, 15),
    localPerspectiveEstimate: clamp(input.perspective ?? 0, 0, 1),
    depthConfidence: clamp(input.depthConfidence ?? 0, 0, 1),
    surfaceConfidence: clamp(input.surfaceConfidence ?? 0, 0, 1),
    ...(input.depthQualityClassification
      ? { depthQualityClassification: input.depthQualityClassification }
      : {}),
    ...(input.surfaceGuidanceMode
      ? { surfaceGuidanceMode: input.surfaceGuidanceMode }
      : {}),
    ...(input.realDepthConfidence !== undefined
      ? { realDepthConfidence: clamp(input.realDepthConfidence, 0, 1) }
      : {}),
    ...(input.torsoStability !== undefined
      ? { torsoStability: clamp(input.torsoStability, 0, 1) }
      : {}),
    ...(input.localFabricEvidence !== undefined
      ? { localFabricEvidence: clamp(input.localFabricEvidence, 0, 1) }
      : {}),
    ...(input.depthDiscontinuityStability !== undefined
      ? {
          depthDiscontinuityStability: clamp(
            input.depthDiscontinuityStability,
            0,
            1,
          ),
        }
      : {}),
    ...(input.depthSampleCoverage !== undefined
      ? { depthSampleCoverage: clamp(input.depthSampleCoverage, 0, 1) }
      : {}),
    ...(input.blendedSurfaceConfidence !== undefined
      ? {
          blendedSurfaceConfidence: clamp(
            input.blendedSurfaceConfidence,
            0,
            1,
          ),
        }
      : {}),
    appliedLocalWarpStrength: clamp(input.warpStrength ?? 0, 0, 0.02),
    maximumLocalWarpPx: Math.max(0, input.maximumWarpPx ?? 0),
    ...(input.requestedMaximumWarpPx !== undefined
      ? {
          requestedMaximumLocalWarpPx: Math.max(
            0,
            input.requestedMaximumWarpPx,
          ),
        }
      : {}),
    ...(input.safeBoundedMaximumWarpPx !== undefined
      ? {
          safeBoundedMaximumLocalWarpPx: Math.max(
            0,
            input.safeBoundedMaximumWarpPx,
          ),
        }
      : {}),
    ...(input.rejectedWarpExcessPx !== undefined
      ? { rejectedWarpExcessPx: Math.max(0, input.rejectedWarpExcessPx) }
      : {}),
    ...(input.nodesExceedingBounds !== undefined
      ? {
          nodesExceedingBounds,
          analyzedNodeCount,
          nodesExceedingBoundsFraction: analyzedNodeCount
            ? nodesExceedingBounds / analyzedNodeCount
            : 0,
        }
      : {}),
    ...(input.perspectiveNormalizationDenominator !== undefined
      ? {
          perspectiveNormalizationDenominator: Math.max(
            Number.EPSILON,
            input.perspectiveNormalizationDenominator,
          ),
        }
      : {}),
    ...(input.requestedPerspectiveWarpPx !== undefined
      ? {
          requestedPerspectiveWarpPx: Math.max(
            0,
            input.requestedPerspectiveWarpPx,
          ),
        }
      : {}),
    ...(input.rawDepthPlaneSlopeX !== undefined
      ? { rawDepthPlaneSlopeX: input.rawDepthPlaneSlopeX }
      : {}),
    ...(input.rawDepthPlaneSlopeY !== undefined
      ? { rawDepthPlaneSlopeY: input.rawDepthPlaneSlopeY }
      : {}),
    ...(input.normalizedDepthPlaneSlopeX !== undefined
      ? { normalizedDepthPlaneSlopeX: input.normalizedDepthPlaneSlopeX }
      : {}),
    ...(input.normalizedDepthPlaneSlopeY !== undefined
      ? { normalizedDepthPlaneSlopeY: input.normalizedDepthPlaneSlopeY }
      : {}),
    ...(input.robustDepthRange !== undefined
      ? { robustDepthRange: Math.max(0, input.robustDepthRange) }
      : {}),
    ...(input.depthPlaneSampleCount !== undefined
      ? { depthPlaneSampleCount: Math.max(0, input.depthPlaneSampleCount) }
      : {}),
    ...(input.depthPlaneRejectedSampleCount !== undefined
      ? {
          depthPlaneRejectedSampleCount: Math.max(
            0,
            input.depthPlaneRejectedSampleCount,
          ),
        }
      : {}),
    ...(input.depthPlaneFitMethod
      ? { depthPlaneFitMethod: input.depthPlaneFitMethod }
      : {}),
    ...(input.depthAnalysisScope
      ? { depthAnalysisScope: input.depthAnalysisScope }
      : {}),
    typographyRisk: clamp(input.typographyRisk ?? 0, 0, 1),
    globalFootprintPreserved: true,
    secondaryScaleApplied: false,
    secondaryTranslationApplied: false,
    maskCoverage: clamp(input.maskCoverage ?? 0, 0, 1),
    clampReasons: input.clampReasons ?? ["FOOTPRINT_BOUNDARY_PINNED"],
    deterministic: true,
    sourceBaseOnly: true,
    sourceAuthorityPreserved: true,
    failClosedReason: input.reason,
  };
}

/**
 * Builds relative, non-metric depth guidance from the frozen Stage-A raster and
 * validated garment mask. Historical V1 keeps its frozen silhouette heuristic;
 * V1.1 fits low-frequency depth only inside SAM ∩ torso ∩ print neighbourhood,
 * rejects robust plane outliers, and evaluates the transform sampled by the
 * compositor. Every outer node stays pinned, so neither version can alter the
 * global owner footprint.
 */
export function buildDepthAwareSurfaceGuidance(input: {
  pixels: Uint8ClampedArray;
  imageWidth: number;
  imageHeight: number;
  artworkRect: PixelRect;
  /** Pixel-space torso authority from Garment Registration V3. */
  garmentAnalysisRect?: PixelRect;
  maskContains: ((x: number, y: number) => boolean) | null;
  settings: DepthAwareSurfaceIntegrationSettings;
  realDepth?: {
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
    provider: "fal";
    model: string;
    adapterVersion: string;
    depthMapChecksumSha256: string;
    sourceBaseChecksumSha256: string;
    dynamicRange: number;
    discontinuityFraction?: number;
    minimumDynamicRange?: number;
    maximumDiscontinuityFraction?: number;
  };
}):
  | { status: "READY"; guidance: DepthAwareSurfaceGuidance }
  | { status: "REFUSED"; evidence: DepthAwareSurfaceEvidence } {
  const { artworkRect: rect, settings } = input;
  if (!input.maskContains) {
    return {
      status: "REFUSED",
      evidence: refusal({ settings, reason: "GARMENT_MASK_REQUIRED" }),
    };
  }
  if (rect.width < 32 || rect.height < 32) {
    return {
      status: "REFUSED",
      evidence: refusal({ settings, reason: "PRINT_REGION_TOO_SMALL" }),
    };
  }

  const left = clamp(Math.floor(rect.x), 0, input.imageWidth - 1);
  const right = clamp(
    Math.ceil(rect.x + rect.width),
    left + 1,
    input.imageWidth - 1,
  );
  const top = clamp(Math.floor(rect.y), 0, input.imageHeight - 1);
  const bottom = clamp(
    Math.ceil(rect.y + rect.height),
    top + 1,
    input.imageHeight - 1,
  );
  let inside = 0;
  let total = 0;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      total += 1;
      if (input.maskContains(x, y)) inside += 1;
    }
  }
  const maskCoverage = total ? inside / total : 0;
  if (maskCoverage < settings.minimumMaskCoverage) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "MASK_COVERAGE_UNSAFE",
        maskCoverage,
      }),
    };
  }

  const robustGarmentPlane =
    settings.contractVersion ===
      DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_1 ||
    settings.contractVersion ===
      DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_2;
  const hybridLowDepthPolicy =
    settings.contractVersion ===
    DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_2;
  const imageRect: PixelRect = {
    x: 0,
    y: 0,
    width: input.imageWidth - 1,
    height: input.imageHeight - 1,
  };
  const torsoAuthority =
    intersectRects(input.garmentAnalysisRect ?? rect, imageRect) ?? rect;
  const printNeighborhood: PixelRect = {
    x: rect.x - rect.width * 0.08,
    y: rect.y - rect.height * 0.08,
    width: rect.width * 1.16,
    height: rect.height * 1.16,
  };
  const analysisRect = robustGarmentPlane
    ? (intersectRects(torsoAuthority, printNeighborhood) ?? rect)
    : rect;
  const centerX = rect.x + rect.width / 2;
  const searchLeft = robustGarmentPlane
    ? clamp(Math.floor(analysisRect.x), 0, input.imageWidth - 1)
    : clamp(
        Math.floor(centerX - rect.width * 1.1),
        0,
        input.imageWidth - 1,
      );
  const searchRight = robustGarmentPlane
    ? clamp(
        Math.ceil(analysisRect.x + analysisRect.width),
        searchLeft + 1,
        input.imageWidth - 1,
      )
    : clamp(
        Math.ceil(centerX + rect.width * 1.1),
        searchLeft + 1,
        input.imageWidth - 1,
      );
  const spans = Array.from({ length: settings.gridRows }, (_, row) => {
    const v = row / (settings.gridRows - 1);
    return maskRowSpan({
      y: rect.y + v * rect.height,
      centerX,
      searchLeft,
      searchRight,
      maskContains: input.maskContains!,
    });
  });
  if (spans.some((span) => !span)) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "DEPTH_EVIDENCE_INSUFFICIENT",
        maskCoverage,
      }),
    };
  }
  const resolvedSpans = spans as Array<NonNullable<(typeof spans)[number]>>;
  const centerSlopePerRow = linearSlope(
    resolvedSpans.map((span) => span.center),
  );
  const yStep = rect.height / (settings.gridRows - 1);
  const centerSlopePerY = centerSlopePerRow / Math.max(1, yStep);
  const planeTiltDegrees =
    (Math.atan(centerSlopePerY) * 180) / Math.PI;
  const meanWidth =
    resolvedSpans.reduce((sum, span) => sum + span.width, 0) /
    resolvedSpans.length;
  const legacyWidthSlopeNormalized =
    (linearSlope(resolvedSpans.map((span) => span.width)) *
      (settings.gridRows - 1)) /
    Math.max(1, meanWidth);

  const radius = clamp(
    Math.round(Math.min(rect.width, rect.height) * 0.045),
    3,
    18,
  );
  const localSamples: number[] = [];
  const realDepthSamples: number[] = [];
  for (let row = 0; row < settings.gridRows; row += 1) {
    const v = row / (settings.gridRows - 1);
    for (let column = 0; column < settings.gridColumns; column += 1) {
      const u = column / (settings.gridColumns - 1);
      localSamples.push(
        meanPatch({
          pixels: input.pixels,
          width: input.imageWidth,
          height: input.imageHeight,
          x: rect.x + u * rect.width,
          y: rect.y + v * rect.height,
          radius,
        }),
      );
      if (input.realDepth) {
        const sample = robustGarmentPlane
          ? maskedMeanPatch({
              pixels: input.realDepth.pixels,
              width: input.realDepth.width,
              height: input.realDepth.height,
              x: rect.x + u * rect.width,
              y: rect.y + v * rect.height,
              radius,
              analysisRect,
              maskContains: input.maskContains!,
            })
          : meanPatch({
              pixels: input.realDepth.pixels,
              width: input.realDepth.width,
              height: input.realDepth.height,
              x: rect.x + u * rect.width,
              y: rect.y + v * rect.height,
              radius,
            });
        realDepthSamples.push(sample ?? Number.NaN);
      }
    }
  }
  const robustPlane = robustGarmentPlane
    ? robustDepthPlaneFit({
        pixels: input.realDepth?.pixels ?? input.pixels,
        width: input.realDepth?.width ?? input.imageWidth,
        height: input.realDepth?.height ?? input.imageHeight,
        analysisRect,
        maskContains: input.maskContains,
        columns: settings.gridColumns,
        rows: settings.gridRows,
        radius,
      })
    : null;
  if (robustGarmentPlane && !robustPlane) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "DEPTH_EVIDENCE_INSUFFICIENT",
        depthEvidenceAvailable: false,
        planeTiltDegrees,
        maskCoverage,
        depthPlaneFitMethod: "GARMENT_MASKED_ROBUST_DEPTH_PLANE_V1",
        depthAnalysisScope: "SAM_TORSO_PRINT_NEIGHBORHOOD",
      }),
    };
  }
  const maxX = rect.width * settings.maximumLocalWarpRatio;
  const maxY = rect.height * settings.maximumLocalWarpRatio * 0.72;
  const requiredPlaneShift =
    centerSlopePerY * rect.height * settings.planeResponse * 0.34;
  const requiredPerspectiveShift = robustPlane
    ? robustPlane.normalizedSlopeX *
      rect.width *
      settings.perspectiveResponse *
      0.18
    : legacyWidthSlopeNormalized *
      rect.width *
      settings.perspectiveResponse *
      0.18;
  let maximumPerspectiveEnvelope = 0;
  for (let row = 1; row < settings.gridRows - 1; row += 1) {
    const v = row / (settings.gridRows - 1);
    for (let column = 1; column < settings.gridColumns - 1; column += 1) {
      const u = column / (settings.gridColumns - 1);
      maximumPerspectiveEnvelope = Math.max(
        maximumPerspectiveEnvelope,
        Math.abs((u - 0.5) * (v - 0.5) * Math.sin(Math.PI * v)),
      );
    }
  }
  const requestedPerspectiveWarpPx =
    Math.abs(requiredPerspectiveShift) * maximumPerspectiveEnvelope;
  const perspectiveNormalizationDenominator = robustGarmentPlane
    ? maxX
    : 0.24;
  const perspectiveEstimate = robustGarmentPlane
    ? clamp(requestedPerspectiveWarpPx / Math.max(Number.EPSILON, maxX), 0, 1)
    : clamp(Math.abs(legacyWidthSlopeNormalized) / 0.24, 0, 1);
  const luminanceRange = Math.max(
    1,
    quantile(localSamples, 0.9) - quantile(localSamples, 0.1),
  );
  const normalizedLuminanceEvidence = clamp(luminanceRange / 30, 0, 1);
  const geometryEvidence = clamp(
    Math.abs(planeTiltDegrees) / 8 * 0.62 + perspectiveEstimate * 0.38,
    0,
    1,
  );
  const finiteRealDepthSamples = realDepthSamples.filter(Number.isFinite);
  const realDepthRange = input.realDepth
    ? Math.max(
        1,
        quantile(finiteRealDepthSamples, 0.9) -
          quantile(finiteRealDepthSamples, 0.1),
      )
    : 0;
  const realDepthEvidence = input.realDepth
    ? clamp(input.realDepth.dynamicRange / 0.18, 0, 1)
    : 0;
  const realDepthConfidence = clamp(
    input.realDepth
      ? maskCoverage * 0.24 +
          realDepthEvidence * 0.5 +
          geometryEvidence * 0.2 +
          normalizedLuminanceEvidence * 0.06
      : maskCoverage * 0.28 +
          normalizedLuminanceEvidence * 0.5 +
          geometryEvidence * 0.22,
    0,
    1,
  );
  const centerResidual = Math.max(
    ...resolvedSpans.map((span, index) => {
      const predicted =
        resolvedSpans[0]!.center + centerSlopePerRow * index;
      return Math.abs(span.center - predicted) / rect.width;
    }),
  );
  const widthResidual = Math.max(
    ...resolvedSpans.map((span) =>
      Math.abs(span.width - meanWidth) / Math.max(1, meanWidth),
    ),
  );
  const geometryStability = clamp(
    1 - centerResidual / 0.12 - widthResidual / 0.5,
    0,
    1,
  );
  const surfaceConfidence = clamp(
    maskCoverage * 0.45 +
      geometryStability * 0.3 +
      normalizedLuminanceEvidence * 0.25,
    0,
    1,
  );
  const hybridDepthQuality =
    hybridLowDepthPolicy && input.realDepth && robustPlane
      ? classifyHybridDepthQuality({
          dynamicRange: input.realDepth.dynamicRange,
          minimumDynamicRange: input.realDepth.minimumDynamicRange ?? 0.04,
          discontinuityFraction:
            input.realDepth.discontinuityFraction ?? 0,
          maximumDiscontinuityFraction:
            input.realDepth.maximumDiscontinuityFraction ?? 0.08,
          maskCoverage,
          torsoStability: geometryStability,
          planeTiltDegrees,
          perspectiveEstimate,
          localFabricEvidence: normalizedLuminanceEvidence,
          acceptedSampleCount: robustPlane.samples.length,
          totalSampleCount: settings.gridColumns * settings.gridRows,
          rejectedSampleCount: robustPlane.rejectedSampleCount,
          realDepthConfidence,
        })
      : null;
  const depthConfidence = hybridDepthQuality
    ? hybridDepthQuality.classification === "DEPTH_LOW_STABLE"
      ? hybridDepthQuality.blendedConfidence
      : hybridDepthQuality.classification === "DEPTH_MODERATE"
        ? clamp(
            realDepthConfidence * 0.65 +
              hybridDepthQuality.blendedConfidence * 0.35,
            0,
            1,
          )
        : realDepthConfidence
    : realDepthConfidence;
  const hybridDiagnostics = hybridDepthQuality
    ? {
        depthQualityClassification: hybridDepthQuality.classification,
        surfaceGuidanceMode: hybridDepthQuality.mode,
        realDepthConfidence,
        torsoStability: geometryStability,
        localFabricEvidence: normalizedLuminanceEvidence,
        depthDiscontinuityStability:
          hybridDepthQuality.discontinuityStability,
        depthSampleCoverage: hybridDepthQuality.sampleCoverage,
        blendedSurfaceConfidence: hybridDepthQuality.blendedConfidence,
      }
    : {};
  const evidenceAvailable = input.realDepth
    ? realDepthEvidence >= 0.12
    : normalizedLuminanceEvidence >= 0.12 || geometryEvidence >= 0.08;
  const realDepth = input.realDepth
    ? {
        provider: input.realDepth.provider,
        model: input.realDepth.model,
        adapterVersion: input.realDepth.adapterVersion,
        depthMapChecksumSha256: input.realDepth.depthMapChecksumSha256,
        sourceBaseChecksumSha256: input.realDepth.sourceBaseChecksumSha256,
        dynamicRange: input.realDepth.dynamicRange,
        ...(input.realDepth.discontinuityFraction !== undefined
          ? {
              discontinuityFraction:
                input.realDepth.discontinuityFraction,
            }
          : {}),
        ...(input.realDepth.minimumDynamicRange !== undefined
          ? { minimumDynamicRange: input.realDepth.minimumDynamicRange }
          : {}),
        ...(input.realDepth.maximumDiscontinuityFraction !== undefined
          ? {
              maximumDiscontinuityFraction:
                input.realDepth.maximumDiscontinuityFraction,
            }
          : {}),
        localCrossCheckWeight: 0.18,
      }
    : undefined;
  if (
    !evidenceAvailable ||
    depthConfidence < settings.minimumDepthConfidence ||
    hybridDepthQuality?.classification === "DEPTH_UNSAFE"
  ) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "DEPTH_EVIDENCE_INSUFFICIENT",
        depthEvidenceAvailable: evidenceAvailable,
        planeTiltDegrees,
        perspective: perspectiveEstimate,
        depthConfidence,
        surfaceConfidence,
        maskCoverage,
        ...hybridDiagnostics,
        ...(realDepth ? { realDepth } : {}),
      }),
    };
  }
  if (surfaceConfidence < settings.minimumSurfaceConfidence) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "SURFACE_CONFIDENCE_INSUFFICIENT",
        depthEvidenceAvailable: true,
        planeTiltDegrees,
        perspective: perspectiveEstimate,
        depthConfidence,
        surfaceConfidence,
        maskCoverage,
        ...hybridDiagnostics,
        ...(realDepth ? { realDepth } : {}),
      }),
    };
  }

  if (
    !robustGarmentPlane &&
    (Math.abs(requiredPlaneShift) > maxX * 1.35 ||
      Math.abs(requiredPerspectiveShift) > maxX * 1.35 ||
      Math.abs(planeTiltDegrees) > 12)
  ) {
    const requestedMaximumWarpPx = Math.max(
      Math.abs(requiredPlaneShift),
      Math.abs(requiredPerspectiveShift),
    );
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "UNSAFE_LOCAL_WARP_REQUIRED",
        depthEvidenceAvailable: true,
        planeTiltDegrees,
        perspective: perspectiveEstimate,
        depthConfidence,
        surfaceConfidence,
        maskCoverage,
        requestedMaximumWarpPx,
        safeBoundedMaximumWarpPx: 0,
        rejectedWarpExcessPx: Math.max(0, requestedMaximumWarpPx - maxX),
        nodesExceedingBounds: 0,
        analyzedNodeCount: settings.gridColumns * settings.gridRows,
        perspectiveNormalizationDenominator,
        requestedPerspectiveWarpPx,
        depthPlaneFitMethod: "LEGACY_MASK_WIDTH_SLOPE_V1",
        depthAnalysisScope: "LEGACY_FULL_GARMENT_SPAN",
        ...hybridDiagnostics,
        clampReasons: ["LOCAL_WARP_BOUND", "FOOTPRINT_BOUNDARY_PINNED"],
        ...(realDepth ? { realDepth } : {}),
      }),
    };
  }
  if (
    robustGarmentPlane &&
    Math.abs(planeTiltDegrees) > 12
  ) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "UNSAFE_LOCAL_WARP_REQUIRED",
        depthEvidenceAvailable: true,
        planeTiltDegrees,
        perspective: perspectiveEstimate,
        depthConfidence,
        surfaceConfidence,
        maskCoverage,
        requestedMaximumWarpPx: Math.abs(requiredPlaneShift),
        safeBoundedMaximumWarpPx: 0,
        rejectedWarpExcessPx: Math.max(
          0,
          Math.abs(requiredPlaneShift) - maxX,
        ),
        nodesExceedingBounds: 0,
        analyzedNodeCount: settings.gridColumns * settings.gridRows,
        perspectiveNormalizationDenominator,
        requestedPerspectiveWarpPx,
        rawDepthPlaneSlopeX: robustPlane!.rawSlopeX,
        rawDepthPlaneSlopeY: robustPlane!.rawSlopeY,
        normalizedDepthPlaneSlopeX: robustPlane!.normalizedSlopeX,
        normalizedDepthPlaneSlopeY: robustPlane!.normalizedSlopeY,
        robustDepthRange: robustPlane!.range,
        depthPlaneSampleCount: robustPlane!.samples.length,
        depthPlaneRejectedSampleCount: robustPlane!.rejectedSampleCount,
        depthPlaneFitMethod: "GARMENT_MASKED_ROBUST_DEPTH_PLANE_V1",
        depthAnalysisScope: "SAM_TORSO_PRINT_NEIGHBORHOOD",
        ...hybridDiagnostics,
        clampReasons: ["LOCAL_WARP_BOUND", "FOOTPRINT_BOUNDARY_PINNED"],
        ...(realDepth ? { realDepth } : {}),
      }),
    };
  }

  const sourceDepthSamples = input.realDepth ? realDepthSamples : localSamples;
  const depthSamples = robustPlane
    ? sourceDepthSamples.map((sample, index) => {
        const row = Math.floor(index / settings.gridColumns);
        const column = index % settings.gridColumns;
        const u01 = column / (settings.gridColumns - 1);
        const v01 = row / (settings.gridRows - 1);
        const x = rect.x + u01 * rect.width;
        const y = rect.y + v01 * rect.height;
        const u =
          (x - (analysisRect.x + analysisRect.width / 2)) /
          analysisRect.width;
        const v =
          (y - (analysisRect.y + analysisRect.height / 2)) /
          analysisRect.height;
        const normalized = Number.isFinite(sample)
          ? (sample - robustPlane.p50) / robustPlane.range
          : robustPlane.normalizedSlopeX * u +
            robustPlane.normalizedSlopeY * v +
            robustPlane.normalizedIntercept;
        return (
          normalized -
          (robustPlane.normalizedSlopeX * u +
            robustPlane.normalizedSlopeY * v +
            robustPlane.normalizedIntercept)
        );
      })
    : sourceDepthSamples;
  const activeDepthRange = robustPlane
    ? 1
    : input.realDepth
      ? realDepthRange
      : luminanceRange;
  const at = (column: number, row: number) =>
    depthSamples[row * settings.gridColumns + column]!;
  const rawNodes: MeshNode[] = [];
  let clamped = 0;
  let requestedMaximumWarpPx = 0;
  let safeBoundedMaximumWarpPx = 0;
  for (let row = 0; row < settings.gridRows; row += 1) {
    const v = row / (settings.gridRows - 1);
    for (let column = 0; column < settings.gridColumns; column += 1) {
      const u = column / (settings.gridColumns - 1);
      if (
        row === 0 ||
        row === settings.gridRows - 1 ||
        column === 0 ||
        column === settings.gridColumns - 1
      ) {
        rawNodes.push({ displacementX: 0, displacementY: 0 });
        continue;
      }
      const horizontalEnvelope = Math.sin(Math.PI * u);
      const verticalEnvelope = Math.sin(Math.PI * v);
      const envelope = horizontalEnvelope * verticalEnvelope;
      const leftDepth = at(Math.max(0, column - 1), row);
      const rightDepth = at(
        Math.min(settings.gridColumns - 1, column + 1),
        row,
      );
      const topDepth = at(column, Math.max(0, row - 1));
      const bottomDepth = at(
        column,
        Math.min(settings.gridRows - 1, row + 1),
      );
      const localGradientX = (rightDepth - leftDepth) / activeDepthRange;
      const localGradientY = (bottomDepth - topDepth) / activeDepthRange;
      const planeX = requiredPlaneShift * (v - 0.5) * horizontalEnvelope;
      const perspectiveX =
        requiredPerspectiveShift *
        (u - 0.5) *
        (v - 0.5) *
        verticalEnvelope;
      const relativeDepthX =
        localGradientX *
        maxX *
        settings.relativeDepthResponse *
        (hybridDepthQuality?.classification === "DEPTH_LOW_STABLE"
          ? 0.42 + normalizedLuminanceEvidence * 0.18
          : hybridDepthQuality?.classification === "DEPTH_MODERATE"
            ? 0.78
            : 1) *
        envelope;
      const relativeDepthY =
        localGradientY *
        maxY *
        settings.relativeDepthResponse *
        (hybridDepthQuality?.classification === "DEPTH_LOW_STABLE"
          ? 0.42 + normalizedLuminanceEvidence * 0.18
          : hybridDepthQuality?.classification === "DEPTH_MODERATE"
            ? 0.78
            : 1) *
        envelope;
      const rawX = planeX + perspectiveX + relativeDepthX;
      const rawY = relativeDepthY;
      const displacementX = clamp(rawX, -maxX, maxX);
      const displacementY = clamp(rawY, -maxY, maxY);
      requestedMaximumWarpPx = Math.max(
        requestedMaximumWarpPx,
        Math.hypot(rawX, rawY),
      );
      safeBoundedMaximumWarpPx = Math.max(
        safeBoundedMaximumWarpPx,
        Math.hypot(displacementX, displacementY),
      );
      if (
        Math.abs(displacementX - rawX) > 1e-9 ||
        Math.abs(displacementY - rawY) > 1e-9
      ) {
        clamped += 1;
      }
      rawNodes.push({ displacementX, displacementY });
    }
  }
  const actualCandidateLimit = Math.hypot(maxX, maxY) * 1.35;
  if (
    clamped / rawNodes.length > 0.2 ||
    (robustGarmentPlane && requestedMaximumWarpPx > actualCandidateLimit)
  ) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "UNSAFE_LOCAL_WARP_REQUIRED",
        depthEvidenceAvailable: true,
        planeTiltDegrees,
        perspective: perspectiveEstimate,
        depthConfidence,
        surfaceConfidence,
        maximumWarpPx: 0,
        warpStrength: 0,
        requestedMaximumWarpPx,
        safeBoundedMaximumWarpPx,
        rejectedWarpExcessPx: Math.max(
          0,
          requestedMaximumWarpPx - safeBoundedMaximumWarpPx,
        ),
        nodesExceedingBounds: clamped,
        analyzedNodeCount: rawNodes.length,
        perspectiveNormalizationDenominator,
        requestedPerspectiveWarpPx,
        ...(robustPlane
          ? {
              rawDepthPlaneSlopeX: robustPlane.rawSlopeX,
              rawDepthPlaneSlopeY: robustPlane.rawSlopeY,
              normalizedDepthPlaneSlopeX: robustPlane.normalizedSlopeX,
              normalizedDepthPlaneSlopeY: robustPlane.normalizedSlopeY,
              robustDepthRange: robustPlane.range,
              depthPlaneSampleCount: robustPlane.samples.length,
              depthPlaneRejectedSampleCount:
                robustPlane.rejectedSampleCount,
              depthPlaneFitMethod:
                "GARMENT_MASKED_ROBUST_DEPTH_PLANE_V1" as const,
              depthAnalysisScope:
                "SAM_TORSO_PRINT_NEIGHBORHOOD" as const,
              ...hybridDiagnostics,
            }
          : {
              depthPlaneFitMethod: "LEGACY_MASK_WIDTH_SLOPE_V1" as const,
              depthAnalysisScope: "LEGACY_FULL_GARMENT_SPAN" as const,
            }),
        maskCoverage,
        clampReasons: ["LOCAL_WARP_BOUND", "FOOTPRINT_BOUNDARY_PINNED"],
        ...(realDepth ? { realDepth } : {}),
      }),
    };
  }

  const maximumWarpPx = Math.max(
    ...rawNodes.map((node) =>
      Math.hypot(node.displacementX, node.displacementY),
    ),
  );
  const warpStrength =
    maximumWarpPx / Math.min(rect.width, rect.height);
  const evidence: DepthAwareSurfaceEvidence = {
    contractVersion: settings.contractVersion,
    status: "READY",
    reason: "READY",
    estimator: input.realDepth
      ? "REAL_DEPTH_ANYTHING_V2"
      : "LOCAL_STAGE_A_RELATIVE_DEPTH_V1",
    ...(realDepth ? { realDepth } : {}),
    depthEvidenceAvailable: true,
    localPlaneTiltDegrees: clamp(planeTiltDegrees, -15, 15),
    localPerspectiveEstimate: perspectiveEstimate,
    depthConfidence,
    surfaceConfidence,
    ...hybridDiagnostics,
    appliedLocalWarpStrength: clamp(warpStrength, 0, 0.02),
    maximumLocalWarpPx: maximumWarpPx,
    requestedMaximumLocalWarpPx: requestedMaximumWarpPx,
    safeBoundedMaximumLocalWarpPx: safeBoundedMaximumWarpPx,
    rejectedWarpExcessPx: Math.max(
      0,
      requestedMaximumWarpPx - safeBoundedMaximumWarpPx,
    ),
    nodesExceedingBounds: clamped,
    analyzedNodeCount: rawNodes.length,
    nodesExceedingBoundsFraction: clamped / rawNodes.length,
    perspectiveNormalizationDenominator,
    requestedPerspectiveWarpPx,
    ...(robustPlane
      ? {
          rawDepthPlaneSlopeX: robustPlane.rawSlopeX,
          rawDepthPlaneSlopeY: robustPlane.rawSlopeY,
          normalizedDepthPlaneSlopeX: robustPlane.normalizedSlopeX,
          normalizedDepthPlaneSlopeY: robustPlane.normalizedSlopeY,
          robustDepthRange: robustPlane.range,
          depthPlaneSampleCount: robustPlane.samples.length,
          depthPlaneRejectedSampleCount: robustPlane.rejectedSampleCount,
          depthPlaneFitMethod:
            "GARMENT_MASKED_ROBUST_DEPTH_PLANE_V1" as const,
          depthAnalysisScope:
            "SAM_TORSO_PRINT_NEIGHBORHOOD" as const,
        }
      : {
          depthPlaneFitMethod: "LEGACY_MASK_WIDTH_SLOPE_V1" as const,
          depthAnalysisScope: "LEGACY_FULL_GARMENT_SPAN" as const,
        }),
    typographyRisk: 0,
    globalFootprintPreserved: true,
    secondaryScaleApplied: false,
    secondaryTranslationApplied: false,
    maskCoverage,
    clampReasons: ["FOOTPRINT_BOUNDARY_PINNED"],
    deterministic: true,
    sourceBaseOnly: true,
    sourceAuthorityPreserved: true,
    failClosedReason: null,
  };
  return {
    status: "READY",
    guidance: {
      rect,
      columns: settings.gridColumns,
      rows: settings.gridRows,
      nodes: rawNodes,
      evidence,
    },
  };
}

function smoothCombinedMesh(input: {
  nodes: MeshNode[];
  columns: number;
  rows: number;
}): MeshNode[] {
  return input.nodes.map((node, index) => {
    const row = Math.floor(index / input.columns);
    const column = index % input.columns;
    if (
      row === 0 ||
      row === input.rows - 1 ||
      column === 0 ||
      column === input.columns - 1
    ) {
      return { displacementX: 0, displacementY: 0 };
    }
    const neighbors = [
      input.nodes[index - 1]!,
      input.nodes[index + 1]!,
      input.nodes[index - input.columns]!,
      input.nodes[index + input.columns]!,
    ];
    return {
      displacementX:
        node.displacementX * 0.68 +
        neighbors.reduce((sum, item) => sum + item.displacementX, 0) * 0.08,
      displacementY:
        node.displacementY * 0.68 +
        neighbors.reduce((sum, item) => sum + item.displacementY, 0) * 0.08,
    };
  });
}

/**
 * Merges depth guidance into the already-safe Surface-Conforming mesh and
 * validates the exact combined transform that the compositor will sample.
 */
export function applyDepthAwareGuidance(input: {
  surfacePlan: SurfaceConformingPlan;
  guidance: DepthAwareSurfaceGuidance;
  settings: DepthAwareSurfaceIntegrationSettings;
  maximumCombinedWarpRatio: number;
  artworkContent?: ArtworkSurfaceContentAnalysis;
}):
  | {
      status: "READY";
      plan: SurfaceConformingPlan;
      evidence: DepthAwareSurfaceEvidence;
    }
  | { status: "REFUSED"; evidence: DepthAwareSurfaceEvidence } {
  if (
    input.surfacePlan.columns !== input.guidance.columns ||
    input.surfacePlan.rows !== input.guidance.rows ||
    input.surfacePlan.rect.x !== input.guidance.rect.x ||
    input.surfacePlan.rect.y !== input.guidance.rect.y ||
    input.surfacePlan.rect.width !== input.guidance.rect.width ||
    input.surfacePlan.rect.height !== input.guidance.rect.height
  ) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings: input.settings,
        reason: "DEPTH_EVIDENCE_INSUFFICIENT",
      }),
    };
  }
  const maxX = input.surfacePlan.rect.width * input.maximumCombinedWarpRatio;
  const maxY =
    input.surfacePlan.rect.height * input.maximumCombinedWarpRatio * 0.72;
  let clamped = 0;
  let requestedMaximumWarpPx = 0;
  let safeBoundedMaximumWarpPx = 0;
  const carriedHybridDiagnostics = {
    ...(input.guidance.evidence.depthQualityClassification
      ? {
          depthQualityClassification:
            input.guidance.evidence.depthQualityClassification,
        }
      : {}),
    ...(input.guidance.evidence.surfaceGuidanceMode
      ? {
          surfaceGuidanceMode:
            input.guidance.evidence.surfaceGuidanceMode,
        }
      : {}),
    realDepthConfidence: input.guidance.evidence.realDepthConfidence,
    torsoStability: input.guidance.evidence.torsoStability,
    localFabricEvidence: input.guidance.evidence.localFabricEvidence,
    depthDiscontinuityStability:
      input.guidance.evidence.depthDiscontinuityStability,
    depthSampleCoverage: input.guidance.evidence.depthSampleCoverage,
    blendedSurfaceConfidence:
      input.guidance.evidence.blendedSurfaceConfidence,
  };
  const combined = input.surfacePlan.nodes.map((surfaceNode, index) => {
    const depthNode = input.guidance.nodes[index]!;
    const rawX = surfaceNode.displacementX + depthNode.displacementX;
    const rawY = surfaceNode.displacementY + depthNode.displacementY;
    const displacementX = clamp(rawX, -maxX, maxX);
    const displacementY = clamp(rawY, -maxY, maxY);
    requestedMaximumWarpPx = Math.max(
      requestedMaximumWarpPx,
      Math.hypot(rawX, rawY),
    );
    safeBoundedMaximumWarpPx = Math.max(
      safeBoundedMaximumWarpPx,
      Math.hypot(displacementX, displacementY),
    );
    if (
      Math.abs(displacementX - rawX) > 1e-9 ||
      Math.abs(displacementY - rawY) > 1e-9
    ) {
      clamped += 1;
    }
    return { displacementX, displacementY };
  });
  const nodes = smoothCombinedMesh({
    nodes: combined,
    columns: input.surfacePlan.columns,
    rows: input.surfacePlan.rows,
  });
  const maximumWarpPx = Math.max(
    ...nodes.map((node) =>
      Math.hypot(node.displacementX, node.displacementY),
    ),
  );
  const warpStrength =
    maximumWarpPx /
    Math.min(input.surfacePlan.rect.width, input.surfacePlan.rect.height);
  const typography: {
    distortion: number;
    analysis: TypographyDeformationAnalysis;
  } = analyzeTypographyDeformation({
    nodes,
    columns: input.surfacePlan.columns,
    rows: input.surfacePlan.rows,
    rect: input.surfacePlan.rect,
    ...(input.artworkContent
      ? { artworkContent: input.artworkContent }
      : {}),
  });
  const clampReasons: DepthAwareSurfaceEvidence["clampReasons"] = [
    "FOOTPRINT_BOUNDARY_PINNED",
  ];
  if (clamped > 0) clampReasons.unshift("LOCAL_WARP_BOUND");
  if (
    clamped / nodes.length > 0.12 ||
    warpStrength > input.maximumCombinedWarpRatio + 1e-9
  ) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings: input.settings,
        reason: "UNSAFE_LOCAL_WARP_REQUIRED",
        depthEvidenceAvailable: true,
        planeTiltDegrees: input.guidance.evidence.localPlaneTiltDegrees,
        perspective: input.guidance.evidence.localPerspectiveEstimate,
        depthConfidence: input.guidance.evidence.depthConfidence,
        surfaceConfidence: input.guidance.evidence.surfaceConfidence,
        warpStrength: 0,
        maximumWarpPx: 0,
        requestedMaximumWarpPx,
        safeBoundedMaximumWarpPx,
        rejectedWarpExcessPx: Math.max(
          0,
          requestedMaximumWarpPx - safeBoundedMaximumWarpPx,
        ),
        nodesExceedingBounds: clamped,
        analyzedNodeCount: nodes.length,
        perspectiveNormalizationDenominator:
          input.guidance.evidence.perspectiveNormalizationDenominator,
        requestedPerspectiveWarpPx:
          input.guidance.evidence.requestedPerspectiveWarpPx,
        rawDepthPlaneSlopeX:
          input.guidance.evidence.rawDepthPlaneSlopeX,
        rawDepthPlaneSlopeY:
          input.guidance.evidence.rawDepthPlaneSlopeY,
        normalizedDepthPlaneSlopeX:
          input.guidance.evidence.normalizedDepthPlaneSlopeX,
        normalizedDepthPlaneSlopeY:
          input.guidance.evidence.normalizedDepthPlaneSlopeY,
        robustDepthRange: input.guidance.evidence.robustDepthRange,
        depthPlaneSampleCount:
          input.guidance.evidence.depthPlaneSampleCount,
        depthPlaneRejectedSampleCount:
          input.guidance.evidence.depthPlaneRejectedSampleCount,
        depthPlaneFitMethod:
          input.guidance.evidence.depthPlaneFitMethod,
        depthAnalysisScope: input.guidance.evidence.depthAnalysisScope,
        ...carriedHybridDiagnostics,
        typographyRisk: typography.distortion,
        maskCoverage: input.guidance.evidence.maskCoverage,
        clampReasons,
        ...(input.guidance.evidence.realDepth
          ? { realDepth: input.guidance.evidence.realDepth }
          : {}),
      }),
    };
  }
  if (typography.distortion > input.settings.maximumTypographyDistortion) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings: input.settings,
        reason: "TYPOGRAPHY_DISTORTION_RISK",
        depthEvidenceAvailable: true,
        planeTiltDegrees: input.guidance.evidence.localPlaneTiltDegrees,
        perspective: input.guidance.evidence.localPerspectiveEstimate,
        depthConfidence: input.guidance.evidence.depthConfidence,
        surfaceConfidence: input.guidance.evidence.surfaceConfidence,
        warpStrength: 0,
        maximumWarpPx: 0,
        requestedMaximumWarpPx,
        safeBoundedMaximumWarpPx: maximumWarpPx,
        rejectedWarpExcessPx: Math.max(
          0,
          requestedMaximumWarpPx - maximumWarpPx,
        ),
        nodesExceedingBounds: clamped,
        analyzedNodeCount: nodes.length,
        perspectiveNormalizationDenominator:
          input.guidance.evidence.perspectiveNormalizationDenominator,
        requestedPerspectiveWarpPx:
          input.guidance.evidence.requestedPerspectiveWarpPx,
        rawDepthPlaneSlopeX:
          input.guidance.evidence.rawDepthPlaneSlopeX,
        rawDepthPlaneSlopeY:
          input.guidance.evidence.rawDepthPlaneSlopeY,
        normalizedDepthPlaneSlopeX:
          input.guidance.evidence.normalizedDepthPlaneSlopeX,
        normalizedDepthPlaneSlopeY:
          input.guidance.evidence.normalizedDepthPlaneSlopeY,
        robustDepthRange: input.guidance.evidence.robustDepthRange,
        depthPlaneSampleCount:
          input.guidance.evidence.depthPlaneSampleCount,
        depthPlaneRejectedSampleCount:
          input.guidance.evidence.depthPlaneRejectedSampleCount,
        depthPlaneFitMethod:
          input.guidance.evidence.depthPlaneFitMethod,
        depthAnalysisScope: input.guidance.evidence.depthAnalysisScope,
        ...carriedHybridDiagnostics,
        typographyRisk: typography.distortion,
        maskCoverage: input.guidance.evidence.maskCoverage,
        clampReasons: [...clampReasons, "TYPOGRAPHY_SAFETY_BOUND"],
        ...(input.guidance.evidence.realDepth
          ? { realDepth: input.guidance.evidence.realDepth }
          : {}),
      }),
    };
  }
  const evidence: DepthAwareSurfaceEvidence = {
    ...input.guidance.evidence,
    appliedLocalWarpStrength: clamp(warpStrength, 0, 0.02),
    maximumLocalWarpPx: maximumWarpPx,
    requestedMaximumLocalWarpPx: requestedMaximumWarpPx,
    safeBoundedMaximumLocalWarpPx: maximumWarpPx,
    rejectedWarpExcessPx: Math.max(
      0,
      requestedMaximumWarpPx - maximumWarpPx,
    ),
    nodesExceedingBounds: clamped,
    analyzedNodeCount: nodes.length,
    nodesExceedingBoundsFraction: clamped / nodes.length,
    typographyRisk: typography.distortion,
    clampReasons,
  };
  return {
    status: "READY",
    plan: { ...input.surfacePlan, nodes },
    evidence,
  };
}

export function depthAwareEvidenceFromError(
  error: unknown,
): DepthAwareSurfaceEvidence | null {
  return error instanceof DepthAwareSurfaceUnsafeError
    ? error.evidence
    : null;
}
