import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  DesignStyleDefinition,
  DesignStyleId,
  LayoutDefinition,
  LayoutId,
  LayoutZones,
  LibraryArtworkSpec,
  TemplateDefinition,
  TemplateId,
  TypographyPlacement,
} from "@/lib/design/design-library/types";
import type { WearabilityDirectorDecision } from "@/lib/design/design-knowledge/wearability";
import { buildDecorativeMetadata } from "@/lib/design/design-knowledge/hero-typography/hierarchy";
import { getHeroTypographyDirection } from "@/lib/design/design-knowledge/hero-typography/hero-library";
import { decideHeroTypographyDirection } from "@/lib/design/design-knowledge/hero-typography/hero-selector";
import {
  auditHeroTypography,
  buildHeroTypographyForDirection,
  estimateTypographyCompositionShare,
  estimateTextWidth,
} from "@/lib/design/design-knowledge/hero-typography/hierarchy";
import type {
  HeroTypographyBuildContext,
  HeroTypographyCompositionMatch,
  HeroTypographyCompositionWeights,
  HeroTypographyDirectorDecision,
} from "@/lib/design/design-knowledge/hero-typography/types";
import { extractHeadline } from "@/lib/design/vector-engine/typography";
import { snap } from "@/lib/design/vector-engine/tokens";

function weightMapFromBias<T extends string>(bias: T[], baseWeight: number): Partial<Record<T, number>> {
  const map: Partial<Record<T, number>> = {};
  bias.forEach((id, index) => {
    map[id] = baseWeight - index;
  });
  return map;
}

/** Build deterministic scoring weights from hero typography direction. */
export function buildHeroTypographyWeights(
  decision: HeroTypographyDirectorDecision,
): HeroTypographyCompositionWeights {
  const direction = getHeroTypographyDirection(decision.direction);
  return {
    templates: weightMapFromBias(direction.templateBias, 6),
    layouts: weightMapFromBias(direction.layoutBias, 5),
    styles: weightMapFromBias(direction.styleBias, 4),
    directionBias: { [decision.direction]: 8 },
  };
}

export function applyHeroTemplateScore(
  score: number,
  templateId: TemplateId,
  weights: HeroTypographyCompositionWeights,
): number {
  return score + (weights.templates[templateId] ?? 0);
}

export function applyHeroLayoutScore(
  score: number,
  layoutId: LayoutId,
  weights: HeroTypographyCompositionWeights,
): number {
  return score + (weights.layouts[layoutId] ?? 0);
}

export function applyHeroStyleScore(
  score: number,
  styleId: DesignStyleId,
  weights: HeroTypographyCompositionWeights,
): number {
  return score + (weights.styles[styleId] ?? 0);
}

export function heroTypographyRevisionOverrides(
  decision: HeroTypographyDirectorDecision,
): Partial<{ templateId: TemplateId; layoutId: LayoutId; styleId: DesignStyleId }> {
  const direction = getHeroTypographyDirection(decision.direction);
  return {
    templateId: direction.templateBias[0],
    layoutId: direction.layoutBias[0],
    styleId: direction.styleBias[0],
  };
}

function buildContext(
  brief: DesignStudioBrief,
  zones: LayoutZones,
  seed: number,
): HeroTypographyBuildContext {
  return {
    safeZone: zones.safeZone,
    focal: zones.anchors.focal,
    heroScale: zones.heroZone.width,
    seed,
    title: brief.title,
    product: brief.product,
    designId: brief.designId,
  };
}

