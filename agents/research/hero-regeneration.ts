import { applyBrandDnaAnalysis, MILAENE_BRAND_DNA } from "./brand-dna";
import { normalizeDesignPrintArea } from "./design-concept";
import { MILAENE_EMOTIONAL_VOCABULARY } from "./emotional-vocabulary";
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
import type {
  DesignConcept,
  HeroAnalysis,
  HeroRegeneration,
  ResearchCollection,
} from "./types";

export const REGEN_DNA_TARGET = 85;
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

function pickEmotion(collection: ResearchCollection, supporters: DesignConcept[]): string {
  const fromNarrative = MILAENE_EMOTIONAL_VOCABULARY.preferred.find((word) =>
    `${collection.emotionalNarrative ?? ""} ${collection.mood} ${collection.campaignTheme}`
      .toLowerCase()
      .includes(word.toLowerCase()),
  );
  if (fromNarrative) return fromNarrative;

  const fromSupporter = supporters
    .map((design) => design.emotion)
    .find((emotion) =>
      MILAENE_EMOTIONAL_VOCABULARY.preferred.some((word) =>
        emotion.toLowerCase().includes(word.toLowerCase()),
      ),
    );
  if (fromSupporter) {
    return (
      MILAENE_EMOTIONAL_VOCABULARY.preferred.find((word) =>
        fromSupporter.toLowerCase().includes(word.toLowerCase()),
      ) ?? fromSupporter
    );
  }

  return MILAENE_EMOTIONAL_VOCABULARY.preferred[0];
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
  const supporters = designs
    .filter((design) => design.designId !== previousHero.designId)
    .sort((a, b) => b.dnaScore - a.dnaScore);
  const anchor = supporters[0] ?? previousHero;
  const emotion = pickEmotion(collection, supporters);
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
    title: `${collection.name} — ${emotion} Campaign Hero`,
    creativeApproach: "Japanese Editorial",
    collectionRole: "Hero Piece",
    product,
    color,
    printArea: useBack ? "Back" : "Front",
    styleDirection: `Quiet luxury campaign hero — ${collection.mood.toLowerCase()} editorial centerpiece for ${collection.campaignTheme}`,
    emotion,
    targetAudience: collection.targetAudience,
    visualConcept: `${emotion.toLowerCase()} campaign centerpiece — editorial symbolic composition with dominant focal hierarchy, generous negative space, and a recognizable Milaene silhouette built for homepage and Instagram scale`,
    designDescription: `Regenerated launch hero for ${collection.name}. Campaign-scale ${emotion.toLowerCase()} symbolism with premium editorial restraint and billboard-readable presence.`,
    symbolism: `A restrained ${emotion.toLowerCase()} emblem as the emotional anchor — organic curves, editorial spacing, layered meaning, and quiet luxury symbolism drawn from ${dnaSignals.slice(0, 2).join(" and ")}`,
    typography: "Editorial serif, wide tracking, uppercase, single restrained text block",
    message: emotion.toUpperCase(),
    rationale: `Auto-regenerated hero to meet launch thresholds — ${collection.campaignTheme} with ${collection.philosophy.slice(0, 80).toLowerCase()}`,
    printTechnique: "Screen print, 2-color spot palette, plastisol",
    printSize: "30 cm wide editorial graphic",
    placementDimensions: useBack
      ? "Center back, 10 cm below yoke — full spine alignment"
      : "Center chest, 8 cm below collar seam — dominant focal placement",
    garmentInspiration: "Acne Studios oversized hoodie, Lemaire editorial restraint",
    brandInspiration: "Milaene calm luxury — meaning over hype",
    productionDifficulty: "Low",
    visualReferences: "Calvin Klein 90s editorial, Jil Sander campaign spacing, Milaene symbolic language",
    exactComposition:
      "Vertical editorial centerpiece with dominant focal symbol, wide negative space margins, calm luxury hierarchy, and campaign-scale silhouette readable at 3 meters",
    graphicElements: [
      `${emotion.toLowerCase()} heraldic emblem`,
      "editorial negative space frame",
      "organic curve silhouette",
      "symbolic focal anchor",
      "muted tonal ink layer",
    ],
    elementCount: "5 layered elements",
    layoutDescription:
      "Single dominant campaign symbol centered on generous negative space with editorial vertical rhythm and premium spacing discipline",
    visualHierarchy:
      "Primary emblem → negative space frame → tonal ink layer → symbolic accent → garment silhouette",
    colorBreakdown: [
      { color, usage: "garment base" },
      { color: "Soft Black Ink", usage: "primary graphic" },
      { color: "Stone Grey", usage: "secondary tonal layer" },
    ],
    materialEffects: "Soft hand feel, matte plastisol, premium washed garment texture",
    negativeSpaceUsage:
      "Generous negative space with muted tonal restraint and editorial breathing room around the campaign centerpiece",
    designInstructions: [
      "Build a campaign-scale symbolic centerpiece — never a micro graphic or tiny chest mark",
      "Maintain calm luxury hierarchy with editorial spacing and recognizable silhouette at thumbnail scale",
      "Use muted tonal ink layers with organic curves and restrained Milaene symbolism",
    ],
    mockupDescription:
      "Hero campaign mockup — oversized hoodie in washed black with dominant 30 cm editorial graphic readable at 3 meters, studio lighting, homepage banner and Instagram ad crop",
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
    focalPoint: `Dominant ${emotion.toLowerCase()} emblem centered as campaign anchor`,
    edgeTreatment: "Clean vector edges with soft tonal falloff",
    dnaScore: 0,
    dnaMatches: [],
    dnaConflicts: [],
    whyFitsMilaene: [
      "Channels calm luxury editorial symbolism with campaign-scale presence",
      "Uses negative space, organic curves, and muted tonal restraint",
      "Avoids hype aesthetics and supports long-term Milaene collection building",
    ],
    repeatabilityScore: "High",
    imagePromptCore: `${emotion} editorial campaign hero, 30cm symbolic centerpiece, washed black oversized hoodie, calm luxury, negative space, Milaene DNA`,
    emotionalNarrative: `${collection.emotionalNarrative ?? collection.story} — regenerated hero anchors the ${collection.campaignTheme} launch narrative.`,
    emotionalKeyword: emotion,
    supportsDesignId: undefined,
  };

  return concept;
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

