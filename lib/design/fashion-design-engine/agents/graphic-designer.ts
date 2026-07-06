import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { CreativeDesignBrief, GraphicSpec, LayoutSpec } from "../types";

export interface GraphicDesignerAgentInput {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  creativeBrief: CreativeDesignBrief;
  layoutSpec: LayoutSpec;
}

/**
 * Graphic Designer Agent — symbols, abstract graphics, textures, line systems.
 * Outputs reusable design instructions — NOT final images.
 */
export function runGraphicDesignerAgent(
  input: GraphicDesignerAgentInput,
): GraphicSpec {
  const { brief, concept, creativeBrief } = input;

  const symbols = buildSymbols(brief, concept);
  const lineSystems = buildLineSystems(brief, concept);
  const textures = buildTextures(brief);
  const abstractElements = buildAbstractElements(brief, concept);
  const distressedEffects = buildDistressedEffects(concept);
  const colorApplication = buildColorApplication(brief);

  return {
    language: concept.symbolLanguage.system,
    symbols,
    lineSystems,
    textures,
    abstractElements,
    distressedEffects,
    colorApplication,
    designInstructions: buildDesignInstructions(
      brief,
      concept,
      creativeBrief,
      symbols,
      lineSystems,
    ),
  };
}

function buildSymbols(
  brief: DesignStudioBrief,
  concept: DesignConcept,
): GraphicSpec["symbols"] {
  return concept.symbolLanguage.primarySymbols.slice(0, 3).map((name, index) => ({
    id: `symbol-${index + 1}`,
    name,
    abstraction: inferAbstraction(name, brief.geometry),
    meaning: concept.symbolLanguage.restraint || "Layered symbolic meaning",
    strokeWidthMm: 1.5 + index * 0.5,
    dimensionsMm: parseBriefDimensions(brief.dimensions),
  }));
}

function inferAbstraction(
  name: string,
  geometry: string,
): GraphicSpec["symbols"][number]["abstraction"] {
  const corpus = `${name} ${geometry}`.toLowerCase();
  if (corpus.includes("arc") || corpus.includes("curve") || corpus.includes("organic")) {
    return "organic";
  }
  if (corpus.includes("grid") || corpus.includes("shard") || corpus.includes("polygon")) {
    return "geometric";
  }
  if (corpus.includes("frame") || corpus.includes("perimeter")) {
    return "architectural";
  }
  return "geometric";
}

function parseBriefDimensions(dimensions: string): { width: number; height: number } {
  const match = dimensions.match(/(\d+)\s*cm/gi);
  if (match && match.length >= 2) {
    return { width: parseInt(match[0]!, 10) * 10, height: parseInt(match[1]!, 10) * 10 };
  }
  const single = dimensions.match(/(\d+)\s*cm/i);
  const cm = single ? parseInt(single[1]!, 10) : 28;
  return { width: cm * 10, height: cm * 6 };
}

function buildLineSystems(
  brief: DesignStudioBrief,
  concept: DesignConcept,
): GraphicSpec["lineSystems"] {
  const systems: GraphicSpec["lineSystems"] = [];
  const geometry = brief.geometry.toLowerCase();

  if (geometry.includes("arc") || geometry.includes("curve") || geometry.includes("concentric")) {
    systems.push({
      id: "concentric-arcs",
      type: "arc",
      count: 3,
      strokeWidthMm: 1.5,
      spacingMm: 30,
      opacity: 1,
    });
  }

  if (geometry.includes("perimeter") || geometry.includes("loop") || geometry.includes("boundary")) {
    systems.push({
      id: "perimeter-loop",
      type: "perimeter",
      count: 1,
      strokeWidthMm: 2,
      spacingMm: 0,
      opacity: 1,
    });
  }

  if (geometry.includes("vertical") || geometry.includes("spine") || geometry.includes("axis")) {
    systems.push({
      id: "spine-axis",
      type: "axis",
      count: 1,
      strokeWidthMm: 2,
      spacingMm: 0,
      opacity: 1,
    });
  }

  if (systems.length === 0) {
    systems.push({
      id: "editorial-frame",
      type: "grid",
      count: 2,
      strokeWidthMm: 1,
      spacingMm: 40,
      opacity: 0.7,
    });
  }

  for (const geo of concept.symbolLanguage.secondaryGeometry.slice(0, 1)) {
    systems.push({
      id: "secondary-geometry",
      type: "fragment",
      count: 1,
      strokeWidthMm: 1,
      spacingMm: 20,
      opacity: 0.8,
    });
    void geo;
  }

  return systems;
}

