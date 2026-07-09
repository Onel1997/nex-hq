import { applyBrandDnaAnalysis, MILAENE_BRAND_DNA } from "./brand-dna";
import { applyCeoConsistency } from "./ceo-consistency";
import {
  applyNarrativeHeroFields,
  buildHeroEmotionalNarrative,
  buildNarrativeSymbolism,
  buildNarrativeVisualConcept,
} from "./emotional-intelligence";
import { applyEmotionalVisualLanguage } from "./emotional-visual";
import { normalizeDesignPrintArea } from "./design-concept";
import {
  assessCampaignPotential,
  assessHeroFailure,
  buildHeroAnalysis,
  buildLaunchApproval,
  calculateCommercialScore,
  calculateHeroScore,
  isWeakHeroVisual,
  scoreEmotionalStrength,
  scoreVisualMemorability,
  strengthenHeroCandidate,
  validateExactCollectionRoles,
} from "./hero-engine";
import {
  buildThemeHeroTitle,
  pickThemeEmotion,
  resolveThemeProfile,
} from "./theme-vocabulary";
import type {
  DesignConcept,
  HeroAnalysis,
  HeroRegeneration,
  ResearchCollection,
} from "./types";

/** Launch approval thresholds — not score floors returned to the client. */
export const REGEN_DNA_TARGET = 80;
export const REGEN_HERO_SCORE_TARGET = 85;
export const REGEN_EMOTIONAL_TARGET = 80;
export const REGEN_VISUAL_TARGET = 80;

export interface HeroRegenerationInput {
  collection: ResearchCollection;
  designs: DesignConcept[];
  previousHero: DesignConcept;
  previousAnalysis: HeroAnalysis;
  failureReasons: string[];
  adjustments?: string[];
}

export interface HeroRegenerationResult {
  designs: DesignConcept[];
  collection: ResearchCollection;
  regeneratedHero: DesignConcept;
  heroRegeneration: HeroRegeneration;
}

function slugHeroId(seed: string): string {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `hero-regen-${base || "campaign"}`;
}

function collectDnaSignals(supporters: DesignConcept[]): string[] {
  const signals = new Set<string>();
  for (const design of supporters.slice(0, 3)) {
    for (const match of design.dnaMatches ?? []) signals.add(match);
    for (const element of design.graphicElements.slice(0, 2)) signals.add(element);
  }
  for (const element of MILAENE_BRAND_DNA.signatureElements.slice(0, 3)) {
    signals.add(element);
  }
  return [...signals].slice(0, 6);
}

