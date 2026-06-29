import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  LibraryArtworkSpec,
  QualityScoreBreakdown,
  QualityValidationResult,
  HeroVisualAuditResult,
  SymbolId,
} from "@/lib/design/design-library/types";

const WEIGHTS = {
  visualBalance: 0.1,
  typographyHierarchy: 0.12,
  luxuryFeeling: 0.09,
  apparelReadiness: 0.14,
  compositionRichness: 0.05,
  originality: 0.08,
  emotionalTranslation: 0.09,
  negativeSpaceUse: 0.08,
  printReadiness: 0.1,
  brandConsistency: 0.07,
  commercialPotential: 0.08,
} as const;

const HERO_WEIGHTS = {
  apparelReadiness: 0.28,
  compositionRichness: 0.32,
  visualBalance: 0.06,
  typographyHierarchy: 0.1,
  luxuryFeeling: 0.05,
  originality: 0.04,
  emotionalTranslation: 0.04,
  negativeSpaceUse: 0.03,
  printReadiness: 0.04,
  brandConsistency: 0.02,
  commercialPotential: 0.02,
} as const;

export const QUIET_LUXURY_MICRO_TEMPLATE_IDS = new Set(["micro-graphic", "minimal-emblem"]);

const BLUEPRINT_TEMPLATES = new Set(["technical-blueprint"]);

const RICH_TEMPLATES = new Set([
  "editorial-poster",
  "faith-collection",
  "oversized-graphic",
  "gallery-composition",
  "monochrome-symbol",
  "luxury-wordmark",
]);

const CIRCLE_ARC_SYMBOLS = new Set<SymbolId>([
  "broken-circle",
  "interrupted-arc",
  "half-circle",
  "split-circle",
  "orbit",
  "halo",
]);

const HERO_TEMPLATE_SCORE_CAPS: Partial<Record<string, number>> = {
  "luxury-wordmark": 78,
  "minimal-emblem": 76,
  "micro-graphic": 72,
};

const SECONDARY_GEOMETRY_ORNAMENTS = new Set([
  "editorial-dividers",
  "vertical-rules",
  "flank-strikes",
  "luxury-borders",
  "coordinates",
  "rule-lines",
  "micro-lines",
]);

const LOGO_MARK_LAYOUTS = new Set(["center-chest", "micro-chest", "symbol-above-type"]);

const HERO_LOGO_TEMPLATES = new Set(["luxury-wordmark", "minimal-emblem", "micro-graphic"]);

export function isHeroRole(role: string): boolean {
  return role.toLowerCase().includes("hero");
}

