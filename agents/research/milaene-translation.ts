import { roundPercent } from "./score-coercion";
import type { CollectionRole, DesignConcept } from "./types";

export interface MilaeneVisualLanguage {
  geometry: string[];
  spacing: string[];
  symbolism: string[];
  typography: string[];
  composition: string[];
  materialLanguage: string[];
  forbiddenVisuals: string[];
}

export type MilaeneEmotionCategory =
  | "DISTANCE"
  | "MEMORY"
  | "SILENCE"
  | "CONNECTION"
  | "LOSS"
  | "WAITING";

export interface MilaeneTranslationResult {
  emotion: string;
  translatedVisualLanguage: MilaeneVisualLanguage;
  milaeneTranslation: string;
  visualRestraint: string;
  symbolicAbstraction: string;
  editorialRestraint: string;
  symbolicAbstractionScore: number;
  literalPenalty: number;
  finalDNAContribution: number;
}

export const MILAENE_FORBIDDEN_VISUALS: string[] = [
  "people",
  "silhouettes",
  "faces",
  "photography",
  "kanji dominance",
  "photo strips",
  "literal heartbreak symbols",
  "obvious emotional illustrations",
  "cinematic scenes",
  "anime influences",
  "visual storytelling through characters",
];

export const TRACKED_MOTIF_TOKENS = [
  "interrupted line",
  "separated arcs",
  "missing segment",
  "negative axis",
  "tonal embroidery",
] as const;

export type TrackedMotifToken = (typeof TRACKED_MOTIF_TOKENS)[number];

export const ROLE_DNA_RANGES: Record<CollectionRole, { min: number; max: number }> = {
  "Hero Piece": { min: 82, max: 92 },
  "Core Essential": { min: 75, max: 85 },
  "Statement Piece": { min: 78, max: 88 },
  "Supporting Piece": { min: 70, max: 82 },
  "Limited Piece": { min: 72, max: 88 },
};

export const ROLE_DNA_TARGETS: Record<CollectionRole, number> = {
  "Hero Piece": 88,
  "Core Essential": 80,
  "Statement Piece": 84,
  "Supporting Piece": 76,
  "Limited Piece": 82,
};

const ROLE_MILAENE_LIBRARY: Record<
  CollectionRole,
  Omit<MilaeneVisualLanguage, "forbiddenVisuals">
