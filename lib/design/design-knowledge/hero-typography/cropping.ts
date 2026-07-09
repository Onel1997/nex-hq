import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { HeroTypographyBuildContext } from "@/lib/design/design-knowledge/hero-typography/types";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export function buildCroppedLayer(
  ctx: HeroTypographyBuildContext,
  text: string,
  size: number,
  x: number,
  y: number,
  align: TypographyPlacement["align"],
  rotation: number,
  id = "hero-type-dominant",
): TypographyPlacement {
  const { safeZone } = ctx;
  return {
    id,
    role: "stacked-headline",
    text,
    x: snap(x),
    y: snap(y),
    size: snap(size),
    tracking: 0.1 + range(ctx.seed, 11, 0, 0.06),
    lineHeight: 0.92,
    weight: 500,
    align,
    rotation,
    opacity: 0.97,
    layer: "typography",
    variant: "cropped",
    clipPathId: `${id}-clip`,
    clipRect: {
      x: safeZone.x,
      y: safeZone.y + safeZone.height * 0.08,
      width: safeZone.width * 0.94,
      height: size * 1.25,
    },
    zOrder: 10,
  };
}
