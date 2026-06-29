export {
  assignWeightTier,
  buildWeightHierarchy,
  hasUniformWeight,
  type WeightTier,
  type WeightedElement,
} from "@/lib/design/design-library/composition-intelligence/visual-weight";

export {
  buildFocalSystem,
  hasFocalHierarchy,
  isCenteredLogoComposition,
  type FocalAnchor,
  type FocalSystem,
} from "@/lib/design/design-library/composition-intelligence/focal-system";

export {
  buildNegativeSpacePlan,
  hasPoorNegativeSpace,
  nudgeFromVoid,
  pointInVoid,
  type NegativeSpacePlan,
} from "@/lib/design/design-library/composition-intelligence/negative-space";

export { analyzeContrast, hasEqualWeightElements, type ContrastProfile } from "@/lib/design/design-library/composition-intelligence/contrast";

export { analyzeBalance, isPerfectlyCentered, type BalanceProfile } from "@/lib/design/design-library/composition-intelligence/balance";

export {
  analyzeScale,
  applyDramaticTypeScale,
  hasUniformScale,
  type ScaleProfile,
} from "@/lib/design/design-library/composition-intelligence/scale";

export {
  applyTypographyOverlap,
  buildOverlapPlan,
  textSitsUnderSymbol,
  type OverlapBand,
  type OverlapMode,
  type OverlapPlan,
} from "@/lib/design/design-library/composition-intelligence/overlap";

export {
  applyDepthToTypography,
  buildDepthPlan,
  type DepthElement,
  type DepthLayer,
  type DepthPlan,
} from "@/lib/design/design-library/composition-intelligence/depth";

export {
  buildMovementVector,
  hasWeakMovement,
  isStaticVerticalStack,
  type FlowDirection,
  type MovementVector,
} from "@/lib/design/design-library/composition-intelligence/movement";

export {
  resemblesConstructionDiagram,
  resemblesLogo,
  resolveEditorialProfile,
  type EditorialMode,
  type EditorialProfile,
} from "@/lib/design/design-library/composition-intelligence/editorial";

export {
  fashionEditorialScore,
  fashionLuxuryScore,
  resolveFashionProfile,
  type FashionHouse,
  type FashionProfile,
} from "@/lib/design/design-library/composition-intelligence/fashion";

export {
  isPosterScale,
  isWireframeBlueprint,
  resolveApparelContext,
  type ApparelContext,
  type GarmentZone,
} from "@/lib/design/design-library/composition-intelligence/apparel";

export {
  evaluateCompositionGate,
  HERO_COMPOSITION_MINIMUM,
  scoreComposition,
  type CompositionQualityGate,
  type CompositionScoreInput,
  type CreativeDirectorScore,
} from "@/lib/design/design-library/composition-intelligence/score";

export {
  applyDirectiveToContext,
  directComposition,
  logCompositionScore,
  type CompositionDirective,
  type DirectedComposition,
} from "@/lib/design/design-library/composition-intelligence/composition-director";
