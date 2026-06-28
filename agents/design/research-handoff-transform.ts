import {
  BACK_PLACEMENT_PATTERN,
  FRONT_PLACEMENT_PATTERN,
  normalizeDesignPrintArea,
} from "@/agents/research/design-concept";
import type { ColorBreakdownEntry, DesignConcept } from "@/agents/research/types";
import type { DesignStudioBrief, DesignStudioColor } from "./studio-brief";

const STALE_COPY_PATTERNS: RegExp[] = [
  /styling influence only/i,
  /^premium oversized fleece construction/i,
  /^milaene calm luxury restraint/i,
  /^milaene abstract emotional translation, muted tonal styling influence only/i,
  /\b(90s rave|stüssy|supreme photo|bape style|palace tri-ferg|daily paper abstract)\b/i,
  /\bno stale template geometry\b/i,
];

const NARRATIVE_LEAD_PATTERNS: RegExp[] = [
  /^tension lives in\b/i,
  /^the design expresses\b/i,
  /^this piece channels\b/i,
  /^emotionally\b/i,
];

function cleanFallbackText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (STALE_COPY_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "";
  }
  return trimmed;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = cleanFallbackText(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function placementCorpus(concept: DesignConcept): string {
  return [
    concept.printArea,
    concept.placementDimensions,
    concept.coordinates,
    concept.exactComposition,
    concept.focalPoint,
  ]
    .join(" ")
    .toLowerCase();
}

function isBackPlacement(corpus: string): boolean {
  return BACK_PLACEMENT_PATTERN.test(corpus);
}

function isFrontPlacement(corpus: string): boolean {
  return FRONT_PLACEMENT_PATTERN.test(corpus);
}

function resolveAlignedConcept(concept: DesignConcept): DesignConcept {
  const normalized = normalizeDesignPrintArea(concept);
  const corpus = placementCorpus(normalized);
  const back = isBackPlacement(corpus);
  const front = isFrontPlacement(corpus);
  const printArea =
    normalized.printArea.toLowerCase() === "back" || (back && !front)
      ? "Back"
      : normalized.printArea.toLowerCase() === "front" || (front && !back)
        ? "Front"
        : normalized.printArea;

  let placement = cleanFallbackText(normalized.placementDimensions);
  let coordinates = cleanFallbackText(normalized.coordinates);

  if (printArea === "Back") {
    if (coordinates && isFrontPlacement(coordinates) && !isBackPlacement(coordinates)) {
      coordinates = "";
    }
    if (placement && isFrontPlacement(placement) && !isBackPlacement(placement)) {
      placement = "";
    }
    if (!placement && !coordinates) {
      placement = "Center back, 10–12 cm below yoke seam";
    }
  }

  if (printArea === "Front") {
    if (coordinates && isBackPlacement(coordinates) && !isFrontPlacement(coordinates)) {
      coordinates = "";
    }
    if (placement && isBackPlacement(placement) && !isFrontPlacement(placement)) {
      placement = "";
    }
    if (!placement && !coordinates) {
      placement = "Center chest, 8 cm below collar seam";
    }
  }

  const resolvedPlacement = uniqueStrings([
    placement,
    coordinates,
    normalized.exactComposition,
  ]).join(" — ");

  return {
    ...normalized,
    printArea,
    placementDimensions: resolvedPlacement || normalized.placementDimensions,
    coordinates: coordinates || normalized.coordinates,
    garmentInspiration: cleanFallbackText(normalized.garmentInspiration),
    brandInspiration: cleanFallbackText(normalized.brandInspiration),
    visualReferences: cleanFallbackText(normalized.visualReferences),
    styleDirection: cleanFallbackText(normalized.styleDirection),
    symbolism: cleanFallbackText(normalized.symbolism),
    emotionalNarrative: cleanFallbackText(normalized.emotionalNarrative ?? ""),
  };
}

function resolveDimensions(concept: DesignConcept): string {
  const printSize = cleanFallbackText(concept.printSize);
  const dimensions = cleanFallbackText(concept.dimensions);
  if (dimensions && printSize) {
    if (dimensions.toLowerCase().includes(printSize.toLowerCase())) {
      return dimensions;
    }
    return `${printSize} · ${dimensions}`;
  }
  return dimensions || printSize || "Print zone unspecified";
}

function toColorPalette(entries: ColorBreakdownEntry[]): DesignStudioColor[] {
  const palette = entries
    .map((entry) => ({
      name: entry.color.trim(),
      usage: entry.usage.trim(),
    }))
    .filter((entry) => entry.name.length > 0);

  if (palette.length > 0) return palette;

  return [{ name: "Garment base", usage: "primary ground" }];
}

function narrativeToInstruction(narrative: string): string | null {
  const cleaned = cleanFallbackText(narrative);
  if (!cleaned) return null;

  let instruction = cleaned
    .replace(NARRATIVE_LEAD_PATTERNS[0], "Design tension:")
    .replace(NARRATIVE_LEAD_PATTERNS[1], "Composition goal:")
    .replace(NARRATIVE_LEAD_PATTERNS[2], "Composition goal:")
    .replace(/\bemotional\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (instruction.length < 10) return null;
  if (!/[.!?]$/.test(instruction)) {
    instruction = `${instruction}.`;
  }

  return `Translate narrative intent into print geometry: ${instruction}`;
}

function buildDesignerInstructions(concept: DesignConcept): string[] {
  const instructions = uniqueStrings([
    ...concept.designInstructions,
    concept.milaeneTranslation
      ? `Milaene translation: ${cleanFallbackText(concept.milaeneTranslation)}`
      : "",
    concept.visualRestraint
      ? `Visual restraint: ${cleanFallbackText(concept.visualRestraint)}`
      : "",
    concept.editorialRestraint
      ? `Editorial restraint: ${cleanFallbackText(concept.editorialRestraint)}`
      : "",
    concept.productionDifficulty
      ? `Production difficulty: ${concept.productionDifficulty}`
      : "",
    narrativeToInstruction(concept.emotionalNarrative ?? "") ?? "",
    concept.exactComposition
      ? `Composition: ${cleanFallbackText(concept.exactComposition)}`
      : "",
    concept.layerOrder ? `Layer order: ${cleanFallbackText(concept.layerOrder)}` : "",
    concept.strokeWidth
      ? `Stroke width: ${cleanFallbackText(concept.strokeWidth)}`
      : "",
    concept.spacing ? `Spacing: ${cleanFallbackText(concept.spacing)}` : "",
    concept.opacity ? `Opacity: ${cleanFallbackText(concept.opacity)}` : "",
  ]);

  if (instructions.length > 0) return instructions.slice(0, 10);

  return [
    `Render ${concept.geometry || concept.visualConcept} at ${resolveDimensions(concept)} on ${concept.printArea.toLowerCase()}.`,
    `Use ${concept.printTechnique} with production-safe margins and Milaene negative space discipline.`,
  ];
}

function buildSvgPrompt(concept: DesignConcept, placement: string): string {
  const colors = toColorPalette(concept.colorBreakdown)
    .map((entry) => `${entry.name} (${entry.usage})`)
    .join(", ");

  return [
    "Create print-ready vector artwork for garment screen production.",
    `Title: ${concept.title}.`,
    `Geometry: ${cleanFallbackText(concept.geometry) || cleanFallbackText(concept.visualConcept)}.`,
    `Dimensions: ${resolveDimensions(concept)}.`,
    `Placement: ${placement} on ${concept.printArea.toLowerCase()}.`,
    `Elements (${concept.elementCount || concept.graphicElements.length}): ${concept.graphicElements.join("; ")}.`,
    concept.strokeWidth ? `Stroke: ${concept.strokeWidth}.` : "",
    concept.spacing ? `Spacing: ${concept.spacing}.` : "",
    concept.layerOrder ? `Layers: ${concept.layerOrder}.` : "",
    `Colors: ${colors}.`,
    concept.negativeSpaceUsage
      ? `Negative space: ${cleanFallbackText(concept.negativeSpaceUsage)}.`
      : "",
    concept.edgeTreatment ? `Edges: ${concept.edgeTreatment}.` : "",
    "Flat vector shapes only, no photography, no raster textures, SVG-export safe.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildMockupPrompt(concept: DesignConcept, placement: string): string {
  const base = cleanFallbackText(concept.mockupDescription);
  if (base.length >= 40) return base;

  return [
    `${concept.title} mockup on ${concept.product} in ${concept.color}.`,
    `${concept.printArea} placement — ${placement}.`,
    `${resolveDimensions(concept)} ${cleanFallbackText(concept.geometry) || "graphic"}.`,
    "Editorial studio lighting, calm luxury streetwear, neutral backdrop, production-accurate print scale.",
  ].join(" ");
}

function buildImagePrompt(concept: DesignConcept): string {
  const core = cleanFallbackText(concept.imagePromptCore);
  if (core.length >= 20) return core;

  return [
    concept.title,
    concept.product,
    concept.color,
    cleanFallbackText(concept.geometry),
    concept.graphicElements.slice(0, 3).join(", "),
    "calm luxury",
    "Milaene editorial streetwear",
  ]
    .filter(Boolean)
    .join(", ");
}

function normalizeProductionMethod(concept: DesignConcept): string {
  const technique = cleanFallbackText(concept.printTechnique);
  if (technique) return technique;
  if (concept.productionDifficulty === "Low") {
    return "Screen print, 1–2 color spot palette";
  }
  return "Screen print, production-safe spot palette";
}

function scorePrintReadiness(
  concept: DesignConcept,
  placement: string,
  hadCoordinateConflict: boolean,
): number {
  let score = 0;

  if (cleanFallbackText(concept.geometry).length >= 5) score += 12;
  if (/\d+\s*cm/i.test(resolveDimensions(concept))) score += 14;
  if (placement.length >= 12) score += 14;
  if (normalizeProductionMethod(concept).length >= 8) score += 10;
  if (concept.graphicElements.length >= 1) score += 8;
  if (!hadCoordinateConflict) score += 14;
  if (concept.colorBreakdown.length >= 2) score += 10;
  if (buildDesignerInstructions(concept).length >= 3) score += 10;
  if (concept.typography?.trim()) score += 4;
  if (cleanFallbackText(concept.materialEffects).length >= 8) score += 4;

  if (concept.productionDifficulty === "Low") score += 6;
  else if (concept.productionDifficulty === "Medium") score += 4;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function hadCoordinateConflict(concept: DesignConcept, aligned: DesignConcept): boolean {
  return (
    concept.placementDimensions.trim() !== aligned.placementDimensions.trim() ||
    concept.coordinates.trim() !== aligned.coordinates.trim() ||
    concept.printArea.trim() !== aligned.printArea.trim()
  );
}

/** Convert one Research HQ design concept into a Design Studio brief. */
export function convertResearchConceptToStudioBrief(
  concept: DesignConcept,
): DesignStudioBrief {
  const aligned = resolveAlignedConcept(concept);
  const conflict = hadCoordinateConflict(concept, aligned);
  const placement = aligned.placementDimensions.trim();
  const geometry =
    cleanFallbackText(aligned.geometry) ||
    cleanFallbackText(aligned.visualConcept) ||
    aligned.graphicElements[0] ||
    "Geometry unspecified";
  const visualElements = uniqueStrings(aligned.graphicElements);
  const typography =
    cleanFallbackText(aligned.typography) ||
    (aligned.message
      ? `Uppercase editorial — "${aligned.message.trim()}"`
      : "No type — graphic only");

  const visualConcept = cleanFallbackText(aligned.visualConcept) || geometry;
  const designDescription =
    cleanFallbackText(aligned.designDescription) ||
    cleanFallbackText(aligned.layoutDescription) ||
    cleanFallbackText(aligned.exactComposition) ||
    visualConcept;

  return {
    designId: aligned.designId,
    title: aligned.title.trim(),
    role: aligned.collectionRole,
    product: aligned.product.trim(),
    color: aligned.color.trim(),
    printArea: aligned.printArea.trim(),
    placement,
    dimensions: resolveDimensions(aligned),
    visualConcept,
    designDescription,
    geometry,
    visualElements: visualElements.length > 0 ? visualElements : [geometry],
    typography,
    colorPalette: toColorPalette(aligned.colorBreakdown),
    productionMethod: normalizeProductionMethod(aligned),
    materialEffects:
      cleanFallbackText(aligned.materialEffects) ||
      "Muted plastisol or water-based ink with soft hand feel",
    negativeSpaceRules:
      cleanFallbackText(aligned.negativeSpaceUsage) ||
      "Preserve editorial breathing room around the primary mark",
    designerInstructions: buildDesignerInstructions(aligned),
    svgPrompt: buildSvgPrompt(aligned, placement),
    mockupPrompt: buildMockupPrompt(aligned, placement),
    imagePrompt: buildImagePrompt(aligned),
    printReadinessScore: scorePrintReadiness(aligned, placement, conflict),
    dnaScore: aligned.dnaScore,
    commercialScore: aligned.commercialScore,
    campaignPotential: aligned.campaignPotential,
  };
}
