import type {
  DepthAwareSurfaceEvidence,
  SurfaceRealismRefinementEvidence,
  SurfaceRealismRefinementSettings,
  TypographyDeformationAnalysis,
} from "@/lib/image/artwork-compositing/types";
import type { PixelRect } from "@/lib/image/artwork-compositing/fabric-aware-v1";
import {
  analyzeTypographyDeformation,
  type ArtworkSurfaceContentAnalysis,
  type MeshNode,
  type SurfaceConformingPlan,
} from "@/lib/image/artwork-compositing/surface-conforming-v1";

export const SURFACE_REALISM_REFINEMENT_OWNER_ERROR =
  "Das Artwork konnte nicht sicher stärker an Perspektive, Stoffrichtung und Shirt-Oberfläche angepasst werden. Es wurde kein Ergebnis zur Freigabe erstellt." as const;

export class SurfaceRealismRefinementUnsafeError extends Error {
  readonly code = "SURFACE_REALISM_REFINEMENT_UNSAFE" as const;

  constructor(readonly evidence: SurfaceRealismRefinementEvidence) {
    super(SURFACE_REALISM_REFINEMENT_OWNER_ERROR);
    this.name = "SurfaceRealismRefinementUnsafeError";
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

function normalizeSamples(values: number[]): {
  values: number[];
  range: number;
} {
  const low = quantile(values, 0.1);
  const high = quantile(values, 0.9);
  const range = Math.max(1, high - low);
  const midpoint = (low + high) / 2;
  return {
    values: values.map((value) => clamp((value - midpoint) / range, -1, 1)),
    range,
  };
}

function pinnedSmooth(input: {
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
        node.displacementX * 0.72 +
        neighbors.reduce((sum, item) => sum + item.displacementX, 0) * 0.07,
      displacementY:
        node.displacementY * 0.72 +
        neighbors.reduce((sum, item) => sum + item.displacementY, 0) * 0.07,
    };
  });
}

