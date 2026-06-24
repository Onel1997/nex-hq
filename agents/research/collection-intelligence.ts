import { applyBrandDnaAnalysis } from "./brand-dna";
import { MILAENE_EMOTIONAL_VOCABULARY } from "./emotional-vocabulary";
import {
  CREATIVE_APPROACHES,
  COLLECTION_ARC,
  COLLECTION_ROLES,
  type CollectionRole,
  type CreativeApproach,
  type CeoAnalysis,
  type DesignConcept,
  type ResearchCollection,
  type StoryPosition,
} from "./types";

export const DUPLICATE_SIMILARITY_THRESHOLD = 75;

export { MILAENE_EMOTIONAL_VOCABULARY } from "./emotional-vocabulary";

export const ROLE_DNA_MINIMUMS: Record<CollectionRole, number> = {
  "Hero Piece": 85,
  "Core Essential": 80,
  "Statement Piece": 75,
  "Supporting Piece": 70,
  "Limited Piece": 70,
};

const ROLE_TO_ARC: Record<CollectionRole, StoryPosition> = {
  "Hero Piece": "Reflection",
  "Core Essential": "Introduction",
  "Statement Piece": "Tension",
  "Supporting Piece": "Resolution",
  "Limited Piece": "Closure",
};

const EMOTIONAL_POSITION_BY_ROLE: Record<CollectionRole, string> = {
  "Hero Piece": "emotional anchor of the capsule",
  "Core Essential": "accessible entry point to the narrative",
  "Statement Piece": "artistic peak of the collection",
  "Supporting Piece": "quiet reinforcement of the hero message",
  "Limited Piece": "experimental conclusion to the arc",
};

const RELATIONSHIP_REASONS: Record<
  CollectionRole,
  (heroTitle: string) => string
> = {
  "Hero Piece": () => "anchors the collection narrative",
  "Core Essential": () => "stands alone as the repeatable commercial foundation",
  "Statement Piece": (hero) =>
    `extends the visual language of ${hero} with stronger artistic expression`,
  "Supporting Piece": (hero) =>
    `reinforces ${hero}'s emotional message through quieter counterpart design`,
  "Limited Piece": (hero) =>
    `concludes the collection narrative while echoing ${hero}'s symbolism`,
};

const ALTERNATE_PLACEMENTS = [
  "upper chest, 7 cm below collar seam",
  "center chest, 9 cm below collar seam",
  "spine back, 12 cm below yoke seam",
  "upper back, 8 cm below yoke seam",
  "left chest, 6 cm from center",
  "vertical center back, full spine alignment",
] as const;

const ALTERNATE_EMOTIONS = MILAENE_EMOTIONAL_VOCABULARY.preferred;

export class CollectionIntelligenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectionIntelligenceError";
  }
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : (intersection / union) * 100;
}

function designSimilarityCorpus(design: DesignConcept): Record<string, string> {
  return {
    visualConcept: design.visualConcept,
    graphicElements: design.graphicElements.join(" "),
    placement: `${design.printArea} ${design.placementDimensions}`,
    emotion: design.emotion,
    composition: design.exactComposition,
    imagePromptCore: design.imagePromptCore,
  };
}

/** Compare key creative dimensions between two designs (0–100). */
export function calculateDesignSimilarity(
  a: DesignConcept,
  b: DesignConcept,
): number {
  const fieldsA = designSimilarityCorpus(a);
  const fieldsB = designSimilarityCorpus(b);
  const keys = Object.keys(fieldsA) as Array<keyof typeof fieldsA>;

  const scores = keys.map((key) =>
    jaccardSimilarity(tokenize(fieldsA[key]), tokenize(fieldsB[key])),
  );

  const approachPenalty =
    a.creativeApproach === b.creativeApproach ? 15 : 0;

  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return Math.min(100, Math.round(avg + approachPenalty));
}

function containsDiscouragedLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return MILAENE_EMOTIONAL_VOCABULARY.discouraged.some((phrase) =>
    lower.includes(phrase.toLowerCase()),
  );
}

function pickPreferredEmotion(index: number): string {
  return ALTERNATE_EMOTIONS[index % ALTERNATE_EMOTIONS.length];
}

