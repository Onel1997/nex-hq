import { createHash } from "node:crypto";

import { createCanvas, loadImage } from "canvas";

import { assertPrintSurfaceReady, type NormalizedQuad } from "@/lib/image/print-surface/types";
import {
  pointInsideConvexQuad,
  resolveAspectLockedArtworkPlacement,
} from "@/lib/image/artwork-compositing/aspect-ratio-lock";
import { STRICT_CONTAIN_OWNER_ERROR } from "@/lib/image/artwork-compositing/strict-contain-fit";
import { OWNER_PRINT_FOOTPRINT_ERROR } from "@/lib/image/owner-print-footprint";
import { OWNER_VERTICAL_PLACEMENT_ERROR } from "@/lib/image/owner-vertical-placement";
import { OrientedFrontPrintPlaneUnsafeError } from "@/lib/image/deterministic-runtime/oriented-front-print-plane-v2";
import {
  meanLuminanceForRect,
  resolveFabricAwarePixelAdjustment,
} from "@/lib/image/artwork-compositing/fabric-aware-v1";
import {
  analyzeArtworkSurfaceContent,
  buildSurfaceConformingPlan,
  resolveSurfaceConformingDisplacement,
  SurfaceIntegrationUnsafeError,
  type SurfaceConformingPlan,
} from "@/lib/image/artwork-compositing/surface-conforming-v1";
import {
  applyDepthAwareGuidance,
  buildDepthAwareSurfaceGuidance,
  DepthAwareSurfaceUnsafeError,
} from "@/lib/image/artwork-compositing/depth-aware-surface-v1";
import {
  refineSurfaceRealism,
  SurfaceRealismRefinementUnsafeError,
} from "@/lib/image/artwork-compositing/surface-realism-refinement-v1";
import {
  COMPOSITOR_SAMPLING,
  COMPOSITOR_VERSION_V2,
  COMPOSITOR_VERSION_V3,
  compositingProvenanceSchema,
  deterministicCompositeRequestSchema,
  type DeterministicCompositeRequest,
  type DeterministicCompositeResult,
  type DepthAwareSurfaceEvidence,
  type SurfaceRealismRefinementEvidence,
} from "@/lib/image/artwork-compositing/types";

type Matrix3 = [number, number, number, number, number, number, number, number, number];

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isAxisAlignedRectangleQuad(
  quad: NormalizedQuad,
  epsilon = 1e-9,
): boolean {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad;
  return (
    Math.abs(topLeft.y - topRight.y) <= epsilon &&
    Math.abs(bottomLeft.y - bottomRight.y) <= epsilon &&
    Math.abs(topLeft.x - bottomLeft.x) <= epsilon &&
    Math.abs(topRight.x - bottomRight.x) <= epsilon
  );
}

export function combineOrientedAndLocalTypographyRisk(
  registrationRisk: number,
  localRisk: number,
): number {
  return 1 - (1 - registrationRisk) * (1 - localRisk);
}

export function classifyDepthNormalAgreement(input: {
  depthPlaneSlopeX: number;
  depthConfidence: number;
  normalFacingX: number;
  normalConfidence: number;
}) {
  const normalizedDepthSlopeX = Math.max(
    -1,
    Math.min(1, input.depthPlaneSlopeX),
  );
  const normalizedAgreementDelta = Math.abs(
    normalizedDepthSlopeX - input.normalFacingX,
  );
  const strongContradiction =
    input.normalConfidence >= 0.7 &&
    input.depthConfidence >= 0.7 &&
    Math.abs(normalizedDepthSlopeX) >= 0.2 &&
    Math.abs(input.normalFacingX) >= 0.2 &&
    Math.sign(normalizedDepthSlopeX) !== Math.sign(input.normalFacingX) &&
    normalizedAgreementDelta > 0.65;
  return {
    depthPlaneSlopeX: input.depthPlaneSlopeX,
    normalFacingX: input.normalFacingX,
    normalizedAgreementDelta,
    agreementClass: strongContradiction
      ? ("DEPTH_CONTRADICTORY" as const)
      : normalizedAgreementDelta <= 0.28
        ? ("DEPTH_AGREES" as const)
        : ("DEPTH_MILD_DIFFERENCE" as const),
    // Depth is a downstream cross-check/local residual authority. It never
    // reinterprets the already-frozen owner/global receiving plane.
    globalPlaneReoriented: false as const,
  };
}

export function printRegionPixelSize(quad: NormalizedQuad, outputWidth: number, outputHeight: number): {
  width: number;
  height: number;
} {
  const xs = quad.map((point) => point.x * (outputWidth - 1));
  const ys = quad.map((point) => point.y * (outputHeight - 1));
  return {
    width: Math.max(1, Math.round(Math.max(...xs) - Math.min(...xs)) + 1),
    height: Math.max(1, Math.round(Math.max(...ys) - Math.min(...ys)) + 1),
  };
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    const divisor = augmented[column]![column]!;
    if (Math.abs(divisor) < 1e-12) throw new Error("Print surface transform is degenerate.");
    for (let index = column; index <= size; index += 1) augmented[column]![index]! /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      for (let index = column; index <= size; index += 1) {
        augmented[row]![index]! -= factor * augmented[column]![index]!;
      }
    }
  }
  return augmented.map((row) => row[size]!);
}

function homography(
  source: Array<[number, number]>,
  target: Array<[number, number]>,
): Matrix3 {
  const rows: number[][] = [];
  const values: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const [x, y] = source[index]!;
    const [u, v] = target[index]!;
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  const result = solveLinearSystem(rows, values);
  return [...result, 1] as Matrix3;
}