> = {
  "Hero Piece": {
    geometry: [
      "interrupted dual arc",
      "missing center geometry",
      "broken center line",
    ],
    spacing: [
      "large campaign mark field",
      "negative axis spacing",
      "offset vertical alignment",
      "empty middle axis",
    ],
    symbolism: [
      "campaign-scale emotional anchor",
      "proximity without connection through offset geometry",
    ],
    typography: [
      "sparse uppercase only if required",
      "no kanji-led composition",
    ],
    composition: [
      "large front or back campaign mark",
      "dominant focal hierarchy",
      "offset geometry creating perceived distance",
    ],
    materialLanguage: [
      "tonal embroidery layer",
      "muted plastisol with soft hand feel",
    ],
  },
  "Core Essential": {
    geometry: [
      "small tonal broken line",
      "micro linear segment",
      "restrained arc fragment",
    ],
    spacing: [
      "micro negative-axis chest mark",
      "12 cm restrained chest zone",
      "compact editorial margin",
    ],
    symbolism: [
      "repeatable commercial foundation",
      "quiet entry into the emotional wound",
    ],
    typography: [
      "micro sans-serif wordmark optional",
      "single restrained text block maximum",
    ],
    composition: [
      "minimal chest placement",
      "repeatable commercial mark",
      "calm luxury hierarchy",
    ],
    materialLanguage: [
      "tone-on-tone ink restraint",
      "soft hand matte finish",
    ],
  },
  "Statement Piece": {
    geometry: [
      "offset arc grid",
      "layered arc matrix",
      "expanded abstract contour",
    ],
    spacing: [
      "larger back composition field",
      "expanded vertical axis",
      "statement-scale negative axis spacing",
    ],
    symbolism: [
      "peak narrative conflict through abstract geometry",
      "stronger symbolic hierarchy",
    ],
    typography: [
      "editorial serif accent beneath symbolic illustration",
      "single restrained text block maximum",
    ],
    composition: [
      "stronger visual hierarchy",
      "back-dominant statement layout",
      "asymmetrical focal weighting",
    ],
    materialLanguage: [
      "layered tonal ink",
      "muted plastisol with editorial softness",
    ],
  },
  "Supporting Piece": {
    geometry: [
      "single broken line",
      "quiet linear accent",
      "minimal arc fragment",
    ],
    spacing: [
      "restrained small placement",
      "upper back micro zone",
      "quiet supporting margin",
    ],
    symbolism: [
      "movement toward acceptance",
      "secondary quiet mark",
    ],
    typography: [
      "quiet restrained text",
      "micro sans wordmark",
      "type absent or single micro wordmark",
    ],
    composition: [
      "supporting quiet mark",
      "secondary hierarchy",
      "minimal geometry anchored by negative space",
    ],
    materialLanguage: [
      "tone-on-tone ink restraint",
      "soft hand matte finish",
    ],
  },
  "Limited Piece": {
    geometry: [
      "abstract fragmented panel",
      "experimental cut geometry",
      "fragmented arc echo",
    ],
    spacing: [
      "asymmetrical panel field",
      "experimental placement zone",
      "layer offset by 6–10 mm",
    ],
    symbolism: [
      "memory that closes the arc",
      "experimental symbolic contrast",
    ],
    typography: [
      "type absent or interrupted only",
      "no archival collage framing",
    ],
    composition: [
      "experimental capsule mark",
      "remove a section of the form intentionally",
    ],
    materialLanguage: [
      "experimental material contrast",
      "specialty ink layer",
      "faded tonal ink layer",
    ],
  },
};

const MOTIF_TOKEN_ALTERNATES: Record<TrackedMotifToken, string[]> = {
  "interrupted line": [
    "offset alignment",
    "broken structure",
    "staggered arc marks",
    "quiet linear segment",
  ],
  "separated arcs": [
    "parallel curves",
    "paired arc contours",
    "mirrored forms",
    "layered arc matrix",
  ],
  "missing segment": [
    "removed shape",
    "cut arc segment",
    "fragmented arc echo",
    "experimental cut geometry",
  ],
  "negative axis": [
    "empty axis",
    "editorial margin field",
    "quiet supporting margin",
    "compact editorial margin",
  ],
  "tonal embroidery": [
    "muted plastisol layer",
    "faded tonal ink layer",
    "specialty ink layer",
    "tone-on-tone ink restraint",
  ],
};

const CATEGORY_LIBRARY: Record<
  MilaeneEmotionCategory,
  Omit<MilaeneVisualLanguage, "forbiddenVisuals">
