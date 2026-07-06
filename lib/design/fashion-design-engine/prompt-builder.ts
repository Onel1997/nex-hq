import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import {
  FORBIDDEN_ARTWORK_TEXT,
  MANDATORY_TRANSPARENT_ARTWORK_SUFFIX,
} from "@/lib/design/master-artwork-prompt";
import type { FashionDesignEngineResult } from "./types";

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(". ");
}

/**
 * Build master artwork image prompt from Fashion Design Engine output.
 * GPT Image receives execution instructions only — creative thinking is done.
 */
export function buildMasterArtworkPromptFromEngine(
  result: FashionDesignEngineResult,
  brief: DesignStudioBrief,
  concept: DesignConcept,
): string {
  const heroBlock = result.typographySpec.blocks.find((b) => b.role === "hero");
  const visibleText = heroBlock?.content ?? "MILAENE";
  const secondaryLines = result.typographySpec.blocks
    .filter((b) => b.role !== "hero")
    .map((b) => b.content);

  const sections = [
    joinParts([
      "FASHION DESIGN ENGINE — EXECUTION PROMPT",
      "Creative direction already finalized — render exactly as specified",
      `visibleText: "${visibleText}"`,
      secondaryLines.length > 0
        ? `secondary lines: ${secondaryLines.map((l) => `"${l}"`).join(", ")}`
        : "no secondary text unless specified below",
      `NEVER render: ${FORBIDDEN_ARTWORK_TEXT.join(", ")}`,
    ]),
    joinParts([
      "CREATIVE BRIEF",
      `Emotional core: ${result.creativeBrief.emotionalCore}`,
      `Story: ${result.creativeBrief.story}`,
      `Philosophy: ${result.creativeBrief.designPhilosophy}`,
      `Mood: ${result.creativeBrief.moodKeywords.join(", ")}`,
      `Avoid: ${result.creativeBrief.antiPatterns.slice(0, 4).join(", ")}`,
    ]),
    joinParts([
      "LAYOUT SPECIFICATION",
      `Print area: ${result.layoutSpec.printArea}`,
      `Visual hierarchy: ${result.layoutSpec.visualHierarchy.map((h) => `${h.order}) ${h.element}`).join("  ")}`,
      `Negative space: ${result.layoutSpec.negativeSpace.targetRatio}`,
      `Garment balance: ${result.layoutSpec.garmentBalance.visualWeight}`,
      result.layoutSpec.oversizedFitNotes[0] ?? "",
    ]),
    joinParts([
      "TYPOGRAPHY SPECIFICATION — vector reference for image model",
      `Font: ${heroBlock?.fontFamily ?? "editorial serif"}`,
      `Tracking: ${result.typographySpec.tracking.hero}`,
      `Hierarchy: ${result.typographySpec.hierarchy.visualWeightDistribution}`,
      `Rules: ${result.typographySpec.luxuryRules.slice(0, 3).join("; ")}`,
      "Render typography cleanly — no distress unless graphic spec enables it",
    ]),
    joinParts([
      "GRAPHIC SPECIFICATION",
      `Language: ${result.graphicSpec.language}`,
      `Symbols: ${result.graphicSpec.symbols.map((s) => s.name).join(", ") || "abstract geometry"}`,
      `Line systems: ${result.graphicSpec.lineSystems.map((l) => `${l.type} (${l.strokeWidthMm}mm)`).join(", ")}`,
      `Colors: ${result.graphicSpec.colorApplication.map((c) => `${c.color} ${c.usage}`).join(", ")}`,
      ...result.graphicSpec.designInstructions.slice(0, 4),
    ]),
    joinParts([
      "COMPOSITION",
      `Score: ${result.compositionSpec.score}/100`,
      `Focal point: ${result.compositionSpec.focalPoint}`,
      `Balance: ${result.compositionSpec.balance}`,
      `Proportions — type ${result.compositionSpec.proportions.typographyShare}% / graphic ${result.compositionSpec.proportions.graphicShare}% / negative space ${result.compositionSpec.proportions.negativeSpaceShare}%`,
    ]),
    joinParts([
      "PRODUCT CONTEXT",
      `Product: ${concept.product} in ${concept.color}`,
      `Garment: ${brief.printArea} print`,
      `Production: ${result.printSpec.productionMethod}`,
      `Palette: ${brief.colorPalette.map((e) => e.name).join(", ")}`,
    ]),
    joinParts([
      "OUTPUT RULES",
      "Isolated apparel artwork on transparent PNG",
      "No shirt, no model, no mockup, no scene, no background rectangle",
      "Premium Milaene streetwear print — Kittl-level professional quality",
      "Print-ready target",
    ]),
    MANDATORY_TRANSPARENT_ARTWORK_SUFFIX,
  ];

  return sections.join("\n\n");
}
