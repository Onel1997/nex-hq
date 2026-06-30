import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  DesignStyleDefinition,
  DesignStyleId,
  LayoutDefinition,
  LayoutId,
  LibraryArtworkSpec,
  TemplateDefinition,
  TemplateId,
} from "@/lib/design/design-library/types";
import { getBuyerCuriosityPattern } from "@/lib/design/design-knowledge/buyer-curiosity/curiosity-library";
import { decideBuyerCuriosityDirection } from "@/lib/design/design-knowledge/buyer-curiosity/curiosity-selector";
import { evaluateDesire } from "@/lib/design/design-knowledge/buyer-curiosity/desire";
import { evaluateIdentityPull } from "@/lib/design/design-knowledge/buyer-curiosity/identity";
import { evaluateMemorability } from "@/lib/design/design-knowledge/buyer-curiosity/memorability";
import { evaluatePremiumSimplicity } from "@/lib/design/design-knowledge/buyer-curiosity/premium-simplicity";
import { evaluateRecognizability } from "@/lib/design/design-knowledge/buyer-curiosity/recognition";
import { evaluateSocialShareability } from "@/lib/design/design-knowledge/buyer-curiosity/social-shareability";
import { evaluateVisualHook } from "@/lib/design/design-knowledge/buyer-curiosity/visual-hook";
import type {
  BuyerCuriosityAssessment,
  BuyerCuriosityCompositionMatch,
  BuyerCuriosityCompositionWeights,
  BuyerCuriosityDirectorDecision,
  BuyerCuriosityDimensionScores,
} from "@/lib/design/design-knowledge/buyer-curiosity/types";
import { evaluateLuxuryRestraint } from "@/lib/design/design-knowledge/wearability";
import { resolvePlacementProfile } from "@/lib/design/design-knowledge/wearability/placement";

function weightMapFromBias<T extends string>(bias: T[], baseWeight: number): Partial<Record<T, number>> {
  const map: Partial<Record<T, number>> = {};
  bias.forEach((id, index) => {
    map[id] = baseWeight - index;
  });
  return map;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function evaluateMystery(spec: LibraryArtworkSpec): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 48;
  const hasCropped = spec.typography.some((t) => t.variant === "cropped" || t.clipPathId);
  const hasGhost = spec.typography.some((t) => t.variant === "ghost");
  const hasPartial =
    hasCropped ||
    spec.typography.some((t) => t.textLength) ||
    spec.brief.visualConcept.toLowerCase().includes("interrupted");

  if (hasPartial) {
    score += 16;
    notes.push("partial reveal creates mystery");
  }
  if (hasGhost) {
    score += 12;
    notes.push("ghost layer adds emotional mystery");
  }
  if (spec.style.negativeSpace >= 0.4) {
    score += 10;
    notes.push("whitespace amplifies mystery gap");
  }
  if (spec.brief.visualConcept.toLowerCase().includes("silence") || spec.brief.title.toLowerCase().includes("silent")) {
    score += 10;
  }
  if (spec.ornaments.some((o) => ["registration-marks", "coordinates"].includes(o.ornamentId))) {
    score += 6;
  }

  const predictable =
    spec.layout.balance === "symmetric" &&
    !hasCropped &&
    !hasGhost &&
    spec.typography.filter((t) => t.layer === "typography").length <= 1;
  if (predictable) {
    score -= 14;
    notes.push("predictable layout kills mystery");
  }

  return { score: clamp(score), notes };
}

function evaluateCuriosityDimension(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
  visualHook: number,
  mystery: number,
): number {
  let score = visualHook * 0.35 + mystery * 0.35;
  const corpus = `${brief.visualConcept} ${brief.designDescription}`.toLowerCase();
  if (corpus.includes("between") || corpus.includes("only") || corpus.includes("interrupted")) score += 12;
  if (spec.typography.some((t) => t.variant === "cropped" || t.variant === "ghost")) score += 10;
  if (brief.title.split(/\s+/).length >= 2) score += 8;
  return clamp(score);
}

