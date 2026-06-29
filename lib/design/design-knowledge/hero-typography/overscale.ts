import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { HeroTypographyBuildContext } from "@/lib/design/design-knowledge/hero-typography/types";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export function buildOversizedLayer(
  ctx: HeroTypographyBuildContext,
  text: string,
  x: number,
  y: number,
  align: TypographyPlacement["align"],
  scaleFactor = 0.24,
  id = "hero-type-oversized",
): TypographyPlacement {
  const size = snap(ctx.safeZone.width * scaleFactor);
  return {
    id,
    role: "stacked-headline",
    text,
    x: snap(x),
    y: snap(y),
    size,
    tracking: 0.08 + range(ctx.seed, 20, 0, 0.05),
    lineHeight: 0.9,
    weight: 500,
    align,
    rotation: range(ctx.seed, 21, -4, 4),
    opacity: 0.96,
    layer: "typography",
    variant: "dominant",
    zOrder: 12,
  };
}

export function buildBackgroundLetterform(
  ctx: HeroTypographyBuildContext,
  text: string,
  id = "hero-type-bg-letter",
): TypographyPlacement {
  const word = text.split(/\s+/)[0] ?? text;
  return {
    id,
    role: "headline",
    text: word,
    x: snap(ctx.focal.x),
    y: snap(ctx.focal.y - ctx.heroScale * 0.12),
    size: snap(ctx.safeZone.width * 0.38),
    tracking: 0.18,
    lineHeight: 0.88,
    weight: 400,
    align: "middle",
    rotation: range(ctx.seed, 22, -6, 6),
    opacity: 0.07,
    layer: "decorative",
    variant: "ghost",
    zOrder: 1,
  };
}
