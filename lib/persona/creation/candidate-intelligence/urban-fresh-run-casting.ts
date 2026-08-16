/**
 * Phase 2.5B.5 / 2.5B.6 / 2.5B.7 — Urban Community Hero fresh-run casting variation.
 *
 * Every new Creation Project gets a deterministic variation seed and a unique
 * A/B/C/D hair + light casting recipe. Phase 2.5B.6 adds fresh-face DNA bias
 * via a SEPARATE seed stream so hair rotation stays unchanged. Phase 2.5B.7
 * adds compact faceIdentityRecipes (also separate from hair RNG).
 * No provider calls. No anatomy essays.
 */

import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";
import { discoveryRunVariationToken } from "@/lib/brand-archetypes/discovery-blueprints";
import {
  buildUrbanFreshFaceDna,
  type UrbanFaceEmbeddingSample,
  type UrbanFacialEmphasis,
  type UrbanFreshFaceDna,
} from "./urban-fresh-face-dna";
import type {
  UrbanFaceIdentityRecipe,
  UrbanFacialHairLane,
} from "./urban-face-identity-recipe";

export const URBAN_FRESH_RUN_RECIPE_VERSION = "2.5B.5" as const;

/** Broad hair pool — short and longer styles allowed. */
export const URBAN_HAIR_LANE_POOL = [
  { id: "very_short_buzz", label: "very short buzz cut", length: "short" },
  { id: "low_fade", label: "low fade", length: "short" },
  { id: "short_curls", label: "short curls", length: "short" },
  { id: "medium_natural_curls", label: "medium natural curls", length: "medium" },
  { id: "textured_afro", label: "textured afro", length: "medium" },
  { id: "longer_afro", label: "longer afro", length: "long" },
  { id: "short_twists", label: "short twists", length: "short" },
  { id: "medium_twists", label: "medium twists", length: "medium" },
  { id: "braids", label: "braids", length: "long" },
  { id: "cornrows", label: "cornrows", length: "medium" },
  { id: "short_locs", label: "short locs", length: "short" },
  { id: "medium_locs", label: "medium locs", length: "medium" },
] as const;

export type UrbanHairLaneId = (typeof URBAN_HAIR_LANE_POOL)[number]["id"];
export type UrbanHairLane = (typeof URBAN_HAIR_LANE_POOL)[number];

/** Mood labels only — not anatomy. */
export const URBAN_SLOT_MOODS = {
  A: "approachable lifestyle",
  B: "clean street",
  C: "creative fashion",
  D: "confident campaign",
} as const satisfies Record<DiscoverySlot, string>;

const SKIN_UNDERTONES = [
  "warm golden undertone",
  "cool neutral undertone",
  "deep rich undertone",
  "medium warm undertone",
] as const;

const FACE_SHAPE_MOODS = [
  "soft oval impression",
  "longer oval impression",
  "rounded friendly impression",
  "more angular impression",
] as const;

const EXPRESSION_OPTIONS = [
  "soft friendly calm",
  "quiet confidence",
  "creative ease",
  "campaign-ready hold",
] as const;

const WARDROBE_TONES = [
  "muted grey heavyweight hoodie",
  "soft charcoal oversized tee",
  "taupe zip hoodie",
  "soft black streetwear layer",
] as const;

export type UrbanSlotCastingCue = {
  slot: DiscoverySlot;
  mood: string;
  hairLaneId: UrbanHairLaneId;
  hairLabel: string;
  hairLength: UrbanHairLane["length"];
  skinUndertone: string;
  faceShapeMood: string;
  facialHair: string;
  facialHairLane: UrbanFacialHairLane;
  expression: string;
  wardrobeTone: string;
  /** Phase 2.5B.6 — one light facial emphasis (kept for debug compat). */
  facialEmphasis: UrbanFacialEmphasis;
  /** Phase 2.5B.7 — compact facial identity recipe. */
  faceIdentityRecipe: UrbanFaceIdentityRecipe;
};

export type UrbanFreshRunRecipe = {
  version: typeof URBAN_FRESH_RUN_RECIPE_VERSION;
  creationProjectId: string;
  variationSeed: string;
  slots: Record<DiscoverySlot, UrbanSlotCastingCue>;
  hairLanes: Record<DiscoverySlot, string>;
  facialHairLanes: Record<DiscoverySlot, UrbanFacialHairLane>;
  faceIdentityRecipes: Record<DiscoverySlot, UrbanFaceIdentityRecipe>;
  /** Phase 2.5B.6 / 2.5B.7 — compact fresh-face bias + slot recipes. */
  faceDna: UrbanFreshFaceDna;
  freshFaceDirection: string;
};

