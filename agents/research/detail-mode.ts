import type { DesignConcept } from "./types";

export const RESEARCH_DETAIL_MODES = ["standard", "full"] as const;
export type ResearchDetailMode = (typeof RESEARCH_DETAIL_MODES)[number];

export const DEFAULT_RESEARCH_DETAIL_MODE: ResearchDetailMode = "standard";

export function buildDetailModePromptSection(
  detailMode: ResearchDetailMode = DEFAULT_RESEARCH_DETAIL_MODE,
): string {
  if (detailMode === "full") {
    return `## Detail mode: full
Include complete art direction, visual DNA, mockup descriptions, and step-by-step design instructions for every concept.`;
  }

  return `## Detail mode: standard (RESPONSE SIZE — CRITICAL)
Keep the JSON compact. The server synthesizes optional production detail.

OMIT these fields entirely from each design concept (do not include the keys):
- designInstructions
- mockupDescription
- geometry, dimensions, coordinates, rotation, spacing, strokeWidth, opacity, layerOrder, textureIntensity, edgeTreatment

Keep each concept focused on:
- title, creativeApproach, emotion, visualConcept, designDescription, symbolism, message
- exactComposition, graphicElements, elementCount, layoutDescription, visualHierarchy
- printTechnique, printSize, placementDimensions, printArea, product, color
- collectionRole, dnaScore, dnaMatches, dnaConflicts, whyFitsMilaene, repeatabilityScore, imagePromptCore
- supportsDesignId

Keep collection, hero analysis, CEO analysis, commercial scores, and relationships complete but concise.
Do NOT duplicate hero designs. Return exactly one hero in designs[].`;
}

/** Compact optional fields server-side when LLM omitted them (standard mode). */
export function compactDesignConceptDetail(
  design: DesignConcept,
  detailMode: ResearchDetailMode = DEFAULT_RESEARCH_DETAIL_MODE,
): DesignConcept {
  if (detailMode === "full") return design;

  const instructionFallbacks = [
    "Follow exactComposition, printSize, and colorBreakdown for production.",
    "Apply Milaene colorBreakdown with restrained ink opacity and clean vector edges.",
    "Verify printArea placement against placementDimensions before sampling.",
  ];

  const compactInstructions = instructionFallbacks.map(
    (fallback, index) => {
      const step = design.designInstructions[index] ?? fallback;
      return step.length >= 10
        ? step
        : `${step} Maintain Milaene production standards.`;
    },
  );

  return {
    ...design,
    designInstructions: compactInstructions,
    mockupDescription:
      design.mockupDescription.length > 20
        ? `${design.title} on ${design.product} — ${design.printArea} placement.`
        : design.mockupDescription,
    geometry:
      design.geometry.length >= 5 ? design.geometry : "Editorial focal composition",
    dimensions:
      design.dimensions.length >= 5 ? design.dimensions : design.printSize || "28 cm graphic",
    coordinates:
      design.coordinates.length >= 5
        ? design.coordinates
        : design.placementDimensions || "center placement",
    rotation: design.rotation.length >= 3 ? design.rotation : "0° upright",
    spacing: design.spacing.length >= 3 ? design.spacing : "editorial margins",
    strokeWidth: design.strokeWidth.length >= 3 ? design.strokeWidth : "2 mm",
    opacity: design.opacity.length >= 3 ? design.opacity : "100%",
    layerOrder:
      design.layerOrder.length >= 5 ? design.layerOrder : "garment base to top graphic",
    textureIntensity:
      design.textureIntensity.length >= 3 ? design.textureIntensity : "low",
    edgeTreatment:
      design.edgeTreatment.length >= 5 ? design.edgeTreatment : "clean vector edge",
  };
}

export function compactDesignConceptsForDetailMode(
  designs: DesignConcept[],
  detailMode: ResearchDetailMode = DEFAULT_RESEARCH_DETAIL_MODE,
): DesignConcept[] {
  return designs.map((design) => compactDesignConceptDetail(design, detailMode));
}
