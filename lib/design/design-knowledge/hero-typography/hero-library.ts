import type { HeroTypographyDirection, HeroTypographyDirectionId } from "@/lib/design/design-knowledge/hero-typography/types";

export const HERO_TYPOGRAPHY_DIRECTIONS: HeroTypographyDirection[] = [
  {
    id: "silent-luxury",
    name: "Silent Luxury",
    concepts: [
      "ghost-typography",
      "museum-label",
      "cropped-typography",
      "micro-editorial-caption",
      "multi-scale-hierarchy",
    ],
    compositionShare: [0.55, 0.65],
    keywords: ["silent", "quiet", "understated", "whisper", "luxury", "architectural silence"],
    styleBias: ["silent-luxury", "minimal-luxury", "monochrome-luxury", "scandinavian-minimal"],
    layoutBias: ["oversized-back", "editorial-layout", "gallery-layout"],
    templateBias: ["silent-collection", "gallery-composition", "luxury-wordmark"],
    templateAvoid: ["technical-blueprint", "oversized-graphic"],
    hierarchy: "restrained",
  },
  {
    id: "faith",
    name: "Faith",
    concepts: [
      "layered-type",
      "background-letterforms",
      "multi-scale-hierarchy",
      "museum-label",
      "typography-depth",
    ],
    compositionShare: [0.58, 0.72],
    keywords: ["faith", "spiritual", "sacred", "devotional", "scripture"],
    styleBias: ["faith", "minimal-luxury", "modern-gothic"],
    layoutBias: ["symbol-above-type", "vertical-print", "editorial-layout"],
    templateBias: ["faith-collection", "gallery-composition"],
    templateAvoid: ["technical-blueprint", "micro-graphic"],
    hierarchy: "layered",
  },
  {
    id: "statement-piece",
    name: "Statement Piece",
    concepts: [
      "oversized-type",
      "broken-type",
      "secondary-type-system",
      "ghost-typography",
      "cropped-typography",
      "offset-headline",
      "split-headline",
    ],
    compositionShare: [0.62, 0.75],
    keywords: ["statement", "scroll-stop", "intimate", "between", "only", "emotional", "cropped"],
    styleBias: ["editorial-fashion", "modern-gothic", "architectural"],
    layoutBias: ["oversized-back", "oversized-front", "split-layout", "editorial-layout"],
    templateBias: ["editorial-poster", "oversized-graphic", "gallery-composition"],
    templateAvoid: ["minimal-emblem", "micro-graphic", "luxury-wordmark"],
    hierarchy: "dramatic",
  },
  {
    id: "core-essential",
    name: "Core Essential",
    concepts: [
      "multi-scale-hierarchy",
      "ghost-typography",
      "micro-editorial-caption",
      "museum-label",
    ],
    compositionShare: [0.28, 0.42],
    keywords: ["core essential", "daily", "quiet", "minimal", "emblem", "rotation", "micro"],
    styleBias: ["silent-luxury", "minimal-luxury", "monochrome-luxury", "scandinavian-minimal"],
    layoutBias: ["micro-chest", "center-chest", "corner-print"],
    templateBias: ["minimal-emblem", "micro-graphic", "silent-collection"],
    templateAvoid: ["editorial-poster", "oversized-graphic"],
    hierarchy: "restrained",
  },
  {
    id: "hero-back-print",
    name: "Hero Back Print",
    concepts: [
      "oversized-type",
      "ghost-typography",
      "layered-type",
      "cropped-typography",
      "split-headline",
      "typography-depth",
      "multi-scale-hierarchy",
      "background-letterforms",
    ],
    compositionShare: [0.55, 0.75],
    keywords: ["hero", "back print", "oversized back", "architectural", "editorial luxury"],
    styleBias: ["editorial-fashion", "architectural", "silent-luxury"],
    layoutBias: ["oversized-back", "wrap-composition", "editorial-layout"],
    templateBias: ["oversized-graphic", "editorial-poster", "gallery-composition"],
    templateAvoid: ["minimal-emblem", "micro-graphic"],
    hierarchy: "layered",
  },
];

const DIRECTION_MAP = new Map<HeroTypographyDirectionId, HeroTypographyDirection>(
  HERO_TYPOGRAPHY_DIRECTIONS.map((d) => [d.id, d]),
);

export function getHeroTypographyDirection(id: HeroTypographyDirectionId): HeroTypographyDirection {
  return DIRECTION_MAP.get(id)!;
}

export function getAllHeroTypographyDirections(): HeroTypographyDirection[] {
  return [...HERO_TYPOGRAPHY_DIRECTIONS];
}