function sanitizeEmotionalLanguage(design: DesignConcept, index: number): DesignConcept {
  let emotion = design.emotion;
  let message = design.message;

  if (containsDiscouragedLanguage(emotion) || containsDiscouragedLanguage(message)) {
    emotion = pickPreferredEmotion(index);
    if (containsDiscouragedLanguage(message)) {
      message = emotion.toUpperCase();
    }
  }

  const preferredHit = MILAENE_EMOTIONAL_VOCABULARY.preferred.find((word) =>
    emotion.toLowerCase().includes(word.toLowerCase()),
  );
  if (!preferredHit) {
    emotion = pickPreferredEmotion(index);
  }

  return { ...design, emotion, message };
}

function regenerateDistinctConcept(
  design: DesignConcept,
  index: number,
  usedApproaches: Set<CreativeApproach>,
  usedEmotions: Set<string>,
): DesignConcept {
  const availableApproaches = CREATIVE_APPROACHES.filter(
    (approach) => !usedApproaches.has(approach),
  );
  const creativeApproach =
    availableApproaches[index % availableApproaches.length] ??
    CREATIVE_APPROACHES[(index + 2) % CREATIVE_APPROACHES.length];

  let emotion = pickPreferredEmotion(index);
  while (usedEmotions.has(emotion.toLowerCase())) {
    emotion = pickPreferredEmotion(index + usedEmotions.size + 1);
  }

  const placement =
    ALTERNATE_PLACEMENTS[index % ALTERNATE_PLACEMENTS.length];

  const regenerated: DesignConcept = {
    ...design,
    creativeApproach,
    emotion,
    message: emotion.toUpperCase(),
    printArea: index % 2 === 0 ? "Front" : "Back",
    placementDimensions: placement,
    visualConcept: `${emotion.toLowerCase()} motif rendered through ${creativeApproach.toLowerCase()} — editorial negative space, muted ink on washed garment`,
    graphicElements: [
      `${emotion.toLowerCase()} symbol`,
      "editorial negative space frame",
      "muted tonal ink layer",
    ],
    exactComposition: `Vertical ${emotion.toLowerCase()} composition centered on ${index % 2 === 0 ? "chest" : "back"} with generous negative space`,
    styleDirection: `Quiet luxury ${creativeApproach.toLowerCase()} with ${emotion.toLowerCase()} emotional restraint`,
  };

  return applyBrandDnaAnalysis(sanitizeEmotionalLanguage(regenerated, index));
}

/** Remove or regenerate concepts above the duplicate similarity threshold. */
export function deduplicateDesignConcepts(
  designs: DesignConcept[],
  adjustments: string[] = [],
): DesignConcept[] {
  const result: DesignConcept[] = [];
  const usedApproaches = new Set<CreativeApproach>();
  const usedEmotions = new Set<string>();

  for (let index = 0; index < designs.length; index += 1) {
    let design = sanitizeEmotionalLanguage(
      applyBrandDnaAnalysis(designs[index]),
      index,
    );

    for (const existing of result) {
      const similarity = calculateDesignSimilarity(design, existing);
      if (similarity > DUPLICATE_SIMILARITY_THRESHOLD) {
        adjustments.push(
          `collection intelligence: regenerated "${design.title}" (${similarity}% similar to "${existing.title}")`,
        );
        design = regenerateDistinctConcept(
          design,
          index,
          usedApproaches,
          usedEmotions,
        );
        break;
      }
    }

    if (usedApproaches.has(design.creativeApproach)) {
      adjustments.push(
        `collection intelligence: duplicate creative approach "${design.creativeApproach}" — regenerating`,
      );
      design = regenerateDistinctConcept(
        design,
        index,
        usedApproaches,
        usedEmotions,
      );
    }

    usedApproaches.add(design.creativeApproach);
    usedEmotions.add(design.emotion.toLowerCase());
    result.push(design);
  }

  return result;
}

function commercialConfidence(design: DesignConcept): number {
  const productionBonus =
    design.productionDifficulty === "Low"
      ? 35
      : design.productionDifficulty === "Medium"
        ? 25
        : 15;
  return Math.min(100, Math.round(design.dnaScore * 0.6 + productionBonus));
}

function emotionalImpact(design: DesignConcept): number {
  const preferred = MILAENE_EMOTIONAL_VOCABULARY.preferred.filter((word) =>
    design.emotion.toLowerCase().includes(word.toLowerCase()),
  ).length;
  const roleWeight: Record<CollectionRole, number> = {
    "Hero Piece": 20,
    "Statement Piece": 15,
    "Limited Piece": 10,
    "Supporting Piece": 8,
    "Core Essential": 5,
  };
  return (
    design.dnaScore * 0.5 +
    preferred * 12 +
    (roleWeight[design.collectionRole] ?? 0)
  );
}