> = {
  DISTANCE: {
    geometry: [
      "interrupted line",
      "separated parallel arcs",
      "missing segment",
      "offset geometry",
      "interrupted dual arc",
      "broken center line",
      "dual abstract forms",
    ],
    spacing: [
      "negative axis spacing",
      "offset vertical alignment",
      "empty middle axis",
      "wide separation between arc endpoints",
    ],
    symbolism: [
      "perceived distance through offset geometry",
      "absence expressed as structural interruption",
      "proximity without connection",
    ],
    typography: [
      "sparse uppercase only if required",
      "no kanji-led composition",
      "maximum one restrained text block",
    ],
    composition: [
      "offset geometry creating perceived distance",
      "avoid central overlap",
      "keep abstract forms apart on a shared axis",
    ],
    materialLanguage: [
      "tonal embroidery layer",
      "muted plastisol with soft hand feel",
      "matte tonal secondary ink",
    ],
  },
  MEMORY: {
    geometry: [
      "faded layer",
      "ghost contour",
      "tonal secondary layer",
      "fragmented arc echo",
      "offset repeated mark",
    ],
    spacing: [
      "layer offset by 6–10 mm",
      "quiet field around ghosted geometry",
      "tonal separation between echoes",
    ],
    symbolism: [
      "prior presence suggested through faded contour",
      "memory as layered tonal echo",
    ],
    typography: [
      "ghosted secondary type layer optional",
      "no archival collage framing",
    ],
    composition: [
      "stack tonal echoes with restrained offset",
      "allow soft edge bleed between fragments",
    ],
    materialLanguage: [
      "faded tonal ink layer",
      "soft matte plastisol with blur falloff",
    ],
  },
  SILENCE: {
    geometry: [
      "minimal geometry",
      "single restrained arc",
      "quiet linear segment",
    ],
    spacing: [
      "large negative space",
      "empty axis",
      "editorial margin field",
    ],
    symbolism: [
      "stillness through absence of graphic density",
      "quiet restraint as the subject",
    ],
    typography: [
      "type absent or single micro wordmark",
      "wide tracking, no decorative scripts",
    ],
    composition: [
      "minimal geometry anchored by negative space",
      "open composition with calm hierarchy",
    ],
    materialLanguage: [
      "tone-on-tone ink restraint",
      "soft hand matte finish",
    ],
  },
  CONNECTION: {
    geometry: [
      "parallel curves",
      "mirrored forms",
      "shared geometry",
      "paired arc contours",
    ],
    spacing: [
      "controlled proximity between paired forms",
      "12–18 mm gap between mirrored contours",
    ],
    symbolism: [
      "bond expressed through mirrored abstract geometry",
      "shared axis without literal figures",
    ],
    typography: [
      "single restrained text block maximum",
      "wide tracking, no decorative scripts",
    ],
    composition: [
      "pair abstract forms in deliberate proximity",
      "allow partial overlap at edges only",
    ],
    materialLanguage: [
      "paired tonal ink layers",
      "muted plastisol with editorial softness",
    ],
  },
  LOSS: {
    geometry: [
      "broken structure",
      "removed shape",
      "missing section",
      "cut arc segment",
    ],
    spacing: [
      "asymmetrical balance",
      "void where content was expected",
      "bias weight to one side",
    ],
    symbolism: [
      "absence as removed geometry",
      "loss expressed through broken continuity",
    ],
    typography: [
      "absent or interrupted type only",
      "no symmetrical wordmark blocks",
    ],
    composition: [
      "remove a section of the form intentionally",
      "use asymmetry to signal absence",
    ],
    materialLanguage: [
      "interrupted tonal layer",
      "matte ink with deliberate void",
    ],
  },
  WAITING: {
    geometry: [
      "offset alignment",
      "delayed repetition",
      "staggered arc marks",
      "unfinished path segment",
    ],
    spacing: [
      "repeated spacing rhythm",
      "offset vertical intervals",
      "measured pause between marks",
    ],
    symbolism: [
      "suspension through offset repetition",
      "anticipation without resolution",
    ],
    typography: [
      "type may trail off or remain absent",
      "no bold resolved wordmarks",
    ],
    composition: [
      "repeat geometry with deliberate offset",
      "leave paths open or incomplete",
    ],
    materialLanguage: [
      "layered tonal marks with staggered opacity",
      "soft matte plastisol",
    ],
  },
};

const LITERAL_IMAGERY_PATTERNS: Array<{ pattern: RegExp; label: string; penalty: number }> = [
  { pattern: /\b(silhouette|silhouettes|figure|figures|people|person|face|faces|portrait)\b/i, label: "human figures", penalty: 20 },
  { pattern: /\b(photograph|photography|photo strip|cinematic|film still|camera)\b/i, label: "photographic storytelling", penalty: 20 },
  { pattern: /\b(drifting apart|two separated|empty center space|heartbreak|broken heart|anime|manga|character)\b/i, label: "literal illustration", penalty: 20 },
  { pattern: /\b(obvious emotional|literal illustration|emotional illustration|storytelling through characters)\b/i, label: "emotional clichés", penalty: 15 },
  { pattern: /\b(kanji dominance|photo strip|photo-strip)\b/i, label: "forbidden editorial cliché", penalty: 15 },
];

