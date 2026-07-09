import {
  analyzeCollectionEmotion,
  analyzeThemeEmotion,
  pickNarrativeHeroTitle,
  type ThemeEmotionalAnalysis,
} from "./emotional-intelligence";
import type { CollectionRole, ResearchCollection } from "./types";

export type { ThemeEmotionalAnalysis };

export interface ThemeRoleTitles {
  "Hero Piece": string;
  "Core Essential": string;
  "Statement Piece": string;
  "Supporting Piece": string;
  "Limited Piece": string;
}

export interface ThemeProfile {
  id: string;
  emotionalKeyword: string;
  heroTitle: string;
  visualMotifs: string[];
  symbolism: string;
  emotions: string[];
  roleTitles: ThemeRoleTitles;
  emotion: ThemeEmotionalAnalysis;
}

function withEmotion(
  entry: Omit<ThemeProfile, "emotion">,
  themeCorpus: string,
): ThemeProfile {
  return {
    ...entry,
    emotion: analyzeThemeEmotion(themeCorpus),
  };
}

const THEME_PROFILES: Array<{ match: RegExp; profile: Omit<ThemeProfile, "emotion"> }> = [
  {
    match: /silent\s*love|unspoken\s*bond|quiet\s*love|closeness/i,
    profile: {
      id: "silent-love",
      emotionalKeyword: "closeness without connection",
      heroTitle: "ONLY BETWEEN US",
      visualMotifs: [
        "interrupted dual arc drawn close without touching",
        "offset parallel arcs in negative space",
        "missing center geometry",
      ],
      symbolism:
        "Unspoken feelings held in quiet proximity — love without expression, moments never shared, resolving toward acceptance",
      emotions: ["Connection", "Closeness", "Stillness", "Reflection"],
      roleTitles: {
        "Hero Piece": "ONLY BETWEEN US",
        "Core Essential": "NEVER SAID",
        "Statement Piece": "STILL HERE",
        "Supporting Piece": "UNSAID DISTANCE",
        "Limited Piece": "WHAT WE NEVER TOLD",
      },
    },
  },
  {
    match: /lost\s*souls?|searching|isolation|fragmented|inner\s*map/i,
    profile: {
      id: "lost-souls",
      emotionalKeyword: "searching without arrival",
      heroTitle: "WHAT WE LOST",
      visualMotifs: [
        "fragmented path lines converging toward a void",
        "isolated abstract contour in negative space",
        "inner map contour with broken coordinates",
      ],
      symbolism:
        "Loneliness mapped through fragmented paths — identity conflict, past selves remembered, self-discovery at the end of searching",
      emotions: ["Distance", "Depth", "Echo", "Weight"],
      roleTitles: {
        "Hero Piece": "WHAT WE LOST",
        "Core Essential": "WHEN YOU LEFT",
        "Statement Piece": "PAST SELVES",
        "Supporting Piece": "EMPTY ROOM",
        "Limited Piece": "NO DIRECTION",
      },
    },
  },
  {
    match: /time\s*never\s*waits|hourglass|fading\s*time|clock|temporal/i,
    profile: {
      id: "time-never-waits",
      emotionalKeyword: "urgency against stillness",
      heroTitle: "LAST CONVERSATION",
      visualMotifs: [
        "abstract hourglass with dissolving sand geometry",
        "fading calendar grid with eroded date markers",
        "circular clock abstraction with broken tick marks",
      ],
      symbolism:
        "Passing time dissolving into negative space — impermanence, lost moments, presence longed for, acceptance of what cannot be held",
      emotions: ["Weight", "Echo", "Memory", "Stillness"],
      roleTitles: {
        "Hero Piece": "LAST CONVERSATION",
        "Core Essential": "BEFORE THE LIGHT",
        "Statement Piece": "FADING HOUR",
        "Supporting Piece": "LOST MOMENTS",
        "Limited Piece": "NEVER AGAIN",
      },
    },
  },
  {
    match: /quiet\s*ascent|ascent|rise\s*quietly/i,
    profile: {
      id: "quiet-ascent",
      emotionalKeyword: "rising without noise",
      heroTitle: "RISE WITHOUT NOISE",
      visualMotifs: [
        "ascending arc geometry with editorial spacing",
        "stepped tonal layers rising vertically",
        "organic curve reaching upward through negative space",
      ],
      symbolism:
        "Quiet upward movement through restrained arc geometry — growth without noise, becoming through editorial minimalism",
      emotions: ["Becoming", "Light", "Calm", "Poise"],
      roleTitles: {
        "Hero Piece": "RISE WITHOUT NOISE",
        "Core Essential": "STILL CLIMBING",
        "Statement Piece": "BEFORE THE PEAK",
        "Supporting Piece": "HELD IN MOTION",
        "Limited Piece": "QUIET ASCENT",
      },
    },
  },
  {
    match: /between\s*shadows|shadow|depth/i,
    profile: {
      id: "between-shadows",
      emotionalKeyword: "light against concealment",
      heroTitle: "HELD IN SHADOW",
      visualMotifs: [
        "layered tonal shadow planes",
        "abstract form emerging from gradient negative space",
        "architectural shadow geometry on garment",
      ],
      symbolism:
        "What remains hidden expressed through layered shadow planes — visibility versus protection, faces in half-light, living with ambiguity",
      emotions: ["Depth", "Silence", "Weight", "Reflection"],
      roleTitles: {
        "Hero Piece": "HELD IN SHADOW",
        "Core Essential": "HALF REVEALED",
        "Statement Piece": "BETWEEN LIGHT",
        "Supporting Piece": "WHAT STAYS HIDDEN",
        "Limited Piece": "EDGE OF DARK",
      },
    },
  },
];

