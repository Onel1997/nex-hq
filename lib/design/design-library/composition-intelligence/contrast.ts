import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { FocalSystem } from "@/lib/design/design-library/composition-intelligence/focal-system";

export interface ContrastProfile {
  sizeRatio: number;
  opacitySpread: number;
  strokeVariation: number;
  typeScaleSpread: number;
  score: number;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Measures visual contrast — prevents equal-sized, equal-weight elements. */
export function analyzeContrast(
  focal: FocalSystem,
  typography: TypographyPlacement[],
): ContrastProfile {
  const scales = [
    focal.primary.scale,
    focal.secondary.scale,
    ...focal.supporting.map((s) => s.scale),
    ...typography.map((t) => t.size),
  ].sort((a, b) => a - b);

  const sizeRatio = scales.length >= 2 ? scales[scales.length - 1]! / Math.max(scales[0]!, 1) : 1;

  const opacities = [
    focal.primary.opacity,
    focal.secondary.opacity,
    ...typography.map((t) => t.opacity),
  ];
  const opacitySpread = Math.max(...opacities) - Math.min(...opacities);

  const typeSizes = typography.filter((t) => t.layer === "typography").map((t) => t.size);
  const typeScaleSpread =
    typeSizes.length >= 2 ? Math.max(...typeSizes) / Math.max(Math.min(...typeSizes), 1) : 1;

  const microScore = focal.micro[0]?.weight.score ?? 16;
  const strokeVariation = focal.primary.weight.score - microScore;

  let score = 50;
  if (sizeRatio >= 3.5) score += 18;
  else if (sizeRatio >= 2.2) score += 10;
  else score -= 15;

  if (opacitySpread >= 0.35) score += 14;
  else if (opacitySpread >= 0.2) score += 6;
  else score -= 12;

  if (typeScaleSpread >= 2.8) score += 16;
  else if (typeScaleSpread >= 1.8) score += 8;
  else score -= 10;

  if (strokeVariation >= 50) score += 8;

  return {
    sizeRatio,
    opacitySpread,
    strokeVariation,
    typeScaleSpread,
    score: clamp(score),
  };
}

export function hasEqualWeightElements(profile: ContrastProfile): boolean {
  return profile.sizeRatio < 2.0 && profile.typeScaleSpread < 1.6 && profile.opacitySpread < 0.18;
}
