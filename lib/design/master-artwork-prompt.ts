import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(". ");
}

/** Words/phrases that must never appear as visible artwork text. */
export const FORBIDDEN_ARTWORK_TEXT = [
  "Research Report",
  "Intelligence Report",
  "Key Findings",
  "Recommendations",
  "Executive Summary",
  "Design Brief",
  "Image Studio",
  "Commercial Review",
  "Report",
] as const;

export interface MasterArtworkVisibleText {
  /** Primary headline rendered in the artwork. */
  visibleText: string;
  /** Optional supporting lines (brand, collection) — only when they fit the concept. */
  secondaryText: string[];
}

/** Appended to every master artwork request — must never be removed or altered. */
export const MANDATORY_TRANSPARENT_ARTWORK_SUFFIX =
  "Generate ONLY the isolated artwork as a transparent PNG. " +
  "No background. No canvas. No poster. No frame. No paper. No mockup. " +
  "No lighting. No environment. Transparent background only.";

const TITLE_SPLIT_PATTERN = /\s*[—–\-|:]\s*/;
const PRODUCT_DESCRIPTOR_PATTERN =
  /\b(oversized\s+tee|oversized\s+t-?shirt|hoodie|sweatshirt|crewneck|t-?shirt|tee)\b/gi;

function containsForbiddenArtworkText(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return true;
  return FORBIDDEN_ARTWORK_TEXT.some((phrase) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(normalized);
  });
}