function invert(matrix: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const determinant = a * A + b * B + c * C;
  if (Math.abs(determinant) < 1e-12) throw new Error("Print surface transform is not invertible.");
  return [
    A / determinant,
    (c * h - b * i) / determinant,
    (b * f - c * e) / determinant,
    B / determinant,
    (a * i - c * g) / determinant,
    (c * d - a * f) / determinant,
    C / determinant,
    (b * g - a * h) / determinant,
    (a * e - b * d) / determinant,
  ];
}

function mapPoint(matrix: Matrix3, x: number, y: number): [number, number] {
  const denominator = matrix[6] * x + matrix[7] * y + matrix[8];
  return [
    (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator,
    (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator,
  ];
}

function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t;
}

/**
 * Deterministic bilinear sample of original source RGBA. This is reconstruction
 * of approved pixels, not generative redrawing: each output channel is a
 * weighted average of at most four neighbouring source pixels.
 */
function sampleBilinear(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const tx = x - x0;
  const ty = y - y0;
  const at = (sx: number, sy: number) => {
    const index = (sy * width + sx) * 4;
    const alpha = pixels[index + 3]! / 255;
    return [
      pixels[index]! * alpha,
      pixels[index + 1]! * alpha,
      pixels[index + 2]! * alpha,
      pixels[index + 3]!,
    ] as const;
  };
  const p00 = at(x0, y0);
  const p10 = at(x1, y0);
  const p01 = at(x0, y1);
  const p11 = at(x1, y1);
  const top = p00.map((channel, index) => lerp(channel, p10[index]!, tx));
  const bottom = p01.map((channel, index) => lerp(channel, p11[index]!, tx));
  const mixed = top.map((channel, index) => lerp(channel, bottom[index]!, ty));
  const alpha = mixed[3]! / 255;
  if (alpha <= 0) return [0, 0, 0, 0];
  return [
    Math.round(mixed[0]! / alpha),
    Math.round(mixed[1]! / alpha),
    Math.round(mixed[2]! / alpha),
    Math.round(mixed[3]!),
  ];
}

/**
 * Deterministically applies approved RGBA pixels to calibrated Product truth.
 * Current v3 first uses the same uniform contain rectangle as v2, then applies
 * only a bounded base-luminance-derived cloth response inside that rectangle.
 * It never invents Artwork pixels. Historical v1/v2 requests keep their frozen
 * perspective-fill/flat-source-over meaning and are never reinterpreted.
 */
export async function compositeApprovedArtwork(
  input: DeterministicCompositeRequest,
  now = new Date().toISOString(),
): Promise<DeterministicCompositeResult> {
  const request = deterministicCompositeRequestSchema.parse(input);
  assertPrintSurfaceReady(request.printSurface);
  if (
    request.compositorVersion !== COMPOSITOR_VERSION_V2 &&
    request.compositorVersion !== COMPOSITOR_VERSION_V3 &&
    request.printSurface.warpMode !== "PERSPECTIVE"
  ) {
    throw new Error(
      "Historical deterministic compositing requires its frozen perspective PrintSurface.",
    );
  }
  // Existing calibrated perspective PrintSurfaces remain valid historical
  // authority. Fresh Product Family jobs freeze the oriented-plane evidence
  // explicitly; absence of that additive field must not reinterpret or reject
  // older non-axis-aligned calibrations.
  if (request.printSurface.clippingMaskReference) {
    throw new Error("The deterministic compositor does not yet support an external clipping-mask raster.");
  }
  if (
    request.printSurface.artworkScale !== 1 ||
    request.printSurface.rotationDegrees !== 0 ||
    Object.values(request.printSurface.safeMargin).some((margin) => margin !== 0)
  ) {
    throw new Error("Scale, rotation, and safe margins must be resolved before deterministic compositing.");
  }
  if (sha256(request.artwork.bytes) !== request.artwork.checksumSha256) {
    throw new Error("Master Artwork checksum mismatch; deterministic composite refused.");
  }
  if (sha256(request.baseImage.bytes) !== request.baseImage.checksumSha256) {
    throw new Error("Base image checksum mismatch; deterministic composite refused.");
  }

  if (
    request.garmentMask &&
    request.garmentMask.sourceBaseChecksumSha256 !==
      request.baseImage.checksumSha256
  ) {
    throw new Error("Garment mask is not bound to this exact Stage-A Base.");
  }
  if (
    request.garmentMask &&
    sha256(request.garmentMask.bytes) !== request.garmentMask.checksumSha256
  ) {
    throw new Error("Garment mask checksum mismatch; compositing refused.");
  }
  if (
    request.depthMap &&
    request.depthMap.sourceBaseChecksumSha256 !==
      request.baseImage.checksumSha256
  ) {
    throw new Error("Depth map is not bound to this exact Stage-A Base.");
  }
  if (
    request.depthMap &&
    sha256(request.depthMap.bytes) !== request.depthMap.checksumSha256
  ) {
    throw new Error("Depth-map checksum mismatch; compositing refused.");
  }

  const [baseImage, artworkImage, garmentMaskImage, depthMapImage] = await Promise.all([
    loadImage(request.baseImage.bytes),
    loadImage(request.artwork.bytes),
    request.garmentMask ? loadImage(request.garmentMask.bytes) : null,
    request.depthMap ? loadImage(request.depthMap.bytes) : null,
  ]);
  if (artworkImage.width < 1 || artworkImage.height < 1) {
    throw new Error("Master Artwork decoded with invalid dimensions.");
  }
  const canvas = createCanvas(baseImage.width, baseImage.height);
  const context = canvas.getContext("2d");
  context.drawImage(baseImage, 0, 0);
  const basePixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const frozenBasePixels = new Uint8ClampedArray(basePixels.data);
  let garmentMaskPixels: Uint8ClampedArray | null = null;
  if (request.garmentMask && garmentMaskImage) {
    if (
      request.garmentMask.width !== baseImage.width ||
      request.garmentMask.height !== baseImage.height ||
      garmentMaskImage.width !== baseImage.width ||
      garmentMaskImage.height !== baseImage.height
    ) {
      throw new Error(
        "Garment mask dimensions must exactly match the Stage-A Base.",
      );
    }
    const maskCanvas = createCanvas(baseImage.width, baseImage.height);
    const maskContext = maskCanvas.getContext("2d");
    maskContext.drawImage(garmentMaskImage, 0, 0);
    garmentMaskPixels = maskContext.getImageData(
      0,
      0,
      baseImage.width,
      baseImage.height,
    ).data;
  }
  let depthMapPixels: Uint8ClampedArray | null = null;
  if (request.depthMap && depthMapImage) {
    if (
      request.depthMap.width !== baseImage.width ||
      request.depthMap.height !== baseImage.height ||
      depthMapImage.width !== baseImage.width ||
      depthMapImage.height !== baseImage.height
    ) {
      throw new Error("Depth-map dimensions must exactly match the Stage-A Base.");
    }
    const depthCanvas = createCanvas(baseImage.width, baseImage.height);
    const depthContext = depthCanvas.getContext("2d");
    depthContext.drawImage(depthMapImage, 0, 0);
    depthMapPixels = depthContext.getImageData(
      0,
      0,
      baseImage.width,
      baseImage.height,
    ).data;
  }

  const artworkCanvas = createCanvas(artworkImage.width, artworkImage.height);
  const artworkContext = artworkCanvas.getContext("2d");
  artworkContext.drawImage(artworkImage, 0, 0, artworkImage.width, artworkImage.height);
  if (artworkCanvas.width !== artworkImage.width || artworkCanvas.height !== artworkImage.height) {
    throw new Error("Stage B refused to downsample the canonical Master Artwork raster.");
  }
  const artworkPixels = artworkContext.getImageData(0, 0, artworkCanvas.width, artworkCanvas.height);

  const source: Array<[number, number]> = [
    [0, 0],
    [artworkCanvas.width - 1, 0],
    [artworkCanvas.width - 1, artworkCanvas.height - 1],
    [0, artworkCanvas.height - 1],
  ];
  const surfaceTarget: Array<[number, number]> = request.printSurface.quad.map((point) => [
    point.x * (canvas.width - 1),
    point.y * (canvas.height - 1),
  ]) as Array<[number, number]>;
  const lockedPlacement =
    request.compositorVersion === COMPOSITOR_VERSION_V2 ||
    request.compositorVersion === COMPOSITOR_VERSION_V3
      ? resolveAspectLockedArtworkPlacement({
          sourceWidth: artworkCanvas.width,
          sourceHeight: artworkCanvas.height,
          surfaceQuad: request.printSurface.quad,
          outputWidth: canvas.width,
          outputHeight: canvas.height,
          ...(request.artworkContainPlacement
            ? {
                ownerPlacement: {
                  uniformScale:
                    request.artworkContainPlacement.uniformScale,
                  offsetX: request.artworkContainPlacement.offsetX,
                  offsetY: request.artworkContainPlacement.offsetY,
                },
              }
            : {}),
          ...(request.orientedFrontPrintPlane
            ? {
                orientedLogicalBounds:
                  request.orientedFrontPrintPlane
                    .requestedAxisAlignedBounds,
              }
            : {}),
        })
      : null;
  const target: Array<[number, number]> = lockedPlacement
    ? lockedPlacement.quad.map((point) => [point.x, point.y])
    : surfaceTarget;
  const transform = lockedPlacement
    ? lockedPlacement.oriented
      ? homography(source, target)
      : lockedPlacement.transformMatrix
    : homography(source, target);
  const inverse = !lockedPlacement || lockedPlacement.oriented
    ? invert(transform)
    : null;
  const minX = Math.max(0, Math.floor(Math.min(...target.map(([x]) => x))));
  const maxX = Math.min(canvas.width - 1, Math.ceil(Math.max(...target.map(([x]) => x))));
  const minY = Math.max(0, Math.floor(Math.min(...target.map(([, y]) => y))));
  const maxY = Math.min(canvas.height - 1, Math.ceil(Math.max(...target.map(([, y]) => y))));
  const printRegion = printRegionPixelSize(request.printSurface.quad, canvas.width, canvas.height);
  const fabricSettings =
    request.compositorVersion === COMPOSITOR_VERSION_V3
      ? request.fabricIntegration!
      : null;
  const fabricRegionMean =
    fabricSettings && lockedPlacement
      ? meanLuminanceForRect({
          pixels: frozenBasePixels,
          imageWidth: canvas.width,
          imageHeight: canvas.height,
          rect: lockedPlacement.rect,
          ...(lockedPlacement.oriented
            ? {
                contains: (x: number, y: number) =>
                  pointInsideConvexQuad(
                    { x, y },
                    lockedPlacement.quad,
                  ),
              }
            : {}),
        })
      : 127.5;
  let maximumAppliedDisplacementPx = 0;
  let minimumAppliedShading = Number.POSITIVE_INFINITY;
  let maximumAppliedShading = 0;
  let appliedRectMaskCoverage = 1;
  let clippedOutputPixelCount = 0;
  const maskContains = (x: number, y: number) => {
    if (!garmentMaskPixels) return true;
    const offset = (y * canvas.width + x) * 4;
    const luminance =
      garmentMaskPixels[offset]! * 0.2126 +
      garmentMaskPixels[offset + 1]! * 0.7152 +
      garmentMaskPixels[offset + 2]! * 0.0722;
    return garmentMaskPixels[offset + 3]! >= 128 && luminance >= 128;
  };
  if (garmentMaskPixels && lockedPlacement) {
    let inside = 0;
    let total = 0;
    const left = Math.max(0, Math.floor(lockedPlacement.rect.x));
    const right = Math.min(
      canvas.width - 1,
      Math.ceil(lockedPlacement.rect.x + lockedPlacement.rect.width),
    );
    const top = Math.max(0, Math.floor(lockedPlacement.rect.y));
    const bottom = Math.min(
      canvas.height - 1,
      Math.ceil(lockedPlacement.rect.y + lockedPlacement.rect.height),
    );
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        if (lockedPlacement.oriented) {
          const [mappedX, mappedY] = mapPoint(inverse!, x + 0.5, y + 0.5);
          if (
            mappedX < 0 ||
            mappedY < 0 ||
            mappedX > artworkCanvas.width - 1 ||
            mappedY > artworkCanvas.height - 1
          ) {
            continue;
          }
        }
        total += 1;
        if (maskContains(x, y)) inside += 1;
      }
    }
    appliedRectMaskCoverage = total > 0 ? inside / total : 0;
    if (appliedRectMaskCoverage < 0.985) {
      throw new Error(
        "Garment-mask clipping would materially destroy the selected print intent.",
      );
    }
  }
  let surfaceConformingPlan: SurfaceConformingPlan | null = null;
  let depthAwareIntegration: DepthAwareSurfaceEvidence | null = null;
  let surfaceRealismRefinementEvidence:
    | SurfaceRealismRefinementEvidence
    | null = null;
  if (fabricSettings?.surfaceConforming && lockedPlacement) {
    const artworkContent = analyzeArtworkSurfaceContent({
      pixels: artworkPixels.data,
      width: artworkCanvas.width,
      height: artworkCanvas.height,
      columns: fabricSettings.surfaceConforming.gridColumns,
      rows: fabricSettings.surfaceConforming.gridRows,
    });
    const surface = buildSurfaceConformingPlan({
      pixels: frozenBasePixels,
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      artworkRect: lockedPlacement.rect,
      maskContains: garmentMaskPixels ? maskContains : null,
      settings: fabricSettings.surfaceConforming,
      artworkContent,
    });
    if (surface.status === "REFUSED") {
      throw new SurfaceIntegrationUnsafeError(surface.evidence);
    }
    surfaceConformingPlan = surface.plan;
    if (fabricSettings.depthAware) {
      const guidance = buildDepthAwareSurfaceGuidance({
        pixels: frozenBasePixels,
        imageWidth: canvas.width,
        imageHeight: canvas.height,
        artworkRect: lockedPlacement.rect,
        ...((request.ownerPrintFootprint?.garmentBodyBounds ??
        request.ownerVerticalPlacement?.garmentBodyBounds)
          ? {
              garmentAnalysisRect: {
                x:
                  (request.ownerPrintFootprint?.garmentBodyBounds.x ??
                    request.ownerVerticalPlacement!.garmentBodyBounds.x) *
                  (canvas.width - 1),
                y:
                  (request.ownerPrintFootprint?.garmentBodyBounds.y ??
                    request.ownerVerticalPlacement!.garmentBodyBounds.y) *
                  (canvas.height - 1),
                width:
                  (request.ownerPrintFootprint?.garmentBodyBounds.width ??
                    request.ownerVerticalPlacement!.garmentBodyBounds.width) *
                  (canvas.width - 1),
                height:
                  (request.ownerPrintFootprint?.garmentBodyBounds.height ??
                    request.ownerVerticalPlacement!.garmentBodyBounds.height) *
                  (canvas.height - 1),
              },
            }
          : {}),
        maskContains: garmentMaskPixels ? maskContains : null,
        settings: fabricSettings.depthAware,
        ...(request.depthMap && depthMapPixels
          ? {
              realDepth: {
                pixels: depthMapPixels,
                width: request.depthMap.width,
                height: request.depthMap.height,
                provider: request.depthMap.provider,
                model: request.depthMap.model,
                adapterVersion: request.depthMap.adapterVersion,
                depthMapChecksumSha256: request.depthMap.checksumSha256,
                sourceBaseChecksumSha256:
                  request.depthMap.sourceBaseChecksumSha256,
                dynamicRange: request.depthMap.dynamicRange,
                discontinuityFraction:
                  request.depthMap.discontinuityFraction,
                minimumDynamicRange:
                  request.depthMap.minimumDynamicRange,
                maximumDiscontinuityFraction:
                  request.depthMap.maximumDiscontinuityFraction,
              },
            }
          : {}),
      });
      if (guidance.status === "REFUSED") {
        throw new DepthAwareSurfaceUnsafeError(guidance.evidence);
      }
      const combined = applyDepthAwareGuidance({
        surfacePlan: surfaceConformingPlan,
        guidance: guidance.guidance,
        settings: fabricSettings.depthAware,
        maximumCombinedWarpRatio: fabricSettings.maxDisplacementRatio,
        artworkContent,
      });
      if (combined.status === "REFUSED") {
        throw new DepthAwareSurfaceUnsafeError(combined.evidence);
      }
      surfaceConformingPlan = combined.plan;
      depthAwareIntegration = combined.evidence;
    }
    if (fabricSettings.surfaceRealismRefinement) {
      if (!depthAwareIntegration) {
        throw new SurfaceRealismRefinementUnsafeError({
          contractVersion:
            fabricSettings.surfaceRealismRefinement.contractVersion,
          status: "REFUSED",
          reason: "SURFACE_DIRECTION_EVIDENCE_INSUFFICIENT",
          strongerPlaneGuidanceUsed: false,
          realDepthUsed: false,
          localFallbackUsed: false,
          surfaceDirectionEvidenceUsed: false,
          footprintPinned: true,
          registeredYPreserved: true,
          secondContainApplied: false,
          secondGlobalScaleApplied: false,
          secondGlobalTranslationApplied: false,
          horizontalSurfaceSlope: 0,
          verticalSurfaceSlope: 0,
          planeGuidanceStrength: 0,
          perspectiveGuidanceStrength: 0,
          curvatureEvidence: 0,
          evidenceConfidence: 0,
          localWarpStrength: 0,
          maximumLocalWarpPx: 0,
          shadingTransferStrength:
            fabricSettings.surfaceRealismRefinement.shadingTransferStrength,
          textureTransferStrength:
            fabricSettings.surfaceRealismRefinement.textureTransferStrength,
          typographyRisk: 0,
          maskCoverage: appliedRectMaskCoverage,
          clampedNodeFraction: 0,
          deterministic: true,
          sourceAuthorityPreserved: true,
          failClosedReason: "SURFACE_DIRECTION_EVIDENCE_INSUFFICIENT",
        });
      }
      const refined = refineSurfaceRealism({
        pixels: frozenBasePixels,
        imageWidth: canvas.width,
        imageHeight: canvas.height,
        surfacePlan: surfaceConformingPlan,
        depthEvidence: depthAwareIntegration,
        maskContains: garmentMaskPixels ? maskContains : null,
        settings: fabricSettings.surfaceRealismRefinement,
        maximumCombinedWarpRatio: fabricSettings.maxDisplacementRatio,
        artworkContent,
        ...(request.depthMap && depthMapPixels
          ? {
              realDepth: {
                pixels: depthMapPixels,
                width: request.depthMap.width,
                height: request.depthMap.height,
                dynamicRange: request.depthMap.dynamicRange,
              },
            }
          : {}),
      });
      if (refined.status === "REFUSED") {
        throw new SurfaceRealismRefinementUnsafeError(refined.evidence);
      }
      surfaceConformingPlan = refined.plan;
      surfaceRealismRefinementEvidence = refined.evidence;
    }
  }
  const orientedFrontPrintPlane = request.orientedFrontPrintPlane
    ? (() => {
        const localTypographyRisk = Math.max(
          surfaceConformingPlan?.evidence.typographyDistortionEstimate ?? 0,
          depthAwareIntegration?.typographyRisk ?? 0,
          surfaceRealismRefinementEvidence?.typographyRisk ?? 0,
        );
        // Composition of the mild projective plane and the bounded local mesh:
        // this conservative union measures the full transform instead of
        // validating both layers independently.
        const combinedTypographyRisk = combineOrientedAndLocalTypographyRisk(
          request.orientedFrontPrintPlane.registrationTypographyRisk,
          localTypographyRisk,
        );
        const limit =
          fabricSettings?.surfaceConforming?.maximumTypographyDistortion ??
          0.075;
        const normal = request.orientedFrontPrintPlane.normalAssistance;
        const depthSlopeX = depthAwareIntegration?.normalizedDepthPlaneSlopeX;
        const depthNormalCrossCheck = normal && depthSlopeX !== undefined
          ? classifyDepthNormalAgreement({
              depthPlaneSlopeX: depthSlopeX,
              depthConfidence: depthAwareIntegration?.depthConfidence ?? 0,
              normalFacingX: normal.normalEvidence.medianNormal.x,
              normalConfidence: normal.normalConfidence,
            })
          : undefined;
        if (depthNormalCrossCheck?.agreementClass === "DEPTH_CONTRADICTORY") {
          throw new OrientedFrontPrintPlaneUnsafeError({
            ...request.orientedFrontPrintPlane,
            status: "REFUSED",
            reason: "DEPTH_NORMAL_CONTRADICTORY",
            finalCombinedTypographyRisk: combinedTypographyRisk,
            depthNormalCrossCheck,
            failureReason: "DEPTH_NORMAL_CONTRADICTORY",
          });
        }
        if (combinedTypographyRisk > limit + 1e-9) {
          throw new OrientedFrontPrintPlaneUnsafeError({
            ...request.orientedFrontPrintPlane,
            status: "REFUSED",
            reason: "ORIENTED_PLANE_TYPOGRAPHY_UNSAFE",
            finalCombinedTypographyRisk: combinedTypographyRisk,
            failureReason: "ORIENTED_PLANE_TYPOGRAPHY_UNSAFE",
          });
        }
        return {
          ...request.orientedFrontPrintPlane,
          finalCombinedTypographyRisk: combinedTypographyRisk,
          ...(depthNormalCrossCheck ? { depthNormalCrossCheck } : {}),
        };
      })()
    : null;
  const appliedQuadWidth = lockedPlacement
    ? (
        Math.hypot(
          lockedPlacement.quad[1].x - lockedPlacement.quad[0].x,
          lockedPlacement.quad[1].y - lockedPlacement.quad[0].y,
        ) +
        Math.hypot(
          lockedPlacement.quad[2].x - lockedPlacement.quad[3].x,
          lockedPlacement.quad[2].y - lockedPlacement.quad[3].y,
        )
      ) / 2
    : 0;
  const appliedQuadHeight = lockedPlacement
    ? (
        Math.hypot(
          lockedPlacement.quad[3].x - lockedPlacement.quad[0].x,
          lockedPlacement.quad[3].y - lockedPlacement.quad[0].y,
        ) +
        Math.hypot(
          lockedPlacement.quad[2].x - lockedPlacement.quad[1].x,
          lockedPlacement.quad[2].y - lockedPlacement.quad[1].y,
        )
      ) / 2
    : 0;
  const appliedQuadCenter = lockedPlacement
    ? lockedPlacement.quad.reduce(
        (center, point) => ({
          x: center.x + point.x / 4,
          y: center.y + point.y / 4,
        }),
        { x: 0, y: 0 },
      )
    : null;
  const ownerPrintFootprint =
    request.ownerPrintFootprint && lockedPlacement
      ? (() => {
          if (
            request.artworkContainPlacement?.uniformScale !== 1 ||
            request.artworkContainPlacement.offsetX !== 0 ||
            request.artworkContainPlacement.offsetY !== 0
          ) {
            throw new Error(OWNER_PRINT_FOOTPRINT_ERROR);
          }
          const bodyWidth =
            request.ownerPrintFootprint.garmentBodyBounds.width *
            (canvas.width - 1);
          const bodyHeight =
            request.ownerPrintFootprint.garmentBodyBounds.height *
            (canvas.height - 1);
          const finalWidthRatio = appliedQuadWidth / bodyWidth;
          const finalHeightRatio = appliedQuadHeight / bodyHeight;
          const widthRetention =
            finalWidthRatio / request.ownerPrintFootprint.requestedWidthRatio;
          const heightRetention =
            finalHeightRatio /
            request.ownerPrintFootprint.requestedHeightRatio;
          const measuredFootprintShrink = Math.max(
            0,
            1 - Math.min(widthRetention, heightRetention),
          );
          const totalFootprintShrink =
            measuredFootprintShrink <= 1e-12
              ? 0
              : measuredFootprintShrink;
          const footprintPreserved =
            totalFootprintShrink <=
              request.ownerPrintFootprint.contract
                .maximumLinearSafetyDeviation &&
            Math.abs(
              request.ownerPrintFootprint.registrationScaleDelta,
            ) <=
              request.ownerPrintFootprint.contract
                .maximumLinearSafetyDeviation;
          if (!footprintPreserved) {
            throw new Error(OWNER_PRINT_FOOTPRINT_ERROR);
          }
          return {
            contractVersion:
              request.ownerPrintFootprint.contract.contractVersion,
            placementPreset: "FRONT_LARGE" as const,
            ownerScale:
              request.ownerPrintFootprint.contract.ownerPlacement.uniformScale,
            ownerOffsetX:
              request.ownerPrintFootprint.contract.ownerPlacement.offsetX,
            ownerOffsetY:
              request.ownerPrintFootprint.contract.ownerPlacement.offsetY,
            marketPrintPrintableArea:
              request.ownerPrintFootprint.contract.marketPrintPrintableArea,
            initialContainedArtworkRectangle:
              request.ownerPrintFootprint.contract
                .initialContainedArtworkRectangle,
            requestedGarmentWidthRatio:
              request.ownerPrintFootprint.requestedWidthRatio,
            requestedGarmentHeightRatio:
              request.ownerPrintFootprint.requestedHeightRatio,
            registeredGarmentWidthRatio:
              request.ownerPrintFootprint.registeredWidthRatio,
            registeredGarmentHeightRatio:
              request.ownerPrintFootprint.registeredHeightRatio,
            registrationScaleDelta:
              request.ownerPrintFootprint.registrationScaleDelta,
            preSurfaceFootprint: lockedPlacement.rect,
            // Surface-Conforming V1 fixes every boundary mesh node at zero;
            // it changes interior sampling, never the global owner footprint.
            postSurfaceFootprint: lockedPlacement.rect,
            surfaceAverageAreaChange: 0,
            surfaceWidthChange: 0,
            surfaceHeightChange: 0,
            finalGarmentWidthRatio: finalWidthRatio,
            finalGarmentHeightRatio: finalHeightRatio,
            totalFootprintShrink,
            footprintPreserved: true,
            containApplicationCount: 1 as const,
            safetyClampReasons:
              request.ownerPrintFootprint.registrationClampReasons,
            failureStage: null,
          };
        })()
      : null;
  const ownerVerticalPlacement =
    request.ownerVerticalPlacement && lockedPlacement
      ? (() => {
          const body = request.ownerVerticalPlacement.garmentBodyBounds;
          const bodyTop = body.y * (canvas.height - 1);
          const bodyHeight = body.height * (canvas.height - 1);
          const finalY =
            ((appliedQuadCenter?.y ??
              lockedPlacement.rect.y + lockedPlacement.rect.height / 2) -
              bodyTop) /
            bodyHeight;
          if (
            Math.abs(finalY - request.ownerVerticalPlacement.registeredY) >
            1e-6
          ) {
            throw new Error(OWNER_VERTICAL_PLACEMENT_ERROR);
          }
          const contract = request.ownerVerticalPlacement.contract;
          const clampDelta = request.ownerVerticalPlacement.clampDelta;
          return {
            contractVersion: contract.contractVersion,
            placementPreset: contract.placementPreset,
            ownerYRequested: contract.ownerOffsetY,
            previewY: contract.previewCenterY,
            requestedRegisteredY: contract.expectedFinalFootprint.centerY,
            registeredY: request.ownerVerticalPlacement.registeredY,
            finalY,
            yPreserved: Math.abs(clampDelta) <= 1e-9,
            withinSafetyTolerance:
              Math.abs(clampDelta) <=
              contract.maximumVerticalClampRatio + 1e-9,
            clampApplied: Math.abs(clampDelta) > 1e-9,
            clampDelta,
            clampReason: request.ownerVerticalPlacement.clampReason,
            footprintPreserved: true,
            secondContainApplied: false,
            secondGlobalScaleApplied: false,
            secondGlobalTranslationApplied: false,
          };
        })()
      : null;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let sourceX: number;
      let sourceY: number;
      let physicalShading = 1;
      let physicalInkOpacity = 1;
      if (lockedPlacement) {
        const pixelCenterX = x + 0.5;
        const pixelCenterY = y + 0.5;
        if (lockedPlacement.oriented) {
          [sourceX, sourceY] = mapPoint(
            inverse!,
            pixelCenterX,
            pixelCenterY,
          );
          if (
            sourceX < 0 ||
            sourceY < 0 ||
            sourceX > artworkCanvas.width - 1 ||
            sourceY > artworkCanvas.height - 1
          ) continue;
        } else {
          if (
            pixelCenterX < lockedPlacement.rect.x ||
            pixelCenterX > lockedPlacement.rect.x + lockedPlacement.rect.width ||
            pixelCenterY < lockedPlacement.rect.y ||
            pixelCenterY > lockedPlacement.rect.y + lockedPlacement.rect.height
          ) continue;
          sourceX = Math.max(
            0,
            Math.min(
              artworkCanvas.width - 1,
              ((pixelCenterX - lockedPlacement.rect.x) /
                lockedPlacement.rect.width) *
                artworkCanvas.width -
                0.5,
            ),
          );
          sourceY = Math.max(
            0,
            Math.min(
              artworkCanvas.height - 1,
              ((pixelCenterY - lockedPlacement.rect.y) /
                lockedPlacement.rect.height) *
                artworkCanvas.height -
                0.5,
            ),
          );
        }
        if (fabricSettings) {
          const adjustment = resolveFabricAwarePixelAdjustment({
            pixels: frozenBasePixels,
            imageWidth: canvas.width,
            imageHeight: canvas.height,
            artworkRect: lockedPlacement.rect,
            regionMeanLuminance: fabricRegionMean,
            x,
            y,
            ...(lockedPlacement.oriented
              ? {
                  boundaryU:
                    sourceX / Math.max(1, artworkCanvas.width - 1),
                  boundaryV:
                    sourceY / Math.max(1, artworkCanvas.height - 1),
                }
              : {}),
            settings: fabricSettings,
          });
          const surfaceAdjustment = surfaceConformingPlan
            ? resolveSurfaceConformingDisplacement({
                plan: surfaceConformingPlan,
                x: lockedPlacement.oriented
                  ? surfaceConformingPlan.rect.x +
                    (sourceX / Math.max(1, artworkCanvas.width - 1)) *
                      surfaceConformingPlan.rect.width -
                    0.5
                  : x,
                y: lockedPlacement.oriented
                  ? surfaceConformingPlan.rect.y +
                    (sourceY / Math.max(1, artworkCanvas.height - 1)) *
                      surfaceConformingPlan.rect.height -
                    0.5
                  : y,
              })
            : { displacementX: 0, displacementY: 0 };
          const maximumX =
            lockedPlacement.rect.width *
            fabricSettings.maxDisplacementRatio;
          const maximumY =
            lockedPlacement.rect.height *
            fabricSettings.maxDisplacementRatio *
            0.65;
          const combinedDisplacementX = Math.max(
            -maximumX,
            Math.min(
              maximumX,
              adjustment.displacementX + surfaceAdjustment.displacementX,
            ),
          );
          const combinedDisplacementY = Math.max(
            -maximumY,
            Math.min(
              maximumY,
              adjustment.displacementY + surfaceAdjustment.displacementY,
            ),
          );
          if (lockedPlacement.oriented) {
            [sourceX, sourceY] = mapPoint(
              inverse!,
              pixelCenterX - combinedDisplacementX,
              pixelCenterY - combinedDisplacementY,
            );
          } else {
            sourceX = Math.max(
              0,
              Math.min(
                artworkCanvas.width - 1,
                sourceX -
                  (combinedDisplacementX / lockedPlacement.rect.width) *
                    artworkCanvas.width,
              ),
            );
            sourceY = Math.max(
              0,
              Math.min(
                artworkCanvas.height - 1,
                sourceY -
                  (combinedDisplacementY / lockedPlacement.rect.height) *
                    artworkCanvas.height,
              ),
            );
          }
          physicalShading = adjustment.shading;
          physicalInkOpacity = adjustment.inkOpacity;
          maximumAppliedDisplacementPx = Math.max(
            maximumAppliedDisplacementPx,
            Math.hypot(
              combinedDisplacementX,
              combinedDisplacementY,
            ),
          );
          minimumAppliedShading = Math.min(
            minimumAppliedShading,
            physicalShading,
          );
          maximumAppliedShading = Math.max(
            maximumAppliedShading,
            physicalShading,
          );
        }
      } else {
        [sourceX, sourceY] = mapPoint(inverse!, x, y);
      }
      if (sourceX < 0 || sourceY < 0 || sourceX > artworkCanvas.width - 1 || sourceY > artworkCanvas.height - 1) continue;
      const [sourceRed, sourceGreen, sourceBlue, sourceAlphaByte] = sampleBilinear(
        artworkPixels.data,
        artworkCanvas.width,
        artworkCanvas.height,
        sourceX,
        sourceY,
      );
      const sourceAlpha = (sourceAlphaByte / 255) * physicalInkOpacity;
      if (sourceAlpha === 0) continue;
      if (!maskContains(x, y)) {
        clippedOutputPixelCount += 1;
        continue;
      }
      const destinationIndex = (y * canvas.width + x) * 4;
      const destinationAlpha = basePixels.data[destinationIndex + 3]! / 255;
      const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
      const sourceChannels = [sourceRed, sourceGreen, sourceBlue];
      for (let channel = 0; channel < 3; channel += 1) {
        const sourceColor =
          sourceChannels[channel]! * request.shadingFactor * physicalShading;
        const destinationColor = basePixels.data[destinationIndex + channel]!;
        basePixels.data[destinationIndex + channel] = Math.round(
          (sourceColor * sourceAlpha + destinationColor * destinationAlpha * (1 - sourceAlpha)) / outputAlpha,
        );
      }
      basePixels.data[destinationIndex + 3] = Math.round(outputAlpha * 255);
    }
  }
  if (clippedOutputPixelCount > 0) {
    throw new Error(STRICT_CONTAIN_OWNER_ERROR);
  }
  context.putImageData(basePixels, 0, 0);
  const pngBytes = canvas.toBuffer("image/png");
  const outputChecksumSha256 = sha256(pngBytes);
  const provenance = compositingProvenanceSchema.parse({
    contractVersion: "compositing-provenance-v1",
    compositorVersion: request.compositorVersion,
    masterArtworkId: request.artwork.id,
    masterArtworkVersion: request.artwork.version,
    masterArtworkChecksumSha256: request.artwork.checksumSha256,
    baseImageId: request.baseImage.id,
    baseImageChecksumSha256: request.baseImage.checksumSha256,
    printSurfaceId: request.printSurface.printSurfaceId,
    targetPrintRegion: request.printSurface.region,
    transformMatrix: transform,
    blendingStrategy: fabricSettings
      ? "FABRIC_AWARE_PRINT_V1"
      : request.shadingFactor === 1
        ? "SOURCE_OVER"
        : "SOURCE_OVER_WITH_UNIFORM_SHADING",
    shadingFactor: request.shadingFactor,
    samplingStrategy: COMPOSITOR_SAMPLING,
    sourceWidth: artworkImage.width,
    sourceHeight: artworkImage.height,
    outputWidth: canvas.width,
    outputHeight: canvas.height,
    printRegionWidth: printRegion.width,
    printRegionHeight: printRegion.height,
    outputChecksumSha256,
    createdAt: now,
    ...(lockedPlacement
      ? {
          artworkPlacementMode: "CONTAIN_UNIFORM_ASPECT_LOCKED",
          sourceAspectRatio: lockedPlacement.sourceAspectRatio,
          effectiveUniformScale: lockedPlacement.effectiveUniformScale,
          appliedArtworkRect: lockedPlacement.rect,
          containFit: lockedPlacement.containFit,
          ...(ownerPrintFootprint ? { ownerPrintFootprint } : {}),
          ...(ownerVerticalPlacement ? { ownerVerticalPlacement } : {}),
          ...(orientedFrontPrintPlane ? { orientedFrontPrintPlane } : {}),
          ...(fabricSettings
            ? {
                fabricIntegration: {
                  ...fabricSettings,
                  maxAppliedDisplacementPx:
                    maximumAppliedDisplacementPx,
                  minimumAppliedShading: Number.isFinite(
                    minimumAppliedShading,
                  )
                    ? minimumAppliedShading
                    : 1,
                  maximumAppliedShading: maximumAppliedShading || 1,
                  sourceAuthorityPreserved: true,
                  ...(surfaceConformingPlan
                    ? {
                        surfaceIntegration:
                          surfaceConformingPlan.evidence,
                      }
                    : {}),
                  ...(depthAwareIntegration
                    ? { depthAwareIntegration }
                    : {}),
                  ...(surfaceRealismRefinementEvidence
                    ? { surfaceRealismRefinementEvidence }
                    : {}),
                },
              }
            : {}),
        }
      : {
          artworkPlacementMode: "LEGACY_PERSPECTIVE_FILL",
        }),
    ...(request.garmentMask
      ? {
          garmentMaskClipping: {
            contractVersion: "garment-mask-clipping-v1",
            maskChecksumSha256: request.garmentMask.checksumSha256,
            sourceBaseChecksumSha256:
              request.garmentMask.sourceBaseChecksumSha256,
            maskWidth: request.garmentMask.width,
            maskHeight: request.garmentMask.height,
            appliedRectMaskCoverage,
            clippedOutputPixelCount,
            everyAppliedPixelInsideMask: true,
          },
        }
      : {}),
  });
  return { pngBytes, outputChecksumSha256, provenance };
}
