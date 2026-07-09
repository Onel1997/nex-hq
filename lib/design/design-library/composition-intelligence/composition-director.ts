import type { PremiumRenderContext, PremiumTemplateLayoutConfig } from "@/lib/design/design-library/templates/premium/types";
import type { TypographyPlacement } from "@/lib/design/design-library/types";
import { buildWeightHierarchy } from "@/lib/design/design-library/composition-intelligence/visual-weight";
import {
  buildFocalSystem,
  type FocalSystem,
} from "@/lib/design/design-library/composition-intelligence/focal-system";
import { buildNegativeSpacePlan } from "@/lib/design/design-library/composition-intelligence/negative-space";
import { analyzeContrast } from "@/lib/design/design-library/composition-intelligence/contrast";
import { analyzeBalance } from "@/lib/design/design-library/composition-intelligence/balance";
import { analyzeScale, applyDramaticTypeScale } from "@/lib/design/design-library/composition-intelligence/scale";
import { buildOverlapPlan, applyTypographyOverlap } from "@/lib/design/design-library/composition-intelligence/overlap";
import { buildDepthPlan, applyDepthToTypography } from "@/lib/design/design-library/composition-intelligence/depth";
import { buildMovementVector } from "@/lib/design/design-library/composition-intelligence/movement";
import { resolveEditorialProfile } from "@/lib/design/design-library/composition-intelligence/editorial";
import { resolveFashionProfile } from "@/lib/design/design-library/composition-intelligence/fashion";
import { resolveApparelContext } from "@/lib/design/design-library/composition-intelligence/apparel";
import {
  evaluateCompositionGate,
  scoreComposition,
  HERO_COMPOSITION_MINIMUM,
  type CompositionQualityGate,
  type CompositionScoreInput,
  type CreativeDirectorScore,
} from "@/lib/design/design-library/composition-intelligence/score";
import { isPremiumTypographyRole } from "@/lib/design/design-library/templates/premium/shared/typography-artwork";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export interface CompositionDirective {
  focal: FocalSystem;
  adjustedFocal: { x: number; y: number };
  adjustedHeroScale: number;
  ghostTypography: TypographyPlacement[];
  movementAngle: number;
  edgeBleed: number;
  score: CreativeDirectorScore;
}

export interface DirectedComposition {
  directive: CompositionDirective;
  typography: TypographyPlacement[];
  gate: CompositionQualityGate;
}

/** Senior apparel creative director — composes, never assembles. */
export function directComposition(
  ctx: PremiumRenderContext,
  layout: PremiumTemplateLayoutConfig,
  typography: TypographyPlacement[],
  elementCount: number,
): DirectedComposition {
  const { seed, safeZone, focal, heroScale, spec } = ctx;
  const weights = buildWeightHierarchy(seed, heroScale);
  const focalSystem = buildFocalSystem(
    safeZone,
    focal,
    heroScale,
    weights,
    seed,
    layout.asymmetry,
  );

  const negativeSpace = buildNegativeSpacePlan(safeZone, focalSystem, seed, layout.negativeSpaceBias);
  const overlap = buildOverlapPlan(focalSystem, seed);
  const movement = buildMovementVector(focalSystem, safeZone, seed);
  const editorial = resolveEditorialProfile(layout);
  const fashion = resolveFashionProfile(spec.style.id, spec.brief.visualConcept);
  const apparel = resolveApparelContext(ctx);

  const preserveArtwork = isPremiumTypographyRole(spec.brief.role);
  let enhancedType = preserveArtwork
    ? typography
    : applyTypographyOverlap(typography, focalSystem, overlap, seed);
  if (!preserveArtwork) {
    enhancedType = applyDramaticTypeScale(enhancedType, focalSystem, seed);
  }

  const depth = buildDepthPlan(focalSystem, enhancedType, seed, layout.depthOpacity);
  enhancedType = preserveArtwork
    ? enhancedType
    : [...applyDepthToTypography(enhancedType, depth), ...depth.ghostTypography];

  const contrast = analyzeContrast(focalSystem, enhancedType);
  const balance = analyzeBalance(focalSystem, enhancedType, safeZone);
  const scale = analyzeScale(focalSystem, enhancedType);

  const scoreInput: CompositionScoreInput = {
    focal: focalSystem,
    negativeSpace,
    contrast,
    balance,
    scale,
    overlap,
    depth,
    movement,
    editorial,
    fashion,
    apparel,
    typography: enhancedType,
    safeZone,
    elementCount,
    seed,
  };

  const isPremium = isPremiumTypographyRole(spec.brief.role);
  const gate = evaluateCompositionGate(scoreInput, isPremium);
  const score = gate.score;

  const asymShiftX = range(seed, 1400, -safeZone.width * 0.06, safeZone.width * 0.06);
  const asymShiftY = range(seed, 1401, -safeZone.height * 0.04, safeZone.height * 0.04);

  const directive: CompositionDirective = {
    focal: focalSystem,
    adjustedFocal: {
      x: snap(focalSystem.primary.x + asymShiftX),
      y: snap(focalSystem.primary.y + asymShiftY),
    },
    adjustedHeroScale: focalSystem.primary.scale,
    ghostTypography: depth.ghostTypography,
    movementAngle: movement.diagonalAngle,
    edgeBleed: apparel.edgeBleed,
    score,
  };

  return { directive, typography: enhancedType, gate };
}

/** Applies composition intelligence to render context focal point. */
export function applyDirectiveToContext(
  ctx: PremiumRenderContext,
  directive: CompositionDirective,
): PremiumRenderContext {
  return {
    ...ctx,
    focal: directive.adjustedFocal,
    heroScale: directive.adjustedHeroScale,
  };
}

export function logCompositionScore(templateId: string, score: CreativeDirectorScore, passed: boolean): void {
  const status = passed ? "PASSED" : "REJECTED";
  console.log(`[COMPOSITION INTELLIGENCE] ${templateId}: ${status} — score ${score.overall}/100`);
  console.log(
    `[COMPOSITION INTELLIGENCE] luxury=${score.luxuryFeeling} editorial=${score.editorialFeeling} fashion=${score.fashionFeeling} apparel=${score.apparelFeeling}`,
  );
  console.log(
    `[COMPOSITION INTELLIGENCE] tension=${score.visualTension} hierarchy=${score.hierarchy} negativeSpace=${score.negativeSpace} movement=${score.movement} depth=${score.depth}`,
  );
}

export { scoreComposition, evaluateCompositionGate, HERO_COMPOSITION_MINIMUM };