export type UrbanFreshRunDebug = {
  creationProjectId: string;
  variationSeed: string;
  slot: DiscoverySlot | null;
  hairLanes: Record<DiscoverySlot, string>;
  hairLane: string | null;
  facialHairLanes: Record<DiscoverySlot, string>;
  facialHairLane: string | null;
  faceIdentityRecipes: Record<DiscoverySlot, string>;
  faceIdentityRecipe: string | null;
  freshFaceDirection: string;
  recentClustersConsidered: number;
  dominantClusterAvoided: string | null;
  facialEmphasis: Record<DiscoverySlot, string>;
  provider: string | null;
  promptLength: number | null;
  noveltyClassification: string | null;
  recipeVersion: typeof URBAN_FRESH_RUN_RECIPE_VERSION;
  faceDnaVersion: UrbanFreshFaceDna["version"];
};

/** Deterministic 32-bit seed from string. */
export function hashStringToUint32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickUnique<T>(
  pool: readonly T[],
  count: number,
  rng: () => number,
): T[] {
  const bag = [...pool];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }
  return bag.slice(0, count);
}

function pickPreferringLengthMix(
  rng: () => number,
): UrbanHairLane[] {
  const shuffled = pickUnique(URBAN_HAIR_LANE_POOL, URBAN_HAIR_LANE_POOL.length, rng);
  const short = shuffled.filter((h) => h.length === "short");
  const longer = shuffled.filter((h) => h.length !== "short");
  const chosen: UrbanHairLane[] = [];
  // Guarantee mix when possible: at least one short + one longer.
  if (short[0]) chosen.push(short[0]);
  if (longer[0]) chosen.push(longer[0]);
  for (const lane of shuffled) {
    if (chosen.length >= 4) break;
    if (!chosen.some((c) => c.id === lane.id)) chosen.push(lane);
  }
  while (chosen.length < 4) {
    chosen.push(shuffled[chosen.length % shuffled.length]!);
  }
  return chosen.slice(0, 4);
}

function pickRotated<T extends string>(
  pool: readonly T[],
  rng: () => number,
  used: Set<string>,
): T {
  const available = pool.filter((p) => !used.has(p));
  const source = available.length > 0 ? available : pool;
  const pick = source[Math.floor(rng() * source.length)]!;
  used.add(pick);
  return pick;
}

/**
 * Build a fresh Urban casting recipe for one Creation Project.
 * Same project id → same hair recipe. Face DNA / faceIdentityRecipes use
 * separate seed streams so hair rotation stays identical to 2.5B.5.
 */
export function buildUrbanFreshRunRecipe(
  creationProjectId: string,
  options?: {
    /** Optional recent Urban discovery embeddings for cluster bias (prompt only). */
    recentFaceSamples?: readonly UrbanFaceEmbeddingSample[] | null;
  },
): UrbanFreshRunRecipe {
  const id = creationProjectId.trim();
  if (!id) {
    throw new Error("buildUrbanFreshRunRecipe requires creationProjectId");
  }
  const variationSeed = discoveryRunVariationToken(id);
  // Hair RNG stream — must stay identical to Phase 2.5B.5.
  const rng = mulberry32(hashStringToUint32(`urban-fresh-run-v1:${id}`));
  const hairs = pickPreferringLengthMix(rng);
  const slots: DiscoverySlot[] = ["A", "B", "C", "D"];

  const usedUndertone = new Set<string>();
  const usedFace = new Set<string>();
  const usedExpr = new Set<string>();
  const usedWardrobe = new Set<string>();

  const faceDna = buildUrbanFreshFaceDna(id, options?.recentFaceSamples);

  const slotMap = {} as Record<DiscoverySlot, UrbanSlotCastingCue>;
  const hairLanes = {} as Record<DiscoverySlot, string>;

  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i]!;
    const hair = hairs[i]!;
    const faceRecipe = faceDna.faceIdentityRecipes[slot];
    const facialHairLane = faceDna.facialHairLanes[slot];
    const cue: UrbanSlotCastingCue = {
      slot,
      mood: URBAN_SLOT_MOODS[slot],
      hairLaneId: hair.id,
      hairLabel: hair.label,
      hairLength: hair.length,
      skinUndertone: pickRotated(SKIN_UNDERTONES, rng, usedUndertone),
      faceShapeMood: pickRotated(FACE_SHAPE_MOODS, rng, usedFace),
      facialHair: facialHairLane,
      facialHairLane,
      expression: (() => {
        // Preserve former facial-hair RNG draw so later hair-stream cues stay stable.
        void rng();
        return pickRotated(EXPRESSION_OPTIONS, rng, usedExpr);
      })(),
      wardrobeTone: pickRotated(WARDROBE_TONES, rng, usedWardrobe),
      facialEmphasis: faceDna.facialEmphasis[slot],
      faceIdentityRecipe: faceRecipe,
    };
    slotMap[slot] = cue;
    hairLanes[slot] = hair.label;
  }

  return {
    version: URBAN_FRESH_RUN_RECIPE_VERSION,
    creationProjectId: id,
    variationSeed,
    slots: slotMap,
    hairLanes,
    facialHairLanes: { ...faceDna.facialHairLanes },
    faceIdentityRecipes: { ...faceDna.faceIdentityRecipes },
    faceDna,
    freshFaceDirection: faceDna.freshFaceDirection,
  };
}

