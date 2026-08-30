import type { NormalizedQuad } from "@/lib/image/print-surface/types";
import {
  resolveStrictContainFit,
  STRICT_CONTAIN_FIT_VERSION,
  type StrictContainFitDiagnostics,
  type StrictContainOwnerPlacement,
} from "@/lib/image/artwork-compositing/strict-contain-fit";

export type PixelPoint = { x: number; y: number };

export type AspectLockedArtworkPlacement = {
  sourceAspectRatio: number;
  effectiveUniformScale: number;
  rect: { x: number; y: number; width: number; height: number };
  quad: [PixelPoint, PixelPoint, PixelPoint, PixelPoint];
  transformMatrix: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  containFit: StrictContainFitDiagnostics;
  oriented: boolean;
  logicalRect: { x: number; y: number; width: number; height: number };
};

function cross(a: PixelPoint, b: PixelPoint, point: PixelPoint): number {
  return (b.x - a.x) * (point.y - a.y) -
    (b.y - a.y) * (point.x - a.x);
}

/** Convex-polygon containment with either clockwise or counter-clockwise input. */
export function pointInsideConvexQuad(
  point: PixelPoint,
  quad: readonly PixelPoint[],
  epsilon = 1e-7,
): boolean {
  let positive = false;
  let negative = false;
  for (let index = 0; index < quad.length; index += 1) {
    const value = cross(quad[index]!, quad[(index + 1) % quad.length]!, point);
    if (value > epsilon) positive = true;
    if (value < -epsilon) negative = true;
    if (positive && negative) return false;
  }
  return true;
}

function rectQuad(input: {
  center: PixelPoint;
  width: number;
  height: number;
}): [PixelPoint, PixelPoint, PixelPoint, PixelPoint] {
  const halfWidth = input.width / 2;
  const halfHeight = input.height / 2;
  return [
    { x: input.center.x - halfWidth, y: input.center.y - halfHeight },
    { x: input.center.x + halfWidth, y: input.center.y - halfHeight },
    { x: input.center.x + halfWidth, y: input.center.y + halfHeight },
    { x: input.center.x - halfWidth, y: input.center.y + halfHeight },
  ];
}

/**
 * Resolve the largest centred, axis-aligned copy of the source rectangle that
 * fits inside the calibrated Product PrintSurface. Width and height always use
 * the same scale factor. The function never stretches, squashes, rotates, or
 * projectively warps the approved Artwork.
 */