function maskCoverage(input: {
  rect: PixelRect;
  imageWidth: number;
  imageHeight: number;
  maskContains: (x: number, y: number) => boolean;
}): number {
  const left = clamp(Math.floor(input.rect.x), 0, input.imageWidth - 1);
  const right = clamp(
    Math.ceil(input.rect.x + input.rect.width),
    left + 1,
    input.imageWidth - 1,
  );
  const top = clamp(Math.floor(input.rect.y), 0, input.imageHeight - 1);
  const bottom = clamp(
    Math.ceil(input.rect.y + input.rect.height),
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
  return total ? inside / total : 0;
}

function refusal(input: {
  settings: SurfaceRealismRefinementSettings;
  reason: Exclude<SurfaceRealismRefinementEvidence["reason"], "READY">;
  realDepthUsed?: boolean;
  localFallbackUsed?: boolean;
  surfaceDirectionEvidenceUsed?: boolean;
  horizontalSurfaceSlope?: number;
  verticalSurfaceSlope?: number;
  planeGuidanceStrength?: number;
  perspectiveGuidanceStrength?: number;
  curvatureEvidence?: number;
  evidenceConfidence?: number;
  localWarpStrength?: number;
  maximumLocalWarpPx?: number;
  typographyRisk?: number;
  maskCoverage?: number;
  clampedNodeFraction?: number;
}): SurfaceRealismRefinementEvidence {
  return {
    contractVersion: input.settings.contractVersion,
    status: "REFUSED",
    reason: input.reason,
    strongerPlaneGuidanceUsed: (input.planeGuidanceStrength ?? 0) > 0.02,
    realDepthUsed: input.realDepthUsed ?? false,
    localFallbackUsed: input.localFallbackUsed ?? false,
    surfaceDirectionEvidenceUsed:
      input.surfaceDirectionEvidenceUsed ?? false,
    footprintPinned: true,
    registeredYPreserved: true,
    secondContainApplied: false,
    secondGlobalScaleApplied: false,
    secondGlobalTranslationApplied: false,
    horizontalSurfaceSlope: clamp(input.horizontalSurfaceSlope ?? 0, -2, 2),
    verticalSurfaceSlope: clamp(input.verticalSurfaceSlope ?? 0, -2, 2),
    planeGuidanceStrength: clamp(input.planeGuidanceStrength ?? 0, 0, 1),
    perspectiveGuidanceStrength: clamp(
      input.perspectiveGuidanceStrength ?? 0,
      0,
      1,
    ),
    curvatureEvidence: clamp(input.curvatureEvidence ?? 0, 0, 1),
    evidenceConfidence: clamp(input.evidenceConfidence ?? 0, 0, 1),
    localWarpStrength: clamp(input.localWarpStrength ?? 0, 0, 0.02),
    maximumLocalWarpPx: Math.max(0, input.maximumLocalWarpPx ?? 0),
    shadingTransferStrength: input.settings.shadingTransferStrength,
    textureTransferStrength: input.settings.textureTransferStrength,
    typographyRisk: clamp(input.typographyRisk ?? 0, 0, 1),
    maskCoverage: clamp(input.maskCoverage ?? 0, 0, 1),
    clampedNodeFraction: clamp(input.clampedNodeFraction ?? 0, 0, 1),
    deterministic: true,
    sourceAuthorityPreserved: true,
    failClosedReason: input.reason,
  };
}

/**
 * Refines only the interior sampling mesh. The complete boundary is pinned and
 * the incoming registered rectangle remains the sole global footprint. A
 * low-frequency depth plane plus detrended local slopes provides deterministic
 * 2.5D shirt-direction guidance; Base luminance is only a bounded cross-check
 * or fallback and never substitutes for placement authority.
 */
export function refineSurfaceRealism(input: {
  pixels: Uint8ClampedArray;
  imageWidth: number;
  imageHeight: number;
  surfacePlan: SurfaceConformingPlan;
  depthEvidence: DepthAwareSurfaceEvidence;
  maskContains: ((x: number, y: number) => boolean) | null;
  settings: SurfaceRealismRefinementSettings;
  maximumCombinedWarpRatio: number;
  artworkContent?: ArtworkSurfaceContentAnalysis;
  realDepth?: {
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
    dynamicRange: number;
  };
}):
  | {
      status: "READY";
      plan: SurfaceConformingPlan;
      evidence: SurfaceRealismRefinementEvidence;
    }
  | { status: "REFUSED"; evidence: SurfaceRealismRefinementEvidence } {
  const { settings, surfacePlan: plan, depthEvidence } = input;
  const rect = plan.rect;
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
  const coverage = maskCoverage({
    rect,
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
    maskContains: input.maskContains,
  });
  if (coverage < 0.985 || depthEvidence.status !== "READY") {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "SURFACE_DIRECTION_EVIDENCE_INSUFFICIENT",
        maskCoverage: coverage,
        realDepthUsed: Boolean(input.realDepth),
        localFallbackUsed: !input.realDepth,
      }),
    };
  }

  const radius = clamp(
    Math.round(Math.min(rect.width, rect.height) * 0.055),
    4,
    22,
  );
  const baseSamples: number[] = [];
  const depthSamples: number[] = [];
  for (let row = 0; row < plan.rows; row += 1) {
    const v = row / (plan.rows - 1);
    for (let column = 0; column < plan.columns; column += 1) {
      const u = column / (plan.columns - 1);
      const x = rect.x + u * rect.width;
      const y = rect.y + v * rect.height;
      baseSamples.push(
        meanPatch({
          pixels: input.pixels,
          width: input.imageWidth,
          height: input.imageHeight,
          x,
          y,
          radius,
        }),
      );
      if (input.realDepth) {
        depthSamples.push(
          meanPatch({
            pixels: input.realDepth.pixels,
            width: input.realDepth.width,
            height: input.realDepth.height,
            x: (x / input.imageWidth) * input.realDepth.width,
            y: (y / input.imageHeight) * input.realDepth.height,
            radius: Math.max(
              2,
              Math.round(
                radius *
                  Math.min(
                    input.realDepth.width / input.imageWidth,
                    input.realDepth.height / input.imageHeight,
                  ),
              ),
            ),
          }),
        );
      }
    }
  }
  const base = normalizeSamples(baseSamples);
  const depth = input.realDepth ? normalizeSamples(depthSamples) : null;
  const realDepthWeight =
    depthEvidence.surfaceGuidanceMode === "NEAR_PLANAR_HYBRID"
      ? 0.58
      : depthEvidence.surfaceGuidanceMode === "HYBRID"
        ? 0.7
        : 0.82;
  const blended = base.values.map((localValue, index) =>
    depth
      ? depth.values[index]! * realDepthWeight +
        localValue * (1 - realDepthWeight)
      : localValue,
  );
  const centerU = (plan.columns - 1) / 2;
  const centerV = (plan.rows - 1) / 2;
  const mean = blended.reduce((sum, value) => sum + value, 0) / blended.length;
  let slopeUNumerator = 0;
  let slopeUDenominator = 0;
  let slopeVNumerator = 0;
  let slopeVDenominator = 0;
  for (let row = 0; row < plan.rows; row += 1) {
    const dv = (row - centerV) / Math.max(1, centerV);
    for (let column = 0; column < plan.columns; column += 1) {
      const du = (column - centerU) / Math.max(1, centerU);
      const value = blended[row * plan.columns + column]! - mean;
      slopeUNumerator += du * value;
      slopeUDenominator += du * du;
      slopeVNumerator += dv * value;
      slopeVDenominator += dv * dv;
    }
  }
  const horizontalSlope = slopeUDenominator
    ? slopeUNumerator / slopeUDenominator
    : 0;
  const verticalSlope = slopeVDenominator
    ? slopeVNumerator / slopeVDenominator
    : 0;
  const residuals = blended.map((value, index) => {
    const row = Math.floor(index / plan.columns);
    const column = index % plan.columns;
    const du = (column - centerU) / Math.max(1, centerU);
    const dv = (row - centerV) / Math.max(1, centerV);
    return value - mean - horizontalSlope * du - verticalSlope * dv;
  });
  const residualRms = Math.sqrt(
    residuals.reduce((sum, value) => sum + value * value, 0) /
      residuals.length,
  );
  const planeGuidanceStrength = clamp(
    Math.abs(depthEvidence.localPlaneTiltDegrees) / 10 * 0.55 +
      Math.abs(verticalSlope) * 0.45,
    0,
    1,
  );
  const perspectiveGuidanceStrength = clamp(
    depthEvidence.localPerspectiveEstimate * 0.5 +
      Math.abs(horizontalSlope) * 0.8,
    0,
    1,
  );
  const curvatureEvidence = clamp(residualRms * 2.4, 0, 1);
  const sourceRangeEvidence = input.realDepth
    ? clamp(input.realDepth.dynamicRange / 0.18, 0, 1)
    : clamp(base.range / 30, 0, 1);
  const evidenceConfidence = clamp(
    coverage * 0.3 +
      depthEvidence.depthConfidence * 0.3 +
      depthEvidence.surfaceConfidence * 0.2 +
      sourceRangeEvidence * 0.2,
    0,
    1,
  );
  if (evidenceConfidence < settings.minimumEvidenceConfidence) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "SURFACE_DIRECTION_EVIDENCE_INSUFFICIENT",
        realDepthUsed: Boolean(input.realDepth),
        localFallbackUsed: !input.realDepth,
        surfaceDirectionEvidenceUsed: sourceRangeEvidence >= 0.12,
        horizontalSurfaceSlope: horizontalSlope,
        verticalSurfaceSlope: verticalSlope,
        planeGuidanceStrength,
        perspectiveGuidanceStrength,
        curvatureEvidence,
        evidenceConfidence,
        maskCoverage: coverage,
      }),
    };
  }
  if (
    Math.abs(horizontalSlope) > 1.15 ||
    Math.abs(verticalSlope) > 1.15 ||
    Math.abs(depthEvidence.localPlaneTiltDegrees) > 12
  ) {
    return {
      status: "REFUSED",
      evidence: refusal({
        settings,
        reason: "UNSAFE_REFINEMENT_REQUIRED",
        realDepthUsed: Boolean(input.realDepth),
        localFallbackUsed: !input.realDepth,
        surfaceDirectionEvidenceUsed: true,
        horizontalSurfaceSlope: horizontalSlope,
        verticalSurfaceSlope: verticalSlope,
        planeGuidanceStrength,
        perspectiveGuidanceStrength,
        curvatureEvidence,
        evidenceConfidence,
        maskCoverage: coverage,
      }),
    };
  }

  const maxAdditionalX = rect.width * settings.maximumAdditionalWarpRatio;
  const maxAdditionalY =
    rect.height * settings.maximumAdditionalWarpRatio * 0.72;
  const maskLean = clamp(
    Math.tan((depthEvidence.localPlaneTiltDegrees * Math.PI) / 180),
    -0.28,
    0.28,
  );
  const additions: MeshNode[] = [];
  let rawClamped = 0;
  const atResidual = (column: number, row: number) =>
    residuals[row * plan.columns + column]!;
  for (let row = 0; row < plan.rows; row += 1) {
    const v = row / (plan.rows - 1);
    for (let column = 0; column < plan.columns; column += 1) {
      const u = column / (plan.columns - 1);
      if (
        row === 0 ||
        row === plan.rows - 1 ||
        column === 0 ||
        column === plan.columns - 1
      ) {
        additions.push({ displacementX: 0, displacementY: 0 });
        continue;
      }
      const envelope = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      const left = atResidual(Math.max(0, column - 1), row);
      const right = atResidual(Math.min(plan.columns - 1, column + 1), row);
      const top = atResidual(column, Math.max(0, row - 1));
      const bottom = atResidual(column, Math.min(plan.rows - 1, row + 1));
      const gradientX = (right - left) / 2;
      const gradientY = (bottom - top) / 2;
      const residual = atResidual(column, row);
      const coherentPlaneX =
        (maskLean * (v - 0.5) * 1.45 + verticalSlope * (v - 0.5)) *
        maxAdditionalX *
        settings.planeOrientationResponse;
      const perspectiveX =
        horizontalSlope *
        (u - 0.5) *
        maxAdditionalX *
        settings.planeOrientationResponse;
      const directionX =
        gradientX *
        maxAdditionalX *
        settings.surfaceDirectionResponse *
        1.4;
      const directionY =
        gradientY *
        maxAdditionalY *
        settings.surfaceDirectionResponse *
        1.2;
      const curvatureX =
        residual *
        (u - 0.5) *
        maxAdditionalX *
        settings.curvatureResponse;
      const curvatureY =
        residual *
        (v - 0.5) *
        maxAdditionalY *
        settings.curvatureResponse;
      const rawX =
        (coherentPlaneX + perspectiveX + directionX + curvatureX) * envelope;
      const rawY = (directionY + curvatureY) * envelope;
      const displacementX = clamp(rawX, -maxAdditionalX, maxAdditionalX);
      const displacementY = clamp(rawY, -maxAdditionalY, maxAdditionalY);
      if (
        Math.abs(displacementX - rawX) > 1e-9 ||
        Math.abs(displacementY - rawY) > 1e-9
      ) {
        rawClamped += 1;
      }
      additions.push({ displacementX, displacementY });
    }
  }
  const smoothedAdditions = pinnedSmooth({
    nodes: additions,
    columns: plan.columns,
    rows: plan.rows,
  });
  const maximumX = rect.width * input.maximumCombinedWarpRatio;
  const maximumY = rect.height * input.maximumCombinedWarpRatio * 0.72;
  let combinedClamped = 0;
  const nodes = plan.nodes.map((node, index) => {
    const addition = smoothedAdditions[index]!;
    const rawX = node.displacementX + addition.displacementX;
    const rawY = node.displacementY + addition.displacementY;
    const displacementX = clamp(rawX, -maximumX, maximumX);
    const displacementY = clamp(rawY, -maximumY, maximumY);
    if (
      Math.abs(displacementX - rawX) > 1e-9 ||
      Math.abs(displacementY - rawY) > 1e-9
    ) {
      combinedClamped += 1;
    }
    return { displacementX, displacementY };
  });
  const clampedNodeFraction =
    (rawClamped + combinedClamped) / Math.max(1, nodes.length * 2);
  const maximumLocalWarpPx = Math.max(
    ...nodes.map((node) => Math.hypot(node.displacementX, node.displacementY)),
  );
  const localWarpStrength =
    maximumLocalWarpPx / Math.min(rect.width, rect.height);
  const typography: {
    distortion: number;
    analysis: TypographyDeformationAnalysis;
  } = analyzeTypographyDeformation({
    nodes,
    columns: plan.columns,
    rows: plan.rows,
    rect,
    ...(input.artworkContent
      ? { artworkContent: input.artworkContent }
      : {}),
  });
  const common = {
    settings,
    realDepthUsed: Boolean(input.realDepth),
    localFallbackUsed: !input.realDepth,
    surfaceDirectionEvidenceUsed: true,
    horizontalSurfaceSlope: horizontalSlope,
    verticalSurfaceSlope: verticalSlope,
    planeGuidanceStrength,
    perspectiveGuidanceStrength,
    curvatureEvidence,
    evidenceConfidence,
    localWarpStrength,
    maximumLocalWarpPx,
    typographyRisk: typography.distortion,
    maskCoverage: coverage,
    clampedNodeFraction,
  };
  if (
    clampedNodeFraction > 0.1 ||
    localWarpStrength > input.maximumCombinedWarpRatio + 1e-9
  ) {
    return {
      status: "REFUSED",
      evidence: refusal({
        ...common,
        reason: "UNSAFE_REFINEMENT_REQUIRED",
      }),
    };
  }
  if (typography.distortion > settings.maximumTypographyDistortion) {
    return {
      status: "REFUSED",
      evidence: refusal({
        ...common,
        reason: "TYPOGRAPHY_DISTORTION_RISK",
      }),
    };
  }
  const evidence: SurfaceRealismRefinementEvidence = {
    contractVersion: settings.contractVersion,
    status: "READY",
    reason: "READY",
    strongerPlaneGuidanceUsed: planeGuidanceStrength > 0.02,
    realDepthUsed: Boolean(input.realDepth),
    localFallbackUsed: !input.realDepth,
    surfaceDirectionEvidenceUsed: true,
    footprintPinned: true,
    registeredYPreserved: true,
    secondContainApplied: false,
    secondGlobalScaleApplied: false,
    secondGlobalTranslationApplied: false,
    horizontalSurfaceSlope: clamp(horizontalSlope, -2, 2),
    verticalSurfaceSlope: clamp(verticalSlope, -2, 2),
    planeGuidanceStrength,
    perspectiveGuidanceStrength,
    curvatureEvidence,
    evidenceConfidence,
    localWarpStrength: clamp(localWarpStrength, 0, 0.02),
    maximumLocalWarpPx,
    shadingTransferStrength: settings.shadingTransferStrength,
    textureTransferStrength: settings.textureTransferStrength,
    typographyRisk: typography.distortion,
    maskCoverage: coverage,
    clampedNodeFraction,
    deterministic: true,
    sourceAuthorityPreserved: true,
    failClosedReason: null,
  };
  return {
    status: "READY",
    plan: { ...plan, nodes },
    evidence,
  };
}

export function surfaceRealismRefinementEvidenceFromError(
  error: unknown,
): SurfaceRealismRefinementEvidence | null {
  return error instanceof SurfaceRealismRefinementUnsafeError
    ? error.evidence
    : null;
}
