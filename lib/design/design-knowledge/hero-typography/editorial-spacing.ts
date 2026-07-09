import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { HeroTypographyBuildContext } from "@/lib/design/design-knowledge/hero-typography/types";
import { range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";

export function buildMicroCaption(
  ctx: HeroTypographyBuildContext,
  text: string,
  x: number,
  y: number,
  id = "hero-type-micro",
): TypographyPlacement {
  const { safeZone } = ctx;
  return {
    id,
    role: "subheadline",
    text,
    x: snap(x),
    y: snap(y),
    size: snap(safeZone.width * 0.042),
    tracking: 0.44,
    lineHeight: 1.15,
    weight: 400,
    align: "start",
    rotation: range(ctx.seed, 50, -10, -4),
    opacity: 0.55,
    layer: "typography",
    variant: "micro",
    zOrder: 25,
  };
}

export function buildMuseumLabel(
  ctx: HeroTypographyBuildContext,
  text: string,
  y: number,
  id = "hero-type-museum",
): TypographyPlacement {
  const { safeZone, seed } = ctx;
  const tokens = DESIGN_TOKENS.typography;
  return {
    id,
    role: "collection-code",
    text,
    x: snap(safeZone.x + safeZone.width * 0.72),
    y: snap(y),
    size: tokens.caption.size,
    tracking: tokens.caption.tracking + 0.14,
    lineHeight: tokens.caption.lineHeight,
    weight: 400,
    align: "end",
    rotation: range(seed, 51, -8, -3),
    opacity: 0.42,
    layer: "decorative",
    variant: "capsule",
    zOrder: 15,
  };
}

/** Editorial spacing rhythm between type scales — museum catalog feel. */
export function applyEditorialSpacing(
  placements: TypographyPlacement[],
  ctx: HeroTypographyBuildContext,
): TypographyPlacement[] {
  const dominant = placements.find((p) => p.variant === "dominant" || p.variant === "cropped" || p.id.includes("dominant"));
  if (!dominant) return placements;

  return placements.map((p) => {
    if (p.role === "subheadline" || p.role === "collection-code") {
      const gap = dominant.size * 0.38;
      return { ...p, y: snap(dominant.y + dominant.size * 1.1 + gap * 0.2), tracking: p.tracking + 0.04 };
    }
    return p;
  });
}
