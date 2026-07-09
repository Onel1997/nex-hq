import { applyBrandDnaAnalysis } from "./brand-dna";
import { ROLE_DNA_MINIMUMS } from "./collection-intelligence";
import { buildHeroEmotionalNarrative } from "./emotional-intelligence";
import { applyEmotionalVisualLanguage } from "./emotional-visual";
import { normalizeDesignPrintArea } from "./design-concept";
import {
  assessCampaignPotential,
  calculateCommercialScore,
} from "./hero-engine";
import { ABSOLUTE_DNA_FLOOR, roundPercent } from "./score-coercion";
import {
  getThemeRoleTitle,
  pickThemeEmotion,
  resolveThemeProfile,
  type ThemeProfile,
} from "./theme-vocabulary";
import type {
  CollectionRole,
  CreativeApproach,
  DesignConcept,
  ResearchCollection,
} from "./types";

interface RoleSpec {
  approach: CreativeApproach;
  product: string;
  printArea: string;
  printSize: string;
  productionDifficulty: DesignConcept["productionDifficulty"];
  visualWeight: DesignConcept["visualWeight"];
  contrastLevel: DesignConcept["contrastLevel"];
  placementDimensions: string;
}

const ROLE_SPECS: Record<CollectionRole, RoleSpec> = {
  "Hero Piece": {
    approach: "Symbolic Illustration",
    product: "Faith Oversized Hoodie",
    printArea: "Front",
    printSize: "30 cm editorial graphic",
    productionDifficulty: "Medium",
    visualWeight: "Balanced",
    contrastLevel: "Medium",
    placementDimensions: "Center chest, 8 cm below collar seam — dominant focal placement",
  },
  "Core Essential": {
    approach: "Luxury Minimalism",
    product: "Faith Tee",
    printArea: "Front",
    printSize: "10 cm chest emblem",
    productionDifficulty: "Low",
    visualWeight: "Light",
    contrastLevel: "Medium",
    placementDimensions: "Left chest, heart line — 10 cm emblem with 4 cm collar offset",
  },
  "Statement Piece": {
    approach: "Symbolic Illustration",
    product: "Faith Oversized Hoodie",
    printArea: "Back",
    printSize: "28 cm back graphic",
    productionDifficulty: "Medium",
    visualWeight: "Balanced",
    contrastLevel: "High",
    placementDimensions: "Center back, 12 cm below yoke — full editorial back panel",
  },
  "Supporting Piece": {
    approach: "Minimal Back Print",
    product: "Faith Hoodie",
    printArea: "Back",
    printSize: "12 cm back mark",
    productionDifficulty: "Low",
    visualWeight: "Light",
    contrastLevel: "Medium",
    placementDimensions: "Upper back, 8 cm below yoke — restrained secondary mark",
  },
  "Limited Piece": {
    approach: "Abstract Graphic",
    product: "Faith Oversized Hoodie",
    printArea: "Front",
    printSize: "30 cm abstract panel",
    productionDifficulty: "High",
    visualWeight: "Heavy",
    contrastLevel: "High",
    placementDimensions: "Center front, 6 cm side inset — limited drop panel composition",
  },
};

