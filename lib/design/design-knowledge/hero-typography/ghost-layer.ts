import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { HeroTypographyBuildContext } from "@/lib/design/design-knowledge/hero-typography/types";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export function buildGhostLayer(
  ctx: HeroTypographyBuildContext,
  text: string,
  size: number,
  x: number,
  y: number,
  rotation = 0,
  id = "hero-type-ghost-bg",
): TypographyPlacement {
  return {
    id,
    role: "headline",
    text,
    x: snap(x),
    y: snap(y),
    size: snap(size),
    tracking: 0.22 + range(ctx.seed, 1, 0, 0.06),
    lineHeight: 1.02,
    weight: 400,
    align: "middle",
    rotation: rotation + range(ctx.seed, 2, -3, 3),
    opacity: 0.1,
    layer: "decorative",
    variant: "ghost",
    zOrder: 0,
  };
}