function buildTextures(brief: DesignStudioBrief): GraphicSpec["textures"] {
  const effects = brief.materialEffects.toLowerCase();
  const textures: GraphicSpec["textures"] = [];

  if (effects.includes("grain")) {
    textures.push({ id: "grain", type: "grain", intensityPercent: 12, application: "Subtle overlay on graphic edges only" });
  }
  if (effects.includes("distress")) {
    textures.push({ id: "distress", type: "distress", intensityPercent: 15, application: "Edge fade — never full-surface distress" });
  }
  if (effects.includes("halftone")) {
    textures.push({ id: "halftone", type: "halftone", intensityPercent: 20, application: "Abstract fill areas only" });
  }
  if (textures.length === 0) {
    textures.push({ id: "none", type: "none", intensityPercent: 0, application: "Flat premium plastisol — no texture" });
  }

  return textures;
}

function buildAbstractElements(
  brief: DesignStudioBrief,
  concept: DesignConcept,
): GraphicSpec["abstractElements"] {
  return brief.visualElements.slice(0, 4).map((element, index) => ({
    id: `abstract-${index + 1}`,
    geometry: element,
    dimensionsMm: brief.dimensions,
    coordinates: brief.placement,
    layerOrder: index + 1,
  }));
}

function buildDistressedEffects(concept: DesignConcept): GraphicSpec["distressedEffects"] {
  const hasDistress = concept.ornamentLanguage.density !== "low"
    && concept.fashionLanguage.antiPatterns.every((p) => !p.includes("distress"));

  return [{
    enabled: hasDistress,
    intensityPercent: hasDistress ? 12 : 0,
    edgeTreatment: "Soft fade on outer 3 mm of stroke terminals only",
    rationale: hasDistress
      ? "Controlled distress for depth — never rave-era destruction"
      : "Flat premium execution aligned with calm luxury DNA",
  }];
}

function buildColorApplication(brief: DesignStudioBrief): GraphicSpec["colorApplication"] {
  return brief.colorPalette.map((entry) => ({
    color: entry.name,
    hex: entry.hex,
    usage: entry.usage,
    opacity: entry.usage.includes("%")
      ? parseInt(entry.usage.match(/(\d+)%/)?.[1] ?? "100", 10)
      : 100,
  }));
}

function buildDesignInstructions(
  brief: DesignStudioBrief,
  concept: DesignConcept,
  creativeBrief: CreativeDesignBrief,
  symbols: GraphicSpec["symbols"],
  lineSystems: GraphicSpec["lineSystems"],
): string[] {
  const instructions = [
    ...brief.designerInstructions.slice(0, 3),
    `Emotional core: ${creativeBrief.emotionalCore}`,
    `Symbol language: ${concept.symbolLanguage.system} — ${symbols.map((s) => s.name).join(", ")}`,
    `Line systems: ${lineSystems.map((l) => l.type).join(", ")} at ${lineSystems[0]?.strokeWidthMm ?? 1.5}mm stroke`,
    `Negative space target: ${concept.negativeSpaceProfile.targetRatio}`,
    "No figurative animals, skulls, wings, or hype-brand references",
    "All graphics as vector paths — raster textures as separate overlay layers only",
  ];

  return instructions.filter((item) => item.length >= 10);
}