export function getRoleMinimumScore(role: string): number {
  const r = role.toLowerCase();
  if (r.includes("hero")) return 82;
  if (r.includes("core essential") || r.includes("core-essential")) return 74;
  if (r.includes("statement")) return 78;
  if (r.includes("supporting")) return 70;
  if (r.includes("limited")) return 76;
  if (r.includes("essential")) return 74;
  return 74;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countTypographyLayers(spec: LibraryArtworkSpec): number {
  return spec.typography.filter((t) => t.layer === "typography").length;
}

function countDecorTypography(spec: LibraryArtworkSpec): number {
  return spec.typography.filter((t) => t.layer === "decorative").length;
}

function countCompositionLayers(spec: LibraryArtworkSpec): number {
  const symbolZones = new Set(spec.symbols.map((s) => s.zone)).size;
  const ornamentKinds = new Set(spec.ornaments.map((o) => o.ornamentId)).size;
  const typeLayers = new Set(spec.typography.map((t) => t.layer)).size;
  return symbolZones + ornamentKinds + typeLayers;
}

function hasHeadlineHierarchy(spec: LibraryArtworkSpec): boolean {
  const roles = new Set(spec.typography.map((t) => t.role));
  return roles.has("headline") || roles.has("stacked-headline");
}

function hasSubHierarchy(spec: LibraryArtworkSpec): boolean {
  const roles = new Set(spec.typography.map((t) => t.role));
  return (
    roles.has("subheadline") ||
    roles.has("roman-numeral") ||
    roles.has("collection-code") ||
    roles.has("coordinates")
  );
}

function hasStrongFocalHierarchy(spec: LibraryArtworkSpec): boolean {
  if (!hasHeadlineHierarchy(spec)) return false;
  const headline = spec.typography.find(
    (t) => t.role === "headline" || t.role === "stacked-headline",
  );
  const sub = spec.typography.find((t) => t.role === "subheadline");
  if (!headline) return false;
  if (sub) return headline.size >= sub.size * 1.6;
  return hasSubHierarchy(spec) && countDecorTypography(spec) >= 2;
}

function hasSecondaryCompositionLayer(spec: LibraryArtworkSpec): boolean {
  const secondarySymbols = spec.symbols.filter((s) => s.zone === "secondary" || s.zone === "accent");
  if (secondarySymbols.length >= 1) return true;
  if (spec.layoutZones.anchors.secondary) return true;
  if (spec.ornaments.some((o) => SECONDARY_GEOMETRY_ORNAMENTS.has(o.ornamentId))) return true;
  return false;
}

function hasApparelScaleComposition(spec: LibraryArtworkSpec): boolean {
  const oversizedLayout =
    spec.layout.id.includes("oversized") ||
    spec.layout.id === "gallery-layout" ||
    spec.layout.id === "editorial-layout" ||
    spec.layout.id === "wrap-composition";
  const heroRatio = spec.layoutZones.heroZone.height / spec.layoutZones.safeZone.height;
  const density = elementDensity(spec);
  return (
    oversizedLayout ||
    spec.style.preferredPrintScale === "oversized" ||
    (heroRatio >= 0.44 && density >= 5)
  );
}

function hasStructuralSymbol(spec: LibraryArtworkSpec): boolean {
  return spec.symbols.some((s) => !CIRCLE_ARC_SYMBOLS.has(s.symbolId));
}

function hasMeaningfulSecondaryGeometry(spec: LibraryArtworkSpec): boolean {
  if (hasStructuralSymbol(spec)) return true;
  if (
    spec.ornaments.some((o) =>
      ["luxury-borders", "editorial-dividers", "vertical-rules", "flank-strikes", "registration-marks"].includes(
        o.ornamentId,
      ),
    )
  ) {
    return true;
  }
  return hasApparelScaleComposition(spec);
}

function isCircleArcTypoOnly(spec: LibraryArtworkSpec): boolean {
  if (spec.symbols.length === 0) return false;
  const allCircleArc = spec.symbols.every((s) => CIRCLE_ARC_SYMBOLS.has(s.symbolId));
  const thinType = countTypographyLayers(spec) < 2;
  return allCircleArc && thinType && !hasMeaningfulSecondaryGeometry(spec);
}

function looksLikeLogoMark(spec: LibraryArtworkSpec): boolean {
  const compactLayout =
    LOGO_MARK_LAYOUTS.has(spec.layout.id) ||
    (spec.layout.scaling.heroScale < 0.42 && spec.layout.balance === "symmetric");
  const circleArcDominant = spec.symbols.length > 0 && !hasStructuralSymbol(spec);

  if (HERO_LOGO_TEMPLATES.has(spec.template.id) && compactLayout && circleArcDominant) {
    return true;
  }

  const heroOnly =
    spec.symbols.filter((s) => s.zone === "hero").length <= 1 &&
    spec.symbols.filter((s) => s.zone !== "hero").length === 0;
  return compactLayout && heroOnly && (circleArcDominant || spec.ornaments.length < 3);
}

function isHeroEnriched(spec: LibraryArtworkSpec): boolean {
  return (
    spec.symbols.length >= 2 &&
    hasStructuralSymbol(spec) &&
    spec.ornaments.length >= 3 &&
    countTypographyLayers(spec) >= 2 &&
    hasSecondaryCompositionLayer(spec) &&
    hasStrongFocalHierarchy(spec) &&
    hasApparelScaleComposition(spec)
  );
}

function elementDensity(spec: LibraryArtworkSpec): number {
  return spec.symbols.length + spec.ornaments.length + spec.typography.length;
}

function isBlueprintLike(spec: LibraryArtworkSpec): boolean {
  if (BLUEPRINT_TEMPLATES.has(spec.template.id)) return true;
  const gridHeavy =
    spec.symbols.some((s) => s.symbolId === "grid" || s.symbolId === "compass") &&
    spec.ornaments.filter((o) => o.ornamentId === "coordinates" || o.ornamentId === "registration-marks").length >= 2;
  const typeThin = countTypographyLayers(spec) <= 1 && countDecorTypography(spec) <= 1;
  return gridHeavy && typeThin && spec.style.id === "technical-streetwear";
}

export function auditHeroVisualComplexity(spec: LibraryArtworkSpec): HeroVisualAuditResult {
  const symbolCount = spec.symbols.length;
  const ornamentCount = spec.ornaments.length;
  const typographyBlocks = countTypographyLayers(spec);
  const layerCount = countCompositionLayers(spec);

  console.log(
    `[DESIGN LIBRARY] Hero richness check: symbols=${symbolCount} ornaments=${ornamentCount} typography=${typographyBlocks} layers=${layerCount}`,
  );

  if (symbolCount < 2) {
    return { passed: false, reason: "symbolCount < 2", symbolCount, ornamentCount, typographyBlocks, layerCount };
  }
  if (ornamentCount < 3) {
    return { passed: false, reason: "ornamentCount < 3", symbolCount, ornamentCount, typographyBlocks, layerCount };
  }
  if (typographyBlocks < 2) {
    return { passed: false, reason: "typographyBlocks < 2", symbolCount, ornamentCount, typographyBlocks, layerCount };
  }
  if (!hasSecondaryCompositionLayer(spec)) {
    return { passed: false, reason: "no secondary composition layer", symbolCount, ornamentCount, typographyBlocks, layerCount };
  }
  if (!hasStrongFocalHierarchy(spec)) {
    return { passed: false, reason: "no strong focal hierarchy", symbolCount, ornamentCount, typographyBlocks, layerCount };
  }
  if (!hasApparelScaleComposition(spec)) {
    return { passed: false, reason: "no apparel-scale composition", symbolCount, ornamentCount, typographyBlocks, layerCount };
  }
  if (isCircleArcTypoOnly(spec)) {
    return {
      passed: false,
      reason: "primary visual is only circle/arc + typography",
      symbolCount,
      ornamentCount,
      typographyBlocks,
      layerCount,
    };
  }
  if (looksLikeLogoMark(spec)) {
    return {
      passed: false,
      reason: "design looks like logo mark instead of apparel artwork",
      symbolCount,
      ornamentCount,
      typographyBlocks,
      layerCount,
    };
  }
  if (HERO_LOGO_TEMPLATES.has(spec.template.id) && !hasStructuralSymbol(spec)) {
    return {
      passed: false,
      reason: "logo template without structural symbol system",
      symbolCount,
      ornamentCount,
      typographyBlocks,
      layerCount,
    };
  }

  return { passed: true, symbolCount, ornamentCount, typographyBlocks, layerCount };
}

function scoreVisualBalance(spec: LibraryArtworkSpec): number {
  let score = 62;
  if (spec.layout.balance === "symmetric" || spec.layout.balance === "optical") score += 12;
  if (spec.symbols.length >= 2) score += 8;
  if (spec.ornaments.length >= 3) score += 10;
  if (spec.layoutZones.anchors.secondary) score += 6;
  if (elementDensity(spec) >= 6) score += 8;
  if (elementDensity(spec) <= 3) score -= 18;
  return clamp(score);
}

function scoreTypographyHierarchy(spec: LibraryArtworkSpec): number {
  let score = 45;
  const typeCount = countTypographyLayers(spec);
  const decorCount = countDecorTypography(spec);
  if (hasHeadlineHierarchy(spec)) score += 18;
  if (hasSubHierarchy(spec)) score += 14;
  if (typeCount >= 2) score += 12;
  if (decorCount >= 2) score += 10;
  if (spec.template.hierarchy === "type-first" && hasHeadlineHierarchy(spec)) score += 8;
  if (typeCount <= 1 && decorCount <= 1) score -= 25;
  if (spec.typography.some((t) => t.tracking >= 0.3)) score += 6;
  return clamp(score);
}

function scoreLuxuryFeeling(spec: LibraryArtworkSpec): number {
  let score = 50;
  const luxuryStyles = new Set([
    "minimal-luxury",
    "silent-luxury",
    "monochrome-luxury",
    "editorial-fashion",
    "scandinavian-minimal",
  ]);
  if (luxuryStyles.has(spec.style.id)) score += 16;
  score += spec.style.negativeSpace * 40;
  if (spec.ornaments.some((o) => ["roman-ids", "tiny-capsules", "luxury-borders"].includes(o.ornamentId))) {
    score += 12;
  }
  if (spec.style.trackingWide >= 0.44) score += 8;
  if (spec.template.id === "technical-blueprint") score -= 20;
  return clamp(score);
}

function scoreApparelReadiness(spec: LibraryArtworkSpec): number {
  let score = 48;
  if (spec.symbols.length >= 2) score += 14;
  if (spec.ornaments.length >= 4) score += 14;
  if (countTypographyLayers(spec) >= 1 && hasSubHierarchy(spec)) score += 12;
  if (spec.layout.id.includes("oversized") || spec.layout.id === "center-chest") score += 8;
  if (hasApparelScaleComposition(spec)) score += 16;
  if (spec.symbols.length <= 1 && countTypographyLayers(spec) <= 1) score -= 30;
  if (elementDensity(spec) >= 7) score += 10;
  if (isBlueprintLike(spec)) score -= 22;
  if (looksLikeLogoMark(spec)) score -= 28;
  if (isCircleArcTypoOnly(spec)) score -= 32;
  return clamp(score);
}

function scoreCompositionRichness(spec: LibraryArtworkSpec): number {
  let score = 38;
  if (spec.symbols.length >= 2) score += 14;
  if (spec.symbols.length >= 3) score += 6;
  if (spec.ornaments.length >= 3) score += 14;
  if (spec.ornaments.length >= 5) score += 6;
  if (countTypographyLayers(spec) >= 2) score += 12;
  if (hasSecondaryCompositionLayer(spec)) score += 12;
  if (hasStrongFocalHierarchy(spec)) score += 10;
  if (hasApparelScaleComposition(spec)) score += 14;
  if (countDecorTypography(spec) >= 2) score += 6;
  if (isCircleArcTypoOnly(spec)) score -= 35;
  if (looksLikeLogoMark(spec)) score -= 30;
  if (elementDensity(spec) >= 8) score += 8;
  return clamp(score);
}

function scoreOriginality(spec: LibraryArtworkSpec): number {
  let score = 55;
  const uniqueSymbols = new Set(spec.symbols.map((s) => s.symbolId)).size;
  const uniqueOrnaments = new Set(spec.ornaments.map((o) => o.ornamentId)).size;
  score += uniqueSymbols * 6;
  score += uniqueOrnaments * 4;
  if (RICH_TEMPLATES.has(spec.template.id)) score += 8;
  if (spec.template.id === "minimal-emblem" && elementDensity(spec) < 5) score -= 10;
  return clamp(score);
}

function scoreEmotionalTranslation(spec: LibraryArtworkSpec): number {
  const text = `${spec.brief.visualConcept} ${spec.brief.designDescription} ${spec.brief.role}`.toLowerCase();
  let score = 58;
  if (text.includes("luxury") && spec.style.id.includes("luxury")) score += 12;
  if (text.includes("faith") && spec.template.id === "faith-collection") score += 14;
  if (text.includes("editorial") && spec.template.id === "editorial-poster") score += 12;
  if (text.includes("oversized") && spec.layout.id.includes("oversized")) score += 10;
  if (spec.template.hierarchy === spec.style.hierarchy) score += 8;
  return clamp(score);
}

function scoreNegativeSpaceUse(spec: LibraryArtworkSpec): number {
  const density = elementDensity(spec);
  const ideal = 6 + spec.style.negativeSpace * 10;
  const delta = Math.abs(density - ideal);
  let score = 70 - delta * 4;
  if (spec.style.negativeSpace >= 0.35 && density <= 8) score += 10;
  if (density <= 2) score -= 25;
  return clamp(score);
}

function scorePrintReadiness(spec: LibraryArtworkSpec): number {
  let score = spec.brief.printReadinessScore * 0.55;
  if (spec.effects.length >= 1) score += 8;
  if (spec.symbols.length >= 2 && spec.ornaments.length >= 3) score += 12;
  if (isBlueprintLike(spec)) score -= 15;
  if (spec.brief.colorPalette.length >= 2) score += 6;
  return clamp(score);
}

function scoreBrandConsistency(spec: LibraryArtworkSpec): number {
  let score = 60;
  if (spec.brief.dnaScore) score += spec.brief.dnaScore * 0.2;
  if (spec.colors.primary && spec.brief.colorPalette.length > 0) score += 12;
  if (spec.style.preferredSymbols.includes(spec.template.primarySymbol)) score += 10;
  return clamp(score);
}

function scoreCommercialPotential(spec: LibraryArtworkSpec): number {
  let score = 55;
  if (spec.brief.commercialScore) score += spec.brief.commercialScore * 0.35;
  if (RICH_TEMPLATES.has(spec.template.id)) score += 12;
  if (spec.template.hierarchy === "type-first" && countTypographyLayers(spec) >= 2) score += 8;
  return clamp(score);
}

function applyHeroTemplateCaps(spec: LibraryArtworkSpec, overall: number): number {
  const cap = HERO_TEMPLATE_SCORE_CAPS[spec.template.id];
  if (!cap) return overall;
  if (spec.template.id === "luxury-wordmark" && isHeroEnriched(spec)) return overall;
  return Math.min(overall, cap);
}

export function scoreArtworkSpec(spec: LibraryArtworkSpec): QualityScoreBreakdown {
  const breakdown = {
    visualBalance: scoreVisualBalance(spec),
    typographyHierarchy: scoreTypographyHierarchy(spec),
    luxuryFeeling: scoreLuxuryFeeling(spec),
    apparelReadiness: scoreApparelReadiness(spec),
    compositionRichness: scoreCompositionRichness(spec),
    originality: scoreOriginality(spec),
    emotionalTranslation: scoreEmotionalTranslation(spec),
    negativeSpaceUse: scoreNegativeSpaceUse(spec),
    printReadiness: scorePrintReadiness(spec),
    brandConsistency: scoreBrandConsistency(spec),
    commercialPotential: scoreCommercialPotential(spec),
    overall: 0,
  };

  const weights = isHeroRole(spec.brief.role) ? HERO_WEIGHTS : WEIGHTS;

  breakdown.overall = clamp(
    Object.entries(weights).reduce(
      (sum, [key, weight]) => sum + breakdown[key as keyof typeof weights] * weight,
      0,
    ),
  );

  if (isHeroRole(spec.brief.role)) {
    breakdown.overall = applyHeroTemplateCaps(spec, breakdown.overall);
  }

  return breakdown;
}

export function validateArtworkCandidate(
  spec: LibraryArtworkSpec,
  score: QualityScoreBreakdown,
  brief: DesignStudioBrief,
): QualityValidationResult {
  const typeBlocks = countTypographyLayers(spec);
  const symbolCount = spec.symbols.length;
  const isQuietMicro = QUIET_LUXURY_MICRO_TEMPLATE_IDS.has(spec.template.id);

  if (symbolCount <= 1 && typeBlocks <= 1 && !isQuietMicro) {
    return { valid: false, reason: "too simple: single symbol and single text block" };
  }

  if (score.typographyHierarchy < 52) {
    return { valid: false, reason: "low typography hierarchy" };
  }

  if (score.apparelReadiness < 55) {
    return { valid: false, reason: "weak apparel readiness" };
  }

  if (isBlueprintLike(spec)) {
    return { valid: false, reason: "blueprint/wireframe composition" };
  }

  if (isHeroRole(brief.role)) {
    const audit = auditHeroVisualComplexity(spec);
    if (!audit.passed && audit.reason) {
      console.log(`[DESIGN LIBRARY] Visual audit failed: ${audit.reason}`);
      return { valid: false, reason: `hero visual audit: ${audit.reason}` };
    }

    if (score.compositionRichness < 58) {
      return { valid: false, reason: "insufficient composition richness for hero" };
    }
  }

  const minimum = getRoleMinimumScore(brief.role);
  if (score.overall < minimum) {
    return { valid: false, reason: `overall score ${score.overall} below role minimum ${minimum}` };
  }

  return { valid: true };
}