/** Full buyer curiosity assessment — scroll-stop psychology lens. */
export function evaluateBuyerCuriosity(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
  decision?: BuyerCuriosityDirectorDecision,
): BuyerCuriosityAssessment {
  const dir = decision ?? decideBuyerCuriosityDirection(brief, spec.seed);
  const pattern = getBuyerCuriosityPattern(dir.pattern);
  const visualHookResult = evaluateVisualHook(spec);
  const identityResult = evaluateIdentityPull(brief, spec);
  const memorabilityResult = evaluateMemorability(spec);
  const desireResult = evaluateDesire(brief, spec);
  const simplicityResult = evaluatePremiumSimplicity(spec);
  const shareResult = evaluateSocialShareability(brief, spec);
  const recognitionResult = evaluateRecognizability(brief, spec);
  const mysteryResult = evaluateMystery(spec);
  const placement = spec.wearabilityDirection
    ? spec.wearabilityDirection.placement
    : resolvePlacementProfile(brief);
  const restraint = evaluateLuxuryRestraint(spec, placement);

  const dimensions: BuyerCuriosityDimensionScores = {
    visualHook: visualHookResult.score,
    curiosity: evaluateCuriosityDimension(brief, spec, visualHookResult.score, mysteryResult.score),
    identity: identityResult.score,
    desire: desireResult.score,
    premiumSimplicity: simplicityResult.score,
    recognizability: recognitionResult.score,
    memorability: memorabilityResult.score,
    shareability: shareResult.score,
    luxuryRestraint: restraint.score,
    mystery: mysteryResult.score,
  };

  const rewards: string[] = [];
  const penalties: string[] = [
    ...visualHookResult.penalties,
    ...memorabilityResult.penalties,
    ...simplicityResult.penalties,
    ...shareResult.penalties,
  ];

  if (visualHookResult.hits.includes("dominant-focal-point")) rewards.push("one unforgettable focal point");
  if (visualHookResult.hits.includes("cropped-hero-word")) rewards.push("memorable typography");
  if (visualHookResult.hits.includes("dramatic-whitespace")) rewards.push("premium whitespace");
  if (restraint.feelsExpensive) rewards.push("premium restraint");
  if (mysteryResult.score >= 72) rewards.push("mystery");
  if (dimensions.curiosity >= 72) rewards.push("emotional curiosity");
  if (identityResult.score >= 72) rewards.push("identity expression");
  if (desireResult.score >= 72) rewards.push("premium fashion feel");

  for (const reward of pattern.rewards) {
    if (!rewards.includes(reward)) rewards.push(reward);
  }

  const overall = clamp(
    dimensions.visualHook * 0.14 +
      dimensions.curiosity * 0.12 +
      dimensions.identity * 0.1 +
      dimensions.desire * 0.1 +
      dimensions.premiumSimplicity * 0.1 +
      dimensions.recognizability * 0.08 +
      dimensions.memorability * 0.12 +
      dimensions.shareability * 0.1 +
      dimensions.luxuryRestraint * 0.07 +
      dimensions.mystery * 0.07,
  );

  const scrollStopPotential = clamp(
    dimensions.visualHook * 0.35 +
      dimensions.curiosity * 0.25 +
      dimensions.shareability * 0.2 +
      dimensions.memorability * 0.2,
  );

  const wouldBuySignal = clamp(
    dimensions.desire * 0.3 +
      dimensions.identity * 0.25 +
      dimensions.premiumSimplicity * 0.2 +
      dimensions.luxuryRestraint * 0.15 +
      overall * 0.1,
  );

  const wouldWearSignal = clamp(
    dimensions.identity * 0.3 +
      dimensions.premiumSimplicity * 0.3 +
      dimensions.luxuryRestraint * 0.25 +
      dimensions.desire * 0.15,
  );

  const desireSignal = clamp(dimensions.desire * 0.5 + dimensions.identity * 0.3 + dimensions.mystery * 0.2);

  const aligned =
    overall >= 68 &&
    visualHookResult.hits.length >= 2 &&
    penalties.filter((p) => p.includes("competing") || p.includes("noise") || p.includes("safe")).length === 0;

  return {
    dimensions,
    overall,
    scrollStopPotential,
    wouldBuySignal,
    wouldWearSignal,
    desireSignal,
    hookHits: visualHookResult.hits,
    patternHits: [dir.pattern],
    rewards,
    penalties,
    aligned,
  };
}

