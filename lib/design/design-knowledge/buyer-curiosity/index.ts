export type {
  BuyerCuriosityAssessment,
  BuyerCuriosityCompositionMatch,
  BuyerCuriosityCompositionWeights,
  BuyerCuriosityDimension,
  BuyerCuriosityDimensionScores,
  BuyerCuriosityDirectorDecision,
  BuyerCuriosityPattern,
  CuriosityPatternId,
  VisualHookPattern,
} from "@/lib/design/design-knowledge/buyer-curiosity/types";

export {
  BUYER_CURIOSITY_PATTERNS,
  getAllBuyerCuriosityPatterns,
  getBuyerCuriosityPattern,
} from "@/lib/design/design-knowledge/buyer-curiosity/curiosity-library";

export { decideBuyerCuriosityDirection } from "@/lib/design/design-knowledge/buyer-curiosity/curiosity-selector";

export {
  applyBuyerCuriosityBoost,
  applyCuriosityLayoutScore,
  applyCuriosityStyleScore,
  applyCuriosityTemplateScore,
  buildBuyerCuriosityWeights,
  curiosityRevisionOverrides,
  evaluateBuyerCuriosity,
  evaluateBuyerCuriosityMatch,
  scoreBuyerCuriosityFit,
} from "@/lib/design/design-knowledge/buyer-curiosity/curiosity-rules";

export { evaluateVisualHook } from "@/lib/design/design-knowledge/buyer-curiosity/visual-hook";
export { evaluateIdentityPull } from "@/lib/design/design-knowledge/buyer-curiosity/identity";
export { evaluateMemorability } from "@/lib/design/design-knowledge/buyer-curiosity/memorability";
export { evaluateDesire } from "@/lib/design/design-knowledge/buyer-curiosity/desire";
export { evaluatePremiumSimplicity } from "@/lib/design/design-knowledge/buyer-curiosity/premium-simplicity";
export { evaluateSocialShareability } from "@/lib/design/design-knowledge/buyer-curiosity/social-shareability";
export { evaluateRecognizability } from "@/lib/design/design-knowledge/buyer-curiosity/recognition";
