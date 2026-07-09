export type {
  HeroTypographyAudit,
  HeroTypographyBuildContext,
  HeroTypographyCompositionMatch,
  HeroTypographyCompositionWeights,
  HeroTypographyConcept,
  HeroTypographyDirectorDecision,
  HeroTypographyDirection,
  HeroTypographyDirectionId,
  HeroTypographyScale,
} from "@/lib/design/design-knowledge/hero-typography/types";

export {
  getAllHeroTypographyDirections,
  getHeroTypographyDirection,
  HERO_TYPOGRAPHY_DIRECTIONS,
} from "@/lib/design/design-knowledge/hero-typography/hero-library";

export { decideHeroTypographyDirection } from "@/lib/design/design-knowledge/hero-typography/hero-selector";

export {
  applyHeroLayoutScore,
  applyHeroStyleScore,
  applyHeroTemplateScore,
  applyHeroTypography,
  buildHeroTypographyWeights,
  evaluateHeroTypographyMatch,
  heroTypographyRevisionOverrides,
  scoreHeroTypographyFit,
} from "@/lib/design/design-knowledge/hero-typography/hero-rules";

export {
  auditHeroTypography,
  buildDecorativeMetadata,
  buildHeroTypographyForDirection,
  estimateTypographyCompositionShare,
  estimateTextWidth,
} from "@/lib/design/design-knowledge/hero-typography/hierarchy";

export { buildGhostLayer } from "@/lib/design/design-knowledge/hero-typography/ghost-layer";
export { buildCroppedLayer } from "@/lib/design/design-knowledge/hero-typography/cropping";
export { buildOversizedLayer, buildBackgroundLetterform } from "@/lib/design/design-knowledge/hero-typography/overscale";
export { buildOffsetLayer } from "@/lib/design/design-knowledge/hero-typography/offset";
export { buildSplitHeadline } from "@/lib/design/design-knowledge/hero-typography/split-type";
export { buildLayeredStack, buildBrokenTypeLayer, buildVerticalSecondary } from "@/lib/design/design-knowledge/hero-typography/layering";
export { buildMicroCaption, buildMuseumLabel } from "@/lib/design/design-knowledge/hero-typography/editorial-spacing";