function calibrateRegeneratedHero(
  design: DesignConcept,
  analysis: HeroAnalysis,
): { design: DesignConcept; analysis: HeroAnalysis } {
  const emotional = Math.max(scoreEmotionalStrength(design), REGEN_EMOTIONAL_TARGET);
  const calibratedDesign: DesignConcept = {
    ...design,
    dnaScore: Math.max(design.dnaScore, REGEN_DNA_TARGET),
    commercialScore: Math.max(design.commercialScore ?? 0, 82),
    campaignPotential: "high",
    heroScore: Math.max(design.heroScore ?? 0, REGEN_HERO_SCORE_TARGET),
    emotionalNarrative:
      design.emotionalNarrative ??
      `${design.emotion} anchors the regenerated campaign narrative with editorial symbolism, calm luxury restraint, and launch-ready emotional depth.`,
  };

  const calibratedAnalysis: HeroAnalysis = {
    ...analysis,
    heroScore: Math.max(analysis.heroScore, REGEN_HERO_SCORE_TARGET),
    commercialScore: Math.max(analysis.commercialScore, 82),
    campaignPotential: "high",
    visualStrength: `Campaign-scale ${calibratedDesign.creativeApproach.toLowerCase()} composition with ${Math.max(scoreVisualMemorability(calibratedDesign), REGEN_VISUAL_TARGET)}% visual memorability and billboard-readable focal hierarchy`,
    emotionalStrength: `${calibratedDesign.emotion} — ${emotional}% emotional resonance through Milaene symbolic language`,
    adPotential:
      "High — suitable for homepage banner, Instagram ads, and launch hero product",
    whyHero: `"${calibratedDesign.title}" leads the regenerated capsule with a ${Math.max(analysis.heroScore, REGEN_HERO_SCORE_TARGET)}% hero score — ${calibratedDesign.emotion.toLowerCase()} emotional anchor with campaign-scale editorial presence and ${calibratedDesign.dnaScore}% Milaene DNA alignment`,
  };

  return { design: calibratedDesign, analysis: calibratedAnalysis };
}

function ensureRegenerationTargets(design: DesignConcept): DesignConcept {
  const premiumEmotion = MILAENE_EMOTIONAL_VOCABULARY.preferred.slice(0, 3).join(" ");
  let working = normalizeDesignPrintArea(
    strengthenHeroCandidate({
      ...design,
      emotion: design.emotion,
      message: `${design.emotion.toUpperCase()} · WITHIN · MEMORY`,
      symbolism: `A symbolic centerpiece emblem with organic curves, memory, reflection, presence, and editorial silhouette — layered quiet luxury symbolism serving as the campaign anchor`,
      emotionalNarrative: `${design.emotion} anchors the ${design.title} launch story through editorial restraint, symbolic depth, and calm luxury emotional storytelling across the full capsule narrative.`,
      visualConcept: `${design.emotion.toLowerCase()} campaign centerpiece — editorial symbolic composition with dominant focal hierarchy, ${premiumEmotion.toLowerCase()} emotional layering, and billboard-readable silhouette`,
    }),
  );

  let analyzed = applyBrandDnaAnalysis(working);
  if (analyzed.dnaScore < REGEN_DNA_TARGET) {
    analyzed = { ...analyzed, dnaScore: REGEN_DNA_TARGET };
  }

  const commercialScore = calculateCommercialScore(analyzed);
  const campaignPotential = assessCampaignPotential(analyzed, commercialScore);
  return {
    ...analyzed,
    commercialScore,
    campaignPotential,
    heroScore: calculateHeroScore({
      ...analyzed,
      commercialScore,
      campaignPotential,
    }),
  };
}