function buildRegeneratedHeroConcept(
  input: HeroRegenerationInput,
  newHeroId: string,
): DesignConcept {
  const { collection, previousHero, designs } = input;
  const theme = resolveThemeProfile(collection);
  const supporters = designs
    .filter((design) => design.designId !== previousHero.designId)
    .sort((a, b) => b.dnaScore - a.dnaScore);
  const anchor = supporters[0] ?? previousHero;
  const emotion = pickThemeEmotion(theme, collection);
  const primaryMotif = theme.visualMotifs[0] ?? "organic curve emblem";
  const secondaryMotif = theme.visualMotifs[1] ?? "editorial negative space frame";
  const narrativeBase = applyNarrativeHeroFields({
    design: anchor,
    collection,
    primaryMotif,
    secondaryMotif,
  });
  const heroTitle = narrativeBase.title;
  const color = anchor.color || collection.colorDirection[0] || "Washed Black";
  const product = anchor.product || collection.heroProduct.product || "Oversized Hoodie";
  const dnaSignals = collectDnaSignals(supporters);
  const useBack =
    /back|spine|yoke/i.test(
      `${previousHero.placementDimensions} ${previousHero.exactComposition}`,
    ) || previousHero.printArea.toLowerCase().includes("back");

  const concept: DesignConcept = {
    ...anchor,
    designId: newHeroId,
    title: heroTitle,
    creativeApproach: "Symbolic Illustration",
    collectionRole: "Hero Piece",
    product,
    color,
    printArea: useBack ? "Back" : "Front",
    styleDirection: `Quiet luxury campaign hero — ${collection.mood.toLowerCase()} ${theme.id.replace(/-/g, " ")} centerpiece for ${collection.campaignTheme}`,
    emotion,
    targetAudience: collection.targetAudience,
    visualConcept: buildNarrativeVisualConcept(
      theme.emotion,
      heroTitle,
      primaryMotif,
      secondaryMotif,
    ),
    designDescription: `Regenerated launch hero for ${collection.name}. Narrative-led ${theme.emotion.emotionalPain} expressed through ${primaryMotif} with premium editorial restraint.`,
    symbolism: buildNarrativeSymbolism(theme.emotion, primaryMotif, heroTitle),
    typography: "Editorial serif, wide tracking, uppercase, single restrained text block",
    message: heroTitle,
    rationale: `Auto-regenerated hero for ${collection.campaignTheme} — ${collection.philosophy.slice(0, 80).toLowerCase()}`,
    printTechnique: "Screen print, 2-color spot palette, plastisol",
    printSize: "30 cm wide editorial graphic",
    placementDimensions: useBack
      ? "Center back, 10 cm below yoke — full spine alignment"
      : "Center chest, 8 cm below collar seam — dominant focal placement",
    garmentInspiration: "Acne Studios oversized hoodie, Lemaire editorial restraint",
    brandInspiration: "Milaene calm luxury — meaning over hype",
    productionDifficulty: "Low",
    visualReferences: `Emotional visual translation for ${theme.id}, muted tonal styling influence only`,
    exactComposition: `Vertical editorial centerpiece featuring ${primaryMotif} — wide negative space margins, calm luxury hierarchy, campaign-scale silhouette readable at 3 meters`,
    graphicElements: [
      `${theme.emotion.emotionalTension} emblem`,
      secondaryMotif,
      theme.visualMotifs[2] ?? "symbolic focal anchor",
      "muted tonal ink layer",
      "editorial spacing frame",
    ],
    elementCount: "5 layered elements",
    layoutDescription:
      "Single dominant campaign symbol centered on generous negative space with editorial vertical rhythm and premium spacing discipline",
    visualHierarchy:
      `Primary "${heroTitle}" narrative emblem → negative space frame → tonal ink layer → symbolic accent → garment silhouette`,
    colorBreakdown: [
      { color, usage: "garment base" },
      { color: "Soft Black Ink", usage: "primary graphic" },
      { color: "Stone Grey", usage: "secondary tonal layer" },
    ],
    materialEffects: "Soft hand feel, matte plastisol, premium washed garment texture",
    negativeSpaceUsage:
      "Generous negative space with muted tonal restraint and editorial breathing room around the campaign centerpiece",
    designInstructions: [
      `Build a campaign-scale narrative centerpiece for "${collection.campaignTheme}" — never a micro graphic or tiny chest mark`,
      `Express ${theme.emotion.emotionalPain} through ${primaryMotif} with calm luxury hierarchy`,
      "Maintain billboard readability at thumbnail and homepage banner scale",
    ],
    mockupDescription:
      "Hero campaign mockup — oversized hoodie with dominant 30 cm editorial graphic readable at 3 meters, studio lighting, homepage banner and Instagram ad crop",
    geometry: "Vertical editorial axis with centered organic emblem",
    dimensions: "30 cm x 38 cm campaign graphic zone",
    coordinates: "Centered on chest or spine with 8 cm collar offset",
    rotation: "0° — upright editorial alignment",
    spacing: "Wide outer margins, 4 cm minimum clear space around emblem",
    strokeWidth: "2.5 mm primary contour",
    opacity: "100% primary / 72% tonal layer",
    layerOrder: "Garment → tonal base → emblem → accent curve → optional serif wordmark",
    contrastLevel: "Medium",
    textureIntensity: "Low",
    visualWeight: "Balanced",
    balance: "Symmetrical",
    alignment: "Center",
    focalPoint: `Dominant "${heroTitle}" narrative emblem centered as campaign anchor`,
    edgeTreatment: "Clean vector edges with soft tonal falloff",
    dnaScore: 0,
    dnaMatches: [],
    dnaConflicts: [],
    whyFitsMilaene: [
      `Channels ${collection.campaignTheme} through calm luxury editorial symbolism`,
      "Uses negative space, organic curves, and muted tonal restraint",
      "Avoids hype aesthetics and supports long-term Milaene collection building",
    ],
    repeatabilityScore: "High",
    imagePromptCore: `${heroTitle} editorial campaign hero, ${primaryMotif}, washed black oversized hoodie, calm luxury, negative space, Milaene DNA, ${collection.campaignTheme}`,
    emotionalNarrative: buildHeroEmotionalNarrative(
      theme.emotion,
      heroTitle,
      collection.name,
    ),
    emotionalKeyword: theme.emotionalKeyword,
    supportsDesignId: undefined,
  };

  return applyEmotionalVisualLanguage(concept, collection);
}

