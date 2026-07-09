import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { HeroTypographyBuildContext } from "@/lib/design/design-knowledge/hero-typography/types";
import { buildCroppedLayer } from "@/lib/design/design-knowledge/hero-typography/cropping";
import { buildGhostLayer } from "@/lib/design/design-knowledge/hero-typography/ghost-layer";
import { buildOffsetLayer } from "@/lib/design/design-knowledge/hero-typography/offset";
import { buildMicroCaption, buildMuseumLabel } from "@/lib/design/design-knowledge/hero-typography/editorial-spacing";
import { buildVerticalSecondary } from "@/lib/design/design-knowledge/hero-typography/layering";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export function buildSplitHeadline(
  ctx: HeroTypographyBuildContext,
  words: string[],
): TypographyPlacement[] {
  const { safeZone, focal, heroScale, seed } = ctx;
  const [w0, w1, w2] = words;
  const dominantSize = snap(safeZone.width * 0.22);
  const secondarySize = snap(safeZone.width * 0.1);
  const baseY = snap(focal.y + heroScale * 0.02);

  return [
    buildGhostLayer(
      ctx,
      words.join(" "),
      dominantSize * 1.3,
      safeZone.x + safeZone.width * 0.5,
      safeZone.y + safeZone.height * 0.36,
      range(seed, 10, -3, 3),
    ),
    buildCroppedLayer(
      ctx,
      w0!,
      dominantSize,
      safeZone.x + safeZone.width * 0.05,
      baseY - dominantSize * 0.2,
      "start",
      range(seed, 12, -2, 4),
      "hero-type-split-a",
    ),
    buildOffsetLayer(
      ctx,
      w1!,
      secondarySize,
      focal.x + range(seed, 13, -heroScale * 0.06, heroScale * 0.1),
      focal.y + dominantSize * 0.22,
      "middle",
      range(seed, 14, -4, 6),
      safeZone.width * 0.55,
      "hero-type-split-b",
    ),
    buildMicroCaption(ctx, w2 ?? "", focal.x - heroScale * 0.32, focal.y - heroScale * 0.08, "hero-type-split-micro"),
    buildVerticalSecondary(ctx, (w2 ?? w1 ?? w0 ?? "ST").slice(0, 4)),
    buildMuseumLabel(ctx, `${w1 ?? ""} / ${2020 + (seed % 6)}`, baseY + dominantSize * 0.52),
  ];
}
