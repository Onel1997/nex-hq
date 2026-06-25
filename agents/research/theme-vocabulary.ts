import type { CollectionRole, ResearchCollection } from "./types";

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
}

const THEME_PROFILES: Array<{ match: RegExp; profile: ThemeProfile }> = [
  {
    match: /silent\s*love|unspoken\s*bond|quiet\s*love|closeness/i,
    profile: {
      id: "silent-love",
      emotionalKeyword: "Connection",
      heroTitle: "Unspoken Bond",
      visualMotifs: [
        "interlocking curves drawn close without touching",
        "paired silhouettes in negative space",
        "subtle proximity geometry",
      ],
      symbolism:
        "Two forms held in quiet proximity — emotional connection expressed through closeness, restraint, and unspoken bond",
      emotions: ["Connection", "Closeness", "Stillness", "Reflection"],
      roleTitles: {
        "Hero Piece": "Unspoken Bond",
        "Core Essential": "Quiet Bond Essential",
        "Statement Piece": "Unspoken Curve",
        "Supporting Piece": "Soft Distance Mark",
        "Limited Piece": "Only Between Us",
      },
    },
  },
  {
    match: /lost\s*souls?|searching|isolation|fragmented|inner\s*map/i,
    profile: {
      id: "lost-souls",
      emotionalKeyword: "Distance",
      heroTitle: "Fragmented Path",
      visualMotifs: [
        "fragmented path lines converging toward a void",
        "isolated figure silhouette in negative space",
        "inner map contour with broken coordinates",
      ],
      symbolism:
        "A searching soul mapped through fragmented paths — isolation, longing, and the inner geography of being lost",
      emotions: ["Distance", "Depth", "Echo", "Weight"],
      roleTitles: {
        "Hero Piece": "Fragmented Path",
        "Core Essential": "Inner Map Essential",
        "Statement Piece": "Lost Path Emblem",
        "Supporting Piece": "Solitude Back Mark",
        "Limited Piece": "No Direction Capsule",
      },
    },
  },
  {
    match: /time\s*never\s*waits|hourglass|fading\s*time|clock|temporal/i,
    profile: {
      id: "time-never-waits",
      emotionalKeyword: "Weight",
      heroTitle: "Fading Hour",
      visualMotifs: [
        "abstract hourglass with dissolving sand geometry",
        "fading calendar grid with eroded date markers",
        "circular clock abstraction with broken tick marks",
      ],
      symbolism:
        "Time markers dissolving into negative space — the weight of passing moments through hourglass geometry and fading temporal symbols",
      emotions: ["Weight", "Echo", "Memory", "Stillness"],
      roleTitles: {
        "Hero Piece": "Fading Hour",
        "Core Essential": "Moment Essential",
        "Statement Piece": "Fading Hour Emblem",
        "Supporting Piece": "Time Marker Back Print",
        "Limited Piece": "Last Minute Capsule",
      },
    },
  },
  {
    match: /quiet\s*ascent|ascent|rise\s*quietly/i,
    profile: {
      id: "quiet-ascent",
      emotionalKeyword: "Becoming",
      heroTitle: "Quiet Ascent",
      visualMotifs: [
        "ascending arc geometry with editorial spacing",
        "stepped tonal layers rising vertically",
        "organic curve reaching upward through negative space",
      ],
      symbolism:
        "Quiet upward movement through restrained arc geometry — growth without noise, ascent through editorial minimalism",
      emotions: ["Becoming", "Light", "Calm", "Poise"],
      roleTitles: {
        "Hero Piece": "Quiet Ascent",
        "Core Essential": "Rising Calm Essential",
        "Statement Piece": "Ascent Curve",
        "Supporting Piece": "Upward Mark",
        "Limited Piece": "Peak Capsule",
      },
    },
  },
  {
    match: /between\s*shadows|shadow|depth/i,
    profile: {
      id: "between-shadows",
      emotionalKeyword: "Depth",
      heroTitle: "Held In Shadow",
      visualMotifs: [
        "layered tonal shadow planes",
        "silhouette emerging from gradient negative space",
        "architectural shadow geometry on garment",
      ],
      symbolism:
        "Depth expressed through layered shadow planes — meaning found in what is partially hidden, not fully revealed",
      emotions: ["Depth", "Silence", "Weight", "Reflection"],
      roleTitles: {
        "Hero Piece": "Held In Shadow",
        "Core Essential": "Shadow Line Essential",
        "Statement Piece": "Depth Plane Emblem",
        "Supporting Piece": "Half-Light Mark",
        "Limited Piece": "Between Shadows Capsule",
      },
    },
  },
];

const DEFAULT_PROFILE: ThemeProfile = {
  id: "milaene-capsule",
  emotionalKeyword: "Presence",
  heroTitle: "Editorial Anchor",
  visualMotifs: [
    "organic curve emblem with editorial negative space",
    "symbolic focal anchor with muted tonal restraint",
    "centered composition with calm luxury hierarchy",
  ],
  symbolism:
    "A restrained symbolic centerpiece — organic curves, editorial spacing, and quiet luxury meaning drawn from the capsule narrative",
  emotions: ["Presence", "Calm", "Reflection", "Depth"],
  roleTitles: {
    "Hero Piece": "Editorial Anchor",
    "Core Essential": "Quiet Core Essential",
    "Statement Piece": "Symbolic Peak",
    "Supporting Piece": "Soft Echo Mark",
    "Limited Piece": "Capsule Closer",
  },
};

const DEFAULT_ROLE_LABELS: ThemeRoleTitles = DEFAULT_PROFILE.roleTitles;

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
      return entry.profile;
    }
  }

  const moodKeyword = collection.mood.split(/\s+/)[0];
  if (moodKeyword && moodKeyword.length > 3) {
    return {
      ...DEFAULT_PROFILE,
      id: `mood-${moodKeyword}`,
      emotionalKeyword:
        DEFAULT_PROFILE.emotions.find((e) =>
          collection.mood.toLowerCase().includes(e.toLowerCase()),
        ) ?? DEFAULT_PROFILE.emotionalKeyword,
      heroTitle: `${collection.name.split(/\s+/).slice(0, 2).join(" ")} Anchor`.trim(),
    };
  }

  return DEFAULT_PROFILE;
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
  const base = profile.heroTitle;
  if (collection.name.toLowerCase().includes(base.toLowerCase())) {
    return `${collection.name} — Hero`;
  }
  return `${collection.name} — ${base}`;
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
  return `${collection.name} — ${themed}`;
}
