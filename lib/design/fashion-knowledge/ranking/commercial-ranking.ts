import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { FashionDesignEngineResult } from "@/lib/design/fashion-design-engine/types";
import type { CommercialDesignRanking } from "../types";
import { COMMERCIAL_EXPORT_THRESHOLD, meetsExportScoreThresholds } from "../types";

export interface CommercialRankingInput {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  engine: FashionDesignEngineResult;
}

/**
 * Phase 4 — Commercial Design Ranking across 8 dimensions.
 * Export approved only when overall >= 90.
 */
export function scoreCommercialDesignRanking(
  input: CommercialRankingInput,
): CommercialDesignRanking {
  const { brief, concept, engine } = input;
  const { creativeBrief, typographySpec, compositionSpec, commercialAssessment, graphicSpec } =
    engine;

  const typography = scoreTypography(typographySpec, creativeBrief);
  const composition = Math.round(compositionSpec.score);
  const fashion = commercialAssessment.fashionRelevance;
  const originality = creativeBrief.originalityAnalysis.score;
  const luxury = scoreLuxury(engine, concept);
  const printability = commercialAssessment.printability;
  const commercial = commercialAssessment.commercialPotential;
  const brandDna = creativeBrief.brandDnaValidation.score;

  const dimensions = [typography, composition, fashion, originality, luxury, printability, commercial, brandDna];
  const overall = Math.round(dimensions.reduce((sum, v) => sum + v, 0) / dimensions.length);

  const explanations = [
    `Typography (${typography}): hierarchy, tracking, vector-only spec`,
    `Composition (${composition}): balance, void, garment fit ${compositionSpec.garmentFitScore}`,
    `Fashion (${fashion}): ${concept.fashionLanguage.mood}`,
    `Originality (${originality}): ${creativeBrief.originalityAnalysis.differentiation.slice(0, 80)}`,
    `Luxury (${luxury}): negative space ${compositionSpec.proportions.negativeSpaceShare}%`,
    `Printability (${printability}): ${graphicSpec.colorApplication.length} inks, vector pipeline`,
    `Commercial (${commercial}): ${brief.product} at ${brief.campaignPotential ?? "medium"} potential`,
    `Brand DNA (${brandDna}): ${creativeBrief.brandDnaValidation.passed ? "passed" : "review"}`,
    `Overall ${overall}/100 — export ${overall >= COMMERCIAL_EXPORT_THRESHOLD ? "approved" : "blocked"}`,
  ];

  return {
    typography,
    composition,
    fashion,
    originality,
    luxury,
    printability,
    commercial,
    brandDna,
    overall,
    exportApproved: meetsExportScoreThresholds({
      typography,
      composition,
      fashion,
      originality,
      luxury,
      printability,
      commercial,
      brandDna,
      overall,
      exportApproved: false,
      explanations,
    }),
    explanations,
  };
}

function scoreTypography(
  typography: FashionDesignEngineResult["typographySpec"],
  creative: FashionDesignEngineResult["creativeBrief"],
): number {
  let score = 72;
  const hero = typography.blocks.find((b) => b.role === "hero");
  if (hero) {
    if (hero.letterSpacingMm >= 2.5) score += 8;
    if (hero.textTransform === "uppercase") score += 4;
    if (hero.fontSizeMm >= 7) score += 4;
  }
  if (typography.blocks.length <= 3) score += 6;
  if (typography.renderMode === "vector-only") score += 5;
  if (creative.brandDnaValidation.passed) score += 3;
  return Math.min(100, score);
}

function scoreLuxury(
  engine: FashionDesignEngineResult,
  concept: DesignConcept,
): number {
  let score = 70;
  const voidShare = engine.compositionSpec.proportions.negativeSpaceShare;
  if (voidShare >= 60) score += 12;
  else if (voidShare >= 50) score += 6;
  if (concept.fashionLanguage.luxurySignals.length >= 2) score += 8;
  if (engine.graphicSpec.lineSystems.length >= 2) score += 5;
  if (engine.creativeBrief.brandDnaValidation.passed) score += 5;
  return Math.min(100, score);
}
