import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { HeroTypographyBuildContext } from "@/lib/design/design-knowledge/hero-typography/types";
import { buildCroppedLayer } from "@/lib/design/design-knowledge/hero-typography/cropping";
import { buildGhostLayer } from "@/lib/design/design-knowledge/hero-typography/ghost-layer";
import { buildMicroCaption } from "@/lib/design/design-knowledge/hero-typography/editorial-spacing";
import { buildOffsetLayer } from "@/lib/design/design-knowledge/hero-typography/offset";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export function buildVerticalSecondary(
  ctx: HeroTypographyBuildContext,
  text: string,
  id = "hero-type-vertical",
): TypographyPlacement {
  const { safeZone } = ctx;
  const capsule = text.length <= 4 ? text : text.slice(0, 4);
  return {
    id,
    role: "vertical-text",
    text: capsule,
    x: snap(safeZone.x + safeZone.width * 0.9),
    y: snap(safeZone.y + safeZone.height * 0.48),
    size: snap(safeZone.width * 0.046),
    tracking: 0.42,
    lineHeight: 0.92,
    weight: 400,
    align: "start",
    rotation: -90,
    opacity: 0.68,
    layer: "typography",
    variant: "capsule",
    zOrder: 30,
  };
}

export function buildBrokenTypeLayer(
  ctx: HeroTypographyBuildContext,
  text: string,
  x: number,
  y: number,
  id = "hero-type-broken",
): TypographyPlacement {
  const { safeZone } = ctx;
  return {
    id,
    role: "stacked-headline",
    text,
    x: snap(x + range(ctx.seed, 40, 8, 20)),
    y: snap(y),
    size: snap(safeZone.width * 0.21),
    tracking: 0.14,
    lineHeight: 0.94,
    weight: 500,
    align: "start",
    rotation: range(ctx.seed, 41, -5, 5),
    opacity: 0.95,
    layer: "typography",
    variant: "stretched",
    textLength: snap(safeZone.width * 0.72),
    zOrder: 15,
  };
}

export function buildLayeredStack(
  ctx: HeroTypographyBuildContext,
  words: string[],
): TypographyPlacement[] {
  const { safeZone, focal, heroScale, seed } = ctx;
  const stack = words.slice(0, Math.min(3, words.length));
  const dominantSize = snap(safeZone.width * 0.2);
  const lineGap = dominantSize * 0.92;
  const startY = snap(focal.y - ((stack.length - 1) * lineGap) / 2);

  const layers: TypographyPlacement[] = [
    buildGhostLayer(ctx, stack.join(" "), dominantSize * 1.25, focal.x, startY - dominantSize * 0.35, 0),
  ];

  stack.forEach((word, i) => {
    const size = snap(dominantSize * (1 - i * 0.18));
    const y = snap(startY + i * lineGap);
    const x = snap(safeZone.x + safeZone.width * (0.08 + i * 0.06));
    if (i === 0) {
      layers.push(buildCroppedLayer(ctx, word, size, x, y, "start", range(seed, 20 + i, -2, 3), `hero-type-stack-${i}`));
    } else if (i === 1) {
      layers.push(
        buildOffsetLayer(ctx, word, size, x + heroScale * 0.08, y, "start", range(seed, 21 + i, -3, 4), undefined, `hero-type-stack-${i}`),
      );
    } else {
      layers.push(buildMicroCaption(ctx, word, x + heroScale * 0.12, y, `hero-type-stack-${i}`));
    }
  });

  if (stack.length >= 2) {
    layers.push(buildVerticalSecondary(ctx, stack[stack.length - 1]!));
  }

  return layers;
}
