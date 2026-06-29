import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { FocalSystem } from "@/lib/design/design-library/composition-intelligence/focal-system";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export type DepthLayer = "foreground" | "midground" | "background" | "ghost";

export interface DepthElement {
  id: string;
  layer: DepthLayer;
  opacity: number;
  clipPath?: string;
}

export interface DepthPlan {
  stack: DepthElement[];
  ghostTypography: TypographyPlacement[];
  foregroundOpacity: number;
  backgroundOpacity: number;
  maskingActive: boolean;
  score: number;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function buildDepthPlan(
  focal: FocalSystem,
  typography: TypographyPlacement[],
  seed: number,
  depthOpacity: number,
): DepthPlan {
  const stack: DepthElement[] = [
    { id: "depth-bg", layer: "background", opacity: range(seed, 1200, 0.12, 0.22) },
    { id: "depth-mid", layer: "midground", opacity: range(seed, 1201, 0.42, 0.58) },
    { id: "depth-fg", layer: "foreground", opacity: range(seed, 1202, 0.82, 0.96) },
    { id: "depth-ghost", layer: "ghost", opacity: depthOpacity },
  ];

  const headline = typography.find((t) => t.role === "headline" || t.role === "stacked-headline");
  const ghostTypography: TypographyPlacement[] = [];

  if (headline) {
    ghostTypography.push({
      id: "composition-ghost-type",
      role: "headline",
      text: headline.text,
      x: snap(headline.x + range(seed, 1210, -8, 8)),
      y: snap(headline.y - headline.size * 0.75),
      size: headline.size * range(seed, 1211, 0.14, 0.22),
      tracking: headline.tracking + 0.12,
      lineHeight: 1.1,
      weight: 400,
      align: headline.align,
      rotation: range(seed, 1212, -2, 2),
      opacity: depthOpacity,
      layer: "decorative",
    });
  }

  let score = 52;
  if (ghostTypography.length > 0) score += 16;
  if (stack.length >= 3) score += 12;
  score += range(seed, 1220, 4, 14);

  return {
    stack,
    ghostTypography,
    foregroundOpacity: stack.find((s) => s.layer === "foreground")?.opacity ?? 0.9,
    backgroundOpacity: stack.find((s) => s.layer === "background")?.opacity ?? 0.18,
    maskingActive: seed % 3 !== 0,
    score: clamp(score),
  };
}

export function applyDepthToTypography(
  placements: TypographyPlacement[],
  plan: DepthPlan,
): TypographyPlacement[] {
  return placements.map((p) => {
    if (p.layer === "decorative") return { ...p, opacity: p.opacity * plan.backgroundOpacity * 2 };
    if (p.role === "headline" || p.role === "stacked-headline") {
      return { ...p, opacity: p.opacity * plan.foregroundOpacity };
    }
    return { ...p, opacity: p.opacity * 0.72 };
  });
}
