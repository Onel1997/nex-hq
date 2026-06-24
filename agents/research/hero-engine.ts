import { applyBrandDnaAnalysis } from "./brand-dna";
import { MILAENE_EMOTIONAL_VOCABULARY } from "./emotional-vocabulary";
import {
  COLLECTION_ROLES,
  type CampaignPotential,
  type CollectionRole,
  type DesignConcept,
  type HeroAnalysis,
  type ResearchCollection,
} from "./types";

export const HERO_DNA_TARGET = 85;

const WEAK_HERO_PATTERNS: RegExp[] = [
  /\b(tiny icon|small icon|micro icon|minimal icon)\b/i,
  /\b(micro graphic|tiny graphic|small chest mark|left chest dot)\b/i,
  /\b(tone-on-tone|tonal embroidery|invisible print|barely visible)\b/i,
  /\b(generic type|basic type|simple text only|plain wordmark)\b/i,
];

const STRONG_SYMBOLISM =
  /\b(symbol|emblem|arc|curve|silhouette|memory|reflection|presence|echo|organic|heraldic|centerpiece)\b/i;

export function calculateCommercialScore(design: DesignConcept): number {
  const productionScore =
    design.productionDifficulty === "Low"
      ? 25
      : design.productionDifficulty === "Medium"
        ? 15
        : 6;

  const repeatabilityScore =
    design.repeatabilityScore === "High"
      ? 20
      : design.repeatabilityScore === "Medium"
        ? 12
        : 5;

  const corpus = [
    design.printTechnique,
    design.productionDifficulty,
    design.creativeApproach,
  ]
    .join(" ")
    .toLowerCase();
  const podScore =
    /screen print|1-color|2-color|spot palette|plastisol/i.test(corpus) ? 18 : 10;

  const campaign = assessCampaignPotential(design);
  const adScore =
    campaign === "high" ? 18 : campaign === "medium" ? 12 : 6;

  const bestsellerScore =
    /hoodie|oversized/i.test(design.product) &&
    ["Luxury Minimalism", "Minimal Back Print", "Typography Design"].includes(
      design.creativeApproach,
    )
      ? 12
      : 6;

  const emotionalAppeal = MILAENE_EMOTIONAL_VOCABULARY.preferred.some((word) =>
    `${design.emotion} ${design.message} ${design.symbolism}`
      .toLowerCase()
      .includes(word.toLowerCase()),
  )
    ? 12
    : 5;

  const raw =
    productionScore +
    repeatabilityScore +
    podScore +
    adScore +
    bestsellerScore +
    emotionalAppeal;

  return Math.max(0, Math.min(100, raw));
}

