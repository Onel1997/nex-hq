import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { FocalSystem } from "@/lib/design/design-library/composition-intelligence/focal-system";
import type { NegativeSpacePlan } from "@/lib/design/design-library/composition-intelligence/negative-space";
import type { ContrastProfile } from "@/lib/design/design-library/composition-intelligence/contrast";
import type { BalanceProfile } from "@/lib/design/design-library/composition-intelligence/balance";
import type { ScaleProfile } from "@/lib/design/design-library/composition-intelligence/scale";
import type { OverlapPlan } from "@/lib/design/design-library/composition-intelligence/overlap";
import type { DepthPlan } from "@/lib/design/design-library/composition-intelligence/depth";
import type { MovementVector } from "@/lib/design/design-library/composition-intelligence/movement";
import type { EditorialProfile } from "@/lib/design/design-library/composition-intelligence/editorial";
import type { FashionProfile } from "@/lib/design/design-library/composition-intelligence/fashion";
import type { ApparelContext } from "@/lib/design/design-library/composition-intelligence/apparel";
import {
  hasFocalHierarchy,
  isCenteredLogoComposition,
} from "@/lib/design/design-library/composition-intelligence/focal-system";
import { hasPoorNegativeSpace } from "@/lib/design/design-library/composition-intelligence/negative-space";
import { hasEqualWeightElements } from "@/lib/design/design-library/composition-intelligence/contrast";
import { isPerfectlyCentered } from "@/lib/design/design-library/composition-intelligence/balance";
import { textSitsUnderSymbol } from "@/lib/design/design-library/composition-intelligence/overlap";
import { isStaticVerticalStack } from "@/lib/design/design-library/composition-intelligence/movement";
import {
  resemblesConstructionDiagram,
  resemblesLogo,
} from "@/lib/design/design-library/composition-intelligence/editorial";
import { fashionEditorialScore, fashionLuxuryScore } from "@/lib/design/design-library/composition-intelligence/fashion";
import { isPosterScale } from "@/lib/design/design-library/composition-intelligence/apparel";
import type { Rect } from "@/lib/design/design-library/types";

export const HERO_COMPOSITION_MINIMUM = 92;

export interface CreativeDirectorScore {
  luxuryFeeling: number;
  editorialFeeling: number;
  fashionFeeling: number;
  apparelFeeling: number;
  visualTension: number;
  hierarchy: number;
  negativeSpace: number;
  movement: number;
  depth: number;
  originality: number;
  overall: number;
}

export interface CompositionQualityGate {
  passed: boolean;
  reason?: string;
  score: CreativeDirectorScore;
}

export interface CompositionScoreInput {
  focal: FocalSystem;
  negativeSpace: NegativeSpacePlan;
  contrast: ContrastProfile;
  balance: BalanceProfile;
  scale: ScaleProfile;
  overlap: OverlapPlan;
  depth: DepthPlan;
  movement: MovementVector;
  editorial: EditorialProfile;
  fashion: FashionProfile;
  apparel: ApparelContext;
  typography: TypographyPlacement[];
  safeZone: Rect;
  elementCount: number;
  seed: number;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreHierarchy(focal: FocalSystem): number {
  if (!hasFocalHierarchy(focal)) return 42;
  const gap = focal.primary.weight.score - focal.secondary.weight.score;
  return clamp(58 + gap * 0.6);
}

function scoreNegativeSpace(plan: NegativeSpacePlan, elementCount: number): number {
  if (hasPoorNegativeSpace(plan, elementCount)) return 38;
  let score = 55 + plan.voidRatio * 80;
  if (plan.voidRatio >= 0.2) score += 12;
  if (plan.luxuryVoids.length >= 1) score += 8;
  return clamp(score);
}

function scoreVisualTension(
  contrast: ContrastProfile,
  balance: BalanceProfile,
  overlap: OverlapPlan,
): number {
  let score = (contrast.score + balance.score + overlap.score) / 3;
  if (balance.asymmetryIndex >= 0.15) score += 8;
  if (contrast.sizeRatio >= 4) score += 6;
  return clamp(score);
}

function scoreOriginality(seed: number, editorial: EditorialProfile, fashion: FashionProfile): number {
  return clamp(55 + (seed % 17) + editorial.brokenAlignment * 25 + fashion.geometrySubtlety * 12);
}

export function scoreComposition(input: CompositionScoreInput): CreativeDirectorScore {
  const hierarchy = scoreHierarchy(input.focal);
  const negativeSpace = scoreNegativeSpace(input.negativeSpace, input.elementCount);
  const movement = input.movement.score;
  const depth = input.depth.score;
  const visualTension = scoreVisualTension(input.contrast, input.balance, input.overlap);
  const luxuryFeeling = fashionLuxuryScore(input.fashion);
  const editorialFeeling = fashionEditorialScore(input.fashion);
  const fashionFeeling = input.fashion.score;
  const apparelFeeling = input.apparel.score;
  const originality = scoreOriginality(input.seed, input.editorial, input.fashion);

  const overall = clamp(
    luxuryFeeling * 0.12 +
      editorialFeeling * 0.11 +
      fashionFeeling * 0.1 +
      apparelFeeling * 0.12 +
      visualTension * 0.11 +
      hierarchy * 0.12 +
      negativeSpace * 0.1 +
      movement * 0.08 +
      depth * 0.07 +
      originality * 0.07,
  );

  return {
    luxuryFeeling,
    editorialFeeling,
    fashionFeeling,
    apparelFeeling,
    visualTension,
    hierarchy,
    negativeSpace,
    movement,
    depth,
    originality,
    overall,
  };
}

export function evaluateCompositionGate(
  input: CompositionScoreInput,
  isHero: boolean,
): CompositionQualityGate {
  const score = scoreComposition(input);

  const reject = (reason: string): CompositionQualityGate => ({
    passed: false,
    reason,
    score,
  });

  if (resemblesLogo(input.editorial, input.balance.asymmetryIndex)) {
    return reject("design resembles a logo");
  }
  if (resemblesConstructionDiagram(input.editorial, input.elementCount)) {
    return reject("design resembles a construction diagram");
  }
  if (isPerfectlyCentered(input.balance)) {
    return reject("everything is centered");
  }
  if (isCenteredLogoComposition(input.focal, input.safeZone)) {
    return reject("perfectly centered logo composition");
  }
  if (textSitsUnderSymbol(input.typography, input.focal)) {
    return reject("text sits underneath a symbol");
  }
  if (hasEqualWeightElements(input.contrast)) {
    return reject("all elements have equal weight");
  }
  if (isStaticVerticalStack(input.movement, input.safeZone)) {
    return reject("composition feels static — vertical stack");
  }
  if (!hasFocalHierarchy(input.focal)) {
    return reject("composition lacks focal hierarchy");
  }
  if (hasPoorNegativeSpace(input.negativeSpace, input.elementCount)) {
    return reject("negative space is poor");
  }
  if (input.movement.score < 48) {
    return reject("visual rhythm is weak");
  }
  if (isPosterScale(input.apparel) && isHero) {
    return reject("poster scale, not garment scale");
  }

  const minimum = isHero ? HERO_COMPOSITION_MINIMUM : 78;
  if (score.overall < minimum) {
    return reject(`creative director score ${score.overall} below ${minimum}`);
  }

  return { passed: true, score };
}