const ABSTRACT_SYMBOLISM_PATTERN =
  /\b(abstract|offset geometry|interrupted|parallel arc|ghost contour|negative axis|tonal layer|missing segment|dual abstract|broken center|minimal geometry)\b/i;
const NEGATIVE_SPACE_PATTERN =
  /\b(negative space|negative axis|empty axis|large negative|editorial margin|breathing room)\b/i;
const EDITORIAL_RESTRAINT_PATTERN =
  /\b(editorial restraint|calm luxury|muted tonal|restraint|tone-on-tone|minimal geometry|quiet luxury)\b/i;

const ART_DIRECTION_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bforms drifting apart\b/gi, replacement: "offset geometry creating perceived distance" },
  { pattern: /\bempty center space\b/gi, replacement: "negative axis spacing" },
  { pattern: /\btwo separated silhouettes\b/gi, replacement: "dual abstract forms" },
  { pattern: /\bpaired silhouettes\b/gi, replacement: "paired abstract arc forms" },
  { pattern: /\bisolated figure silhouette\b/gi, replacement: "isolated abstract contour" },
  { pattern: /\bsilhouette emerging\b/gi, replacement: "abstract form emerging" },
  { pattern: /\bprimary silhouettes\b/gi, replacement: "primary abstract forms" },
  { pattern: /\breadable silhouette\b/gi, replacement: "readable abstract form" },
  { pattern: /\btwo silhouettes\b/gi, replacement: "dual abstract forms" },
  { pattern: /\bsilhouettes\b/gi, replacement: "abstract forms" },
  { pattern: /\bfigure silhouette\b/gi, replacement: "abstract contour" },
];

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function createMotifTokenCounts(): Map<TrackedMotifToken, number> {
  return new Map(TRACKED_MOTIF_TOKENS.map((token) => [token, 0]));
}

export function extractTrackedMotifTokens(text: string): TrackedMotifToken[] {
  const lower = text.toLowerCase();
  const found: TrackedMotifToken[] = [];
  if (/interrupted/.test(lower)) found.push("interrupted line");
  if (/separated|parallel arc/.test(lower)) found.push("separated arcs");
  if (/missing segment|missing center|missing section/.test(lower)) {
    found.push("missing segment");
  }
  if (/negative[- ]axis|negative axis/.test(lower)) found.push("negative axis");
  if (/tonal embroidery/.test(lower)) found.push("tonal embroidery");
  return [...new Set(found)];
}

function registerMotifTokens(
  values: string[],
  tokenCounts: Map<TrackedMotifToken, number>,
): void {
  for (const value of values) {
    for (const token of extractTrackedMotifTokens(value)) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
  }
}

function tokenWouldExceedLimit(
  value: string,
  tokenCounts: Map<TrackedMotifToken, number>,
): boolean {
  return extractTrackedMotifTokens(value).some(
    (token) => (tokenCounts.get(token) ?? 0) >= 2,
  );
}

function diversifyGeometry(
  geometry: string[],
  role: CollectionRole,
  tokenCounts: Map<TrackedMotifToken, number>,
): string[] {
  const roleGeometry = ROLE_MILAENE_LIBRARY[role].geometry;
  const diversified: string[] = [];

  for (const entry of roleGeometry.slice(0, 2)) {
    if (!diversified.includes(entry)) {
      diversified.push(entry);
      registerMotifTokens([entry], tokenCounts);
    }
  }

  for (const candidate of uniqueStrings([...geometry, ...roleGeometry])) {
    if (diversified.includes(candidate)) continue;

    if (!tokenWouldExceedLimit(candidate, tokenCounts)) {
      diversified.push(candidate);
      registerMotifTokens([candidate], tokenCounts);
      continue;
    }

    const blockedTokens = extractTrackedMotifTokens(candidate).filter(
      (token) => (tokenCounts.get(token) ?? 0) >= 2,
    );
    const alternatePool = uniqueStrings([
      ...blockedTokens.flatMap((token) => MOTIF_TOKEN_ALTERNATES[token]),
      ...roleGeometry,
      ...geometry,
    ]).filter(
      (entry) => !diversified.includes(entry) && !tokenWouldExceedLimit(entry, tokenCounts),
    );

    const replacement = alternatePool[0];
    if (replacement) {
      diversified.push(replacement);
      registerMotifTokens([replacement], tokenCounts);
    }
  }

  return uniqueStrings(diversified).slice(0, 5);
}

