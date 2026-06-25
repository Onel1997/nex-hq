import { MILAENE_EMOTIONAL_VOCABULARY } from "./emotional-vocabulary";
import { roundPercent } from "./score-coercion";
import type { DesignConcept, ResearchCollection } from "./types";

export const EMOTIONAL_STRENGTH_CEO_MIN = 70;

export interface ThemeEmotionalAnalysis {
  emotionalPain: string;
  emotionalLonging: string;
  emotionalConflict: string;
  emotionalMemory: string;
  emotionalResolution: string;
  emotionalTension: string;
}

interface ThemeEmotionalEntry extends ThemeEmotionalAnalysis {
  id: string;
  heroTitles: string[];
  narrativeTitles: string[];
}

const GENERIC_HERO_MESSAGES =
  /^(connection|presence|within|echo|stillness|depth|calm|poise|memory|distance|light|weight|becoming|reflection|silence)$/i;

const THEME_EMOTIONAL_ENTRIES: Array<{ match: RegExp; entry: ThemeEmotionalEntry }> = [
  {
    match: /silent\s*love|unspoken\s*bond|quiet\s*love|closeness/i,
    entry: {
      id: "silent-love",
      emotionalPain: "unspoken feelings",
      emotionalLonging: "emotional distance",
      emotionalConflict: "love without expression",
      emotionalMemory: "moments never shared",
      emotionalResolution: "acceptance",
      emotionalTension: "closeness without connection",
      heroTitles: [
        "ONLY BETWEEN US",
        "NEVER SAID",
        "STILL HERE",
        "WHAT WE NEVER TOLD",
        "CLOSE ENOUGH",
      ],
      narrativeTitles: [
        "ONLY BETWEEN US",
        "NEVER SAID",
        "STILL HERE",
        "UNSAID DISTANCE",
        "QUIET LOVE",
      ],
    },
  },
  {
    match: /lost\s*souls?|searching|isolation|fragmented|inner\s*map/i,
    entry: {
      id: "lost-souls",
      emotionalPain: "loneliness",
      emotionalLonging: "belonging",
      emotionalConflict: "identity",
      emotionalMemory: "past selves",
      emotionalResolution: "self-discovery",
      emotionalTension: "searching without arrival",
      heroTitles: [
        "WHAT WE LOST",
        "WHEN YOU LEFT",
        "NO DIRECTION",
        "PAST SELVES",
        "EMPTY ROOM",
      ],
      narrativeTitles: [
        "WHAT WE LOST",
        "WHEN YOU LEFT",
        "SEARCHING",
        "INNER MAP",
        "LOST PATH",
      ],
    },
  },
  {
    match: /time\s*never\s*waits|hourglass|fading\s*time|clock|temporal/i,
    entry: {
      id: "time-never-waits",
      emotionalPain: "passing time",
      emotionalLonging: "presence",
      emotionalConflict: "impermanence",
      emotionalMemory: "lost moments",
      emotionalResolution: "acceptance",
      emotionalTension: "urgency against stillness",
      heroTitles: [
        "LAST CONVERSATION",
        "BEFORE THE LIGHT",
        "FADING HOUR",
        "TIME RUNS OUT",
        "MOMENTS LEFT",
      ],
      narrativeTitles: [
        "LAST CONVERSATION",
        "BEFORE THE LIGHT",
        "FADING HOUR",
        "LOST MOMENTS",
        "NEVER AGAIN",
      ],
    },
  },
  {
    match: /quiet\s*ascent|ascent|rise\s*quietly/i,
    entry: {
      id: "quiet-ascent",
      emotionalPain: "stagnation",
      emotionalLonging: "growth",
      emotionalConflict: "ambition versus restraint",
      emotionalMemory: "who you were before the climb",
      emotionalResolution: "quiet becoming",
      emotionalTension: "rising without noise",
      heroTitles: [
        "RISE WITHOUT NOISE",
        "STILL CLIMBING",
        "BEFORE THE PEAK",
        "QUIET ASCENT",
        "HELD IN MOTION",
      ],
      narrativeTitles: ["RISE WITHOUT NOISE", "STILL CLIMBING", "QUIET ASCENT"],
    },
  },
  {
    match: /between\s*shadows|shadow|depth/i,
    entry: {
      id: "between-shadows",
      emotionalPain: "what remains hidden",
      emotionalLonging: "clarity",
      emotionalConflict: "visibility versus protection",
      emotionalMemory: "faces in half-light",
      emotionalResolution: "living with ambiguity",
      emotionalTension: "light against concealment",
      heroTitles: [
        "HELD IN SHADOW",
        "HALF REVEALED",
        "BETWEEN LIGHT",
        "WHAT STAYS HIDDEN",
        "EDGE OF DARK",
      ],
      narrativeTitles: ["HELD IN SHADOW", "HALF REVEALED", "BETWEEN LIGHT"],
    },
  },
];

