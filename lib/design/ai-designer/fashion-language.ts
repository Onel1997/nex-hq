import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { CreativeDirectorDecision } from "@/lib/design/design-knowledge/art-direction/creative-director";
import type { FashionLanguageProfile } from "@/lib/design/ai-designer/types";

/** Build premium fashion language from design knowledge and creative direction. */
export function buildFashionLanguage(
  brief: DesignStudioBrief,
  creativeDirector: CreativeDirectorDecision,
  mood?: string,
): FashionLanguageProfile {
  const principles = creativeDirector.fashionPrinciples.map(
    (p) => `${p.name}: ${p.description}`,
  );
  const antiPatterns = creativeDirector.fashionPrinciples.flatMap((p) => p.antiPatterns);

  const isOversized =
    brief.product.toLowerCase().includes("oversized") ||
    brief.placement.toLowerCase().includes("oversized") ||
    brief.printArea.toLowerCase().includes("back");

  const luxurySignals = [
    brief.materialEffects,
    "premium print restraint",
    "editorial garment scale",
  ];

  if (creativeDirector.artDirection.feelsLuxury) {
    luxurySignals.push("quiet luxury — expensive through restraint");
  }
  if (creativeDirector.artDirection.wouldStopScrolling) {
    luxurySignals.push("scroll-stop editorial tension");
  }

  const stylingNotes = [
    `${creativeDirector.collection.name} collection language`,
    `Layout family: ${creativeDirector.layout.meta.family}`,
    `Composition: ${creativeDirector.composition.meta.family}`,
    brief.negativeSpaceRules,
  ];

  return {
    principles,
    mood: mood ?? brief.visualConcept.split("—")[0]?.trim() ?? brief.visualConcept.slice(0, 80),
    stylingNotes,
    antiPatterns: [...new Set(antiPatterns)],
    garmentScale: isOversized ? "oversized editorial back/front print" : "refined garment-scale placement",
    luxurySignals,
  };
}
