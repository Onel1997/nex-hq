import { normalizeProductShotKind } from "@/lib/image/content-packs";
import type {
  NormalizedQuad,
  PrintSurface,
} from "@/lib/image/print-surface/types";
import type { SemanticPlacementPreset } from "@/lib/image/semantic-print-placement";

export const FRONT_LARGE_PRODUCTION_TUNING_VERSION =
  "nexhq-front-large-tuning-v4" as const;

// New-job-only tuning. Relative to V3, the effective rectangle is 10% larger
// and its centre is 4% of the output higher. Canonical Product geometry stays
// unchanged and the exact override is frozen into the prepared job.
const SCALE = 1.452;
const VERTICAL_SHIFT = 0.015;

function rectangle(
  left: number,
  top: number,
  right: number,
  bottom: number,
): NormalizedQuad {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function clampRange(center: number, size: number): [number, number] {
  const safeSize = Math.min(1, Math.max(0, size));
  const half = safeSize / 2;
  const safeCenter = Math.min(1 - half, Math.max(half, center));
  return [safeCenter - half, safeCenter + half];
}

/**
 * New v3 jobs using the standard large T-shirt front placement get one frozen,
 * axis-aligned production override. Canonical Product PrintSurface truth is not
 * mutated, and historical snapshots without this override keep their geometry.
 */
export function resolveFrontLargeProductionTuning(input: {
  productType: string | null | undefined;
  placementPreset: SemanticPlacementPreset | null | undefined;
  surface: PrintSurface;
}): {
  quad: NormalizedQuad;
  version: typeof FRONT_LARGE_PRODUCTION_TUNING_VERSION;
} | null {
  if (
    input.placementPreset !== "FRONT_LARGE" ||
    normalizeProductShotKind(input.productType) !== "TSHIRT" ||
    !input.surface.quad
  ) {
    return null;
  }

  const xs = input.surface.quad.map((point) => point.x);
  const ys = input.surface.quad.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const [tunedLeft, tunedRight] = clampRange(
    (left + right) / 2,
    (right - left) * SCALE,
  );
  const [tunedTop, tunedBottom] = clampRange(
    (top + bottom) / 2 + VERTICAL_SHIFT,
    (bottom - top) * SCALE,
  );

  return {
    quad: rectangle(tunedLeft, tunedTop, tunedRight, tunedBottom),
    version: FRONT_LARGE_PRODUCTION_TUNING_VERSION,
  };
}
