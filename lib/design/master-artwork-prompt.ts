import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(". ");
}

/** Build the standalone printable artwork prompt — no garment, no mockup, no scene. */
export function buildMasterArtworkGenerationPrompt(input: {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  designDirection?: string;
}): string {
  const { brief, concept } = input;
  const direction =
    input.designDirection?.trim() ||
    concept.creativeDirection.summary ||
    brief.visualConcept ||
  "";

  return joinParts([
    "Create only the printable apparel artwork",
    "No shirt",
    "No model",
    "No mockup",
    "No scene",
    "No background",
    "Centered composition",
    "Transparent background if supported",
    "Premium streetwear graphic design",
    "Kittl-level professional apparel artwork",
    "Luxury typography and graphic composition",
    "Print-ready 300 DPI target",
    `Suitable for oversized tee or hoodie print on ${concept.printArea}`,
    `Design: "${concept.title}"`,
    `Collection: ${concept.collection}`,
    `Creative direction: ${direction}`,
    `Design story: ${concept.designStory}`,
    `Fashion mood: ${concept.fashionLanguage.mood}`,
    `Composition: ${concept.compositionLanguage.pattern}, ${concept.compositionLanguage.focalStrategy}, ${concept.compositionLanguage.balance}`,
    `Typography: ${concept.typographyLanguage.headlineTreatment}, ${concept.typographyLanguage.direction}, ${concept.typographyLanguage.behaviors.join(", ")}`,
    `Hero focus: ${concept.heroFocus.dominantElement} — ${concept.heroFocus.scrollStopHook}`,
    `Symbol language: ${concept.symbolLanguage.system}, ${concept.symbolLanguage.primarySymbols.join(", ")}`,
    `Ornament: ${concept.ornamentLanguage.density} density`,
    `Negative space: ${concept.negativeSpaceProfile.targetRatio}`,
    `Print placement: ${concept.productionNotes.placement}`,
    `Production method: ${concept.productionNotes.method}`,
    `Commercial hook: ${concept.commercialIntention.buyerHook}`,
    "High-end luxury streetwear graphic only — centered print design",
    "Professional apparel artwork with premium typography hierarchy",
    "Print-friendly flat graphic composition",
    "No watermarks, no labels, no garment folds",
  ]);
}