function cleanPhrase(value: string): string {
  return value
    .replace(/["'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(PRODUCT_DESCRIPTOR_PATTERN, "")
    .replace(/\s+—\s*$/g, "")
    .trim();
}

function extractHeroPhraseFromTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "";

  const segments = trimmed.split(TITLE_SPLIT_PATTERN).map(cleanPhrase).filter(Boolean);
  for (const segment of segments) {
    if (!containsForbiddenArtworkText(segment) && segment.length >= 3) {
      return segment;
    }
  }

  const cleaned = cleanPhrase(trimmed);
  return containsForbiddenArtworkText(cleaned) ? "" : cleaned;
}

function firstUsableSentence(value: string): string {
  const sentence = value.split(/[.!?]/).map((part) => cleanPhrase(part)).find(Boolean);
  return sentence && !containsForbiddenArtworkText(sentence) ? sentence : "";
}

function buildSecondaryVisibleText(
  brief: DesignStudioBrief,
  concept: DesignConcept,
): string[] {
  const secondary: string[] = [];
  const brand = "MILAENE";
  if (!secondary.includes(brand)) {
    secondary.push(brand);
  }

  const collectionCandidates = [
    concept.collection,
    brief.title.split(TITLE_SPLIT_PATTERN).slice(1).join(" "),
  ]
    .map(cleanPhrase)
    .filter(Boolean);

  for (const candidate of collectionCandidates) {
    const collectionLabel = candidate.toUpperCase().includes("COLLECTION")
      ? candidate.toUpperCase()
      : `${candidate.toUpperCase()} COLLECTION`;
    if (
      !containsForbiddenArtworkText(collectionLabel) &&
      collectionLabel.length >= 4 &&
      !secondary.includes(collectionLabel)
    ) {
      secondary.push(collectionLabel);
      break;
    }
  }

  return secondary.slice(0, 2);
}

/** Resolve intentional visible artwork text — never report/dashboard language. */
export function resolveMasterArtworkVisibleText(
  brief: DesignStudioBrief,
  concept: DesignConcept,
): MasterArtworkVisibleText {
  const candidates = [
    extractHeroPhraseFromTitle(brief.title),
    extractHeroPhraseFromTitle(concept.title),
    firstUsableSentence(brief.visualConcept),
    firstUsableSentence(brief.designDescription),
    concept.heroFocus.focalPoint,
    concept.symbolLanguage.primarySymbols[0],
  ];

  const visibleText =
    candidates.find((candidate) => candidate && !containsForbiddenArtworkText(candidate)) ??
    "MILAENE";

  return {
    visibleText,
    secondaryText: buildSecondaryVisibleText(brief, concept),
  };
}

function buildVisibleTextSection(visible: MasterArtworkVisibleText): string {
  const secondary =
    visible.secondaryText.length > 0
      ? `Optional secondary lines (only if they fit the composition): ${visible.secondaryText.map((line) => `"${line}"`).join(", ")}`
      : "No secondary text unless it strengthens the concept.";

  return joinParts([
    "VISIBLE ARTWORK TEXT — render intentionally, not copied from reports",
    `visibleText: "${visible.visibleText}"`,
    secondary,
    `NEVER render these words or phrases: ${FORBIDDEN_ARTWORK_TEXT.join(", ")}`,
    "Do not render report titles, dashboard labels, UI copy, or fake brand footer text",
    "Report and brief content below is context only — never visible in the artwork",
  ]);
}

function buildReportContextSection(input: {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  designDirection: string;
}): string {
  const { brief, concept, designDirection } = input;

  return joinParts([
    "DESIGN CONTEXT — mood, style, and production guidance only (not artwork text)",
    `Product: ${concept.product} in ${concept.color}`,
    `Garment: ${concept.printArea} print area`,
    `Collection mood: ${concept.creativeDirection.mood}`,
    `Emotional tone: ${concept.creativeDirection.emotion}`,
    `Target audience: premium streetwear — intimate, minimal, urban luxury`,
    `Creative direction: ${designDirection}`,
    `Fashion mood: ${concept.fashionLanguage.mood}`,
    `Styling: ${concept.fashionLanguage.stylingNotes.slice(0, 3).join("; ")}`,
    `Color palette: ${brief.colorPalette.map((entry) => `${entry.name} (${entry.usage})`).join(", ")}`,
    `Composition: ${concept.compositionLanguage.pattern}, ${concept.compositionLanguage.focalStrategy}, ${concept.compositionLanguage.balance}`,
    `Typography style: ${concept.typographyLanguage.headlineTreatment}, ${concept.typographyLanguage.direction}`,
    `Symbol language: ${concept.symbolLanguage.system}, ${concept.symbolLanguage.primarySymbols.join(", ")}`,
    `Print placement: ${concept.productionNotes.placement}`,
    `Production method: ${concept.productionNotes.method}`,
    `Negative space: ${concept.negativeSpaceProfile.targetRatio}`,
  ]);
}

function buildArtworkCompositionSection(concept: DesignConcept): string {
  return joinParts([
    "ARTWORK COMPOSITION",
    "Premium Milaene streetwear print — transparent apparel artwork only",
    "Clean premium fashion typography with symbolic or abstract graphic elements",
    "Kittl-level professional apparel artwork",
    "Luxury typography hierarchy with garment-scale readability",
    `Hero focus: ${concept.heroFocus.dominantElement}`,
    `Ornament density: ${concept.ornamentLanguage.density}`,
    `Typography behaviors: ${concept.typographyLanguage.behaviors.join(", ")}`,
    "Centered composition with print-friendly flat graphic shapes",
    "No watermarks, no garment folds, no mockup elements",
  ]);
}

/** Build the standalone printable artwork prompt — no garment, no mockup, no scene. */
export function buildMasterArtworkGenerationPrompt(input: {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  designDirection?: string;
}): string {
  const { brief, concept } = input;
  const designDirection =
    input.designDirection?.trim() ||
    concept.creativeDirection.summary ||
    brief.visualConcept ||
    "";

  const visible = resolveMasterArtworkVisibleText(brief, concept);

  const sections = [
    buildVisibleTextSection(visible),
    buildReportContextSection({ brief, concept, designDirection }),
    buildArtworkCompositionSection(concept),
    joinParts([
      "OUTPUT RULES",
      "Isolated apparel artwork on transparent PNG",
      "No shirt, no model, no mockup, no scene, no background rectangle",
      "No poster layout, no paper, no frame, no canvas fill",
      "Print-ready 300 DPI target",
    ]),
    MANDATORY_TRANSPARENT_ARTWORK_SUFFIX,
  ];

  return sections.join("\n\n");
}