export function resolveAspectLockedArtworkPlacement(input: {
  sourceWidth: number;
  sourceHeight: number;
  surfaceQuad: NormalizedQuad;
  outputWidth: number;
  outputHeight: number;
  ownerPlacement?: StrictContainOwnerPlacement;
  orientedLogicalBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}): AspectLockedArtworkPlacement {
  if (
    !Number.isFinite(input.sourceWidth) ||
    !Number.isFinite(input.sourceHeight) ||
    input.sourceWidth <= 0 ||
    input.sourceHeight <= 0 ||
    !Number.isFinite(input.outputWidth) ||
    !Number.isFinite(input.outputHeight) ||
    input.outputWidth <= 0 ||
    input.outputHeight <= 0
  ) {
    throw new Error("Artwork and output dimensions must be positive.");
  }

  const polygon = input.surfaceQuad.map((point) => ({
    x: point.x * (input.outputWidth - 1),
    y: point.y * (input.outputHeight - 1),
  }));
  const center = polygon.reduce(
    (current, point) => ({
      x: current.x + point.x / polygon.length,
      y: current.y + point.y / polygon.length,
    }),
    { x: 0, y: 0 },
  );
  if (!pointInsideConvexQuad(center, polygon)) {
    throw new Error("PrintSurface center is outside its calibrated geometry.");
  }

  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const target = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
  const axisAligned =
    Math.abs(polygon[0]!.y - polygon[1]!.y) <= 1e-7 &&
    Math.abs(polygon[2]!.y - polygon[3]!.y) <= 1e-7 &&
    Math.abs(polygon[0]!.x - polygon[3]!.x) <= 1e-7 &&
    Math.abs(polygon[1]!.x - polygon[2]!.x) <= 1e-7;
  // The shared exact resolver is version-gated by the frozen owner contain
  // contract. Requests without it retain the historical centered resolver so
  // old composite retries are not reinterpreted.
  if (axisAligned && input.ownerPlacement) {
    const fit = resolveStrictContainFit({
      sourceWidth: input.sourceWidth,
      sourceHeight: input.sourceHeight,
      target,
      ...(input.ownerPlacement
        ? { ownerPlacement: input.ownerPlacement }
        : {}),
    });
    const quad = rectQuad({
      center: {
        x: fit.rect.x + fit.rect.width / 2,
        y: fit.rect.y + fit.rect.height / 2,
      },
      width: fit.rect.width,
      height: fit.rect.height,
    });
    return {
      sourceAspectRatio: fit.diagnostics.originalArtworkAspectRatio,
      effectiveUniformScale: fit.diagnostics.effectiveUniformScale,
      rect: fit.rect,
      quad,
      transformMatrix: [
        fit.diagnostics.effectiveUniformScale,
        0,
        fit.rect.x,
        0,
        fit.diagnostics.effectiveUniformScale,
        fit.rect.y,
        0,
        0,
        1,
      ],
      containFit: fit.diagnostics,
      oriented: false,
      logicalRect: fit.rect,
    };
  }
  if (!axisAligned && input.ownerPlacement && input.orientedLogicalBounds) {
    const logicalTarget = {
      x: input.orientedLogicalBounds.x * (input.outputWidth - 1),
      y: input.orientedLogicalBounds.y * (input.outputHeight - 1),
      width: input.orientedLogicalBounds.width * (input.outputWidth - 1),
      height: input.orientedLogicalBounds.height * (input.outputHeight - 1),
    };
    const fit = resolveStrictContainFit({
      sourceWidth: input.sourceWidth,
      sourceHeight: input.sourceHeight,
      target: logicalTarget,
      ownerPlacement: input.ownerPlacement,
    });
    const mapToSurface = (point: PixelPoint) => {
      const u = (point.x - logicalTarget.x) / logicalTarget.width;
      const v = (point.y - logicalTarget.y) / logicalTarget.height;
      const [tl, tr, br, bl] = polygon;
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
    };
    const logicalQuad = rectQuad({
      center: {
        x: fit.rect.x + fit.rect.width / 2,
        y: fit.rect.y + fit.rect.height / 2,
      },
      width: fit.rect.width,
      height: fit.rect.height,
    });
    const quad = logicalQuad.map(mapToSurface) as AspectLockedArtworkPlacement["quad"];
    const quadXs = quad.map((point) => point.x);
    const quadYs = quad.map((point) => point.y);
    const rect = {
      x: Math.min(...quadXs),
      y: Math.min(...quadYs),
      width: Math.max(...quadXs) - Math.min(...quadXs),
      height: Math.max(...quadYs) - Math.min(...quadYs),
    };
    return {
      sourceAspectRatio: fit.diagnostics.originalArtworkAspectRatio,
      effectiveUniformScale: fit.diagnostics.effectiveUniformScale,
      rect,
      quad,
      // The compositor derives the exact projective matrix from the approved
      // source corners and this oriented quad. This placeholder is never used
      // as an independent scale/translation authority.
      transformMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      containFit: fit.diagnostics,
      oriented: true,
      logicalRect: fit.rect,
    };
  }
  if (
    input.ownerPlacement &&
    (input.ownerPlacement.uniformScale !== 1 ||
      input.ownerPlacement.offsetX !== 0 ||
      input.ownerPlacement.offsetY !== 0)
  ) {
    throw new Error(
      "Owner-adjusted CONTAIN placement requires a rectangular printable area.",
    );
  }
  const maxScale = Math.min(
    (Math.max(...xs) - Math.min(...xs)) / input.sourceWidth,
    (Math.max(...ys) - Math.min(...ys)) / input.sourceHeight,
  );
  if (!Number.isFinite(maxScale) || maxScale <= 0) {
    throw new Error("PrintSurface has no usable area for the Artwork.");
  }

  let low = 0;
  let high = maxScale;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const scale = (low + high) / 2;
    const candidate = rectQuad({
      center,
      width: input.sourceWidth * scale,
      height: input.sourceHeight * scale,
    });
    if (candidate.every((point) => pointInsideConvexQuad(point, polygon))) {
      low = scale;
    } else {
      high = scale;
    }
  }
  if (low <= 1e-9) {
    throw new Error("PrintSurface cannot contain the Artwork without distortion.");
  }

  const width = input.sourceWidth * low;
  const height = input.sourceHeight * low;
  const quad = rectQuad({ center, width, height });
  const x = quad[0].x;
  const y = quad[0].y;
  return {
    sourceAspectRatio: input.sourceWidth / input.sourceHeight,
    effectiveUniformScale: low,
    rect: { x, y, width, height },
    quad,
    transformMatrix: [low, 0, x, 0, low, y, 0, 0, 1],
    containFit: {
      contractVersion: STRICT_CONTAIN_FIT_VERSION,
      fitMode: "CONTAIN",
      originalArtworkWidth: input.sourceWidth,
      originalArtworkHeight: input.sourceHeight,
      originalArtworkAspectRatio: input.sourceWidth / input.sourceHeight,
      targetPrintableArea: target,
      targetPrintableAreaAspectRatio: target.width / target.height,
      baseContainScale: low,
      effectiveUniformScale: low,
      unusedHorizontalSpace: Math.max(0, target.width - width),
      unusedVerticalSpace: Math.max(0, target.height - height),
      ownerOffsetX: 0,
      ownerOffsetY: 0,
      ownerScale: 1,
      ratioPreserved: true,
      cropApplied: false,
      distortionApplied: false,
    },
    oriented: false,
    logicalRect: { x, y, width, height },
  };
}