export function urbanFreshRunHairComboKey(recipe: UrbanFreshRunRecipe): string {
  return (["A", "B", "C", "D"] as const)
    .map((s) => recipe.hairLanes[s])
    .join(" | ");
}

/** Lightweight Urban L3 casting brief — no micro-anatomy essay. */
export function formatUrbanFreshDiscoveryIdentityPrompt(input: {
  slot: DiscoverySlot;
  exactAge: number | string;
  recipe: UrbanFreshRunRecipe;
}): string {
  const cue = input.recipe.slots[input.slot];
  return [
    "DISCOVERY IDENTITY INSTANCE (L3)",
    "Generate a new individual inside this casting lane.",
    "This is a fresh person for this discovery run — not a locked Brand Face.",
    "Create a genuinely different individual, not a variation of the previous candidates.",
    "Create a new person not based on previous discovery faces.",
    "Cast a real commercial streetwear model — photorealistic, not CGI.",
    "",
    `Slot: ${input.slot} — mood: ${cue.mood}`,
    `Gender: adult male`,
    `Apparent age feel: ${input.exactAge} (natural variation within 21–24 — never underage / teenage / baby-face)`,
    "Young fashion-model face with distinctive but believable features.",
    "Black / Afro-European commercial casting.",
    "",
    "LIGHT CASTING CUES (creative freedom — not a locked anatomy recipe)",
    `Hair: ${cue.hairLabel}.`,
    cue.faceIdentityRecipe.promptLine,
    `Skin undertone cue: ${cue.skinUndertone}.`,
    `Facial hair: ${cue.facialHairLane} (keep youthful — do not age the face).`,
    `Expression: ${cue.expression}.`,
    `Wardrobe tone: ${cue.wardrobeTone}.`,
    "",
    `FRESH FACE: ${input.recipe.freshFaceDirection}`,
    "",
    "Look clearly different from the other three candidates in this same board.",
    "Do NOT copy previous Urban discovery faces or fixed slot anatomy essays.",
    "Streetwear model — not ordinary catalog person, not luxury perfume model.",
    "Natural commercial fashion casting · realistic skin · clean portrait photography.",
  ].join("\n");
}

export function toUrbanFreshRunDebug(
  recipe: UrbanFreshRunRecipe,
  extras?: Partial<
    Pick<
      UrbanFreshRunDebug,
      "provider" | "promptLength" | "noveltyClassification" | "slot"
    >
  >,
): UrbanFreshRunDebug {
  const slot = extras?.slot ?? null;
  const cue = slot ? recipe.slots[slot] : null;
  return {
    creationProjectId: recipe.creationProjectId,
    variationSeed: recipe.variationSeed,
    slot,
    hairLanes: { ...recipe.hairLanes },
    hairLane: cue?.hairLabel ?? null,
    facialHairLanes: { ...recipe.facialHairLanes },
    facialHairLane: cue?.facialHairLane ?? null,
    faceIdentityRecipes: {
      A: recipe.faceIdentityRecipes.A.promptLine,
      B: recipe.faceIdentityRecipes.B.promptLine,
      C: recipe.faceIdentityRecipes.C.promptLine,
      D: recipe.faceIdentityRecipes.D.promptLine,
    },
    faceIdentityRecipe: cue?.faceIdentityRecipe.promptLine ?? null,
    freshFaceDirection: recipe.freshFaceDirection,
    recentClustersConsidered: recipe.faceDna.recentClustersConsidered,
    dominantClusterAvoided: recipe.faceDna.dominantClusterAvoided,
    facialEmphasis: { ...recipe.faceDna.facialEmphasis },
    provider: extras?.provider ?? null,
    promptLength: extras?.promptLength ?? null,
    noveltyClassification: extras?.noveltyClassification ?? null,
    recipeVersion: recipe.version,
    faceDnaVersion: recipe.faceDna.version,
  };
}
