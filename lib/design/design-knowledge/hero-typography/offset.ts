import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { HeroTypographyBuildContext } from "@/lib/design/design-knowledge/hero-typography/types";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export function buildOffsetLayer(
  ctx: HeroTypographyBuildContext,
  text: string,
  size: number,
  x: number,
  y: number,
  align: TypographyPlacement["align"],
  rotation: number,
  stretch?: number,
  id = "hero-type-secondary",
): TypographyPlacement {
  const { focal, heroScale } = ctx;
  return {
    id,
    role: "headline",
    text,
    x: snap(x),
    y: snap(y),
    size: snap(size),
    tracking: 0.32 + range(ctx.seed, 30, 0, 0.08),
    lineHeight: 1.05,
    weight: 450,
    align,
    rotation,
    opacity: 0.9,
    layer: "typography",
    variant: stretch ? "stretched" : "offset",
    textLength: stretch ? snap(stretch) : undefined,
    maskId: stretch ? `${id}-mask` : undefined,
    maskCircle: stretch ? { cx: focal.x, cy: focal.y, r: heroScale * 0.34 } : undefined,
    zOrder: 20,
  };
}
