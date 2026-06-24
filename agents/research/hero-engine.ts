import { applyBrandDnaAnalysis } from "./brand-dna";
import { normalizeDesignPrintArea } from "./design-concept";
import { MILAENE_EMOTIONAL_VOCABULARY } from "./emotional-vocabulary";
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
export const HERO_EMOTIONAL_TARGET = 70;
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
  const raw =
    scoreProductionSimplicity(design) +
    scorePodSuitability(design) +
    scoreRepeatability(design) +
    scoreEmotionalAppeal(design) +
    scoreBestsellerPotential(design) +
    scoreVisualCommercialComponent(design);

  return Math.max(0, Math.min(100, raw));
}

export function scoreEmotionalStrength(design: DesignConcept): number {
  const preferred = MILAENE_EMOTIONAL_VOCABULARY.preferred.filter((word) =>
    `${design.emotion} ${design.message} ${design.symbolism}`
      .toLowerCase()
      .includes(word.toLowerCase()),
  ).length;
  const narrativeBonus = (design.emotionalNarrative?.length ?? 0) > 30 ? 10 : 0;
  return Math.min(100, preferred * 18 + narrativeBonus + design.dnaScore * 0.3);
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

export function calculateHeroScore(design: DesignConcept): number {
  const commercialScore = design.commercialScore ?? calculateCommercialScore(design);
  const campaign =
    design.campaignPotential ?? assessCampaignPotential(design, commercialScore);
  const campaignScore =
    campaign === "high" ? 90 : campaign === "medium" ? 65 : 35;

  const score = Math.round(
    scoreEmotionalStrength(design) * 0.2 +
      scoreSymbolism(design) * 0.15 +
      scoreUniqueness(design) * 0.15 +
      (design.repeatabilityScore === "High"
        ? 70
        : design.repeatabilityScore === "Medium"
          ? 55
          : 40) *
        0.1 +
      campaignScore * 0.15 +
      scoreVisualMemorability(design) * 0.15 +
      design.dnaScore * 0.1,
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

export function strengthenHeroCandidate(design: DesignConcept): DesignConcept {
  const emotion =
    MILAENE_EMOTIONAL_VOCABULARY.preferred.find((word) =>
      design.emotion.toLowerCase().includes(word.toLowerCase()),
    ) ?? "Presence";

  const useBackPlacement =
    /back|spine|yoke/i.test(
      `${design.printArea} ${design.placementDimensions} ${design.exactComposition}`,
    );

  const strengthened: DesignConcept = {
    ...design,
    collectionRole: "Hero Piece",
    emotion,
    message: emotion.toUpperCase(),
    visualConcept: `${emotion.toLowerCase()} centerpiece — editorial symbolic composition with strong focal hierarchy and generous negative space framing a memorable Milaene emblem`,
    symbolism: `A restrained ${emotion.toLowerCase()} symbol serving as the emotional anchor — layered meaning through organic curves, editorial spacing, and quiet luxury symbolism`,
    exactComposition: useBackPlacement
      ? "Vertical editorial centerpiece anchored on full spine back — dominant focal symbol with wide negative space margins and calm luxury hierarchy"
      : "Vertical editorial centerpiece anchored on upper chest — dominant focal symbol with wide negative space margins and calm luxury hierarchy",
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
  return (
    hero.dnaScore >= HERO_DNA_TARGET &&
    analysis.heroScore >= HERO_SCORE_TARGET &&
    analysis.campaignPotential === "high" &&
    !isWeakHeroVisual(hero)
  );
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

function prepareHeroCandidate(design: DesignConcept): DesignConcept {
  let candidate = normalizeDesignPrintArea(design);
  if (candidate.dnaScore < HERO_DNA_TARGET || isWeakHeroVisual(candidate)) {
    candidate = strengthenHeroCandidate(candidate);
  }
  return candidate;
}

function resolveHeroSelection(
  designs: DesignConcept[],
  adjustments: string[],
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
  return prepareHeroCandidate(best);
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

function applyCommercialFields(design: DesignConcept): DesignConcept {
  const commercialScore = calculateCommercialScore(design);
  const campaignPotential = assessCampaignPotential(design, commercialScore);

  return {
    ...design,
    commercialScore,
    campaignPotential,
    ...(design.collectionRole === "Hero Piece"
      ? { heroScore: calculateHeroScore({ ...design, commercialScore, campaignPotential }) }
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
      calculateHeroScore(enrichedA) * 0.4 +
      a.dnaScore * 0.25 +
      scoreEmotionalStrength(a) * 0.15 +
      scoreVisualMemorability(a) * 0.15 +
      scoreSymbolism(a) * 0.05;
    const scoreB =
      calculateHeroScore(enrichedB) * 0.4 +
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

export function buildHeroAnalysis(design: DesignConcept): HeroAnalysis {
  const commercialScore = design.commercialScore ?? calculateCommercialScore(design);
  const campaignPotential =
    design.campaignPotential ?? assessCampaignPotential(design, commercialScore);
  const heroScore = calculateHeroScore({
    ...design,
    commercialScore,
    campaignPotential,
  });

  return {
    heroScore,
    commercialScore,
    campaignPotential,
    whyHero: buildWhyHero(design, heroScore),
    visualStrength: hasStrongVisualIdentity(design)
      ? `Strong ${design.creativeApproach.toLowerCase()} composition with memorable focal hierarchy and campaign-scale presence`
      : "Visual presence strengthened for homepage and editorial campaign readability",
    emotionalStrength: `${design.emotion} — ${scoreEmotionalStrength(design)}% emotional resonance through Milaene symbolic language`,
    adPotential:
      campaignPotential === "high"
        ? "High — suitable for homepage banner, Instagram ads, and launch hero product"
        : campaignPotential === "medium"
          ? "Medium — viable for lookbook and social, may need visual amplification for paid ads"
          : "Low — refine visual impact before using as campaign anchor",
  };
}

export function buildLaunchApproval(
  hero: DesignConcept,
  analysis: HeroAnalysis,
): NonNullable<ResearchCollection["ceoAnalysis"]>["launchApproval"] {
  const approved = isHeroApproved(hero, analysis);

  return {
    approved,
    emotionalImpact: `${hero.emotion} symbolism delivers ${analysis.emotionalStrength.toLowerCase()} — ${approved ? "sufficient" : "insufficient"} for a Milaene launch narrative`,
    commercialStrength: `${analysis.commercialScore}% commercial score with ${hero.repeatabilityScore.toLowerCase()} repeatability — ${approved ? "CEO-grade launch confidence" : "needs commercial strengthening"}`,
    adPerformanceExpectations:
      analysis.campaignPotential === "high"
        ? "Expect strong homepage conversion and Instagram engagement — hero reads at thumbnail and billboard scale"
        : analysis.campaignPotential === "medium"
          ? "Moderate paid social performance — organic lookbook strong, paid ads may need tighter crop"
          : "Weak ad performance expected until visual impact is elevated",
  };
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
  const heroCandidate = resolveHeroSelection(working, adjustments);
  const heroId = heroCandidate.designId;

  working = working.map((design) => {
    const base = design.designId === heroId ? heroCandidate : design;
    const normalized = normalizeDesignPrintArea(base);
    if (design.designId === heroId) {
      return applyCommercialFields({ ...normalized, collectionRole: "Hero Piece" });
    }
    return applyCommercialFields(normalized);
  });

  working = validateExactCollectionRoles(working, adjustments, heroId);

  const hero = working.find((d) => d.designId === heroId)!;
  const heroAnalysis = buildHeroAnalysis(hero);
  const failure = assessHeroFailure(hero, heroAnalysis);
  const launchApproval = buildLaunchApproval(hero, heroAnalysis)!;
  const approved = failure.heroStatus === "approved" && launchApproval.approved;

  const supportingDesignIds = working
    .filter((d) => d.designId !== hero.designId)
    .map((d) => d.designId);

  const ceoAnalysis = {
    ...collection.ceoAnalysis,
    strongestProduct: hero.product,
    commercialConfidence: Math.round(
      (heroAnalysis.commercialScore + hero.dnaScore + heroAnalysis.heroScore) / 3,
    ),
    adPotential: heroAnalysis.adPotential,
    launchApproval,
  };

  const collectionScore = approved
    ? collection.collectionScore
    : Math.min(collection.collectionScore, 69);

  const ceoRecommendation = approved
    ? "Proceed to Design Studio — CEO approves hero as launch piece."
    : "Do not launch yet — refine Hero Piece.";

  const enrichedCollection: ResearchCollection = {
    ...collection,
    collectionScore,
    heroDesignId: hero.designId,
    supportingDesignIds,
    heroStatus: failure.heroStatus,
    heroRegenerationRequired: failure.heroRegenerationRequired,
    heroProduct: {
      product: hero.product,
      estimatedRetailPrice: collection.heroProduct.estimatedRetailPrice,
      productionComplexity: hero.productionDifficulty,
      commercialConfidence: heroAnalysis.commercialScore,
    },
    heroAnalysis,
    ceoAnalysis: {
      strongestProduct:
        ceoAnalysis?.strongestProduct ?? hero.product,
      weakestProduct:
        ceoAnalysis?.weakestProduct ??
        [...working].sort((a, b) => a.dnaScore - b.dnaScore)[0]?.product ??
        hero.product,
      recommendedLaunchOrder:
        ceoAnalysis?.recommendedLaunchOrder ?? [hero.title],
      productionRisk:
        ceoAnalysis?.productionRisk ??
        "Production risk assessed after hero engine pass",
      commercialConfidence: ceoAnalysis.commercialConfidence ?? heroAnalysis.commercialScore,
      adPotential: heroAnalysis.adPotential,
      launchApproval,
    },
    ceoRecommendation,
  };

  adjustments.push(
    `hero engine: selected "${hero.title}" as hero (score ${heroAnalysis.heroScore}%, DNA ${hero.dnaScore}%, commercial ${heroAnalysis.commercialScore}%, approved ${approved})`,
  );

  return { designs: working, collection: enrichedCollection };
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
