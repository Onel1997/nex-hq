import { applyBrandDnaAnalysis } from "./brand-dna";
import {
  applyCeoConsistency,
  buildConsistentAdPotential,
  buildLaunchApprovalCopy,
  collectHeroApprovalMetrics,
  isHeroCeoApproved,
  limitCommercialScore,
} from "./ceo-consistency";
import {
  applyNarrativeHeroFields,
  computeEmotionalStrength,
  EMOTIONAL_STRENGTH_CEO_MIN,
} from "./emotional-intelligence";
import {
  applyEmotionalVisualLanguage,
} from "./emotional-visual";
import { normalizeDesignPrintArea } from "./design-concept";
import { MILAENE_EMOTIONAL_VOCABULARY } from "./emotional-vocabulary";
import { roundPercent } from "./score-coercion";
import {
  pickThemeEmotion,
  resolveThemeProfile,
  type ThemeProfile,
} from "./theme-vocabulary";
import {
  COLLECTION_ROLES,
  type CampaignPotential,
  type CollectionRole,
  type DesignConcept,
  type HeroAnalysis,
  type ResearchCollection,
} from "./types";

export const HERO_DNA_TARGET = 80;
export const HERO_SCORE_TARGET = 80;
export const HERO_EMOTIONAL_TARGET = EMOTIONAL_STRENGTH_CEO_MIN;
export const HERO_VISUAL_TARGET = 75;
export const HERO_FAILURE_THRESHOLD = 2;

const NON_HERO_ROLES: CollectionRole[] = [
  "Core Essential",
  "Statement Piece",
  "Supporting Piece",
  "Limited Piece",
];

const CAMPAIGN_SCALE_PATTERN =
  /\b(center|spine|vertical|editorial|centerpiece|campaign|28 cm|32 cm|large|focal|full back|upper back)\b/i;

const WEAK_HERO_PATTERNS: RegExp[] = [
  /\b(tiny icon|small icon|micro icon|minimal icon)\b/i,
  /\b(micro graphic|tiny graphic|small chest mark|left chest dot)\b/i,
  /\b(tone-on-tone|tonal embroidery|invisible print|barely visible)\b/i,
  /\b(generic type|basic type|simple text only|plain wordmark)\b/i,
];

const STRONG_SYMBOLISM =
  /\b(symbol|emblem|arc|curve|silhouette|memory|reflection|presence|echo|organic|heraldic|centerpiece)\b/i;

const MICRO_PRINT_PATTERN =
  /\b(\d{1,2}\s*cm|micro|tiny|small chest|left chest dot|icon only|minimal mark)\b/i;
const NICHE_SYMBOLISM =
  /\b(obscure|esoteric|cryptic|incomprehensible|confusing|abstract metaphor)\b/i;
const WEARABLE_PRODUCT_PATTERN = /hoodie|tee|sweat|oversized|crew/i;
const BESTSELLER_PRODUCT_PATTERN = /faith|oversized hoodie|bestseller/i;

