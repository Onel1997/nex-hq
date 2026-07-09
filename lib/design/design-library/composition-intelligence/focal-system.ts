import type { Rect } from "@/lib/design/design-library/types";
import type { WeightedElement } from "@/lib/design/design-library/composition-intelligence/visual-weight";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export interface FocalAnchor {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  weight: WeightedElement;
}

export interface FocalSystem {
  /** ONE dominant focal point */
  primary: FocalAnchor;
  /** ONE secondary focal point */
  secondary: FocalAnchor;
  /** ONE supporting system (2–3 elements) */
  supporting: FocalAnchor[];
  /** ONE micro-detail system */
  micro: FocalAnchor[];
}

function anchorFromWeight(
  x: number,
  y: number,
  weight: WeightedElement,
  seed: number,
  index: number,
): FocalAnchor {
  return {
    x: snap(x),
    y: snap(y),
    scale: weight.scale,
    rotation: range(seed, 800 + index, -14, 14),
    opacity: weight.opacity,
    weight,
  };
}

/** Builds four-tier focal hierarchy — nothing competes equally. */
export function buildFocalSystem(
  safeZone: Rect,
  focal: { x: number; y: number },
  heroScale: number,
  weights: {
    dominant: WeightedElement;
    secondary: WeightedElement;
    supporting: WeightedElement[];
    micro: WeightedElement[];
  },
  seed: number,
  asymmetry: number,
): FocalSystem {
  const offsetX = range(seed, 810, -safeZone.width * 0.08, safeZone.width * 0.08) + asymmetry * 24;
  const offsetY = range(seed, 811, -safeZone.height * 0.06, safeZone.height * 0.05);

  const primary = anchorFromWeight(
    focal.x + offsetX * 0.4,
    focal.y + offsetY * 0.3,
    weights.dominant,
    seed,
    0,
  );

  const secondary = anchorFromWeight(
    primary.x + range(seed, 812, safeZone.width * 0.1, safeZone.width * 0.2),
    primary.y + range(seed, 813, -safeZone.height * 0.16, safeZone.height * 0.06),
    weights.secondary,
    seed,
    1,
  );

  const supporting = weights.supporting.map((w, i) =>
    anchorFromWeight(
      safeZone.x + safeZone.width * range(seed, 820 + i, 0.12 + i * 0.04, 0.22 + i * 0.06),
      primary.y + heroScale * range(seed, 830 + i, -0.2, 0.24),
      w,
      seed,
      2 + i,
    ),
  );

  const micro = weights.micro.map((w, i) =>
    anchorFromWeight(
      safeZone.x + safeZone.width * range(seed, 840 + i, 0.06 + i * 0.05, 0.18 + i * 0.08),
      safeZone.y + safeZone.height * range(seed, 850 + i, 0.1 + i * 0.07, 0.2 + i * 0.1),
      w,
      seed,
      5 + i,
    ),
  );

  return { primary, secondary, supporting, micro };
}

/** Rejects perfectly centered logo compositions. */
export function isCenteredLogoComposition(system: FocalSystem, safeZone: Rect): boolean {
  const cx = safeZone.x + safeZone.width / 2;
  const cy = safeZone.y + safeZone.height / 2;
  const primaryDelta = Math.abs(system.primary.x - cx) / safeZone.width;
  const secondaryDelta = Math.abs(system.secondary.x - cx) / safeZone.width;
  const verticalStack =
    system.secondary.y > system.primary.y &&
    Math.abs(system.secondary.x - system.primary.x) < safeZone.width * 0.06;
  return primaryDelta < 0.04 && secondaryDelta < 0.06 && verticalStack;
}

export function hasFocalHierarchy(system: FocalSystem): boolean {
  const primaryScore = system.primary.weight.score;
  const secondaryScore = system.secondary.weight.score;
  const gap = primaryScore - secondaryScore;
  return gap >= 22 && system.supporting.length >= 2 && system.micro.length >= 2;
}
