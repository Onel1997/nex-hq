import type { DesignStyleId, LayoutId, TemplateId } from "@/lib/design/design-library/types";

/** Buyer curiosity dimensions — scroll-stop psychology, not technical balance. */
export type BuyerCuriosityDimension =
  | "visualHook"
  | "curiosity"
  | "identity"
  | "desire"
  | "premiumSimplicity"
  | "recognizability"
  | "memorability"
  | "shareability"
  | "luxuryRestraint"
  | "mystery";

export type VisualHookPattern =
  | "partial-typography"
  | "cropped-hero-word"
  | "unexpected-overlap"
  | "dominant-focal-point"
  | "dramatic-whitespace"
  | "premium-tension";

export type CuriosityPatternId =
  | "scroll-stop-hook"
  | "identity-pull"
  | "mystery-gap"
  | "social-native"
  | "premium-restraint"
  | "unforgettable-focal";

export interface BuyerCuriosityPattern {
  id: CuriosityPatternId;
  name: string;
  dimensions: BuyerCuriosityDimension[];
  visualHooks: VisualHookPattern[];
  keywords: string[];
  styleBias: DesignStyleId[];
  layoutBias: LayoutId[];
  templateBias: TemplateId[];
  templateAvoid: TemplateId[];
  rewards: string[];
  penalties: string[];
}

export interface BuyerCuriosityDirectorDecision {
  pattern: CuriosityPatternId;
  visualHooks: VisualHookPattern[];
  confidence: number;
  reason: string;
}

export interface BuyerCuriosityDimensionScores {
  visualHook: number;
  curiosity: number;
  identity: number;
  desire: number;
  premiumSimplicity: number;
  recognizability: number;
  memorability: number;
  shareability: number;
  luxuryRestraint: number;
  mystery: number;
}

export interface BuyerCuriosityAssessment {
  dimensions: BuyerCuriosityDimensionScores;
  overall: number;
  scrollStopPotential: number;
  wouldBuySignal: number;
  wouldWearSignal: number;
  desireSignal: number;
  hookHits: VisualHookPattern[];
  patternHits: CuriosityPatternId[];
  rewards: string[];
  penalties: string[];
  aligned: boolean;
}

export interface BuyerCuriosityCompositionMatch extends BuyerCuriosityAssessment {
  score: number;
  mismatches: string[];
}

export interface BuyerCuriosityCompositionWeights {
  templates: Partial<Record<TemplateId, number>>;
  layouts: Partial<Record<LayoutId, number>>;
  styles: Partial<Record<DesignStyleId, number>>;
  patternBias: Partial<Record<CuriosityPatternId, number>>;
}
