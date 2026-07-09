import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type {
  CompositionSpec,
  GraphicSpec,
  LayoutSpec,
  TypographySpec,
} from "../types";

export interface CompositionEngineInput {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  layoutSpec: LayoutSpec;
  typographySpec: TypographySpec;
  graphicSpec: GraphicSpec;
}

/**
 * Composition Engine — balances typography, graphics, whitespace, proportions.
 */
export function runCompositionEngine(input: CompositionEngineInput): CompositionSpec {
  const { brief, concept, layoutSpec, typographySpec, graphicSpec } = input;

  const typographyShare = estimateTypographyShare(typographySpec, graphicSpec);
  const graphicShare = estimateGraphicShare(graphicSpec);
  const negativeSpaceShare = estimateNegativeSpaceShare(layoutSpec, concept);

  const proportions = {
    typographyShare,
    graphicShare,
    negativeSpaceShare,
  };

  const issues = collectIssues(proportions, layoutSpec, typographySpec, graphicSpec);
  const recommendations = buildRecommendations(issues, layoutSpec, concept);
  const score = computeCompositionScore(proportions, issues, concept, brief);
  const garmentFitScore = computeGarmentFitScore(layoutSpec, concept);

  return {
    score,
    balance: concept.compositionLanguage.balance.toLowerCase().includes("asym")
      ? "asymmetrical"
      : "symmetrical",
    focalPoint: concept.heroFocus.focalPoint,
    proportions,
    whitespaceDistribution: layoutSpec.negativeSpace.targetRatio,
    typographyGraphicRatio: `${typographyShare}:${graphicShare} (type:graphic)`,
    garmentFitScore,
    issues,
    recommendations,
  };
}

function estimateTypographyShare(
  typography: TypographySpec,
  graphic: GraphicSpec,
): number {
  const blockCount = typography.blocks.length;
  const hasHero = typography.blocks.some((b) => b.role === "hero");
  let share = hasHero ? 45 : 20;
  share += blockCount * 8;
  if (graphic.symbols.length === 0 && graphic.lineSystems.length <= 1) {
    share += 15;
  }
  return Math.min(70, share);
}

function estimateGraphicShare(graphic: GraphicSpec): number {
  let share = graphic.symbols.length * 12;
  share += graphic.lineSystems.length * 8;
  share += graphic.abstractElements.length * 5;
  if (graphic.textures.some((t) => t.type !== "none")) share += 5;
  return Math.min(55, Math.max(10, share));
}

function estimateNegativeSpaceShare(
  layout: LayoutSpec,
  concept: DesignConcept,
): number {
  const ratioMatch = layout.negativeSpace.targetRatio.match(/(\d+)/);
  if (ratioMatch) return parseInt(ratioMatch[1]!, 10);

  const conceptMatch = concept.negativeSpaceProfile.targetRatio.match(/(\d+)/);
  if (conceptMatch) return parseInt(conceptMatch[1]!, 10);

  return 60;
}

function collectIssues(
  proportions: CompositionSpec["proportions"],
  layout: LayoutSpec,
  typography: TypographySpec,
  graphic: GraphicSpec,
): string[] {
  const issues: string[] = [];

  if (proportions.typographyShare + proportions.graphicShare > 50) {
    issues.push("Combined type and graphic density may crowd oversized garment negative space");
  }
  if (typography.blocks.length > 3) {
    issues.push("Typography block count exceeds Milaene maximum 1–2 visible text blocks guideline");
  }
  if (graphic.symbols.length > 4) {
    issues.push("Symbol count creates visual noise — consider reduction");
  }
  if (layout.garmentBalance.visualWeight === "heavy-top" && layout.printArea === "front") {
    issues.push("Heavy-top weight on front chest may fight dropped-shoulder drape");
  }
  if (proportions.negativeSpaceShare < 50) {
    issues.push("Negative space below 50% — risks merch-label density vs calm luxury");
  }

  return issues;
}

function buildRecommendations(
  issues: string[],
  layout: LayoutSpec,
  concept: DesignConcept,
): string[] {
  const recommendations: string[] = [];

  if (issues.some((i) => i.includes("negative space"))) {
    recommendations.push("Increase negative space to 60%+ by reducing secondary graphic elements");
  }
  if (issues.some((i) => i.includes("Typography block"))) {
    recommendations.push("Consolidate to single hero line with optional micro secondary");
  }
  if (issues.some((i) => i.includes("drape"))) {
    recommendations.push(layout.garmentBalance.droppedShoulderCompensation);
  }
  if (recommendations.length === 0) {
    recommendations.push("Composition balance acceptable — maintain editorial restraint at production");
    recommendations.push(`Preserve focal strategy: ${concept.compositionLanguage.focalStrategy}`);
  }

  return recommendations;
}

function computeCompositionScore(
  proportions: CompositionSpec["proportions"],
  issues: string[],
  concept: DesignConcept,
  brief: DesignStudioBrief,
): number {
  let score = 72;

  if (proportions.negativeSpaceShare >= 60) score += 10;
  else if (proportions.negativeSpaceShare >= 50) score += 5;

  if (proportions.typographyShare <= 50 && proportions.graphicShare <= 40) score += 8;

  if (concept.compositionLanguage.depthLayers <= 3) score += 5;
  if (brief.printReadinessScore >= 80) score += 5;

  score -= issues.length * 6;

  return Math.max(0, Math.min(100, score));
}

function computeGarmentFitScore(
  layout: LayoutSpec,
  concept: DesignConcept,
): number {
  let score = 70;

  if (layout.oversizedFitNotes.length >= 3) score += 5;
  if (layout.garmentBalance.visualWeight === "balanced" || layout.garmentBalance.visualWeight === "light-minimal") {
    score += 10;
  }
  if (concept.fashionLanguage.garmentScale.includes("oversized")) score += 8;

  return Math.min(100, score);
}
