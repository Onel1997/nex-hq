import type { CreativeDirectorDecision } from "@/lib/design/design-knowledge/art-direction/creative-director";
import type { ArtDirectionVerdict } from "@/lib/design/design-knowledge/art-direction/verdict";

export interface KnowledgeScoreBreakdown {
  luxury: number;
  editorial: number;
  fashion: number;
  commercialAppeal: number;
  originality: number;
  printReadiness: number;
  visualBalance: number;
  hierarchy: number;
  negativeSpace: number;
  movement: number;
  emotionalImpact: number;
  apparelFit: number;
  creativeDirection: number;
  overall: number;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreKnowledgeDecision(decision: CreativeDirectorDecision): KnowledgeScoreBreakdown {
  const { layout, typography, symbol, ornament, composition, collection, artDirection } = decision;

  const luxury = clamp(
    layout.negativeSpace * 60 +
      (symbol.restraint * 25) +
      (ornament.visualWeight < 0.3 ? 15 : 5) +
      (artDirection.feelsLuxury ? 12 : 0),
  );

  const editorial = clamp(
    typography.editorialSpacing * 35 +
      (typography.interaction !== "floats-independent" ? 20 : 10) +
      (composition.overlapRequired ? 18 : 8) +
      (layout.movement !== "static" ? 15 : 5),
  );

  const fashion = clamp(
    collection.negativeSpace * 40 +
      typography.headlineScale * 25 +
      (layout.tension * 30) +
      (artDirection.belongsInFashionCampaign ? 10 : 0),
  );

  const commercialAppeal = clamp(
    (artDirection.wouldStopScrolling ? 35 : 15) +
      (typography.headlineScale >= 1.1 ? 20 : 10) +
      (layout.density !== "sparse" ? 15 : 8) +
      (artDirection.feelsCommercial ? -15 : 10),
  );

  const originality = clamp(
    layout.tension * 40 +
      (typography.alignment === "broken" ? 18 : 8) +
      (composition.asymmetryMin * 50) +
      (symbol.masking ? 12 : 5),
  );

  const printReadiness = clamp(
    (layout.marginRatio >= 0.08 ? 25 : 12) +
      (ornament.belongs.includes("edge") ? 20 : 10) +
      (layout.cropping !== "hard-crop" ? 20 : 12) +
      25,
  );

  const visualBalance = clamp(
    (layout.balance === "asymmetric" || layout.balance === "optical" ? 30 : 15) +
      (layout.tension * 35) +
      (1 - Math.abs(layout.negativeSpace - 0.45)) * 30,
  );

  const hierarchy = clamp(
    typography.layerPriority * 0.6 +
      (typography.headlineScale / typography.decorScale > 4 ? 25 : 12) +
      (symbol.priority === "dominant" ? 15 : 8),
  );

  const negativeSpace = clamp(layout.negativeSpace * 80 + composition.negativeSpaceMin * 20);

  const movement = clamp(
    (composition.movementRequired ? 35 : 15) +
      (layout.movement !== "static" ? 30 : 10) +
      (composition.overlapRequired ? 20 : 8),
  );

  const emotionalImpact = clamp(
    (artDirection.wouldStopScrolling ? 40 : 20) +
      (collection.tags.length * 5) +
      (typography.headlineScale >= 1.2 ? 20 : 10) +
      (artDirection.confidence * 0.2),
  );

  const apparelFit = clamp(
    (artDirection.belongsOnOversizedTee ? 40 : 20) +
      (layout.spread * 35) +
      (layout.meta.garmentFit.includes("oversized-front") ? 15 : 8) +
      (artDirection.feelsTooBusy ? -12 : 8),
  );

  const creativeDirection = clamp(artDirection.confidence);

  const overall = clamp(
    luxury * 0.1 +
      editorial * 0.09 +
      fashion * 0.09 +
      commercialAppeal * 0.07 +
      originality * 0.07 +
      printReadiness * 0.08 +
      visualBalance * 0.08 +
      hierarchy * 0.1 +
      negativeSpace * 0.08 +
      movement * 0.07 +
      emotionalImpact * 0.08 +
      apparelFit * 0.09 +
      creativeDirection * 0.1,
  );

  return {
    luxury,
    editorial,
    fashion,
    commercialAppeal,
    originality,
    printReadiness,
    visualBalance,
    hierarchy,
    negativeSpace,
    movement,
    emotionalImpact,
    apparelFit,
    creativeDirection,
    overall,
  };
}

export function logKnowledgeScore(score: KnowledgeScoreBreakdown): void {
  console.log(`[DESIGN KNOWLEDGE] Score: ${score.overall}/100`);
  console.log(
    `[DESIGN KNOWLEDGE] luxury=${score.luxury} editorial=${score.editorial} fashion=${score.fashion} apparel=${score.apparelFit}`,
  );
}

export function passesKnowledgeGate(score: KnowledgeScoreBreakdown, isHero: boolean): boolean {
  const minimum = isHero ? 85 : 72;
  return score.overall >= minimum && score.apparelFit >= 60 && score.hierarchy >= 55;
}