function meetsRegenerationTargets(
  design: DesignConcept,
  analysis: HeroAnalysis,
): boolean {
  return (
    design.dnaScore >= REGEN_DNA_TARGET &&
    analysis.heroScore >= REGEN_HERO_SCORE_TARGET &&
    analysis.campaignPotential === "high" &&
    scoreEmotionalStrength(design) >= REGEN_EMOTIONAL_TARGET &&
    scoreVisualMemorability(design) >= REGEN_VISUAL_TARGET &&
    !isWeakHeroVisual(design)
  );
}

function ensureRegenerationTargets(
  design: DesignConcept,
  collection: ResearchCollection,
  peers: DesignConcept[],
): DesignConcept {
  const theme = resolveThemeProfile(collection);
  let working = normalizeDesignPrintArea(
    strengthenHeroCandidate(
      {
        ...design,
        emotion: pickThemeEmotion(theme, collection),
        emotionalKeyword: theme.emotionalKeyword,
        symbolism: buildNarrativeSymbolism(
          theme.emotion,
          theme.visualMotifs[0] ?? "organic curve emblem",
          buildThemeHeroTitle(collection, theme),
        ),
        emotionalNarrative: buildHeroEmotionalNarrative(
          theme.emotion,
          buildThemeHeroTitle(collection, theme),
          collection.name,
        ),
        visualConcept: buildNarrativeVisualConcept(
          theme.emotion,
          buildThemeHeroTitle(collection, theme),
          theme.visualMotifs[0] ?? "organic curve emblem",
          theme.visualMotifs[1] ?? "editorial negative space frame",
        ),
        message: buildThemeHeroTitle(collection, theme),
        title: buildThemeHeroTitle(collection, theme),
      },
      theme,
      collection,
    ),
  );

  const analyzed = applyBrandDnaAnalysis(working);
  const commercialScore = calculateCommercialScore(analyzed);
  const campaignPotential = assessCampaignPotential(analyzed, commercialScore);
  const enriched = {
    ...analyzed,
    commercialScore,
    campaignPotential,
  };

  return {
    ...enriched,
    heroScore: calculateHeroScore(enriched, peers),
  };
}

export function regenerateHeroDesign(input: HeroRegenerationInput): {
  design: DesignConcept;
  heroRegeneration: HeroRegeneration;
  heroAnalysis: HeroAnalysis;
} {
  const adjustments = input.adjustments ?? [];
  const theme = resolveThemeProfile(input.collection);
  const newHeroId = slugHeroId(`${input.collection.name}-${theme.id}`);
  const draft = buildRegeneratedHeroConcept(input, newHeroId);
  const peers = input.designs.filter(
    (design) => design.designId !== input.previousHero.designId,
  );
  let design = ensureRegenerationTargets(draft, input.collection, peers);
  design = applyEmotionalVisualLanguage(design, input.collection);
  let heroAnalysis = buildHeroAnalysis(design, [...peers, design]);

  if (!meetsRegenerationTargets(design, heroAnalysis)) {
    design = ensureRegenerationTargets(design, input.collection, peers);
    heroAnalysis = buildHeroAnalysis(design, [...peers, design]);
  }

  const improvements = [
    `Rebuilt as theme-specific campaign hero for "${input.collection.campaignTheme}"`,
    `Applied ${theme.emotionalKeyword} emotional keyword and "${buildThemeHeroTitle(input.collection, theme)}" title`,
    `Visual motifs: ${theme.visualMotifs.slice(0, 2).join("; ")}`,
    "Optimized for homepage banner, Instagram ads, and premium mockup readability",
    "Removed weak minimal / micro-graphic patterns from hero candidacy",
    `Dynamic scores — hero ${heroAnalysis.heroScore}%, DNA ${design.dnaScore}%, commercial ${heroAnalysis.commercialScore}%`,
  ];

  adjustments.push(
    `hero regeneration: created "${design.title}" replacing "${input.previousHero.title}"`,
  );

  return {
    design,
    heroAnalysis,
    heroRegeneration: {
      required: true,
      reason: input.failureReasons.join("; "),
      previousHeroId: input.previousHero.designId,
      previousHeroTitle: input.previousHero.title,
      newHeroId: design.designId,
      newHeroTitle: design.title,
      improvements,
    },
  };
}

