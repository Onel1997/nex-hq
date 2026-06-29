import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { FocalSystem } from "@/lib/design/design-library/composition-intelligence/focal-system";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export type OverlapMode =
  | "type-over-symbol"
  | "type-behind-geometry"
  | "type-through-geometry"
  | "type-breaks-frame"
  | "partial-crop";

export interface OverlapBand {
  y: number;
  height: number;
  mode: OverlapMode;
  opacity: number;
}

export interface OverlapPlan {
  bands: OverlapBand[];
  /** Typography intersects symbol geometry */
  intersectionActive: boolean;
  score: number;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function buildOverlapPlan(focal: FocalSystem, seed: number): OverlapPlan {
  const modes: OverlapMode[] = [
    "type-over-symbol",
    "type-behind-geometry",
    "type-through-geometry",
    "type-breaks-frame",
    "partial-crop",
  ];
  const mode = modes[seed % modes.length]!;

  const band: OverlapBand = {
    y: snap(focal.primary.y - focal.primary.scale * 0.12),
    height: focal.primary.scale * 0.48,
    mode,
    opacity: range(seed, 1100, 0.72, 0.96),
  };

  const secondaryBand: OverlapBand = {
    y: snap(focal.secondary.y - focal.secondary.scale * 0.08),
    height: focal.secondary.scale * 0.35,
    mode: modes[(seed + 2) % modes.length]!,
    opacity: range(seed, 1101, 0.45, 0.68),
  };

  let score = 55;
  if (mode === "type-through-geometry" || mode === "type-behind-geometry") score += 18;
  if (mode === "type-breaks-frame") score += 14;
  if (mode === "type-over-symbol") score += 10;

  return {
    bands: [band, secondaryBand],
    intersectionActive: true,
    score: clamp(score),
  };
}

/** Typography overlaps symbols — not sitting passively underneath. */
export function applyTypographyOverlap(
  placements: TypographyPlacement[],
  focal: FocalSystem,
  plan: OverlapPlan,
  seed: number,
): TypographyPlacement[] {
  const band = plan.bands[0];
  if (!band) return placements;

  return placements.map((p, i) => {
    if (p.layer !== "typography") return p;
    if (p.role !== "headline" && p.role !== "stacked-headline") return p;

    const inBand = p.y >= band.y && p.y <= band.y + band.height;
    if (!inBand) {
      const shiftY = range(seed, 1110 + i, -focal.primary.scale * 0.08, focal.primary.scale * 0.04);
      return {
        ...p,
        y: snap(focal.primary.y + shiftY),
        x: snap(p.x + range(seed, 1115 + i, -12, 12)),
      };
    }

    switch (band.mode) {
      case "type-behind-geometry":
        return { ...p, opacity: p.opacity * 0.42, y: snap(focal.primary.y - p.size * 0.15) };
      case "type-through-geometry":
        return {
          ...p,
          opacity: p.opacity * 0.78,
          y: snap(focal.primary.y + range(seed, 1120 + i, -p.size * 0.2, p.size * 0.1)),
          rotation: range(seed, 1121 + i, -3, 3),
        };
      case "type-breaks-frame":
        return {
          ...p,
          x: snap(p.x + range(seed, 1125 + i, -18, 18)),
          align: "start" as const,
        };
      case "partial-crop":
        return { ...p, opacity: p.opacity * 0.88, y: snap(focal.primary.y + p.size * 0.05) };
      default:
        return { ...p, y: snap(focal.primary.y + p.size * 0.12), opacity: band.opacity };
    }
  });
}

export function textSitsUnderSymbol(placements: TypographyPlacement[], focal: FocalSystem): boolean {
  const headline = placements.find((t) => t.role === "headline" || t.role === "stacked-headline");
  if (!headline) return false;
  const belowSymbol = headline.y > focal.primary.y + focal.primary.scale * 0.35;
  const centeredUnder = Math.abs(headline.x - focal.primary.x) < focal.primary.scale * 0.15;
  return belowSymbol && centeredUnder;
}