function mergeRoleAndEmotionLanguage(
  role: CollectionRole,
  categories: MilaeneEmotionCategory[],
  tokenCounts: Map<TrackedMotifToken, number>,
): MilaeneVisualLanguage {
  const roleLanguage = ROLE_MILAENE_LIBRARY[role];
  const emotionLanguage = mergeCategories(categories);

  const merged: MilaeneVisualLanguage = {
    geometry: diversifyGeometry(
      uniqueStrings([...roleLanguage.geometry, ...emotionLanguage.geometry]),
      role,
      tokenCounts,
    ),
    spacing: uniqueStrings([...roleLanguage.spacing, ...emotionLanguage.spacing]).slice(0, 5),
    symbolism: uniqueStrings([...roleLanguage.symbolism, ...emotionLanguage.symbolism]).slice(0, 4),
    typography: uniqueStrings([...roleLanguage.typography, ...emotionLanguage.typography]).slice(0, 3),
    composition: uniqueStrings([...roleLanguage.composition, ...emotionLanguage.composition]).slice(0, 4),
    materialLanguage: uniqueStrings([
      ...roleLanguage.materialLanguage,
      ...emotionLanguage.materialLanguage,
    ]).slice(0, 3),
    forbiddenVisuals: [...MILAENE_FORBIDDEN_VISUALS],
  };

  return merged;
}

function mergeCategories(categories: MilaeneEmotionCategory[]): MilaeneVisualLanguage {
  const merged: MilaeneVisualLanguage = {
    geometry: [],
    spacing: [],
    symbolism: [],
    typography: [],
    composition: [],
    materialLanguage: [],
    forbiddenVisuals: [...MILAENE_FORBIDDEN_VISUALS],
  };

  for (const category of categories) {
    const source = CATEGORY_LIBRARY[category];
    merged.geometry.push(...source.geometry);
    merged.spacing.push(...source.spacing);
    merged.symbolism.push(...source.symbolism);
    merged.typography.push(...source.typography);
    merged.composition.push(...source.composition);
    merged.materialLanguage.push(...source.materialLanguage);
  }

  merged.geometry = uniqueStrings(merged.geometry).slice(0, 7);
  merged.spacing = uniqueStrings(merged.spacing).slice(0, 5);
  merged.symbolism = uniqueStrings(merged.symbolism).slice(0, 4);
  merged.typography = uniqueStrings(merged.typography).slice(0, 3);
  merged.composition = uniqueStrings(merged.composition).slice(0, 4);
  merged.materialLanguage = uniqueStrings(merged.materialLanguage).slice(0, 3);

  return merged;
}

export function detectMilaeneEmotionCategories(corpus: string): MilaeneEmotionCategory[] {
  const lower = corpus.toLowerCase();
  const categories = new Set<MilaeneEmotionCategory>();

  if (
    /closeness without connection|distance|separated|apart|isolation|loneliness|void|unspoken distance/.test(
      lower,
    )
  ) {
    categories.add("DISTANCE");
  }
  if (/silence|stillness|quiet|unspoken|minimal restraint|held in silence/.test(lower)) {
    categories.add("SILENCE");
  }
  if (/memory|moment|past|fragment|echo|ghost|never shared|never told/.test(lower)) {
    categories.add("MEMORY");
  }
  if (
    /connection|bond|parallel|mirrored|together|between us/.test(lower) &&
    !/closeness without connection|without connection/.test(lower)
  ) {
    categories.add("CONNECTION");
  }
  if (/loss|lost|missing|left|absence|broken|removed|impermanence/.test(lower)) {
    categories.add("LOSS");
  }
  if (/waiting|delay|longing|presence|urgency against|offset alignment/.test(lower)) {
    categories.add("WAITING");
  }

  if (categories.size === 0) {
    categories.add("SILENCE");
  }

  if (categories.has("DISTANCE") && categories.has("CONNECTION")) {
    categories.delete("CONNECTION");
  }

  return [...categories];
}

