import type {
  CollectionRole,
  CreativeApproach,
  DesignConcept,
  RepeatabilityScore,
} from "./types";
import { COLLECTION_ROLES, REPEATABILITY_SCORES } from "./types";

export const DNA_MIN_SCORE = 65;

export type { CollectionRole, RepeatabilityScore };
export { COLLECTION_ROLES, REPEATABILITY_SCORES };

export interface BrandDnaDefinition {
  philosophy: string[];
  forbiddenStyles: string[];
  preferredSilhouettes: string[];
  preferredPlacements: string[];
  signatureElements: string[];
  emotionalGoals: string[];
  materialLanguage: string[];
  typographyRules: string[];
}

export const MILAENE_BRAND_DNA: BrandDnaDefinition = {
  philosophy: [
    "calm luxury",
    "emotional minimalism",
    "quiet confidence",
    "meaning over hype",
    "timeless over trendy",
  ],
  emotionalGoals: [
    "serenity",
    "reflection",
    "confidence",
    "connection",
    "depth",
  ],
  preferredSilhouettes: [
    "oversized",
    "relaxed",
    "boxy",
    "heavy-weight",
    "dropped shoulders",
  ],
  preferredPlacements: [
    "upper chest",
    "center chest",
    "spine back",
    "upper back",
    "vertical compositions",
  ],
  signatureElements: [
    "organic curves",
    "subtle symbols",
    "abstract geometry",
    "editorial spacing",
    "layered meaning",
    "negative space",
  ],
  materialLanguage: [
    "washed black",
    "off-white",
    "concrete grey",
    "natural beige",
    "muted green",
  ],
  typographyRules: [
    "large tracking",
    "uppercase",
    "editorial serif",
    "minimalist sans",
    "maximum 1–2 text blocks",
  ],
  forbiddenStyles: [
    "Supreme style",
    "BAPE style",
    "anime graphics",
    "graffiti chaos",
    "hyper color palettes",
    "loud Y2K graphics",
    "cartoon artwork",
    "heavy skull graphics",
    "chaotic collages",
    "oversized logos",
    "saturated neon colors",
    "maximalism",
    "hypebeast aesthetics",
  ],
};

const COLOR_KEYWORDS: Record<string, string[]> = {
  "washed black": ["black", "soft black", "charcoal", "washed black", "ink black", "sumi"],
  "off-white": ["off-white", "off white", "natural raw", "cream", "ivory", "stone"],
  "concrete grey": ["grey", "gray", "concrete", "stone grey", "warm grey", "ash"],
  "natural beige": ["beige", "sand", "natural", "taupe", "oat", "raw"],
  "muted green": ["green", "sage", "olive", "muted green", "forest"],
};

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string; penalty: number }> = [
  { pattern: /\b(supreme|hypebeast|bape|y2k)\b/i, label: "hypebeast / street-hype reference", penalty: 22 },
  { pattern: /\b(anime|manga|cartoon|graffiti)\b/i, label: "anime / cartoon / graffiti style", penalty: 24 },
  { pattern: /\b(skull|neon|fluorescent|saturated)\b/i, label: "loud graphic or neon palette", penalty: 18 },
  { pattern: /\b(maximal|chaotic collage|oversized logo)\b/i, label: "maximalist or chaotic composition", penalty: 18 },
  { pattern: /\b(rave|acid yellow|electric cobalt)\b/i, label: "hyper-saturated color energy", penalty: 15 },
  { pattern: /\b(hustle|dream big|stay wild|never stop|rise again|speak louder|be strong)\b/i, label: "generic hype slogan energy", penalty: 16 },
  { pattern: /\b(large logo|oversized branding|all-over print|graphic noise)\b/i, label: "loud branding or graphic noise", penalty: 14 },
  { pattern: /\b(distressed headline|bold hierarchy|stacked oversized|condensed grotesk headline)\b/i, label: "loud typography treatment", penalty: 12 },
];

