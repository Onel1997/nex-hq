import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import { COMMERCIAL_APPROVAL_THRESHOLD } from "@/lib/design/commercial-design-director/commercial-score";
import type {
  CompositionSpec,
  CreativeDesignBrief,
  FashionCommercialAssessment,
  GraphicSpec,
  LayoutSpec,
  TypographySpec,
} from "../types";

export interface FashionCommercialDirectorInput {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  creativeBrief: CreativeDesignBrief;
  layoutSpec: LayoutSpec;
  typographySpec: TypographySpec;
  graphicSpec: GraphicSpec;
  compositionSpec: CompositionSpec;
}

/**
 * Commercial Director Agent — Milaene DNA, commercial potential, originality,
 * printability, fashion relevance, social appeal, POD compatibility.
 */
export function runFashionCommercialDirectorAgent(
  input: FashionCommercialDirectorInput,
): FashionCommercialAssessment {
  const {
    brief,
    concept,
    creativeBrief,
    layoutSpec,
    typographySpec,
    graphicSpec,
    compositionSpec,
  } = input;

  const dimensions: FashionCommercialAssessment["dimensions"] = [
    scoreDimension("milaene-dna", "Milaene DNA", scoreMilaeneDna(creativeBrief, brief), explainDna(creativeBrief, brief)),
    scoreDimension("commercial", "Commercial Potential", scoreCommercial(brief, concept, compositionSpec), explainCommercial(brief, concept)),
    scoreDimension("originality", "Originality", creativeBrief.originalityAnalysis.score, creativeBrief.originalityAnalysis.differentiation),
    scoreDimension("printability", "Printability", scorePrintability(brief, typographySpec, graphicSpec), explainPrintability(brief, graphicSpec)),
    scoreDimension("fashion", "Fashion Relevance", scoreFashionRelevance(concept, layoutSpec), explainFashion(concept)),
    scoreDimension("social", "Social Media Appeal", scoreSocialAppeal(concept, layoutSpec, typographySpec), explainSocial(layoutSpec, typographySpec)),
    scoreDimension("pod", "POD Compatibility", scorePodCompatibility(brief, graphicSpec), explainPod(brief, graphicSpec)),
  ];

  const overall = Math.round(
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
  );

  const explanations = dimensions.map(
    (d) => `${d.label} (${d.score}/100): ${d.explanation}`,
  );

  if (compositionSpec.issues.length > 0) {
    explanations.push(`Composition notes: ${compositionSpec.issues.join("; ")}`);
  }

  return {
    overall,
    approved: overall >= COMMERCIAL_APPROVAL_THRESHOLD || (overall >= 82 && creativeBrief.brandDnaValidation.passed),
    dimensions,
    explanations,
    milaeneDna: dimensions.find((d) => d.id === "milaene-dna")?.score ?? 0,
    commercialPotential: dimensions.find((d) => d.id === "commercial")?.score ?? 0,
    originality: dimensions.find((d) => d.id === "originality")?.score ?? 0,
    printability: dimensions.find((d) => d.id === "printability")?.score ?? 0,
    fashionRelevance: dimensions.find((d) => d.id === "fashion")?.score ?? 0,
    socialMediaAppeal: dimensions.find((d) => d.id === "social")?.score ?? 0,
    podCompatibility: dimensions.find((d) => d.id === "pod")?.score ?? 0,
  };
}

function scoreDimension(
  id: string,
  label: string,
  score: number,
  explanation: string,
): FashionCommercialAssessment["dimensions"][number] {
  return {
    id,
    label,
    score: Math.max(0, Math.min(100, Math.round(score))),
    explanation,
  };
}

function scoreMilaeneDna(
  creative: CreativeDesignBrief,
  brief: DesignStudioBrief,
): number {
  return Math.round(
    (creative.brandDnaValidation.score + (brief.dnaScore ?? 70)) / 2,
  );
}

function explainDna(
  creative: CreativeDesignBrief,
  brief: DesignStudioBrief,
): string {
  const matches = creative.brandDnaValidation.matches.slice(0, 2).join(", ");
  return creative.brandDnaValidation.passed
    ? `Passes DNA gate at ${creative.brandDnaValidation.score}% — ${matches}`
    : `DNA conflicts detected: ${creative.brandDnaValidation.conflicts.join(", ") || "review required"}`;
}

function scoreCommercial(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  composition: CompositionSpec,
): number {
  let score = brief.commercialScore ?? 72;
  score += composition.score * 0.15;
  score += concept.confidence * 0.1;
  if (brief.campaignPotential?.toLowerCase().includes("high")) score += 8;
  return score;
}

function explainCommercial(
  brief: DesignStudioBrief,
  concept: DesignConcept,
): string {
  return `Premium streetwear positioning on ${brief.product} — campaign potential ${brief.campaignPotential ?? "medium"}, concept confidence ${concept.confidence}%`;
}

function scorePrintability(
  brief: DesignStudioBrief,
  typography: TypographySpec,
  graphic: GraphicSpec,
): number {
  let score = brief.printReadinessScore ?? 75;
  if (typography.renderMode === "vector-only") score += 5;
  const colorCount = graphic.colorApplication.length;
  if (colorCount <= 2) score += 10;
  if (colorCount > 4) score -= 10;
  if (graphic.distressedEffects[0]?.enabled) score -= 3;
  return score;
}

function explainPrintability(
  brief: DesignStudioBrief,
  graphic: GraphicSpec,
): string {
  return `${brief.productionMethod} — ${graphic.colorApplication.length} ink colors, ${graphic.lineSystems.length} line systems, vector typography spec ready`;
}

function scoreFashionRelevance(
  concept: DesignConcept,
  layout: LayoutSpec,
): number {
  let score = 70;
  if (concept.fashionLanguage.luxurySignals.length >= 2) score += 10;
  if (layout.printArea === "spine-back" || layout.printArea === "upper-back") score += 8;
  if (concept.fashionLanguage.mood.includes("luxury") || concept.fashionLanguage.mood.includes("editorial")) {
    score += 7;
  }
  return score;
}

function explainFashion(concept: DesignConcept): string {
  return `${concept.fashionLanguage.mood} — ${concept.fashionLanguage.luxurySignals.slice(0, 2).join(", ")}`;
}

function scoreSocialAppeal(
  concept: DesignConcept,
  layout: LayoutSpec,
  typography: TypographySpec,
): number {
  let score = 68;
  if (layout.printArea.includes("back")) score += 12;
  if (typography.blocks.some((b) => b.role === "hero" && b.content.length <= 12)) score += 8;
  if (concept.heroFocus.scrollStopHook) score += 6;
  return score;
}

function explainSocial(
  layout: LayoutSpec,
  typography: TypographySpec,
): string {
  const hero = typography.blocks.find((b) => b.role === "hero")?.content ?? "graphic";
  return `${layout.printArea} placement optimizes back-shot and flat-lay content — hero "${hero}" reads in 4:5 crops`;
}

function scorePodCompatibility(
  brief: DesignStudioBrief,
  graphic: GraphicSpec,
): number {
  let score = 80;
  if (graphic.colorApplication.length <= 2) score += 10;
  if (brief.productionMethod.toLowerCase().includes("screen")) score += 5;
  if (graphic.textures.some((t) => t.type === "halftone")) score -= 5;
  return score;
}

function explainPod(
  brief: DesignStudioBrief,
  graphic: GraphicSpec,
): string {
  return `MarketPrint-compatible ${brief.productionMethod} — ${graphic.colorApplication.length}-color, transparent asset pipeline prepared`;
}