const DEFAULT_EMOTIONAL_ENTRY: ThemeEmotionalEntry = {
  id: "milaene-capsule",
  emotionalPain: "emotional distance",
  emotionalLonging: "meaningful connection",
  emotionalConflict: "restraint versus expression",
  emotionalMemory: "moments of quiet significance",
  emotionalResolution: "calm acceptance",
  emotionalTension: "presence without certainty",
  heroTitles: [
    "STILL HERE",
    "WHAT REMAINS",
    "BEFORE WE KNEW",
    "HELD IN SILENCE",
    "LAST GLANCE",
  ],
  narrativeTitles: ["STILL HERE", "WHAT REMAINS", "HELD IN SILENCE"],
};

function normalizeThemeInput(theme: string): string {
  return theme.trim().toLowerCase();
}

function resolveEmotionalEntry(theme: string): ThemeEmotionalEntry {
  const corpus = normalizeThemeInput(theme);
  for (const { match, entry } of THEME_EMOTIONAL_ENTRIES) {
    if (match.test(corpus)) return entry;
  }
  return DEFAULT_EMOTIONAL_ENTRY;
}

/** Analyze the emotional architecture of a theme before design generation. */
export function analyzeThemeEmotion(theme: string): ThemeEmotionalAnalysis {
  const entry = resolveEmotionalEntry(theme);
  return {
    emotionalPain: entry.emotionalPain,
    emotionalLonging: entry.emotionalLonging,
    emotionalConflict: entry.emotionalConflict,
    emotionalMemory: entry.emotionalMemory,
    emotionalResolution: entry.emotionalResolution,
    emotionalTension: entry.emotionalTension,
  };
}

export function analyzeCollectionEmotion(
  collection: ResearchCollection,
): ThemeEmotionalAnalysis {
  const corpus = [
    collection.name,
    collection.campaignTheme,
    collection.story,
    collection.mood,
    collection.philosophy,
    collection.emotionalNarrative ?? "",
  ].join(" ");
  return analyzeThemeEmotion(corpus);
}

export function pickNarrativeHeroTitle(
  theme: string,
  index = 0,
): string {
  const entry = resolveEmotionalEntry(theme);
  const pool = entry.heroTitles.length > 0 ? entry.heroTitles : entry.narrativeTitles;
  return pool[index % pool.length] ?? pool[0] ?? "STILL HERE";
}

export function isGenericEmotionalMessage(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length < 4) return true;
  if (GENERIC_HERO_MESSAGES.test(trimmed)) return true;
  const words = trimmed.split(/\s+/);
  if (words.length === 1 && MILAENE_EMOTIONAL_VOCABULARY.preferred.some(
    (word) => word.toLowerCase() === trimmed.toLowerCase(),
  )) {
    return true;
  }
  return false;
}

/** Collection narrative — wound, tension, resolution required. */
export function buildThemeEmotionalNarrative(
  analysis: ThemeEmotionalAnalysis,
  collectionName: string,
): string {
  return [
    `${collectionName} carries an emotional wound of ${analysis.emotionalPain}.`,
    `Tension lives in ${analysis.emotionalTension} — the conflict of ${analysis.emotionalConflict}.`,
    `Longing pulls toward ${analysis.emotionalLonging}, while memory holds ${analysis.emotionalMemory}.`,
    `The arc resolves through ${analysis.emotionalResolution}.`,
    "Pain → Conflict → Reflection → Acceptance → Memory.",
  ].join(" ");
}