function conceptCorpus(concept: DesignConcept): string {
  return [
    concept.title,
    concept.styleDirection,
    concept.emotion,
    concept.visualConcept,
    concept.designDescription,
    concept.message,
    concept.typography,
    concept.symbolism,
    concept.product,
    concept.color,
    concept.printArea,
    concept.placementDimensions,
    concept.coordinates,
    concept.garmentInspiration,
    concept.brandInspiration,
    concept.visualReferences,
    concept.exactComposition,
    concept.layoutDescription,
    concept.materialEffects,
    concept.negativeSpaceUsage,
    concept.geometry,
    concept.focalPoint,
    ...concept.graphicElements,
    ...concept.colorBreakdown.map((e) => `${e.color} ${e.usage}`),
  ]
    .join(" ")
    .toLowerCase();
}

function scoreColorFit(concept: DesignConcept): { score: number; match?: string } {
  const corpus = conceptCorpus(concept);
  let best = 0;
  let match: string | undefined;
  for (const [label, keywords] of Object.entries(COLOR_KEYWORDS)) {
    const hit = keywords.some((kw) => corpus.includes(kw));
    if (hit) {
      best = 15;
      match = label;
      break;
    }
  }
  if (best === 0 && /muted|tonal|tone-on-tone|soft/i.test(corpus)) {
    best = 10;
    match = "muted tonal palette";
  }
  return { score: best, match };
}

function scorePlacementFit(concept: DesignConcept): { score: number; match?: string } {
  const corpus = conceptCorpus(concept);
  const hits = MILAENE_BRAND_DNA.preferredPlacements.filter((p) =>
    corpus.includes(p.replace(/\s+/g, " ").toLowerCase().split(" ")[0]),
  );
  const placementTerms = [
    "chest",
    "upper back",
    "spine",
    "left chest",
    "center",
    "vertical",
  ];
  const termHits = placementTerms.filter((t) => corpus.includes(t));
  const score = Math.min(15, (hits.length + termHits.length) * 4);
  return {
    score,
    match: hits[0] ?? termHits[0],
  };
}

function scoreEmotionFit(concept: DesignConcept): { score: number; match?: string } {
  const emotion = concept.emotion.toLowerCase();
  const message = concept.message.toLowerCase();
  const goals = MILAENE_BRAND_DNA.emotionalGoals;
  const direct = goals.find((g) => emotion.includes(g));
  if (direct) return { score: 15, match: direct };

  const milaeneWords = [
    "silence", "presence", "echo", "within", "memory", "distance",
    "stillness", "becoming", "weight", "light", "reflection",
    "connection", "depth", "calm", "poise",
  ];
  const preferred = milaeneWords.find((w) => emotion.includes(w) || message.includes(w));
  if (preferred) return { score: 14, match: preferred };

  const calmEmotions = ["calm", "poise", "stillness", "serenity", "reflection", "quiet", "depth"];
  const hit = calmEmotions.find((e) => emotion.includes(e));
  if (hit) return { score: 12, match: hit };

  const loudEmotions = ["energy", "defiance", "rebellion", "chaos", "rage", "hustle"];
  if (loudEmotions.some((e) => emotion.includes(e))) {
    return { score: 2, match: undefined };
  }
  return { score: 7 };
}

function scoreSilhouetteFit(concept: DesignConcept): { score: number; match?: string } {
  const corpus = conceptCorpus(concept);
  const hits = MILAENE_BRAND_DNA.preferredSilhouettes.filter((s) =>
    corpus.includes(s.toLowerCase()),
  );
  if (hits.length > 0) return { score: 10, match: hits[0] };
  if (/hoodie|oversized|relaxed|boxy/i.test(corpus)) {
    return { score: 8, match: "oversized garment" };
  }
  return { score: 4 };
}

function scoreTypographyFit(concept: DesignConcept): { score: number; match?: string } {
  const typo = concept.typography.toLowerCase();
  if (/no type|pure graphic/i.test(typo)) return { score: 9, match: "typography-free restraint" };

  if (/distress|bold hierarchy|stacked oversized|condensed grotesk|rave/i.test(typo)) {
    return { score: 2, match: undefined };
  }

  const hits: string[] = [];
  if (/track|spaced|wide|letter/i.test(typo)) hits.push("large tracking");
  if (/uppercase|caps/i.test(typo)) hits.push("uppercase");
  if (/serif|editorial/i.test(typo)) hits.push("editorial serif");
  if (/sans|grotesk|minimal/i.test(typo)) hits.push("minimalist sans");
  if (concept.message.split(/\s+/).length <= 4) hits.push("concise text blocks");

  const score = Math.min(10, hits.length * 3);
  return { score, match: hits[0] };
}