function parsePrintWidthCm(design: DesignConcept): number | undefined {
  const match = design.printSize.match(/(\d{1,2})\s*cm/i);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function scoreCampaignReadability(design: DesignConcept): number {
  let score = 35;
  if (design.contrastLevel === "High") score += 22;
  else if (design.contrastLevel === "Medium") score += 14;
  if (design.visualWeight === "Heavy" || design.visualWeight === "Balanced") {
    score += 12;
  }
  const width = parsePrintWidthCm(design);
  if (width !== undefined) {
    if (width >= 24) score += 18;
    else if (width >= 16) score += 10;
    else if (width < 12) score -= 12;
  }
  if (/center|spine|vertical|editorial|campaign/i.test(design.placementDimensions)) {
    score += 8;
  }
  if (design.focalPoint.length > 12) score += 6;
  return Math.max(0, Math.min(100, score));
}

function scoreProductFit(design: DesignConcept): number {
  let score = 40;
  if (WEARABLE_PRODUCT_PATTERN.test(design.product)) score += 25;
  if (BESTSELLER_PRODUCT_PATTERN.test(design.product)) score += 15;
  if (design.productionDifficulty === "Low") score += 12;
  else if (design.productionDifficulty === "Medium") score += 6;
  if (/front|back|chest|spine/i.test(design.printArea)) score += 8;
  return Math.max(0, Math.min(100, score));
}

function scoreEmotionalRelevance(design: DesignConcept): number {
  const corpus = `${design.emotion} ${design.message} ${design.symbolism} ${design.emotionalNarrative ?? ""}`;
  const preferredHits = MILAENE_EMOTIONAL_VOCABULARY.preferred.filter((word) =>
    corpus.toLowerCase().includes(word.toLowerCase()),
  ).length;
  const discouragedHits = MILAENE_EMOTIONAL_VOCABULARY.discouraged.filter((word) =>
    corpus.toLowerCase().includes(word.toLowerCase()),
  ).length;
  let score = 35 + preferredHits * 14;
  score -= discouragedHits * 18;
  if ((design.emotionalNarrative?.length ?? 0) > 40) score += 10;
  if (design.emotionalKeyword && design.emotion.includes(design.emotionalKeyword)) {
    score += 8;
  }
  return Math.max(0, Math.min(100, score));
}

function scoreUniquenessVsPeers(
  design: DesignConcept,
  peers: DesignConcept[] = [],
): number {
  if (peers.length === 0) return scoreUniqueness(design);
  const sameApproach = peers.filter(
    (peer) =>
      peer.designId !== design.designId &&
      peer.creativeApproach === design.creativeApproach,
  ).length;
  const sameEmotion = peers.filter(
    (peer) =>
      peer.designId !== design.designId &&
      peer.emotion.toLowerCase() === design.emotion.toLowerCase(),
  ).length;
  let score = scoreUniqueness(design);
  score -= sameApproach * 14;
  score -= sameEmotion * 8;
  return Math.max(20, Math.min(100, score));
}

function computeCommercialPenalties(design: DesignConcept): number {
  const corpus = [
    design.visualConcept,
    design.designDescription,
    design.printSize,
    design.typography,
    design.exactComposition,
    design.symbolism,
  ].join(" ");

  let penalty = 0;
  const width = parsePrintWidthCm(design);

  if (MICRO_PRINT_PATTERN.test(corpus) || (width !== undefined && width < 10)) {
    penalty += 22;
  }
  if (
    /\b(micro wordmark|tiny wordmark|tone-on-tone wordmark|spaced caps wordmark)\b/i.test(
      corpus,
    ) ||
    (design.creativeApproach === "Luxury Minimalism" &&
      design.message.split(/\s+/).length <= 1 &&
      width !== undefined &&
      width < 14)
  ) {
    penalty += 18;
  }
  if (isWeakHeroVisual(design) || design.visualWeight === "Light") {
    penalty += 14;
  }
  if (design.contrastLevel === "Low" && design.visualWeight !== "Heavy") {
    penalty += 10;
  }
  if (NICHE_SYMBOLISM.test(design.symbolism)) {
    penalty += 12;
  }
  if (scoreCampaignReadability(design) < 45) {
    penalty += 15;
  }
  if (
    design.creativeApproach === "Minimal Back Print" &&
    width !== undefined &&
    width < 16
  ) {
    penalty += 20;
  }

  return Math.min(55, penalty);
}

function computeCommercialRewards(design: DesignConcept): number {
  let reward = 0;
  const width = parsePrintWidthCm(design);

  if (WEARABLE_PRODUCT_PATTERN.test(design.product)) reward += 12;
  if (BESTSELLER_PRODUCT_PATTERN.test(design.product)) reward += 10;
  if (!isWeakHeroVisual(design) && (width === undefined || width >= 20)) {
    reward += 14;
  }
  if (scoreEmotionalRelevance(design) >= 60) reward += 10;
  if (design.productionDifficulty === "Low") reward += 8;
  if (scoreCampaignReadability(design) >= 65) reward += 12;
  if (design.repeatabilityScore === "High") reward += 6;

  return Math.min(40, reward);
}

function scoreProductionSimplicity(design: DesignConcept): number {
  return design.productionDifficulty === "Low"
    ? 25
    : design.productionDifficulty === "Medium"
      ? 15
      : 6;
}

function scoreRepeatability(design: DesignConcept): number {
  return design.repeatabilityScore === "High"
    ? 20
    : design.repeatabilityScore === "Medium"
      ? 12
      : 5;
}

function scorePodSuitability(design: DesignConcept): number {
  const corpus = [
    design.printTechnique,
    design.productionDifficulty,
    design.creativeApproach,
  ]
    .join(" ")
    .toLowerCase();
  return /screen print|1-color|2-color|spot palette|plastisol/i.test(corpus) ? 18 : 10;
}

function scoreEmotionalAppeal(design: DesignConcept): number {
  return MILAENE_EMOTIONAL_VOCABULARY.preferred.some((word) =>
    `${design.emotion} ${design.message} ${design.symbolism}`
      .toLowerCase()
      .includes(word.toLowerCase()),
  )
    ? 12
    : 5;
}

function scoreBestsellerPotential(design: DesignConcept): number {
  return /hoodie|oversized/i.test(design.product) &&
    ["Luxury Minimalism", "Minimal Back Print", "Typography Design"].includes(
      design.creativeApproach,
    )
    ? 12
    : 6;
}

function scoreVisualCommercialComponent(design: DesignConcept): number {
  const memorability = scoreVisualMemorability(design);
  return memorability >= 65 ? 18 : memorability >= 50 ? 12 : 6;
}

function scoreAdPotential(design: DesignConcept): number {
  let score = 6;
  if (design.contrastLevel !== "Low") score += 4;
  if (design.visualWeight === "Heavy" || design.visualWeight === "Balanced") {
    score += 4;
  }
  if (!isWeakHeroVisual(design)) score += 4;
  if (/campaign|homepage|banner|editorial|instagram/i.test(design.mockupDescription)) {
    score += 4;
  }
  return Math.min(18, score);
}

function scoreHeroSuitability(design: DesignConcept, commercialScore: number): number {
  let score = 0;
  if (commercialScore >= 65) score += 12;
  if (design.dnaScore >= 70) score += 12;
  if (!isWeakHeroVisual(design)) score += 6;
  return score;
}

export function calculateCommercialScore(design: DesignConcept): number {
  const base =
    scoreProductionSimplicity(design) +
    scorePodSuitability(design) +
    scoreRepeatability(design) +
    scoreEmotionalAppeal(design) +
    scoreBestsellerPotential(design) +
    scoreVisualCommercialComponent(design);

  const raw =
    base + computeCommercialRewards(design) - computeCommercialPenalties(design);

  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function scoreEmotionalStrength(design: DesignConcept): number {
  return computeEmotionalStrength(design).emotionalStrength;
}

function scoreSymbolism(design: DesignConcept): number {
  if (design.symbolism.length < 12) return 20;
  const hits = STRONG_SYMBOLISM.test(design.symbolism) ? 40 : 15;
  const elementBonus = Math.min(20, design.graphicElements.length * 4);
  return Math.min(100, hits + elementBonus);
}

function scoreUniqueness(design: DesignConcept): number {
  const approachBonus: Partial<Record<DesignConcept["creativeApproach"], number>> = {
    "Japanese Editorial": 25,
    "Symbolic Illustration": 22,
    "Abstract Graphic": 18,
    "Photography Style": 16,
    "Typography Design": 12,
    "Luxury Minimalism": 10,
    "Minimal Back Print": 8,
    "Vintage Archive": 14,
  };
  return Math.min(
    100,
    (approachBonus[design.creativeApproach] ?? 10) +
      (design.visualConcept.length > 60 ? 15 : 5),
  );
}

export function scoreVisualMemorability(design: DesignConcept): number {
  let score = 40;
  if (design.visualWeight === "Heavy" || design.visualWeight === "Balanced") {
    score += 15;
  }
  if (design.contrastLevel !== "Low") score += 12;
  if (/center|spine|vertical|full back|28 cm|32 cm|large/i.test(
    `${design.printSize} ${design.placementDimensions} ${design.exactComposition}`,
  )) {
    score += 18;
  }
  if (design.focalPoint.length > 15) score += 10;
  if (design.mockupDescription.length > 40) score += 8;
  return Math.min(100, score);
}

export function calculateHeroScore(
  design: DesignConcept,
  peerDesigns: DesignConcept[] = [],
): number {
  const commercialScore = design.commercialScore ?? calculateCommercialScore(design);
  const campaign =
    design.campaignPotential ?? assessCampaignPotential(design, commercialScore);

  const memorability = scoreVisualMemorability(design);
  const readability = scoreCampaignReadability(design);
  const emotional = scoreEmotionalRelevance(design);
  const productFit = scoreProductFit(design);
  const uniqueness = scoreUniquenessVsPeers(design, peerDesigns);
  const campaignFactor =
    campaign === "high" ? 88 : campaign === "medium" ? 62 : 38;

  const score = Math.round(
    design.dnaScore * 0.18 +
      memorability * 0.16 +
      readability * 0.14 +
      emotional * 0.14 +
      productFit * 0.1 +
      commercialScore * 0.1 +
      uniqueness * 0.08 +
      campaignFactor * 0.1,
  );

  return Math.max(0, Math.min(100, score));
}

export function assessCampaignPotential(
  design: DesignConcept,
  commercialScore: number,
): CampaignPotential {
  const visualReady =
    scoreVisualMemorability(design) >= 65 &&
    !isWeakHeroVisual(design) &&
    design.dnaScore >= 75;

  const emotionalReady =
    scoreEmotionalStrength(design) >= 55 &&
    design.contrastLevel !== "Low" &&
    design.graphicElements.length >= 2;

  const adReady = scoreAdPotential(design) >= 12;

  const heroReady = scoreHeroSuitability(design, commercialScore) >= 18;

  const passes = [visualReady, emotionalReady, adReady, heroReady].filter(Boolean)
    .length;

  if (passes >= 3) return "high";
  if (passes >= 2) return "medium";
  return "low";
}

export function isWeakHeroVisual(design: DesignConcept): boolean {
  const corpus = [
    design.visualConcept,
    design.designDescription,
    design.printSize,
    design.typography,
    design.exactComposition,
    design.materialEffects,
  ]
    .join(" ");

  if (WEAK_HERO_PATTERNS.some((pattern) => pattern.test(corpus))) return true;

  if (
    design.visualWeight === "Light" &&
    design.contrastLevel === "Low" &&
    /tone-on-tone|tonal|subtle|micro/i.test(corpus)
  ) {
    return true;
  }

  if (
    design.creativeApproach === "Typography Design" &&
    design.message.split(/\s+/).length <= 2 &&
    !/editorial|serif|symbol/i.test(corpus)
  ) {
    return true;
  }

  const printCm = Number.parseInt(design.printSize, 10);
  if (!Number.isNaN(printCm) && printCm < 12) return true;

  return !hasStrongVisualIdentity(design);
}

export function hasStrongVisualIdentity(design: DesignConcept): boolean {
  const checks = [
    design.symbolism.length >= 15 && STRONG_SYMBOLISM.test(design.symbolism),
    design.exactComposition.length >= 40 &&
      /center|vertical|spine|focal|editorial/i.test(design.exactComposition),
    MILAENE_EMOTIONAL_VOCABULARY.preferred.some((word) =>
      design.emotion.toLowerCase().includes(word.toLowerCase()),
    ),
    design.graphicElements.length >= 3 &&
      design.creativeApproach !== "Minimal Back Print",
  ];
  return checks.filter(Boolean).length >= 1;
}

export function strengthenHeroCandidate(
  design: DesignConcept,
  theme?: ThemeProfile,
  collection?: ResearchCollection,
): DesignConcept {
  const resolvedTheme = theme ?? (collection ? resolveThemeProfile(collection) : undefined);
  const emotion = resolvedTheme
    ? pickThemeEmotion(resolvedTheme, collection ?? {
        name: design.title,
        campaignTheme: design.message,
        story: design.symbolism,
        mood: design.emotion,
        philosophy: design.styleDirection,
      } as ResearchCollection)
    : MILAENE_EMOTIONAL_VOCABULARY.preferred.find((word) =>
        design.emotion.toLowerCase().includes(word.toLowerCase()),
      ) ?? design.emotion;

  const motif =
    resolvedTheme?.visualMotifs[0] ??
    "organic curve emblem with editorial negative space framing";
  const secondaryMotif =
    resolvedTheme?.visualMotifs[1] ?? "editorial negative space frame";

  const useBackPlacement =
    /back|spine|yoke/i.test(
      `${design.printArea} ${design.placementDimensions} ${design.exactComposition}`,
    );

  let strengthened: DesignConcept = {
    ...design,
    collectionRole: "Hero Piece",
    emotion,
    emotionalKeyword: resolvedTheme?.emotionalKeyword ?? emotion,
    printSize:
      design.printSize?.includes("cm")
        ? design.printSize.replace(/\d+/, (n) =>
            String(Math.max(Number.parseInt(n, 10) || 28, 28)),
          )
        : "28 cm wide editorial graphic",
    printArea: useBackPlacement ? "Back" : "Front",
    placementDimensions: useBackPlacement
      ? "Center back, 10 cm below yoke — full spine alignment"
      : "Center chest, 8 cm below collar seam — dominant focal placement",
    visualWeight: "Balanced",
    contrastLevel: design.contrastLevel === "Low" ? "Medium" : design.contrastLevel,
    graphicElements:
      design.graphicElements.length >= 3
        ? design.graphicElements
        : [
            `${emotion.toLowerCase()} emblem`,
            "editorial negative space frame",
            "muted tonal ink layer",
            "symbolic focal anchor",
          ],
    mockupDescription:
      "Hero campaign mockup — oversized hoodie in washed black with dominant chest or back graphic readable at 3 meters, editorial studio lighting",
    styleDirection: `Quiet luxury hero statement — ${design.styleDirection}`,
  };

  if (resolvedTheme && collection) {
    strengthened = applyNarrativeHeroFields({
      design: strengthened,
      collection,
      primaryMotif: motif,
      secondaryMotif,
    });
    strengthened = applyEmotionalVisualLanguage(strengthened, collection);
  } else {
    strengthened = {
      ...strengthened,
      message: resolvedTheme?.heroTitle ?? emotion.toUpperCase(),
      visualConcept: `${emotion.toLowerCase()} centerpiece — ${motif} with strong focal hierarchy and generous negative space`,
      symbolism:
        resolvedTheme?.symbolism ??
        `A restrained ${emotion.toLowerCase()} symbol serving as the emotional anchor — layered meaning through organic curves, editorial spacing, and quiet luxury symbolism`,
    };
  }

  return normalizeDesignPrintArea(applyBrandDnaAnalysis(strengthened));
}

export function qualifiesAsHeroCandidate(design: DesignConcept): boolean {
  const campaignCorpus = [
    design.exactComposition,
    design.visualConcept,
    design.mockupDescription,
    design.placementDimensions,
  ].join(" ");

  return (
    !isWeakHeroVisual(design) &&
    hasStrongVisualIdentity(design) &&
    scoreVisualMemorability(design) >= 55 &&
    scoreEmotionalStrength(design) >= 45 &&
    design.dnaScore >= 65 &&
    CAMPAIGN_SCALE_PATTERN.test(campaignCorpus)
  );
}

export function isHeroApproved(hero: DesignConcept, analysis: HeroAnalysis): boolean {
  return isHeroCeoApproved(hero, analysis);
}

export interface HeroFailureAssessment {
  heroStatus: "approved" | "rejected";
  heroRegenerationRequired: boolean;
  failureReasons: string[];
  failureCount: number;
  emotionalStrength: number;
  visualMemorability: number;
}

export function assessHeroFailure(
  hero: DesignConcept,
  analysis: HeroAnalysis,
): HeroFailureAssessment {
  const emotionalStrength = scoreEmotionalStrength(hero);
  const visualMemorability = scoreVisualMemorability(hero);
  const failureReasons: string[] = [];

  if (analysis.heroScore < HERO_SCORE_TARGET) {
    failureReasons.push(
      `Hero score ${analysis.heroScore}% is below the ${HERO_SCORE_TARGET}% launch threshold`,
    );
  }
  if (hero.dnaScore < HERO_DNA_TARGET) {
    failureReasons.push(
      `DNA score ${hero.dnaScore}% is below the ${HERO_DNA_TARGET}% Milaene minimum`,
    );
  }
  if (analysis.campaignPotential !== "high") {
    failureReasons.push(
      `Campaign potential is "${analysis.campaignPotential}" — high campaign readiness is required`,
    );
  }
  if (emotionalStrength < HERO_EMOTIONAL_TARGET) {
    failureReasons.push(
      `Emotional strength ${emotionalStrength}% is below the ${HERO_EMOTIONAL_TARGET}% threshold`,
    );
  }
  if (visualMemorability < HERO_VISUAL_TARGET) {
    failureReasons.push(
      `Visual memorability ${visualMemorability}% is below the ${HERO_VISUAL_TARGET}% threshold`,
    );
  }

  const failureCount = failureReasons.length;
  const heroRegenerationRequired = failureCount >= HERO_FAILURE_THRESHOLD;
  const heroStatus =
    !heroRegenerationRequired && isHeroApproved(hero, analysis)
      ? "approved"
      : "rejected";

  return {
    heroStatus,
    heroRegenerationRequired,
    failureReasons,
    failureCount,
    emotionalStrength,
    visualMemorability,
  };
}

function prepareHeroCandidate(
  design: DesignConcept,
  collection?: ResearchCollection,
): DesignConcept {
  let candidate = normalizeDesignPrintArea(design);
  if (candidate.dnaScore < HERO_DNA_TARGET || isWeakHeroVisual(candidate)) {
    candidate = strengthenHeroCandidate(
      candidate,
      collection ? resolveThemeProfile(collection) : undefined,
      collection,
    );
  }
  return candidate;
}

function resolveHeroSelection(
  designs: DesignConcept[],
  adjustments: string[],
  collection?: ResearchCollection,
): DesignConcept {
  const ranked = rankHeroCandidates(designs);
  const qualified = ranked.filter(qualifiesAsHeroCandidate);
  const pool =
    qualified.length > 0
      ? qualified
      : ranked.filter((design) => !isWeakHeroVisual(design));
  const best = pool[0] ?? ranked[0];

  if (!best) {
    throw new Error("Hero engine requires at least one design candidate");
  }

  adjustments.push(
    `hero engine: selected best available candidate "${best.title}" for evaluation`,
  );
  return prepareHeroCandidate(best, collection);
}

/** Ensure exactly one design holds each required collection role. */
export function validateExactCollectionRoles(
  designs: DesignConcept[],
  adjustments: string[] = [],
  lockedHeroId?: string,
): DesignConcept[] {
  if (designs.length < COLLECTION_ROLES.length) {
    throw new Error(
      `Collection requires at least ${COLLECTION_ROLES.length} designs for role validation`,
    );
  }

  const sorted = [...designs].sort((a, b) => b.dnaScore - a.dnaScore);
  const heroId =
    lockedHeroId ??
    designs.find((d) => d.collectionRole === "Hero Piece")?.designId ??
    sorted[0]?.designId;

  if (!heroId) {
    throw new Error("Hero engine requires a hero design id for role validation");
  }

  const roleById = new Map<string, CollectionRole>();
  const assigned = new Set<string>();

  roleById.set(heroId, "Hero Piece");
  assigned.add(heroId);

  for (const role of NON_HERO_ROLES) {
    const holder = designs.find(
      (design) => !assigned.has(design.designId) && design.collectionRole === role,
    );
    if (holder) {
      roleById.set(holder.designId, role);
      assigned.add(holder.designId);
    }
  }

  const missingRoles = NON_HERO_ROLES.filter(
    (role) => !Array.from(roleById.values()).includes(role),
  );
  const unassigned = sorted.filter((design) => !assigned.has(design.designId));

  for (const role of missingRoles) {
    const candidate = unassigned.shift();
    if (candidate) {
      roleById.set(candidate.designId, role);
      assigned.add(candidate.designId);
      adjustments.push(
        `hero engine: assigned missing role "${role}" to "${candidate.title}"`,
      );
    }
  }

  for (const design of designs) {
    if (!roleById.has(design.designId)) {
      roleById.set(design.designId, "Supporting Piece");
    }
  }

  return designs.map((design) => ({
    ...design,
    collectionRole: roleById.get(design.designId) ?? "Supporting Piece",
  }));
}

function applyCommercialFields(
  design: DesignConcept,
  peers: DesignConcept[] = [],
): DesignConcept {
  const commercialScore = calculateCommercialScore(design);
  const campaignPotential = assessCampaignPotential(design, commercialScore);

  return {
    ...design,
    commercialScore,
    campaignPotential,
    ...(design.collectionRole === "Hero Piece"
      ? {
          heroScore: calculateHeroScore(
            { ...design, commercialScore, campaignPotential },
            peers,
          ),
        }
      : {}),
  };
}

function rankHeroCandidates(designs: DesignConcept[]): DesignConcept[] {
  const qualified = designs.filter(qualifiesAsHeroCandidate);
  const pool =
    qualified.length > 0
      ? qualified
      : designs.filter((design) => !isWeakHeroVisual(design));
  const candidates = pool.length > 0 ? pool : designs;

  return [...candidates].sort((a, b) => {
    const commercialA = calculateCommercialScore(a);
    const commercialB = calculateCommercialScore(b);
    const enrichedA = {
      ...a,
      commercialScore: commercialA,
      campaignPotential: assessCampaignPotential(a, commercialA),
    };
    const enrichedB = {
      ...b,
      commercialScore: commercialB,
      campaignPotential: assessCampaignPotential(b, commercialB),
    };
    const scoreA =
      calculateHeroScore(enrichedA, candidates) * 0.4 +
      a.dnaScore * 0.25 +
      scoreEmotionalStrength(a) * 0.15 +
      scoreVisualMemorability(a) * 0.15 +
      scoreSymbolism(a) * 0.05;
    const scoreB =
      calculateHeroScore(enrichedB, candidates) * 0.4 +
      b.dnaScore * 0.25 +
      scoreEmotionalStrength(b) * 0.15 +
      scoreVisualMemorability(b) * 0.15 +
      scoreSymbolism(b) * 0.05;
    return scoreB - scoreA;
  });
}

function buildWhyHero(design: DesignConcept, heroScore: number): string {
  return [
    `"${design.title}" leads the capsule with a ${heroScore}% hero score`,
    `${design.emotion.toLowerCase()} emotional anchor`,
    `${design.creativeApproach.toLowerCase()} visual identity`,
    `and ${design.dnaScore}% Milaene DNA alignment`,
  ].join(" — ");
}

export function buildHeroAnalysis(
  design: DesignConcept,
  peerDesigns: DesignConcept[] = [],
): HeroAnalysis {
  const commercialScore = design.commercialScore ?? calculateCommercialScore(design);
  const campaignPotential =
    design.campaignPotential ?? assessCampaignPotential(design, commercialScore);
  const heroScore = calculateHeroScore(
    {
      ...design,
      commercialScore,
      campaignPotential,
    },
    peerDesigns,
  );

  const emotionalPct = roundPercent(scoreEmotionalStrength(design));
  const draftAnalysis: HeroAnalysis = {
    heroScore: roundPercent(heroScore),
    commercialScore: roundPercent(commercialScore),
    campaignPotential,
    whyHero: buildWhyHero(design, heroScore),
    visualStrength: hasStrongVisualIdentity(design)
      ? `Strong ${design.creativeApproach.toLowerCase()} composition with memorable focal hierarchy and campaign-scale presence`
      : "Visual presence strengthened for homepage and editorial campaign readability",
    emotionalStrength: `${design.emotion} — ${emotionalPct}% emotional resonance through Milaene symbolic language`,
    adPotential: "",
  };
  const ceoApproved = isHeroCeoApproved(design, draftAnalysis);

  return {
    ...draftAnalysis,
    adPotential: buildConsistentAdPotential(ceoApproved, campaignPotential),
  };
}

export function buildLaunchApproval(
  hero: DesignConcept,
  analysis: HeroAnalysis,
): NonNullable<ResearchCollection["ceoAnalysis"]>["launchApproval"] {
  const metrics = collectHeroApprovalMetrics(hero, analysis);
  const ceoApproved = isHeroCeoApproved(hero, analysis);
  const { commercialScore } = limitCommercialScore(
    metrics.commercialScore,
    metrics,
    ceoApproved,
  );
  return buildLaunchApprovalCopy(hero, analysis, ceoApproved, commercialScore);
}

export interface HeroEngineResult {
  designs: DesignConcept[];
  collection: ResearchCollection;
}

export function applyHeroEngine(
  designs: DesignConcept[],
  collection: ResearchCollection,
  adjustments: string[] = [],
): HeroEngineResult {
  let working = validateExactCollectionRoles(designs, adjustments);
  const heroCandidate = resolveHeroSelection(working, adjustments, collection);
  const heroId = heroCandidate.designId;

  working = working.map((design) => {
    const base = design.designId === heroId ? heroCandidate : design;
    const normalized = normalizeDesignPrintArea(base);
    if (design.designId === heroId) {
      return applyCommercialFields(
        { ...normalized, collectionRole: "Hero Piece" },
        working,
      );
    }
    return applyCommercialFields(normalized, working);
  });

  working = validateExactCollectionRoles(working, adjustments, heroId);

  const hero = working.find((d) => d.designId === heroId)!;
  const heroAnalysis = buildHeroAnalysis(hero, working);
  const failure = assessHeroFailure(hero, heroAnalysis);
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
  const syncedCollection = ceoResult.collection;

  const supportingDesignIds = working
    .filter((d) => d.designId !== syncedHero.designId)
    .map((d) => d.designId);

  const syncedDesigns = working.map((d) =>
    d.designId === syncedHero.designId ? syncedHero : d,
  );

  const enrichedCollection: ResearchCollection = {
    ...syncedCollection,
    heroDesignId: syncedHero.designId,
    supportingDesignIds,
    heroStatus: approved ? "approved" : failure.heroStatus,
    heroRegenerationRequired: failure.heroRegenerationRequired,
    heroProduct: {
      ...syncedCollection.heroProduct,
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
      recommendedLaunchOrder:
        collection.ceoAnalysis?.recommendedLaunchOrder ?? [syncedHero.title],
      productionRisk:
        collection.ceoAnalysis?.productionRisk ??
        "Production risk assessed after hero engine pass",
      commercialConfidence: syncedCollection.ceoAnalysis!.commercialConfidence,
      adPotential: syncedAnalysis.adPotential,
      launchApproval,
    },
  };

  adjustments.push(
    `hero engine: selected "${syncedHero.title}" as hero (score ${syncedAnalysis.heroScore}%, DNA ${syncedHero.dnaScore}%, commercial ${syncedAnalysis.commercialScore}%, approved ${approved})`,
  );

  return { designs: syncedDesigns, collection: enrichedCollection };
}

export function formatHeroEngineMarkdown(
  collection: ResearchCollection,
  hero?: DesignConcept,
): string {
  const analysis = collection.heroAnalysis;
  if (!analysis || !hero) return "";

  return [
    "## Hero Engine Analysis",
    "",
    `**Hero:** ${hero.title}`,
    `**Hero score:** ${analysis.heroScore}%`,
    `**Commercial score:** ${analysis.commercialScore}%`,
    `**Campaign potential:** ${analysis.campaignPotential}`,
    `**Why this is the hero:** ${analysis.whyHero}`,
    `**Visual strength:** ${analysis.visualStrength}`,
    `**Emotional strength:** ${analysis.emotionalStrength}`,
    `**Ad potential:** ${analysis.adPotential}`,
    "",
    collection.ceoAnalysis?.launchApproval
      ? [
          "### CEO Launch Approval",
          `**Approved:** ${collection.ceoAnalysis.launchApproval.approved ? "Yes" : "No"}`,
          `**Emotional impact:** ${collection.ceoAnalysis.launchApproval.emotionalImpact}`,
          `**Commercial strength:** ${collection.ceoAnalysis.launchApproval.commercialStrength}`,
          `**Ad expectations:** ${collection.ceoAnalysis.launchApproval.adPerformanceExpectations}`,
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