/** Assign collection roles with DNA minimum enforcement. */
export function enforceCollectionRoles(
  designs: DesignConcept[],
  adjustments: string[] = [],
): DesignConcept[] {
  if (designs.length < COLLECTION_ROLES.length) {
    throw new CollectionIntelligenceError(
      `Collection requires at least ${COLLECTION_ROLES.length} designs — received ${designs.length}`,
    );
  }

  const sorted = [...designs].sort((a, b) => {
    const scoreA =
      a.dnaScore * 0.5 +
      commercialConfidence(a) * 0.3 +
      emotionalImpact(a) * 0.2;
    const scoreB =
      b.dnaScore * 0.5 +
      commercialConfidence(b) * 0.3 +
      emotionalImpact(b) * 0.2;
    return scoreB - scoreA;
  });

  const roleById = new Map<string, CollectionRole>();
  const assigned = new Set<string>();

  const pickForRole = (
    role: CollectionRole,
    predicate: (d: DesignConcept) => boolean,
  ): DesignConcept | undefined => {
    const minScore = ROLE_DNA_MINIMUMS[role];
    return (
      sorted.find(
        (d) =>
          !assigned.has(d.designId) &&
          d.dnaScore >= minScore &&
          predicate(d),
      ) ??
      sorted.find(
        (d) => !assigned.has(d.designId) && d.dnaScore >= minScore,
      ) ??
      sorted.find((d) => !assigned.has(d.designId))
    );
  };

  const hero = pickForRole("Hero Piece", () => true);
  if (hero) {
    roleById.set(hero.designId, "Hero Piece");
    assigned.add(hero.designId);
  }

  const core = pickForRole(
    "Core Essential",
    (d) =>
      d.creativeApproach === "Luxury Minimalism" ||
      d.productionDifficulty === "Low",
  );
  if (core) {
    roleById.set(core.designId, "Core Essential");
    assigned.add(core.designId);
  }

  const statement = pickForRole(
    "Statement Piece",
    (d) =>
      ["Symbolic Illustration", "Japanese Editorial", "Typography Design"].includes(
        d.creativeApproach,
      ),
  );
  if (statement) {
    roleById.set(statement.designId, "Statement Piece");
    assigned.add(statement.designId);
  }

  const limited = pickForRole(
    "Limited Piece",
    (d) =>
      d.creativeApproach === "Abstract Graphic" ||
      d.creativeApproach === "Photography Style" ||
      d.productionDifficulty === "High",
  );
  if (limited) {
    roleById.set(limited.designId, "Limited Piece");
    assigned.add(limited.designId);
  }

  const supporting = pickForRole("Supporting Piece", () => true);
  if (supporting) {
    roleById.set(supporting.designId, "Supporting Piece");
    assigned.add(supporting.designId);
  }

  const missingRoles = COLLECTION_ROLES.filter(
    (role) => ![...roleById.values()].includes(role),
  );

  if (missingRoles.length > 0) {
    const unassigned = sorted.filter((d) => !assigned.has(d.designId));
    for (const role of missingRoles) {
      const candidate = unassigned.shift();
      if (candidate) {
        roleById.set(candidate.designId, role);
        assigned.add(candidate.designId);
        adjustments.push(
          `collection intelligence: assigned missing role "${role}" to "${candidate.title}"`,
        );
      }
    }
  }

  const stillMissing = COLLECTION_ROLES.filter(
    (role) => ![...roleById.values()].includes(role),
  );
  if (stillMissing.length > 0) {
    throw new CollectionIntelligenceError(
      `Collection rejected — missing required roles: ${stillMissing.join(", ")}`,
    );
  }

  return designs.map((design) => ({
    ...design,
    collectionRole: roleById.get(design.designId) ?? "Supporting Piece",
  }));
}

function buildEmotionalNarrative(
  designs: DesignConcept[],
  collectionName: string,
): string {
  const keywords = designs
    .map((d) => d.emotionalKeyword ?? d.emotion)
    .filter(Boolean)
    .slice(0, 5);
  return `${collectionName} moves through ${keywords.join(" → ").toLowerCase()} — a Milaene capsule built on emotional restraint, editorial spacing, and quiet luxury symbolism.`;
}