export function evaluateBuyerCuriosityMatch(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
): BuyerCuriosityCompositionMatch {
  const assessment = evaluateBuyerCuriosity(brief, spec);
  const mismatches: string[] = [];

  if (assessment.dimensions.visualHook < 70) mismatches.push("visual hook too weak for scroll-stop");
  if (assessment.dimensions.identity < 68) mismatches.push("identity pull reads as nice graphic, not must-have");
  if (assessment.dimensions.memorability < 68) mismatches.push("no unforgettable focal relationship");
  if (assessment.dimensions.premiumSimplicity < 65) mismatches.push("premium simplicity missing");
  if (assessment.penalties.some((p) => p.includes("competing"))) mismatches.push("multiple competing heroes");
  if (assessment.penalties.some((p) => p.includes("safe layout"))) mismatches.push("safe symmetric layout");
  if (assessment.penalties.some((p) => p.includes("generic"))) mismatches.push("generic editorial layout");

  return {
    ...assessment,
    score: assessment.overall,
    mismatches,
  };
}

export function buildBuyerCuriosityWeights(
  decision: BuyerCuriosityDirectorDecision,
): BuyerCuriosityCompositionWeights {
  const pattern = getBuyerCuriosityPattern(decision.pattern);
  return {
    templates: weightMapFromBias(pattern.templateBias, 6),
    layouts: weightMapFromBias(pattern.layoutBias, 5),
    styles: weightMapFromBias(pattern.styleBias, 4),
    patternBias: { [decision.pattern]: 8 },
  };
}

export function applyCuriosityTemplateScore(
  score: number,
  templateId: TemplateId,
  weights: BuyerCuriosityCompositionWeights,
): number {
  return score + (weights.templates[templateId] ?? 0);
}

export function applyCuriosityLayoutScore(
  score: number,
  layoutId: LayoutId,
  weights: BuyerCuriosityCompositionWeights,
): number {
  return score + (weights.layouts[layoutId] ?? 0);
}

export function applyCuriosityStyleScore(
  score: number,
  styleId: DesignStyleId,
  weights: BuyerCuriosityCompositionWeights,
): number {
  return score + (weights.styles[styleId] ?? 0);
}

export function curiosityRevisionOverrides(
  decision: BuyerCuriosityDirectorDecision,
): Partial<{ templateId: TemplateId; layoutId: LayoutId; styleId: DesignStyleId }> {
  const pattern = getBuyerCuriosityPattern(decision.pattern);
  return {
    templateId: pattern.templateBias[0],
    layoutId: pattern.layoutBias[0],
    styleId: pattern.styleBias[0],
  };
}

/** Apply buyer curiosity score boosts to a quality dimension (0–100). */
export function applyBuyerCuriosityBoost(
  baseScore: number,
  assessment: BuyerCuriosityAssessment,
  dimension: keyof BuyerCuriosityDimensionScores | "overall",
): number {
  const curiosityBoost = assessment.overall >= 72 ? 8 : assessment.overall >= 65 ? 5 : 0;
  const rewardBoost = Math.min(12, assessment.rewards.length * 2);
  const penalty = Math.min(16, assessment.penalties.length * 3);

  let boost = curiosityBoost + rewardBoost - penalty;

  if (dimension === "visualHook" || dimension === "shareability") {
    boost += assessment.scrollStopPotential >= 75 ? 10 : assessment.scrollStopPotential >= 68 ? 6 : 0;
  }
  if (dimension === "identity" || dimension === "desire") {
    boost += assessment.desireSignal >= 72 ? 8 : 0;
  }
  if (dimension === "premiumSimplicity" || dimension === "luxuryRestraint") {
    boost += assessment.dimensions.luxuryRestraint >= 68 ? 6 : 0;
  }
  if (dimension === "memorability") {
    boost += assessment.dimensions.memorability >= 72 ? 8 : 0;
  }
  if (dimension === "overall") {
    boost += assessment.scrollStopPotential >= 72 ? 6 : 0;
    boost += assessment.wouldBuySignal >= 72 ? 4 : 0;
  }

  return clamp(baseScore + boost);
}

export function scoreBuyerCuriosityFit(
  brief: DesignStudioBrief,
  template: TemplateDefinition,
  layout: LayoutDefinition,
  style: DesignStyleDefinition,
  seed: number,
): number {
  const decision = decideBuyerCuriosityDirection(brief, seed);
  const weights = buildBuyerCuriosityWeights(decision);
  let score = 0;
  score = applyCuriosityTemplateScore(score, template.id, weights);
  score = applyCuriosityLayoutScore(score, layout.id, weights);
  score = applyCuriosityStyleScore(score, style.id, weights);
  const pattern = getBuyerCuriosityPattern(decision.pattern);
  if (pattern.templateAvoid.includes(template.id)) score -= 8;
  return score;
}