export function buildHeroEmotionalNarrative(
  analysis: ThemeEmotionalAnalysis,
  heroTitle: string,
  collectionName: string,
): string {
  return [
    `"${heroTitle}" holds the wound of ${analysis.emotionalPain} for ${collectionName}.`,
    `The hero expresses ${analysis.emotionalTension} — ${analysis.emotionalConflict} made visible.`,
    `Memory of ${analysis.emotionalMemory} and longing for ${analysis.emotionalLonging} shape the launch narrative.`,
    `Resolution arrives as ${analysis.emotionalResolution}.`,
  ].join(" ");
}

export function buildNarrativeSymbolism(
  analysis: ThemeEmotionalAnalysis,
  motif: string,
  heroTitle: string,
): string {
  return [
    `"${heroTitle}" translates ${analysis.emotionalPain} into visual form`,
    `through ${motif} — ${analysis.emotionalConflict} held in editorial restraint,`,
    `memory of ${analysis.emotionalMemory}, longing for ${analysis.emotionalLonging},`,
    `and the quiet resolution of ${analysis.emotionalResolution}.`,
  ].join(" ");
}

export function buildNarrativeVisualConcept(
  analysis: ThemeEmotionalAnalysis,
  heroTitle: string,
  primaryMotif: string,
  secondaryMotif: string,
): string {
  return [
    `"${heroTitle}" — ${analysis.emotionalTension} made visible`,
    `through ${primaryMotif} and ${secondaryMotif},`,
    `where ${analysis.emotionalPain} meets ${analysis.emotionalLonging}`,
    `and ${analysis.emotionalMemory} lingers beneath the surface.`,
  ].join(" ");
}

export interface EmotionalStrengthBreakdown {
  emotionalDepth: number;
  emotionalConflict: number;
  narrativeStrength: number;
  memoryImpact: number;
  symbolicResonance: number;
  emotionalStrength: number;
}

function corpusHits(corpus: string, phrases: string[]): number {
  const lower = corpus.toLowerCase();
  return phrases.filter((phrase) => lower.includes(phrase.toLowerCase())).length;
}

function scoreEmotionalDepth(
  corpus: string,
  analysis: ThemeEmotionalAnalysis,
): number {
  const hits = corpusHits(corpus, [
    analysis.emotionalPain,
    analysis.emotionalLonging,
    "wound",
    "longing",
    "unspoken",
    "distance",
  ]);
  let score = 35 + hits * 12;
  if (analysis.emotionalPain.length > 8) score += 8;
  if (analysis.emotionalLonging.length > 8) score += 8;
  return Math.min(100, score);
}

function scoreEmotionalConflictScore(
  corpus: string,
  analysis: ThemeEmotionalAnalysis,
): number {
  const hits = corpusHits(corpus, [
    analysis.emotionalConflict,
    analysis.emotionalTension,
    "tension",
    "conflict",
    "without",
    "between",
  ]);
  return Math.min(100, 40 + hits * 14);
}

function scoreNarrativeStrength(
  design: DesignConcept,
  analysis: ThemeEmotionalAnalysis,
): number {
  const narrative = design.emotionalNarrative ?? "";
  let score = 30;
  if (narrative.length > 60) score += 15;
  if (narrative.length > 120) score += 10;
  if (/wound|tension|resolution/i.test(narrative)) score += 18;
  if (corpusHits(narrative, [analysis.emotionalResolution, analysis.emotionalPain]) >= 2) {
    score += 12;
  }
  if (design.title.split(/\s+/).length >= 2) score += 10;
  return Math.min(100, score);
}

function scoreMemoryImpact(
  corpus: string,
  analysis: ThemeEmotionalAnalysis,
): number {
  const hits = corpusHits(corpus, [
    analysis.emotionalMemory,
    "memory",
    "moment",
    "past",
    "never",
    "lost",
    "before",
  ]);
  return Math.min(100, 35 + hits * 13);
}