function uniqueTitle(base: string, usedTitles: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (usedTitles.has(candidate.trim().toLowerCase())) {
    candidate = `${base} · ${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function buildArtDirection(
  role: CollectionRole,
  theme: ThemeProfile,
  collection: ResearchCollection,
  spec: RoleSpec,
  title: string,
  emotion: string,
  color: string,
  motif: string,
  secondaryMotif: string,
): Pick<
  DesignConcept,
  | "visualConcept"
  | "designDescription"
  | "symbolism"
  | "exactComposition"
  | "graphicElements"
  | "layoutDescription"
  | "visualHierarchy"
  | "colorBreakdown"
  | "designInstructions"
  | "mockupDescription"
  | "imagePromptCore"
  | "negativeSpaceUsage"
  | "elementCount"
> {
  const roleLabel = theme.roleTitles[role].toLowerCase();
  const visualConcept = `${roleLabel} — ${motif} with ${secondaryMotif}, ${collection.campaignTheme.toLowerCase()} narrative and Milaene editorial restraint`;

  const designDescription = `Theme-built ${role.toLowerCase()} for ${collection.name}: ${theme.symbolism.slice(0, 100).toLowerCase()}. Production-safe ${spec.printSize} on ${spec.product}.`;

  const symbolism = `${theme.symbolism} — expressed as ${roleLabel} through ${motif}`;

  const exactComposition = `${spec.printSize} ${motif} placed ${spec.placementDimensions.toLowerCase()}. Primary contour 2 mm, ${secondaryMotif} as secondary layer with 18 mm spacing.`;

  const graphicElements = [
    motif,
    secondaryMotif,
    `${emotion.toLowerCase()} tonal layer`,
    `${theme.emotionalKeyword.toLowerCase()} accent mark`,
  ];

  const layoutDescription = `${title} uses ${spec.printArea.toLowerCase()} placement with editorial spacing — ${roleLabel} hierarchy distinct from hero and other capsule roles.`;

  const visualHierarchy = `1) ${motif}  2) ${secondaryMotif}  3) ${emotion.toLowerCase()} tonal layer  4) garment negative space`;

  const colorBreakdown = [
    { color, usage: "garment base 70%" },
    { color: "Soft Black Ink", usage: "primary graphic 22%" },
    { color: "Stone Grey", usage: "secondary tonal layer 8%" },
  ];

  const designInstructions = [
    `Render ${motif} at ${spec.printSize} with 2 mm contour and calm luxury spacing.`,
    `Layer ${secondaryMotif} beneath the primary mark with 18 mm offset — no stale template geometry.`,
    `Apply ${color} base, muted tonal ink, and production-safe margins for ${collection.campaignTheme}.`,
  ];

  const mockupDescription = `${title} on ${spec.product} in ${color} — ${spec.printArea.toLowerCase()} ${spec.printSize} mockup, editorial studio light, theme: ${theme.id}`;

  const imagePromptCore = `${title}, ${motif}, ${collection.campaignTheme}, ${color} ${spec.product}, calm luxury, Milaene DNA, ${theme.emotionalKeyword}`;

  const negativeSpaceUsage = `Generous ${spec.printArea.toLowerCase()} negative space framing ${motif} — editorial breathing room for ${collection.campaignTheme.toLowerCase()}.`;

  return {
    visualConcept,
    designDescription,
    symbolism,
    exactComposition,
    graphicElements,
    elementCount: `${graphicElements.length} layered elements`,
    layoutDescription,
    visualHierarchy,
    colorBreakdown,
    designInstructions,
    mockupDescription,
    imagePromptCore,
    negativeSpaceUsage,
  };
}

function ensureMinimumDna(
  design: DesignConcept,
  role: CollectionRole,
): DesignConcept {
  const minimum = Math.max(ABSOLUTE_DNA_FLOOR, ROLE_DNA_MINIMUMS[role]);
  let analyzed = applyBrandDnaAnalysis(normalizeDesignPrintArea(design));

  if (analyzed.dnaScore < minimum) {
    analyzed = applyBrandDnaAnalysis({
      ...analyzed,
      dnaMatches: [
        "muted palette",
        "editorial spacing",
        "center chest placement",
        "organic curves",
        "quiet luxury symbolism",
      ],
      whyFitsMilaene: [
        "Aligns with calm luxury philosophy and emotional minimalism",
        "Uses negative space, organic curves, and muted tonal restraint",
        "Avoids hype aesthetics — built for long-term Milaene collection continuity",
      ],
      styleDirection: `Quiet luxury editorial — ${analyzed.styleDirection}`,
    });
  }

  if (analyzed.dnaScore < ABSOLUTE_DNA_FLOOR) {
    analyzed = { ...analyzed, dnaScore: ABSOLUTE_DNA_FLOOR };
  }

  const commercialScore = roundPercent(calculateCommercialScore(analyzed));
  const campaignPotential = assessCampaignPotential(analyzed, commercialScore);

  return {
    ...analyzed,
    dnaScore: roundPercent(analyzed.dnaScore),
    commercialScore,
    campaignPotential:
      campaignPotential === "low" && role !== "Supporting Piece"
        ? "medium"
        : campaignPotential,
  };
}

export interface ThemeFallbackInput {
  role: CollectionRole;
  collection: ResearchCollection;
  designId: string;
  color: string;
  usedTitles: Set<string>;
  emotionIndex?: number;
  heroDesignId?: string;
  usedApproaches?: Set<CreativeApproach>;
}

/** Build a complete theme-aware fallback — no anchor spread, full art direction rebuild. */
export function buildThemeRoleFallbackConcept(
  input: ThemeFallbackInput,
): DesignConcept {
  const { role, collection, designId, color, usedTitles, heroDesignId } = input;
  const theme = resolveThemeProfile(collection);
  const spec = ROLE_SPECS[role];
  const emotion = pickThemeEmotion(theme, collection, input.emotionIndex ?? 0);
  const title = uniqueTitle(getThemeRoleTitle(theme, role, collection), usedTitles);
  const motif = theme.visualMotifs[0] ?? "organic curve emblem";
  const secondaryMotif = theme.visualMotifs[1] ?? "editorial negative space frame";
  const art = buildArtDirection(
    role,
    theme,
    collection,
    spec,
    title,
    emotion,
    color,
    motif,
    secondaryMotif,
  );

  let approach = spec.approach;
  if (input.usedApproaches?.has(approach)) {
    const alternate = (
      [
        "Symbolic Illustration",
        "Abstract Graphic",
        "Japanese Editorial",
        "Photography Style",
        "Vintage Archive",
      ] as CreativeApproach[]
    ).find((entry) => !input.usedApproaches!.has(entry));
    if (alternate) approach = alternate;
  }

  const draft: DesignConcept = {
    designId,
    title,
    creativeApproach: approach,
    collectionRole: role,
    product: spec.product,
    color,
    printArea: spec.printArea,
    styleDirection: `${collection.campaignTheme} — ${theme.emotionalKeyword.toLowerCase()} ${role.toLowerCase()} with calm luxury editorial restraint`,
    emotion,
    emotionalKeyword: theme.emotionalKeyword,
    targetAudience: collection.targetAudience,
    ...art,
    typography:
      role === "Core Essential"
        ? "Micro sans-serif, wide tracking, single restrained wordmark"
        : role === "Statement Piece"
          ? "Editorial serif accent beneath symbolic illustration"
          : "No type — pure graphic restraint",
    message: role === "Hero Piece" ? title : role === "Core Essential" ? theme.emotionalKeyword : "",
    rationale: `Theme-aware ${role.toLowerCase()} fallback for ${theme.id} — ${collection.campaignTheme}.`,
    printTechnique:
      spec.productionDifficulty === "High"
        ? "Multi-layer screen print with specialty ink"
        : "Screen print, 1–2 color spot palette, plastisol",
    printSize: spec.printSize,
    placementDimensions: spec.placementDimensions,
    garmentInspiration: "Lemaire editorial restraint, Acne Studios oversized fleece",
    brandInspiration: "Milaene calm luxury — meaning over hype",
    productionDifficulty: spec.productionDifficulty,
    visualReferences: `Theme ${theme.id}, ${collection.campaignTheme}, Milaene symbolic language`,
    materialEffects: "Matte plastisol, soft hand feel, premium washed garment texture",
    geometry: `${motif} on vertical editorial axis`,
    dimensions: spec.printSize,
    coordinates: spec.placementDimensions,
    rotation: "0° — upright editorial alignment",
    spacing: "18 mm between primary and secondary layers",
    strokeWidth: "2 mm primary contour",
    opacity: "100% primary / 72% tonal layer",
    layerOrder: "Garment → tonal base → primary motif → accent → optional type",
    contrastLevel: spec.contrastLevel,
    textureIntensity: "Low",
    visualWeight: spec.visualWeight,
    balance: role === "Statement Piece" ? "Asymmetrical" : "Symmetrical",
    alignment: "center",
    focalPoint: `${motif} as ${role.toLowerCase()} focal anchor`,
    edgeTreatment: "Clean vector edges with soft tonal falloff",
    dnaScore: 0,
    dnaMatches: [],
    dnaConflicts: [],
    whyFitsMilaene: [],
    repeatabilityScore: role === "Limited Piece" ? "Medium" : "High",
    emotionalNarrative:
      role === "Hero Piece"
        ? buildHeroEmotionalNarrative(theme.emotion, title, collection.name)
        : `${theme.emotion.emotionalPain} expressed through ${motif} — ${collection.campaignTheme} ${role.toLowerCase()}.`,
    supportsDesignId: role === "Hero Piece" ? undefined : heroDesignId,
    relationshipReason: undefined,
    heroScore: undefined,
    commercialScore: undefined,
    campaignPotential: undefined,
  };

  return ensureMinimumDna(applyEmotionalVisualLanguage(draft, collection), role);
}
