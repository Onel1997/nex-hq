import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import { decideWearabilityDirection } from "@/lib/design/design-knowledge/wearability";
import { hashString } from "@/lib/design/vector-engine/hash";
import type { CreativeDesignBrief, LayoutSpec } from "../types";

export interface ArtDirectorAgentInput {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  creativeBrief: CreativeDesignBrief;
}

/**
 * Art Director Agent — composition, placement, front/back layout, oversized balance.
 */
export function runArtDirectorAgent(input: ArtDirectorAgentInput): LayoutSpec {
  const { brief, concept, creativeBrief } = input;
  const seed = hashString(brief.designId) % 10000;
  const wearability = decideWearabilityDirection(brief, seed);
  const printArea = resolvePrintArea(brief.printArea);
  const isBack = printArea.includes("back") || printArea === "spine-back";

  const panelLayout = buildPanelLayout(brief, concept, isBack);
  const garmentBalance = buildGarmentBalance(concept, wearability);
  const negativeSpace = buildNegativeSpaceLayout(brief, concept);
  const visualHierarchy = buildVisualHierarchy(concept, creativeBrief);

  return {
    printArea,
    frontLayout: isBack ? undefined : panelLayout,
    backLayout: isBack ? panelLayout : undefined,
    garmentBalance,
    negativeSpace,
    visualHierarchy,
    oversizedFitNotes: [
      wearability.reason,
      `Apparel lens: ${wearability.apparelLens}`,
      `Placement: ${wearability.placement.id}`,
      concept.fashionLanguage.garmentScale,
      "Artwork scaled for boxy oversized silhouette — not standard fit proportions.",
    ],
  };
}

function resolvePrintArea(
  printArea: string,
): LayoutSpec["printArea"] {
  const normalized = printArea.toLowerCase();
  if (normalized.includes("spine")) return "spine-back";
  if (normalized.includes("back")) return "back";
  if (normalized.includes("left") && normalized.includes("chest")) return "left-chest";
  if (normalized.includes("upper") && normalized.includes("back")) return "upper-back";
  if (normalized.includes("front") || normalized.includes("chest")) return "front";
  return "front";
}

function parseDimensionsMm(dimensions: string): { width: number; height: number } {
  const widthMatch = dimensions.match(/(\d+(?:\.\d+)?)\s*cm\s*(?:wide|×|x)/i);
  const heightMatch = dimensions.match(/(\d+(?:\.\d+)?)\s*cm\s*(?:tall|high)/i);
  const singleMatch = dimensions.match(/(\d+(?:\.\d+)?)\s*cm/i);

  const widthCm = widthMatch ? parseFloat(widthMatch[1]!) : singleMatch ? parseFloat(singleMatch[1]!) : 28;
  const heightCm = heightMatch ? parseFloat(heightMatch[1]!) : widthCm * 0.6;

  return { width: widthCm * 10, height: heightCm * 10 };
}

function buildPanelLayout(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  isBack: boolean,
): NonNullable<LayoutSpec["frontLayout"]> {
  const dims = parseDimensionsMm(brief.dimensions);
  const isSpine = brief.printArea.toLowerCase().includes("spine");

  return {
    anchor: isSpine ? "spine center axis" : isBack ? "upper back center" : "center chest",
    boundingBoxMm: dims,
    offsetFromCollarMm: isBack ? 60 : 80,
    offsetFromCenterMm: brief.printArea.toLowerCase().includes("left") ? 60 : 0,
    rotationDeg: concept.compositionLanguage.placement.includes("diagonal") ? 15 : 0,
    safeMarginMm: 25,
  };
}

function buildGarmentBalance(
  concept: DesignConcept,
  wearability: ReturnType<typeof decideWearabilityDirection>,
): LayoutSpec["garmentBalance"] {
  const weight = concept.compositionLanguage.balance.toLowerCase();
  let visualWeight: LayoutSpec["garmentBalance"]["visualWeight"] = "balanced";
  if (weight.includes("top") || weight.includes("upper")) visualWeight = "heavy-top";
  if (weight.includes("center")) visualWeight = "heavy-center";
  if (
    wearability.apparelLens === "premium-mark"
    || concept.ornamentLanguage.density === "low"
  ) {
    visualWeight = "light-minimal";
  }

  return {
    visualWeight,
    droppedShoulderCompensation: "Shift artwork 5–8 mm upward on oversized block to account for dropped shoulder drape.",
    oversizedDrapeNotes: concept.fashionLanguage.garmentScale,
  };
}

function buildNegativeSpaceLayout(
  brief: DesignStudioBrief,
  concept: DesignConcept,
): LayoutSpec["negativeSpace"] {
  return {
    targetRatio: concept.negativeSpaceProfile.targetRatio,
    breathingZones: concept.negativeSpaceProfile.breathingZones,
    forbiddenZones: [
      "pocket seam overlap on front chest",
      "hood seam interference on upper back",
      brief.negativeSpaceRules,
    ].filter(Boolean),
  };
}

function buildVisualHierarchy(
  concept: DesignConcept,
  creativeBrief: CreativeDesignBrief,
): LayoutSpec["visualHierarchy"] {
  const steps: LayoutSpec["visualHierarchy"] = [
    {
      order: 1,
      element: concept.heroFocus.dominantElement,
      rationale: "Primary scroll-stop and identity anchor",
    },
  ];

  if (concept.symbolLanguage.primarySymbols[0]) {
    steps.push({
      order: 2,
      element: concept.symbolLanguage.primarySymbols[0]!,
      rationale: "Supporting symbolic layer reinforcing emotional core",
    });
  }

  steps.push({
    order: steps.length + 1,
    element: "negative space field",
    rationale: `Supports ${creativeBrief.emotionalCore} through editorial restraint`,
  });

  return steps;
}