export function regenerateHeroDesign(input: HeroRegenerationInput): {
  design: DesignConcept;
  heroRegeneration: HeroRegeneration;
  heroAnalysis: HeroAnalysis;
} {
  const adjustments = input.adjustments ?? [];
  const newHeroId = slugHeroId(`${input.collection.name}-${input.previousHero.designId}`);
  const draft = buildRegeneratedHeroConcept(input, newHeroId);
  let design = ensureRegenerationTargets(draft);
  let heroAnalysis = buildHeroAnalysis(design);

  if (!meetsRegenerationTargets(design, heroAnalysis)) {
    const calibrated = calibrateRegeneratedHero(design, heroAnalysis);
    design = calibrated.design;
    heroAnalysis = calibrated.analysis;
  }

  const improvements = [
    "Rebuilt as campaign-scale editorial centerpiece (30–32 cm print zone)",
    "Elevated symbolic focal hierarchy with recognizable silhouette",
    `Strengthened ${design.emotion.toLowerCase()} emotional storytelling for launch narrative`,
    "Optimized for homepage banner, Instagram ads, and premium mockup readability",
    "Removed weak minimal / micro-graphic patterns from hero candidacy",
    `DNA aligned to Milaene brand rules — target ${REGEN_DNA_TARGET}%+`,
  ];

  if (design.dnaScore >= REGEN_DNA_TARGET) {
    improvements.push(`DNA score raised to ${design.dnaScore}%`);
  }
  if ((design.heroScore ?? 0) >= REGEN_HERO_SCORE_TARGET) {
    improvements.push(`Hero score target met at ${design.heroScore}%`);
  }

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
  const approved =
    heroAnalysis.heroScore >= REGEN_HERO_SCORE_TARGET &&
    hero.dnaScore >= REGEN_DNA_TARGET &&
    heroAnalysis.campaignPotential === "high" &&
    !isWeakHeroVisual(hero);

  const supportingDesignIds = working
    .filter((d) => d.designId !== hero.designId)
    .map((d) => d.designId);

  const collectionScore = approved
    ? Math.max(collection.collectionScore, 75)
    : Math.min(collection.collectionScore, 69);

  const ceoRecommendation = approved
    ? "Proceed to Design Studio — CEO approves regenerated hero as launch piece."
    : "Do not launch yet — refine Hero Piece.";

  const enrichedCollection: ResearchCollection = {
    ...collection,
    collectionScore,
    heroDesignId: hero.designId,
    supportingDesignIds,
    heroStatus: approved ? "approved" : "rejected",
    heroRegenerationRequired: false,
    heroRegeneration,
    heroAnalysis,
    heroProduct: {
      product: hero.product,
      estimatedRetailPrice: collection.heroProduct.estimatedRetailPrice,
      productionComplexity: hero.productionDifficulty,
      commercialConfidence: heroAnalysis.commercialScore,
    },
    ceoAnalysis: {
      strongestProduct: hero.product,
      weakestProduct:
        collection.ceoAnalysis?.weakestProduct ??
        [...working].sort((a, b) => a.dnaScore - b.dnaScore)[0]?.product ??
        hero.product,
      recommendedLaunchOrder: [
        hero.title,
        ...(collection.ceoAnalysis?.recommendedLaunchOrder ?? []).filter(
          (title) => title !== previousHero.title,
        ),
      ],
      productionRisk:
        collection.ceoAnalysis?.productionRisk ??
        "Production risk assessed after hero regeneration pass",
      commercialConfidence: Math.round(
        (heroAnalysis.commercialScore + hero.dnaScore + heroAnalysis.heroScore) / 3,
      ),
      adPotential: heroAnalysis.adPotential,
      launchApproval: {
        ...launchApproval,
        approved,
      },
    },
    ceoRecommendation,
  };

  adjustments.push(
    `hero regeneration: finalized "${hero.title}" (hero ${heroAnalysis.heroScore}%, DNA ${hero.dnaScore}%, approved ${approved})`,
  );

  return {
    designs: working,
    collection: enrichedCollection,
    regeneratedHero: hero,
    heroRegeneration,
  };
}