const DEFAULT_PROFILE_BASE: Omit<ThemeProfile, "emotion"> = {
  id: "milaene-capsule",
  emotionalKeyword: "presence without certainty",
  heroTitle: "STILL HERE",
  visualMotifs: [
    "organic curve emblem with editorial negative space",
    "symbolic focal anchor with muted tonal restraint",
    "centered composition with calm luxury hierarchy",
  ],
  symbolism:
    "Emotional restraint translated into organic curves — longing, memory, and quiet resolution drawn from the capsule narrative",
  emotions: ["Presence", "Calm", "Reflection", "Depth"],
  roleTitles: {
    "Hero Piece": "STILL HERE",
    "Core Essential": "WHAT REMAINS",
    "Statement Piece": "BEFORE WE KNEW",
    "Supporting Piece": "HELD IN SILENCE",
    "Limited Piece": "LAST GLANCE",
  },
};

const DEFAULT_ROLE_LABELS: ThemeRoleTitles = DEFAULT_PROFILE_BASE.roleTitles;

function collectionCorpus(collection: ResearchCollection): string {
  return [
    collection.name,
    collection.campaignTheme,
    collection.story,
    collection.mood,
    collection.philosophy,
    collection.emotionalNarrative ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Resolve theme-specific hero language from collection metadata. */
export function resolveThemeProfile(collection: ResearchCollection): ThemeProfile {
  const corpus = collectionCorpus(collection);

  for (const entry of THEME_PROFILES) {
    if (entry.match.test(corpus)) {
      return withEmotion(entry.profile, corpus);
    }
  }

  const moodKeyword = collection.mood.split(/\s+/)[0];
  if (moodKeyword && moodKeyword.length > 3) {
    return withEmotion(
      {
        ...DEFAULT_PROFILE_BASE,
        id: `mood-${moodKeyword}`,
        emotionalKeyword:
          DEFAULT_PROFILE_BASE.emotions.find((e) =>
            collection.mood.toLowerCase().includes(e.toLowerCase()),
          ) ?? DEFAULT_PROFILE_BASE.emotionalKeyword,
        heroTitle: pickNarrativeHeroTitle(corpus),
      },
      corpus,
    );
  }

  return withEmotion(DEFAULT_PROFILE_BASE, corpus);
}

export function getThemeEmotionalAnalysis(
  collection: ResearchCollection,
): ThemeEmotionalAnalysis {
  return analyzeCollectionEmotion(collection);
}

export function pickThemeEmotion(
  profile: ThemeProfile,
  collection: ResearchCollection,
  index = 0,
): string {
  const corpus = collectionCorpus(collection);
  const fromProfile = profile.emotions.find((emotion) =>
    corpus.includes(emotion.toLowerCase()),
  );
  if (fromProfile) return fromProfile;
  return profile.emotions[index % profile.emotions.length] ?? profile.emotionalKeyword;
}

export function buildThemeHeroTitle(
  collection: ResearchCollection,
  profile: ThemeProfile,
): string {
  const corpus = collectionCorpus(collection);
  const narrativeTitle = pickNarrativeHeroTitle(corpus);
  if (profile.roleTitles["Hero Piece"]) {
    return profile.roleTitles["Hero Piece"];
  }
  return narrativeTitle;
}

export function getThemeRoleTitle(
  profile: ThemeProfile,
  role: CollectionRole,
  collection: ResearchCollection,
): string {
  const themed = profile.roleTitles[role] ?? DEFAULT_ROLE_LABELS[role];
  if (role === "Hero Piece") {
    return buildThemeHeroTitle(collection, profile);
  }
  return themed;
}