function scoreEmotionalStrength(design: DesignConcept): number {
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

function scoreVisualMemorability(design: DesignConcept): number {
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
  const campaign = assessCampaignPotential(design);
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

export function assessCampaignPotential(design: DesignConcept): CampaignPotential {
  const corpus = [
    design.visualConcept,
    design.exactComposition,
    design.mockupDescription,
    design.printSize,
    design.symbolism,
    design.emotion,
  ]
    .join(" ")
    .toLowerCase();

  const homepageReady =
    scoreVisualMemorability(design) >= 65 &&
    !isWeakHeroVisual(design) &&
    design.dnaScore >= 75;

  const instagramReady =
    scoreEmotionalStrength(design) >= 55 &&
    design.contrastLevel !== "Low" &&
    design.graphicElements.length >= 2;

  const heroProductReady =
    calculateCommercialScore(design) >= 65 && design.dnaScore >= 70;

  const passes = [homepageReady, instagramReady, heroProductReady].filter(Boolean)
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

function strengthenHeroCandidate(design: DesignConcept): DesignConcept {
  const emotion =
    MILAENE_EMOTIONAL_VOCABULARY.preferred.find((word) =>
      design.emotion.toLowerCase().includes(word.toLowerCase()),
    ) ?? "Presence";

  const strengthened: DesignConcept = {
    ...design,
    collectionRole: "Hero Piece",
    emotion,
    message: emotion.toUpperCase(),
    visualConcept: `${emotion.toLowerCase()} centerpiece — editorial symbolic composition with strong focal hierarchy and generous negative space framing a memorable Milaene emblem`,
    symbolism: `A restrained ${emotion.toLowerCase()} symbol serving as the emotional anchor — layered meaning through organic curves, editorial spacing, and quiet luxury symbolism`,
    exactComposition:
      "Vertical editorial centerpiece anchored on upper chest or full spine back — dominant focal symbol with wide negative space margins and calm luxury hierarchy",
    printSize: design.printSize.includes("cm")
      ? design.printSize.replace(/\d+/, (n) => String(Math.max(Number.parseInt(n, 10) || 28, 28)))
      : "28 cm wide editorial graphic",
    placementDimensions:
      design.printArea.toLowerCase().includes("back")
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

  return applyBrandDnaAnalysis(strengthened);
}

/** Ensure exactly one design holds each required collection role. */
export function validateExactCollectionRoles(
  designs: DesignConcept[],
  adjustments: string[] = [],
): DesignConcept[] {
  if (designs.length < COLLECTION_ROLES.length) {
    throw new Error(
      `Collection requires at least ${COLLECTION_ROLES.length} designs for role validation`,
    );
  }

  const roleHolders = new Map<CollectionRole, string>();
  const duplicates: Array<{ designId: string; role: CollectionRole }> = [];

  for (const design of designs) {
    const role = design.collectionRole;
    if (!COLLECTION_ROLES.includes(role)) continue;
    if (roleHolders.has(role)) {
      duplicates.push({ designId: design.designId, role });
    } else {
      roleHolders.set(role, design.designId);
    }
  }

  const missing = COLLECTION_ROLES.filter((role) => !roleHolders.has(role));
  const assignedIds = new Set(roleHolders.values());

  if (missing.length > 0) {
    const unassigned = designs
      .filter((d) => !assignedIds.has(d.designId))
      .sort((a, b) => b.dnaScore - a.dnaScore);

    for (const role of missing) {
      const candidate = unassigned.shift();
      if (candidate) {
        roleHolders.set(role, candidate.designId);
        assignedIds.add(candidate.designId);
        adjustments.push(
          `hero engine: assigned missing role "${role}" to "${candidate.title}"`,
        );
      }
    }
  }

  const roleById = new Map<string, CollectionRole>();
  for (const [role, designId] of roleHolders) {
    roleById.set(designId, role);
  }

  for (const duplicate of duplicates) {
    const fallbackRoles: CollectionRole[] = ["Supporting Piece"];
    const reassigned = fallbackRoles[0];
    roleById.set(duplicate.designId, reassigned);
    adjustments.push(
      `hero engine: duplicate "${duplicate.role}" corrected — "${duplicate.designId}" reassigned to ${reassigned}`,
    );
  }

  return designs.map((design) => ({
    ...design,
    collectionRole: roleById.get(design.designId) ?? "Supporting Piece",
  }));
}

function applyCommercialFields(design: DesignConcept): DesignConcept {
  const commercialScore = calculateCommercialScore(design);
  const campaignPotential = assessCampaignPotential(design);

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
  return [...designs].sort((a, b) => {
    const scoreA =
      calculateHeroScore(a) * 0.35 +
      a.dnaScore * 0.25 +
      calculateCommercialScore(a) * 0.2 +
      scoreEmotionalStrength(a) * 0.1 +
      scoreVisualMemorability(a) * 0.1;
    const scoreB =
      calculateHeroScore(b) * 0.35 +
      b.dnaScore * 0.25 +
      calculateCommercialScore(b) * 0.2 +
      scoreEmotionalStrength(b) * 0.1 +
      scoreVisualMemorability(b) * 0.1;
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
  const heroScore = calculateHeroScore(design);
  const commercialScore = design.commercialScore ?? calculateCommercialScore(design);
  const campaignPotential =
    design.campaignPotential ?? assessCampaignPotential(design);

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
  const approved =
    hero.dnaScore >= HERO_DNA_TARGET &&
    analysis.heroScore >= 80 &&
    analysis.commercialScore >= 65 &&
    analysis.campaignPotential !== "low" &&
    !isWeakHeroVisual(hero);

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

  const ranked = rankHeroCandidates(working);
  let heroCandidate = ranked.find((d) => !isWeakHeroVisual(d)) ?? ranked[0];

  if (!heroCandidate) {
    throw new Error("Hero engine requires at least one design candidate");
  }

  if (
    heroCandidate.dnaScore < HERO_DNA_TARGET ||
    isWeakHeroVisual(heroCandidate)
  ) {
    adjustments.push(
      `hero engine: strengthened weak hero candidate "${heroCandidate.title}" (DNA ${heroCandidate.dnaScore}%)`,
    );
    heroCandidate = strengthenHeroCandidate(heroCandidate);
  }

  const previousHeroId = working.find((d) => d.collectionRole === "Hero Piece")
    ?.designId;

  working = working.map((design) => {
    if (design.designId === heroCandidate.designId) {
      return applyCommercialFields({ ...design, collectionRole: "Hero Piece" });
    }
    if (
      design.designId === previousHeroId &&
      design.designId !== heroCandidate.designId
    ) {
      return applyCommercialFields({
        ...design,
        collectionRole: "Supporting Piece",
      });
    }
    return applyCommercialFields(design);
  });

  working = validateExactCollectionRoles(working, adjustments);

  const hero = working.find((d) => d.designId === heroCandidate.designId)!;
  const heroAnalysis = buildHeroAnalysis(hero);

  const supportingDesignIds = working
    .filter(
      (d) =>
        d.designId !== hero.designId &&
        (d.collectionRole === "Supporting Piece" ||
          d.collectionRole === "Core Essential"),
    )
    .map((d) => d.designId);

  const ceoAnalysis = {
    ...collection.ceoAnalysis,
    strongestProduct: hero.product,
    commercialConfidence: Math.round(
      (heroAnalysis.commercialScore + hero.dnaScore + heroAnalysis.heroScore) / 3,
    ),
    adPotential: heroAnalysis.adPotential,
    launchApproval: buildLaunchApproval(hero, heroAnalysis),
  };

  const enrichedCollection: ResearchCollection = {
    ...collection,
    heroDesignId: hero.designId,
    supportingDesignIds:
      supportingDesignIds.length > 0
        ? supportingDesignIds
        : working
            .filter((d) => d.designId !== hero.designId)
            .slice(0, 3)
            .map((d) => d.designId),
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
      launchApproval: ceoAnalysis.launchApproval,
    },
    ceoRecommendation: ceoAnalysis.launchApproval?.approved
      ? "Proceed to Design Studio — CEO approves hero as launch piece."
      : collection.ceoRecommendation,
  };

  adjustments.push(
    `hero engine: selected "${hero.title}" as hero (score ${heroAnalysis.heroScore}%, DNA ${hero.dnaScore}%, commercial ${heroAnalysis.commercialScore}%)`,
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
