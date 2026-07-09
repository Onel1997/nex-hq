import { range } from "@/lib/design/vector-engine/hash";

export type WeightTier = "dominant" | "secondary" | "supporting" | "micro";

export interface WeightedElement {
  id: string;
  tier: WeightTier;
  /** 0–100 visual weight score */
  score: number;
  scale: number;
  opacity: number;
  strokeWeight?: number;
}

const TIER_BASE: Record<WeightTier, number> = {
  dominant: 88,
  secondary: 58,
  supporting: 34,
  micro: 16,
};

const TIER_SCALE_RANGE: Record<WeightTier, [number, number]> = {
  dominant: [0.72, 1.0],
  secondary: [0.32, 0.52],
  supporting: [0.14, 0.28],
  micro: [0.04, 0.12],
};

/** Assigns tier-based weight — never equal across tiers. */
export function assignWeightTier(
  tier: WeightTier,
  seed: number,
  index: number,
): { score: number; scale: number; opacity: number } {
  const base = TIER_BASE[tier];
  const jitter = range(seed, 700 + index, -6, 8);
  const [lo, hi] = TIER_SCALE_RANGE[tier];
  const scale = range(seed, 710 + index, lo, hi);
  const opacity =
    tier === "dominant"
      ? range(seed, 720 + index, 0.88, 0.98)
      : tier === "secondary"
        ? range(seed, 720 + index, 0.52, 0.72)
        : tier === "supporting"
          ? range(seed, 720 + index, 0.32, 0.48)
          : range(seed, 720 + index, 0.18, 0.34);

  return { score: base + jitter, scale, opacity };
}

/** Rejects compositions where elements cluster at similar weight. */
export function hasUniformWeight(elements: WeightedElement[]): boolean {
  if (elements.length < 3) return false;
  const scores = elements.map((e) => e.score).sort((a, b) => a - b);
  const spread = scores[scores.length - 1]! - scores[0]!;
  if (spread < 28) return true;

  const mid = Math.floor(scores.length / 2);
  const pairs = scores.slice(0, mid).map((s, i) => Math.abs(s - scores[mid + i]!));
  const avgPairDelta = pairs.reduce((a, b) => a + b, 0) / pairs.length;
  return avgPairDelta < 12;
}

export function buildWeightHierarchy(
  seed: number,
  heroScale: number,
): {
  dominant: WeightedElement;
  secondary: WeightedElement;
  supporting: WeightedElement[];
  micro: WeightedElement[];
} {
  const dominantW = assignWeightTier("dominant", seed, 0);
  const secondaryW = assignWeightTier("secondary", seed, 1);

  return {
    dominant: {
      id: "focal-primary",
      tier: "dominant",
      score: dominantW.score,
      scale: heroScale * dominantW.scale,
      opacity: dominantW.opacity,
    },
    secondary: {
      id: "focal-secondary",
      tier: "secondary",
      score: secondaryW.score,
      scale: heroScale * secondaryW.scale,
      opacity: secondaryW.opacity,
    },
    supporting: Array.from({ length: 2 }, (_, i) => {
      const w = assignWeightTier("supporting", seed, 2 + i);
      return {
        id: `support-${i}`,
        tier: "supporting" as const,
        score: w.score,
        scale: heroScale * w.scale,
        opacity: w.opacity,
      };
    }),
    micro: Array.from({ length: 3 + (seed % 2) }, (_, i) => {
      const w = assignWeightTier("micro", seed, 5 + i);
      return {
        id: `micro-${i}`,
        tier: "micro" as const,
        score: w.score,
        scale: heroScale * w.scale,
        opacity: w.opacity,
      };
    }),
  };
}