export function sanitizeMilaeneArtDirection(text: string): string {
  let sanitized = text;
  for (const { pattern, replacement } of ART_DIRECTION_REPLACEMENTS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized.replace(/\s{2,}/g, " ").trim();
}

export function scoreSymbolicAbstraction(input: {
  corpus: string;
  language: MilaeneVisualLanguage;
}): {
  symbolicAbstractionScore: number;
  literalPenalty: number;
  finalDNAContribution: number;
} {
  let score = 50;
  let literalPenalty = 0;

  if (ABSTRACT_SYMBOLISM_PATTERN.test(input.corpus)) score += 15;
  if (NEGATIVE_SPACE_PATTERN.test(input.corpus)) score += 10;
  if (EDITORIAL_RESTRAINT_PATTERN.test(input.corpus)) score += 10;

  if (
    ABSTRACT_SYMBOLISM_PATTERN.test(input.language.geometry.join(" ")) ||
    ABSTRACT_SYMBOLISM_PATTERN.test(input.language.symbolism.join(" "))
  ) {
    score += 10;
  }

  for (const { pattern, penalty } of LITERAL_IMAGERY_PATTERNS) {
    if (pattern.test(input.corpus)) {
      score -= penalty;
      literalPenalty += penalty;
    }
  }

  const symbolicAbstractionScore = roundPercent(Math.max(0, Math.min(100, score)));
  const finalDNAContribution = roundPercent(
    Math.max(-20, Math.min(12, (symbolicAbstractionScore - 65) * 0.2 - literalPenalty * 0.15)),
  );

  return { symbolicAbstractionScore, literalPenalty, finalDNAContribution };
}

export function hasLiteralEmotionalImagery(corpus: string): boolean {
  return LITERAL_IMAGERY_PATTERNS.some(({ pattern }) => pattern.test(corpus));
}

/** Cap literal imagery at 70; map abstract translation into role-specific DNA ranges. */
export function applyMilaeneDnaCaps(
  baseDnaScore: number,
  translation: MilaeneTranslationResult,
  corpus: string,
  role: CollectionRole = "Supporting Piece",
): number {
  const range = ROLE_DNA_RANGES[role];

  if (hasLiteralEmotionalImagery(corpus) || translation.literalPenalty >= 20) {
    return Math.min(roundPercent(baseDnaScore), 70);
  }

  let score = roundPercent(baseDnaScore + translation.finalDNAContribution);
  const normalized = Math.max(0, Math.min(100, score)) / 100;
  score = range.min + normalized * (range.max - range.min);

  return roundPercent(Math.min(range.max, Math.max(range.min, score)));
}

export function rescoreDnaForRole(design: DesignConcept): number {
  return ROLE_DNA_TARGETS[design.collectionRole];
}

export function ensureCollectionDnaDiversity(
  designs: DesignConcept[],
  adjustments: string[] = [],
): DesignConcept[] {
  if (designs.length <= 1) return designs;

  const scores = designs.map((design) => design.dnaScore);
  if (new Set(scores).size > 1) return designs;

  adjustments.push(
    `dna diversity: all designs scored ${scores[0]}% — applying role-based rescoring`,
  );

  return designs.map((design) => ({
    ...design,
    dnaScore: rescoreDnaForRole(design),
  }));
}

export function assertDnaScoreDiversity(designs: DesignConcept[]): void {
  if (designs.length <= 1) return;

  const scores = designs.map((design) => design.dnaScore);
  if (new Set(scores).size === 1) {
    throw new Error(
      `DNA score diversity failed: all ${designs.length} designs scored ${scores[0]}%`,
    );
  }
}

function buildTranslationSummary(
  emotion: string,
  language: MilaeneVisualLanguage,
): string {
  return [
    ...language.geometry.slice(0, 3),
    ...language.spacing.slice(0, 2),
    language.materialLanguage[0],
  ]
    .filter(Boolean)
    .join(", ");
}

export interface MilaeneTranslationOptions {
  log?: boolean;
  role?: CollectionRole;
  motifTokenCounts?: Map<TrackedMotifToken, number>;
}

export function translateEmotionToMilaeneVisuals(
  emotion: string,
  emotionalNarrative?: string,
  emotionalConflict?: string,
  emotionalMemory?: string,
  options: MilaeneTranslationOptions = {},
): MilaeneTranslationResult {
  const corpus = [emotion, emotionalNarrative, emotionalConflict, emotionalMemory]
    .filter(Boolean)
    .join(" ");

  const categories = detectMilaeneEmotionCategories(corpus);
  const role = options.role ?? "Supporting Piece";
  const tokenCounts = options.motifTokenCounts ?? createMotifTokenCounts();
  const translatedVisualLanguage = mergeRoleAndEmotionLanguage(
    role,
    categories,
    tokenCounts,
  );

  const visualCorpus = [
    corpus,
    translatedVisualLanguage.geometry.join(" "),
    translatedVisualLanguage.spacing.join(" "),
    translatedVisualLanguage.symbolism.join(" "),
    translatedVisualLanguage.composition.join(" "),
    translatedVisualLanguage.materialLanguage.join(" "),
  ].join(" ");

  const scoring = scoreSymbolicAbstraction({
    corpus: visualCorpus,
    language: translatedVisualLanguage,
  });

  const milaeneTranslation = buildTranslationSummary(emotion, translatedVisualLanguage);
  const visualRestraint =
    "Abstract geometry only — symbolic forms without human depiction or lens-based reference";
  const symbolicAbstraction = translatedVisualLanguage.symbolism.slice(0, 2).join("; ");
  const editorialRestraint = translatedVisualLanguage.composition
    .concat(translatedVisualLanguage.spacing.slice(0, 1))
    .slice(0, 2)
    .join("; ");

  const result: MilaeneTranslationResult = {
    emotion,
    translatedVisualLanguage,
    milaeneTranslation,
    visualRestraint,
    symbolicAbstraction,
    editorialRestraint,
    symbolicAbstractionScore: scoring.symbolicAbstractionScore,
    literalPenalty: scoring.literalPenalty,
    finalDNAContribution: scoring.finalDNAContribution,
  };

  if (options.log !== false) {
    logMilaeneTranslation(result);
  }

  return result;
}

/** Build Milaene translation without logging — for DNA scoring passes. */
export function buildMilaeneTranslation(
  emotion: string,
  emotionalNarrative?: string,
  emotionalConflict?: string,
  emotionalMemory?: string,
  role: CollectionRole = "Supporting Piece",
  motifTokenCounts?: Map<TrackedMotifToken, number>,
): MilaeneTranslationResult {
  return translateEmotionToMilaeneVisuals(
    emotion,
    emotionalNarrative,
    emotionalConflict,
    emotionalMemory,
    { log: false, role, motifTokenCounts },
  );
}

export function logMilaeneTranslation(result: MilaeneTranslationResult): void {
  console.log("MILAENE_TRANSLATION:");
  console.log(`emotion: ${result.emotion}`);
  console.log(`translatedVisualLanguage: ${result.milaeneTranslation}`);
  console.log(`symbolicAbstractionScore: ${result.symbolicAbstractionScore}`);
  console.log(`literalPenalty: ${result.literalPenalty}`);
  console.log(`finalDNAContribution: ${result.finalDNAContribution}`);
}

export function milaeneToVisualSymbols(language: MilaeneVisualLanguage): string[] {
  return uniqueStrings([...language.geometry, ...language.symbolism]).slice(0, 6);
}