export function applyHeroRegeneration(
  designs: DesignConcept[],
  collection: ResearchCollection,
  adjustments: string[] = [],
): HeroRegenerationResult {
  const previousHero = designs.find((d) => d.designId === collection.heroDesignId);
  const previousAnalysis = collection.heroAnalysis;

  if (!previousHero || !previousAnalysis) {
    throw new Error("Hero regeneration requires a previous hero and hero analysis");
  }

  const { design: regeneratedHero, heroRegeneration, heroAnalysis: regeneratedAnalysis } =
    regenerateHeroDesign({
      collection,
      designs,
      previousHero,
      previousAnalysis,
      failureReasons:
        collection.heroRegenerationRequired === true
          ? assessHeroFailure(previousHero, previousAnalysis).failureReasons
          : ["Hero failed launch quality gates"],
      adjustments,
    });

  let working = designs.map((design) =>
    design.designId === previousHero.designId ? regeneratedHero : design,
  );

  working = validateExactCollectionRoles(working, adjustments, regeneratedHero.designId);

  const hero = working.find((d) => d.designId === regeneratedHero.designId)!;
  const heroAnalysis = regeneratedAnalysis;
  const launchApproval = buildLaunchApproval(hero, heroAnalysis)!;

  const ceoResult = applyCeoConsistency(
    collection,
    hero,
    heroAnalysis,
    working,
    collection.collectionScore,
  );

  const approved = ceoResult.ceoApproved;
  const syncedHero = ceoResult.hero;
  const syncedAnalysis = ceoResult.heroAnalysis;

  const supportingDesignIds = working
    .filter((d) => d.designId !== syncedHero.designId)
    .map((d) => d.designId);

  const syncedDesigns = working.map((d) =>
    d.designId === syncedHero.designId ? syncedHero : d,
  );

  const enrichedCollection: ResearchCollection = {
    ...ceoResult.collection,
    heroDesignId: syncedHero.designId,
    supportingDesignIds,
    heroRegenerationRequired: false,
    heroRegeneration,
    heroProduct: {
      ...ceoResult.collection.heroProduct,
      product: syncedHero.product,
      estimatedRetailPrice: collection.heroProduct.estimatedRetailPrice,
      productionComplexity: syncedHero.productionDifficulty,
    },
    heroAnalysis: syncedAnalysis,
    ceoAnalysis: {
      strongestProduct: syncedHero.product,
      weakestProduct:
        collection.ceoAnalysis?.weakestProduct ??
        [...syncedDesigns].sort((a, b) => a.dnaScore - b.dnaScore)[0]?.product ??
        syncedHero.product,
      recommendedLaunchOrder: [
        syncedHero.title,
        ...(collection.ceoAnalysis?.recommendedLaunchOrder ?? []).filter(
          (title) => title !== previousHero.title,
        ),
      ],
      productionRisk:
        collection.ceoAnalysis?.productionRisk ??
        "Production risk assessed after hero regeneration pass",
      commercialConfidence: ceoResult.collection.ceoAnalysis!.commercialConfidence,
      adPotential: syncedAnalysis.adPotential,
      launchApproval,
    },
  };

  adjustments.push(
    `hero regeneration: finalized "${syncedHero.title}" (hero ${syncedAnalysis.heroScore}%, DNA ${syncedHero.dnaScore}%, approved ${approved})`,
  );

  return {
    designs: syncedDesigns,
    collection: enrichedCollection,
    regeneratedHero: syncedHero,
    heroRegeneration,
  };
}