/** Transform typography into hero editorial artwork — ONE direction per design. */
export function applyHeroTypography(
  placements: TypographyPlacement[],
  brief: DesignStudioBrief,
  layout: LayoutDefinition,
  zones: LayoutZones,
  seed: number,
  wearability?: WearabilityDirectorDecision,
  existingDecision?: HeroTypographyDirectorDecision,
): { typography: TypographyPlacement[]; decision: HeroTypographyDirectorDecision } {
  const decision = existingDecision ?? decideHeroTypographyDirection(brief, seed, wearability);
  const ctx = buildContext(brief, zones, seed);

  // Core Essential — restrained hierarchy only; never poster-scale replacement
  if (decision.direction === "core-essential") {
    const enriched = [...placements];
    const headline = enriched.find((p) => p.role === "headline" || p.role === "stacked-headline");

    if (headline && !enriched.some((p) => p.variant === "ghost")) {
      enriched.push({
        id: "hero-type-quiet-ghost",
        role: "headline",
        text: headline.text,
        x: headline.x + 3,
        y: headline.y + headline.size * 0.04,
        size: headline.size * 1.05,
        tracking: headline.tracking + 0.06,
        lineHeight: headline.lineHeight,
        weight: 400,
        align: headline.align,
        rotation: 0,
        opacity: 0.12,
        layer: "decorative",
        variant: "ghost",
        zOrder: 0,
      });
    }

    if (!enriched.some((p) => p.role === "collection-code")) {
      const anchor = headline ?? enriched[0];
      if (anchor) {
        enriched.push({
          id: "hero-type-quiet-caption",
          role: "collection-code",
          text: `${brief.title.toUpperCase()} · ESSENTIAL`,
          x: anchor.x,
          y: anchor.y + anchor.size * 1.15,
          size: anchor.size * 0.24,
          tracking: 0.28,
          lineHeight: 1.15,
          weight: 400,
          align: anchor.align,
          rotation: 0,
          opacity: 0.38,
          layer: "decorative",
          variant: "micro",
          zOrder: 5,
        });
      }
    }

    if (!enriched.some((p) => p.role === "roman-numeral")) {
      enriched.push({
        id: "hero-type-quiet-roman",
        role: "roman-numeral",
        text: ["I", "II", "III", "IV"][seed % 4]!,
        x: snap(zones.safeZone.x + zones.safeZone.width * 0.08),
        y: snap(zones.safeZone.y + zones.safeZone.height * 0.1),
        size: 8,
        tracking: 0.3,
        lineHeight: 1.1,
        weight: 400,
        align: "start",
        rotation: 0,
        opacity: 0.32,
        layer: "decorative",
        variant: "micro",
        zOrder: 4,
      });
    }

    return { typography: enriched, decision };
  }

  const words = extractHeadline(brief.title).trim().split(/\s+/).filter(Boolean);
  const core = buildHeroTypographyForDirection(decision.direction, ctx, words);
  const baseY = core.find((p) => p.id.includes("dominant") || p.id.includes("oversized") || p.id.includes("split-a"))?.y ?? ctx.focal.y;
  const decor = buildDecorativeMetadata(ctx, baseY, brief.product);

  void layout;
  return { typography: [...core, ...decor], decision };
}