function scoreSymbolicResonance(
  design: DesignConcept,
  analysis: ThemeEmotionalAnalysis,
): number {
  let score = 40;
  const message = design.message?.trim() ?? "";

  if (!isGenericEmotionalMessage(message)) {
    score += 25;
    if (message.split(/\s+/).length >= 2) score += 12;
  } else {
    score -= 20;
  }

  const symbolismHits = corpusHits(
    `${design.symbolism} ${design.visualConcept}`,
    [
      analysis.emotionalPain,
      analysis.emotionalConflict,
      analysis.emotionalMemory,
      analysis.emotionalTension,
    ],
  );
  score += symbolismHits * 10;

  if (design.title === message || design.title.toUpperCase() === message) {
    score += 8;
  }

  return Math.max(0, Math.min(100, score));
}

/** Compute 0–100 emotional strength from narrative intelligence, not keyword counting alone. */
export function computeEmotionalStrength(
  design: DesignConcept,
  themeSource?: string | ThemeEmotionalAnalysis,
): EmotionalStrengthBreakdown {
  const analysis =
    typeof themeSource === "string" || themeSource === undefined
      ? analyzeThemeEmotion(
          themeSource ??
            [
              design.title,
              design.message,
              design.emotionalNarrative,
              design.symbolism,
              design.visualConcept,
            ].join(" "),
        )
      : themeSource;

  const corpus = [
    design.title,
    design.message,
    design.emotion,
    design.symbolism,
    design.visualConcept,
    design.emotionalNarrative ?? "",
    design.designDescription,
  ].join(" ");

  const emotionalDepth = roundPercent(scoreEmotionalDepth(corpus, analysis));
  const emotionalConflict = roundPercent(
    scoreEmotionalConflictScore(corpus, analysis),
  );
  const narrativeStrength = roundPercent(
    scoreNarrativeStrength(design, analysis),
  );
  const memoryImpact = roundPercent(scoreMemoryImpact(corpus, analysis));
  const symbolicResonance = roundPercent(
    scoreSymbolicResonance(design, analysis),
  );

  const emotionalStrength = roundPercent(
    emotionalDepth * 0.22 +
      emotionalConflict * 0.18 +
      narrativeStrength * 0.22 +
      memoryImpact * 0.18 +
      symbolicResonance * 0.2,
  );

  return {
    emotionalDepth,
    emotionalConflict,
    narrativeStrength,
    memoryImpact,
    symbolicResonance,
    emotionalStrength,
  };
}

export function applyNarrativeHeroFields(input: {
  design: DesignConcept;
  collection: ResearchCollection;
  primaryMotif: string;
  secondaryMotif: string;
  themeCorpus?: string;
}): DesignConcept {
  const corpus =
    input.themeCorpus ??
    [
      input.collection.name,
      input.collection.campaignTheme,
      input.collection.story,
      input.collection.mood,
    ].join(" ");

  const analysis = analyzeThemeEmotion(corpus);
  const heroTitle = pickNarrativeHeroTitle(corpus);
  const symbolism = buildNarrativeSymbolism(
    analysis,
    input.primaryMotif,
    heroTitle,
  );
  const visualConcept = buildNarrativeVisualConcept(
    analysis,
    heroTitle,
    input.primaryMotif,
    input.secondaryMotif,
  );
  const emotionalNarrative = buildHeroEmotionalNarrative(
    analysis,
    heroTitle,
    input.collection.name,
  );

  return {
    ...input.design,
    title: heroTitle,
    message: heroTitle,
    emotion: analysis.emotionalLonging,
    emotionalKeyword: analysis.emotionalTension,
    symbolism,
    visualConcept,
    emotionalNarrative,
    designDescription: `Narrative hero for ${input.collection.name}: ${analysis.emotionalPain} expressed through ${input.primaryMotif}, resolving toward ${analysis.emotionalResolution}.`,
  };
}