function scoreSignatureFit(concept: DesignConcept): { score: number; match?: string } {
  const corpus = conceptCorpus(concept);
  const hits = MILAENE_BRAND_DNA.signatureElements.filter((el) => {
    const key = el.split(" ")[0];
    return corpus.includes(key);
  });
  if (/negative space|editorial|organic|subtle/i.test(corpus)) {
    hits.push("editorial restraint");
  }
  const score = Math.min(10, hits.length * 3);
  return { score, match: hits[0] };
}

function scorePhilosophyFit(concept: DesignConcept): { score: number; match?: string } {
  const corpus = conceptCorpus(concept);
  const hits = MILAENE_BRAND_DNA.philosophy.filter((p) => {
    const key = p.split(" ")[0];
    return corpus.includes(key);
  });
  if (/quiet luxury|minimal|timeless|meaning|restraint/i.test(corpus)) {
    return { score: 10, match: "quiet luxury philosophy" };
  }
  return { score: Math.min(10, hits.length * 4), match: hits[0] };
}

function computeForbiddenPenalties(corpus: string): {
  penalty: number;
  conflicts: string[];
} {
  const conflicts: string[] = [];
  let penalty = 0;
  for (const { pattern, label, penalty: p } of FORBIDDEN_PATTERNS) {
    if (pattern.test(corpus)) {
      penalty += p;
      conflicts.push(label);
    }
  }
  for (const style of MILAENE_BRAND_DNA.forbiddenStyles) {
    const key = style.split(" ")[0].toLowerCase();
    if (corpus.includes(key) && !conflicts.some((c) => c.includes(key))) {
      penalty += 8;
      conflicts.push(style);
    }
  }
  return { penalty, conflicts };
}

export interface BrandDnaAnalysis {
  dnaScore: number;
  dnaMatches: string[];
  dnaConflicts: string[];
  whyFitsMilaene: string[];
  collectionRole: CollectionRole;
  repeatabilityScore: RepeatabilityScore;
  imagePromptCore: string;
}