function applyEmotionalFields(
  design: DesignConcept,
  index: number,
): DesignConcept {
  const role = design.collectionRole;
  const keyword =
    MILAENE_EMOTIONAL_VOCABULARY.preferred.find((word) =>
      design.emotion.toLowerCase().includes(word.toLowerCase()),
    ) ?? pickPreferredEmotion(index);

  const narrative = `${keyword} expressed through ${design.creativeApproach.toLowerCase()} — ${design.visualConcept.slice(0, 80).toLowerCase()}.`;

  return {
    ...design,
    emotion: design.emotion.includes(keyword) ? design.emotion : keyword,
    emotionalKeyword: keyword,
    emotionalNarrative: narrative,
    emotionalPositionInCollection: EMOTIONAL_POSITION_BY_ROLE[role],
    storyPosition: ROLE_TO_ARC[role],
  };
}

export function enrichDesignRelationships(
  designs: DesignConcept[],
  heroDesignId: string,
): DesignConcept[] {
  const hero = designs.find((d) => d.designId === heroDesignId);
  const heroTitle = hero?.title ?? "the hero piece";

  return designs.map((design) => {
    if (design.designId === heroDesignId) {
      return {
        ...design,
        supportsDesignId: undefined,
        relationshipReason: RELATIONSHIP_REASONS["Hero Piece"](heroTitle),
      };
    }

    return {
      ...design,
      supportsDesignId: heroDesignId,
      relationshipReason: RELATIONSHIP_REASONS[design.collectionRole](heroTitle),
    };
  });
}

export function buildCeoAnalysis(
  designs: DesignConcept[],
  collection: Pick<ResearchCollection, "collectionScore" | "heroDesignId">,
): CeoAnalysis {
  const ranked = [...designs].sort((a, b) => b.dnaScore - a.dnaScore);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];

  const launchOrder = [
    designs.find((d) => d.collectionRole === "Hero Piece"),
    designs.find((d) => d.collectionRole === "Supporting Piece"),
    designs.find((d) => d.collectionRole === "Statement Piece"),
    designs.find((d) => d.collectionRole === "Core Essential"),
    designs.find((d) => d.collectionRole === "Limited Piece"),
  ]
    .filter(Boolean)
    .map((d) => d!.title);

  const highRisk = designs.filter((d) => d.productionDifficulty === "High");
  const productionRisk =
    highRisk.length > 0
      ? `${highRisk.length} piece(s) carry high production complexity — prioritize sampling for ${highRisk.map((d) => d.title).join(", ")}.`
      : "Production risk is manageable across the capsule — all pieces within standard POD parameters.";

  const avgCommercial = Math.round(
    designs.reduce((sum, d) => sum + commercialConfidence(d), 0) /
      designs.length,
  );

  const hero = designs.find((d) => d.designId === collection.heroDesignId);
  const adPotential = hero
    ? `Strong editorial campaign potential anchored on "${hero.title}" — ${hero.emotion.toLowerCase()} narrative suits calm luxury lookbooks and minimal social storytelling.`
    : "Moderate ad potential — refine hero narrative before campaign production.";

  return {
    strongestProduct: strongest?.product ?? strongest?.title ?? "Unknown",
    weakestProduct: weakest?.product ?? weakest?.title ?? "Unknown",
    recommendedLaunchOrder: launchOrder,
    productionRisk,
    commercialConfidence: Math.round(
      (avgCommercial + collection.collectionScore) / 2,
    ),
    adPotential,
  };
}

export function applyRoleDnaMinimums(
  designs: DesignConcept[],
  adjustments: string[] = [],
): DesignConcept[] {
  return designs.map((design, index) => {
    const minimum = ROLE_DNA_MINIMUMS[design.collectionRole];
    if (design.dnaScore >= minimum) return design;

    const enhanced = applyBrandDnaAnalysis(
      sanitizeEmotionalLanguage(
        {
          ...design,
          styleDirection: `Quiet luxury editorial — ${design.styleDirection}`,
          negativeSpaceUsage:
            design.negativeSpaceUsage ||
            "Generous negative space with muted tonal restraint",
          typography: design.typography.includes("distress")
            ? "Editorial serif, wide tracking, single restrained text block"
            : design.typography,
        },
        index,
      ),
    );

    if (enhanced.dnaScore < minimum) {
      adjustments.push(
        `collection intelligence: "${design.title}" (${design.collectionRole}) below ${minimum}% DNA — scored ${enhanced.dnaScore}%`,
      );
    }

    return enhanced;
  });
}

