import type { DesignQualityLayerInput } from "../types";
import type { DesignQualityScore } from "../types";
import type { DesignRuleViolation } from "../rules/design-rules";
import { QUALITY_PASS_THRESHOLD } from "../types";

export function scoreDesignQuality(
  input: DesignQualityLayerInput,
  violations: DesignRuleViolation[],
  graphicElementCount: number,
): DesignQualityScore {
  const { engine } = input;
  const { typographySpec, compositionSpec, commercialAssessment, graphicSpec, layoutSpec } =
    engine;

  const typographyQuality = scoreTypographyQuality(typographySpec, violations);
  const compositionQuality = scoreCompositionQuality(compositionSpec, graphicElementCount);
  const brandFit = Math.round(
    (commercialAssessment.milaeneDna + engine.creativeBrief.brandDnaValidation.score) / 2,
  );
  const fashionRelevance = commercialAssessment.fashionRelevance;
  const commercialStrength = Math.round(
    (commercialAssessment.commercialPotential + commercialAssessment.socialMediaAppeal) / 2,
  );
  const printReadiness = Math.round(
    (commercialAssessment.printability + compositionSpec.garmentFitScore) / 2,
  );

  const kittlBenchmarkScore = computeKittlBenchmark({
    typographyQuality,
    compositionQuality,
    brandFit,
    fashionRelevance,
    graphicDensity: graphicElementCount,
    negativeSpace: parseNegativeSpace(layoutSpec.negativeSpace.targetRatio),
    hasTextures: graphicSpec.textures.some((t) => t.type !== "none"),
    hasLineSystems: graphicSpec.lineSystems.length >= 2,
    violationCount: violations.length,
  });

  const dimensions = [
    typographyQuality,
    compositionQuality,
    brandFit,
    fashionRelevance,
    commercialStrength,
    printReadiness,
    kittlBenchmarkScore,
  ];
  const overall = Math.round(dimensions.reduce((sum, v) => sum + v, 0) / dimensions.length);

  const issues = [
    ...violations.map((v) => v.message),
    ...compositionSpec.issues,
  ].slice(0, 6);

  const recommendations = [
    ...compositionSpec.recommendations,
    ...buildQualityRecommendations(violations, graphicElementCount, typographyQuality),
  ].slice(0, 5);

  return {
    overall,
    typographyQuality,
    compositionQuality,
    brandFit,
    fashionRelevance,
    commercialStrength,
    printReadiness,
    kittlBenchmarkScore,
    passed: overall >= QUALITY_PASS_THRESHOLD && kittlBenchmarkScore >= QUALITY_PASS_THRESHOLD,
    issues,
    recommendations,
  };
}

function scoreTypographyQuality(
  typography: DesignQualityLayerInput["engine"]["typographySpec"],
  violations: DesignRuleViolation[],
): number {
  let score = 72;

  const hero = typography.blocks.find((b) => b.role === "hero");
  if (hero) {
    if (hero.letterSpacingMm >= 2.5) score += 8;
    if (hero.fontSizeMm >= 8) score += 5;
    if (hero.textTransform === "uppercase") score += 4;
  }

  const blockCount = typography.blocks.length;
  if (blockCount >= 2 && blockCount <= 4) score += 6;
  if (blockCount === 1) score += 3;

  if (typography.luxuryRules.length >= 3) score += 4;

  const typoViolations = violations.filter(
    (v) =>
      v.rule.includes("text") ||
      v.rule.includes("milaene") ||
      v.rule.includes("spacing"),
  );
  score -= typoViolations.length * 8;

  return clamp(score);
}

function scoreCompositionQuality(
  composition: DesignQualityLayerInput["engine"]["compositionSpec"],
  graphicCount: number,
): number {
  let score = composition.score;

  if (graphicCount >= 4) score += 6;
  if (composition.proportions.negativeSpaceShare >= 55) score += 5;
  if (composition.balance === "asymmetrical") score += 3;

  return clamp(score);
}

function computeKittlBenchmark(input: {
  typographyQuality: number;
  compositionQuality: number;
  brandFit: number;
  fashionRelevance: number;
  graphicDensity: number;
  negativeSpace: number;
  hasTextures: boolean;
  hasLineSystems: boolean;
  violationCount: number;
}): number {
  let score = 68;

  score += input.typographyQuality * 0.12;
  score += input.compositionQuality * 0.1;
  score += input.brandFit * 0.08;
  score += input.fashionRelevance * 0.08;

  if (input.graphicDensity >= 5) score += 10;
  else if (input.graphicDensity >= 3) score += 6;

  if (input.negativeSpace >= 55) score += 6;
  if (input.hasTextures) score += 4;
  if (input.hasLineSystems) score += 5;

  score -= input.violationCount * 5;

  return clamp(Math.round(score));
}

function parseNegativeSpace(ratio: string): number {
  const match = ratio.match(/(\d+)/);
  return match ? parseInt(match[1]!, 10) : 50;
}

function buildQualityRecommendations(
  violations: DesignRuleViolation[],
  graphicCount: number,
  typographyQuality: number,
): string[] {
  const recs: string[] = [];

  if (violations.some((v) => v.rule === "premium-composition")) {
    recs.push("Add perimeter lines, arcs, and registration marks for Kittl-level composition");
  }
  if (graphicCount < 4) {
    recs.push("Enrich with abstract graphic systems — avoid text-only poster layout");
  }
  if (typographyQuality < 80) {
    recs.push("Increase hero tracking and consolidate to 3–5 text blocks maximum");
  }

  return recs;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