export function analyzeBrandDna(concept: DesignConcept): BrandDnaAnalysis {
  const corpus = conceptCorpus(concept);

  const color = scoreColorFit(concept);
  const placement = scorePlacementFit(concept);
  const emotion = scoreEmotionFit(concept);
  const silhouette = scoreSilhouetteFit(concept);
  const typography = scoreTypographyFit(concept);
  const signature = scoreSignatureFit(concept);
  const philosophy = scorePhilosophyFit(concept);
  const forbidden = computeForbiddenPenalties(corpus);

  const raw =
    color.score +
    placement.score +
    emotion.score +
    silhouette.score +
    typography.score +
    signature.score +
    philosophy.score -
    forbidden.penalty;

  const dnaScore = Math.max(0, Math.min(100, raw));

  const dnaMatches: string[] = [];
  if (color.match) dnaMatches.push(`muted palette (${color.match})`);
  if (placement.match) dnaMatches.push(`${placement.match} placement`);
  if (emotion.match) dnaMatches.push(`calm emotional direction (${emotion.match})`);
  if (silhouette.match) dnaMatches.push(`${silhouette.match} silhouette`);
  if (typography.match) dnaMatches.push(`premium typography (${typography.match})`);
  if (signature.match) dnaMatches.push(signature.match);
  if (philosophy.match) dnaMatches.push(philosophy.match);

  if (dnaMatches.length === 0) {
    dnaMatches.push("structured art-direction brief");
  }

  const dnaConflicts = [...forbidden.conflicts];
  if (emotion.score <= 5) dnaConflicts.push("emotion too loud for Milaene calm");
  if (typography.score <= 3) dnaConflicts.push("typography too loud for Milaene restraint");
  if (color.score <= 5) dnaConflicts.push("palette not aligned with muted material language");
  if (/speak louder|rise again|hustle|dream big|stay wild|never stop|be strong/i.test(corpus)) {
    dnaConflicts.push("generic hype slogan detected");
  }
  if (concept.graphicElements.length > 5) {
    dnaConflicts.push("graphic element count creates visual noise");
  }
  if (concept.contrastLevel === "High" && concept.visualWeight === "Heavy") {
    dnaConflicts.push("graphic complexity slightly high");
  }
  if (concept.creativeApproach === "Abstract Graphic" && concept.graphicElements.length > 4) {
    dnaConflicts.push("geometric complexity slightly high");
  }

  const whyFitsMilaene = [
    philosophy.match
      ? `aligns with ${philosophy.match}`
      : "supports Milaene editorial identity",
    signature.match || /negative space/i.test(corpus)
      ? "uses negative space and editorial restraint"
      : "maintains production-ready clarity",
    "avoids trend-chasing hype aesthetics",
    emotion.match
      ? `channels ${emotion.match} — core Milaene emotional territory`
      : "supports long-term collection building",
    color.match
      ? `works within ${color.match} material language`
      : "compatible with calm luxury positioning",
  ].slice(0, 5);

  const collectionRole = assignCollectionRole(concept, dnaScore);
  const repeatabilityScore = assignRepeatability(concept, dnaScore);
  const imagePromptCore = buildImagePromptCore(concept);

  return {
    dnaScore,
    dnaMatches: dnaMatches.slice(0, 6),
    dnaConflicts: [...new Set(dnaConflicts)].slice(0, 4),
    whyFitsMilaene,
    collectionRole,
    repeatabilityScore,
    imagePromptCore,
  };
}

function assignCollectionRole(concept: DesignConcept, dnaScore: number): CollectionRole {
  if (dnaScore >= 88 && concept.creativeApproach === "Luxury Minimalism") {
    return "Core Essential";
  }
  if (dnaScore >= 85 && ["Typography Design", "Japanese Editorial"].includes(concept.creativeApproach)) {
    return "Hero Piece";
  }
  if (dnaScore >= 80 && concept.creativeApproach === "Symbolic Illustration") {
    return "Statement Piece";
  }
  if (concept.creativeApproach === "Abstract Graphic" || concept.productionDifficulty === "High") {
    return "Limited Piece";
  }
  if (dnaScore >= 72) return "Statement Piece";
  if (dnaScore >= 65) return "Supporting Piece";
  return "Supporting Piece";
}

function assignRepeatability(concept: DesignConcept, dnaScore: number): RepeatabilityScore {
  const highRepeat: CreativeApproach[] = [
    "Luxury Minimalism",
    "Minimal Back Print",
    "Typography Design",
  ];
  const lowRepeat: CreativeApproach[] = ["Abstract Graphic", "Photography Style"];

  if (lowRepeat.includes(concept.creativeApproach)) return "Low";
  if (highRepeat.includes(concept.creativeApproach) && dnaScore >= 70) return "High";
  if (concept.creativeApproach === "Japanese Editorial") return "Medium";
  return dnaScore >= 75 ? "Medium" : "Low";
}

function buildImagePromptCore(concept: DesignConcept): string {
  const color = concept.color || "washed black";
  const product = concept.product || "oversized hoodie";
  const ink =
    /tone-on-tone|sand|beige|off-white|natural/i.test(concept.color)
      ? "off-white ink"
      : "muted ink";
  const motif = concept.visualConcept
    .replace(/\.$/, "")
    .slice(0, 80)
    .toLowerCase();

  return [
    `${color} ${product}`,
    motif,
    ink,
    "quiet luxury streetwear",
    "centered composition",
    "negative space",
    "editorial spacing",
  ]
    .filter(Boolean)
    .join(", ");
}

export function applyBrandDnaAnalysis(concept: DesignConcept): DesignConcept {
  const analysis = analyzeBrandDna(concept);
  return { ...concept, ...analysis };
}