export function evaluateHeroTypographyMatch(spec: LibraryArtworkSpec): HeroTypographyCompositionMatch {
  const decision = spec.heroTypographyDirection;
  const direction = decision ? getHeroTypographyDirection(decision.direction) : null;
  const mismatches: string[] = [];
  const penalties: string[] = [];
  const conceptHits: HeroTypographyCompositionMatch["conceptHits"] = [];

  const compositionShare = estimateTypographyCompositionShare(spec.typography, spec.layoutZones.safeZone);
  const sizes = spec.typography.filter((t) => t.layer === "typography").map((t) => t.size);
  const uniqueScales = new Set(sizes.map((s) => Math.round(s / 4)));

  if (spec.typography.some((t) => t.variant === "ghost")) conceptHits.push("ghost-typography");
  if (spec.typography.some((t) => t.variant === "cropped" || t.clipPathId)) conceptHits.push("cropped-typography");
  if (spec.typography.some((t) => t.variant === "offset")) conceptHits.push("offset-headline");
  if (spec.typography.some((t) => t.variant === "stretched")) conceptHits.push("broken-type");
  if (spec.typography.some((t) => t.role === "vertical-text")) conceptHits.push("secondary-type-system");
  if (spec.typography.some((t) => t.variant === "micro" || t.role === "micro-label")) {
    conceptHits.push("micro-editorial-caption");
  }
  if (spec.typography.some((t) => t.role === "collection-code")) conceptHits.push("museum-label");
  if (uniqueScales.size >= 3) conceptHits.push("multi-scale-hierarchy");
  if (spec.typography.filter((t) => t.layer === "typography").length >= 3) conceptHits.push("layered-type");
  if (sizes.some((s) => s >= spec.layoutZones.safeZone.width * 0.18)) conceptHits.push("oversized-type");
  if (spec.typography.some((t) => t.zOrder !== undefined && (t.zOrder ?? 0) > 1)) {
    conceptHits.push("typography-depth");
  }
  if (spec.typography.some((t) => t.variant === "ghost" && t.size >= spec.layoutZones.safeZone.width * 0.2)) {
    conceptHits.push("background-letterforms");
  }
  if (spec.typography.filter((t) => t.role === "headline" || t.role === "stacked-headline").length >= 2) {
    conceptHits.push("split-headline");
  }

  let score = 52;

  if (direction) {
    const [minShare, maxShare] = direction.compositionShare;
    const isMicroDirection = direction.id === "core-essential";
    if (compositionShare >= minShare && compositionShare <= maxShare + 0.08) score += 18;
    else if (isMicroDirection && compositionShare <= maxShare + 0.15) score += 12;
    else if (compositionShare >= minShare * 0.85) score += 8;
    else if (!isMicroDirection) {
      mismatches.push(`typography share ${Math.round(compositionShare * 100)}% outside ${Math.round(minShare * 100)}–${Math.round(maxShare * 100)}% target`);
    }

    for (const concept of direction.concepts) {
      if (conceptHits.includes(concept)) score += 6;
    }
  }

  if (uniqueScales.size >= 3) score += 12;
  else if (uniqueScales.size >= 2) score += 6;
  else penalties.push("insufficient type scale hierarchy");

  const audit = auditHeroTypography(spec.typography, spec.layoutZones, spec.brief.role);
  score += audit.score * 0.35;
  penalties.push(...audit.reasons);

  // Penalties — poster / logo / flat typography
  const typeBlocks = spec.typography.filter((t) => t.layer === "typography");
  if (typeBlocks.length <= 1) penalties.push("single text block");
  if (typeBlocks.length >= 2) {
    const fontSizes = typeBlocks.map((t) => t.size);
    const allSimilar = fontSizes.every((s) => Math.abs(s - fontSizes[0]!) < fontSizes[0]! * 0.12);
    if (allSimilar) penalties.push("equal font sizes");
  }

  const centeredOnly =
    typeBlocks.length === 1 &&
    typeBlocks[0]!.align === "middle" &&
    !spec.typography.some((t) => t.variant === "ghost" || t.variant === "cropped");
  if (centeredOnly) penalties.push("centered title only");

  for (const p of penalties) {
    if (p.includes("single text") || p.includes("centered title") || p.includes("poster")) score -= 14;
    else if (p.includes("equal font")) score -= 10;
    else score -= 6;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    aligned: mismatches.length === 0 && audit.passed && penalties.length <= 1,
    score,
    compositionShare,
    scaleCount: uniqueScales.size,
    conceptHits,
    mismatches,
    penalties,
  };
}

/** Score boost for template/style/layout when typography direction aligns. */
export function scoreHeroTypographyFit(
  template: TemplateDefinition,
  layout: LayoutDefinition,
  style: DesignStyleDefinition,
  decision: HeroTypographyDirectorDecision,
): number {
  const direction = getHeroTypographyDirection(decision.direction);
  let score = 0;
  if (direction.templateBias.includes(template.id)) score += 4;
  if (direction.layoutBias.includes(layout.id)) score += 3;
  if (direction.styleBias.includes(style.id)) score += 3;
  if (direction.templateAvoid.includes(template.id)) score -= 8;
  return score;
}

export { estimateTextWidth };