export interface CollectionIntelligenceResult {
  designs: DesignConcept[];
  collection: ResearchCollection;
}

/** Apply collection intelligence — does NOT call Hero Engine. */
export function applyCollectionIntelligence(
  designs: DesignConcept[],
  collection: ResearchCollection,
  adjustments: string[] = [],
): CollectionIntelligenceResult {
  let working = deduplicateDesignConcepts(designs, adjustments);
  working = enforceCollectionRoles(working, adjustments);
  working = applyRoleDnaMinimums(working, adjustments);

  const heroDesignId =
    working.find((d) => d.collectionRole === "Hero Piece")?.designId ??
    collection.heroDesignId;

  working = enrichDesignRelationships(working, heroDesignId);
  working = working.map((design, index) =>
    applyEmotionalFields(sanitizeEmotionalLanguage(design, index), index),
  );

  const emotionalNarrative = buildEmotionalNarrative(working, collection.name);
  const ceoAnalysis = buildCeoAnalysis(working, {
    ...collection,
    heroDesignId,
  });

  const enrichedCollection: ResearchCollection = {
    ...collection,
    heroDesignId,
    collectionArc: [...COLLECTION_ARC],
    emotionalNarrative,
    ceoAnalysis,
    ceoRecommendation: buildCeoRecommendation(
      ceoAnalysis,
      collection.collectionScore,
    ),
  };

  adjustments.push(
    `collection intelligence: applied emotional arc, relationships, and CEO analysis`,
  );

  return { designs: working, collection: enrichedCollection };
}

function buildCeoRecommendation(
  analysis: CeoAnalysis,
  collectionScore: number,
): string {
  if (analysis.commercialConfidence >= 85 && collectionScore >= 85) {
    return "Proceed to Design Studio — strong commercial and creative alignment.";
  }
  if (collectionScore >= 70) {
    return `Proceed with refinements — prioritize ${analysis.strongestProduct} for launch.`;
  }
  return `Refine before production — address weaknesses in ${analysis.weakestProduct}.`;
}

export function formatCollectionIntelligenceMarkdown(
  collection: ResearchCollection,
  designs: DesignConcept[],
): string {
  const lines = [
    "## Collection Intelligence",
    "",
    "### Collection Arc",
    ...(collection.collectionArc ?? COLLECTION_ARC).map(
      (step, index) => `${index + 1}. ${step}`,
    ),
    "",
    "### Emotional Story",
    collection.emotionalNarrative ?? "",
    "",
    "### DNA Ranking",
    ...[...designs]
      .sort((a, b) => b.dnaScore - a.dnaScore)
      .map(
        (d, i) =>
          `${i + 1}. ${d.title} — ${d.dnaScore}% (${d.collectionRole})`,
      ),
    "",
    "### Design Relationships",
    ...designs.map(
      (d) =>
        `- **${d.title}** (${d.collectionRole})${d.supportsDesignId ? ` → supports ${d.supportsDesignId}` : ""}: ${d.relationshipReason ?? ""}`,
    ),
  ];

  if (collection.ceoAnalysis) {
    lines.push(
      "",
      "### CEO Analysis",
      `**Strongest product:** ${collection.ceoAnalysis.strongestProduct}`,
      `**Weakest product:** ${collection.ceoAnalysis.weakestProduct}`,
      `**Launch order:** ${collection.ceoAnalysis.recommendedLaunchOrder.join(" → ")}`,
      `**Production risk:** ${collection.ceoAnalysis.productionRisk}`,
      `**Commercial confidence:** ${collection.ceoAnalysis.commercialConfidence}%`,
      `**Ad potential:** ${collection.ceoAnalysis.adPotential}`,
    );
    if (collection.ceoAnalysis.launchApproval) {
      lines.push(
        `**CEO launch approval:** ${collection.ceoAnalysis.launchApproval.approved ? "Yes" : "No"}`,
        `**Emotional impact:** ${collection.ceoAnalysis.launchApproval.emotionalImpact}`,
        `**Commercial strength:** ${collection.ceoAnalysis.launchApproval.commercialStrength}`,
        `**Ad expectations:** ${collection.ceoAnalysis.launchApproval.adPerformanceExpectations}`,
      );
    }
  }

  return lines.join("\n");
}
