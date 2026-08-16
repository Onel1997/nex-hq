/**
 * Phase 2.5B.7 — Stronger Urban facial identity diversity.
 *
 * Compact faceIdentityRecipe per slot (A/B/C/D). Prompt-bias only.
 * Separate RNG stream from hair rotation (2.5B.5) so hair stays unchanged.
 * Cross-run bias uses recent Urban project ids from 2.5B.6 cluster memory.
 * No provider calls. No anatomy essays.
 */

import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";

export const URBAN_FACE_IDENTITY_RECIPE_VERSION = "2.5B.7" as const;

export const URBAN_FACE_SHAPE_POOL = [
  "oval",
  "narrow oval",
  "broad oval",
  "rectangular",
  "round",
  "tapered",
  "heart-shaped",
  "longer face",
] as const;

export const URBAN_JAW_POOL = [
  "soft jaw",
  "defined jaw",
  "broad jaw",
  "narrow jaw",
  "stronger chin",
  "shorter chin",
  "longer lower face",
  "compact lower face",
] as const;

export const URBAN_EYE_POOL = [
  "wider-set",
  "closer-set",
  "almond",
  "rounder",
  "deeper-set",
  "softer eye area",
  "stronger brow ridge",
] as const;

export const URBAN_NOSE_POOL = [
  "narrow bridge",
  "medium-width nose",
  "broader nose",
  "shorter nose",
  "longer nose",
  "straighter profile",
  "softer profile",
] as const;

export const URBAN_LIP_POOL = [
  "fuller lips",
  "medium lips",
  "thinner lips",
  "fuller lower lip",
  "fuller upper lip",
] as const;

export const URBAN_CHEEKBONE_POOL = [
  "high cheekbones",
  "softer cheekbones",
  "broad cheek structure",
  "subtle cheek structure",
] as const;

/** Facial-hair lanes — younger-biased with slight early-20s maturity. */
export const URBAN_FACIAL_HAIR_LANE_POOL = [
  "clean shaven",
  "faint moustache",
  "very light stubble",
  "light neat stubble",
  "short neat beard",
] as const;

export type UrbanFaceShape = (typeof URBAN_FACE_SHAPE_POOL)[number];
export type UrbanJawTrait = (typeof URBAN_JAW_POOL)[number];
export type UrbanEyeTrait = (typeof URBAN_EYE_POOL)[number];
export type UrbanNoseTrait = (typeof URBAN_NOSE_POOL)[number];
export type UrbanLipTrait = (typeof URBAN_LIP_POOL)[number];
export type UrbanCheekboneTrait = (typeof URBAN_CHEEKBONE_POOL)[number];
export type UrbanFacialHairLane = (typeof URBAN_FACIAL_HAIR_LANE_POOL)[number];

export type UrbanFaceIdentityRecipe = {
  faceShape: UrbanFaceShape;
  jaw: UrbanJawTrait;
  eyes: UrbanEyeTrait;
  nose: UrbanNoseTrait;
  lips: UrbanLipTrait;
  cheekbones: UrbanCheekboneTrait | null;
  /** Compact one-line prompt cue. */
  promptLine: string;
};

export type UrbanFaceIdentityRecipeSet = {
  version: typeof URBAN_FACE_IDENTITY_RECIPE_VERSION;
  creationProjectId: string;
  recipes: Record<DiscoverySlot, UrbanFaceIdentityRecipe>;
  facialHairLanes: Record<DiscoverySlot, UrbanFacialHairLane>;
  recentProjectsBiasedAgainst: string[];
  recentTraitUsage: {
    faceShape: Record<string, number>;
    jaw: Record<string, number>;
    eyes: Record<string, number>;
    nose: Record<string, number>;
  };
};

const SLOTS: DiscoverySlot[] = ["A", "B", "C", "D"];

const CLEAN_FACIAL_HAIR = new Set<UrbanFacialHairLane>([
  "clean shaven",
  "faint moustache",
  "very light stubble",
  "light neat stubble",
]);

const BEARDED_FACIAL_HAIR = new Set<UrbanFacialHairLane>([
  "short neat beard",
]);

/** Younger-biased weights — beard occasional; light neat stubble allowed. */
const FACIAL_HAIR_WEIGHTS: Record<UrbanFacialHairLane, number> = {
  "clean shaven": 32,
  "faint moustache": 24,
  "very light stubble": 22,
  "light neat stubble": 16,
  "short neat beard": 6,
};

function hashStringToUint32(input: string): number {
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

function formatFaceShapePhrase(shape: UrbanFaceShape): string {
  return shape.includes("face") ? shape : `${shape} face`;
}

/** Compact prompt line — high-level only, no millimeter essay. */
export function formatUrbanFaceIdentityPromptLine(
  recipe: Omit<UrbanFaceIdentityRecipe, "promptLine">,
): string {
  const eyePhrase =
    recipe.eyes.includes("eye") || recipe.eyes.includes("brow")
      ? recipe.eyes
      : `${recipe.eyes} eyes`;
  const parts = [
    formatFaceShapePhrase(recipe.faceShape),
    recipe.jaw,
    eyePhrase,
    recipe.nose,
    recipe.lips,
  ];
  if (recipe.cheekbones) parts.push(recipe.cheekbones);
  return `Distinct facial identity: ${parts.join(", ")}.`;
}

function comboKey(faceShape: string, jaw: string): string {
  return `${faceShape}|${jaw}`;
}

function countTraits(
  recipes: readonly UrbanFaceIdentityRecipe[],
): UrbanFaceIdentityRecipeSet["recentTraitUsage"] {
  const usage: UrbanFaceIdentityRecipeSet["recentTraitUsage"] = {
    faceShape: {},
    jaw: {},
    eyes: {},
    nose: {},
  };
  for (const r of recipes) {
    usage.faceShape[r.faceShape] = (usage.faceShape[r.faceShape] ?? 0) + 1;
    usage.jaw[r.jaw] = (usage.jaw[r.jaw] ?? 0) + 1;
    usage.eyes[r.eyes] = (usage.eyes[r.eyes] ?? 0) + 1;
    usage.nose[r.nose] = (usage.nose[r.nose] ?? 0) + 1;
  }
  return usage;
}

/**
 * Deterministic baseline recipes for a project (no cross-run bias).
 * Used to reconstruct recent-run trait usage without DB recipe storage.
 */
export function buildUrbanFaceIdentityRecipesBaseline(
  creationProjectId: string,
): Record<DiscoverySlot, UrbanFaceIdentityRecipe> {
  return pickUrbanFaceIdentityRecipes(creationProjectId, {
    recentProjectIds: [],
    avoidanceWeight: 0,
  }).recipes;
}

function weightForTrait(
  trait: string,
  usage: Record<string, number>,
  avoidanceWeight: number,
): number {
  const used = usage[trait] ?? 0;
  // Soft inverse-frequency bias — stronger when recent clusters repeated.
  const penalty = used * (1 + avoidanceWeight);
  return 1 / (1 + penalty);
}

function pickWeighted<T extends string>(
  pool: readonly T[],
  rng: () => number,
  usage: Record<string, number>,
  avoidanceWeight: number,
  forbidden: ReadonlySet<string>,
): T {
  const candidates = pool.filter((p) => !forbidden.has(p));
  const source = candidates.length > 0 ? candidates : [...pool];
  const weights = source.map((t) =>
    weightForTrait(t, usage, avoidanceWeight),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < source.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) return source[i]!;
  }
  return source[source.length - 1]!;
}

function ensureMinDistinct(
  values: string[],
  minDistinct: number,
): boolean {
  return new Set(values).size >= Math.min(minDistinct, values.length);
}

/**
 * Pick 4 faceIdentityRecipes for A/B/C/D with within-run separation and
 * optional cross-run anti-repeat bias from recent Urban projects.
 */
export function pickUrbanFaceIdentityRecipes(
  creationProjectId: string,
  options?: {
    recentProjectIds?: readonly string[];
    avoidanceWeight?: number;
  },
): UrbanFaceIdentityRecipeSet {
  const id = creationProjectId.trim();
  if (!id) {
    throw new Error("pickUrbanFaceIdentityRecipes requires creationProjectId");
  }

  const recentIds = (options?.recentProjectIds ?? [])
    .map((p) => p.trim())
    .filter((p) => p && p !== id);
  const avoidanceWeight = Math.max(0, options?.avoidanceWeight ?? 0);

  // Reconstruct prior recipes deterministically (baseline only — avoid recursion).
  const priorRecipes: UrbanFaceIdentityRecipe[] = [];
  for (const priorId of recentIds) {
    const prior = pickUrbanFaceIdentityRecipesCore(priorId, {
      usage: {
        faceShape: {},
        jaw: {},
        eyes: {},
        nose: {},
      },
      avoidanceWeight: 0,
    });
    for (const slot of SLOTS) priorRecipes.push(prior.recipes[slot]);
  }
  const usage = countTraits(priorRecipes);

  const core = pickUrbanFaceIdentityRecipesCore(id, {
    usage,
    avoidanceWeight,
  });

  return {
    version: URBAN_FACE_IDENTITY_RECIPE_VERSION,
    creationProjectId: id,
    recipes: core.recipes,
    facialHairLanes: core.facialHairLanes,
    recentProjectsBiasedAgainst: recentIds,
    recentTraitUsage: usage,
  };
}

function pickUrbanFaceIdentityRecipesCore(
  creationProjectId: string,
  bias: {
    usage: UrbanFaceIdentityRecipeSet["recentTraitUsage"];
    avoidanceWeight: number;
  },
): {
  recipes: Record<DiscoverySlot, UrbanFaceIdentityRecipe>;
  facialHairLanes: Record<DiscoverySlot, UrbanFacialHairLane>;
} {
  const rng = mulberry32(
    hashStringToUint32(`urban-face-identity-v1:${creationProjectId}`),
  );
  const { usage, avoidanceWeight } = bias;

  const usedShapes = new Set<string>();
  const usedJaws = new Set<string>();
  const usedCombos = new Set<string>();
  const usedEyes: string[] = [];
  const usedNoses: string[] = [];
  const usedLips = new Set<string>();
  const usedCheeks = new Set<string>();

  const recipes = {} as Record<DiscoverySlot, UrbanFaceIdentityRecipe>;

  for (const slot of SLOTS) {
    let faceShape: UrbanFaceShape = URBAN_FACE_SHAPE_POOL[0]!;
    let jaw: UrbanJawTrait = URBAN_JAW_POOL[0]!;
    let guard = 0;
    do {
      faceShape = pickWeighted(
        URBAN_FACE_SHAPE_POOL,
        rng,
        usage.faceShape,
        avoidanceWeight,
        usedShapes,
      );
      jaw = pickWeighted(
        URBAN_JAW_POOL,
        rng,
        usage.jaw,
        avoidanceWeight,
        usedJaws,
      );
      guard += 1;
    } while (usedCombos.has(comboKey(faceShape, jaw)) && guard < 24);

    usedShapes.add(faceShape);
    usedJaws.add(jaw);
    usedCombos.add(comboKey(faceShape, jaw));

    // Prefer unused eyes/noses until we have ≥3 distinct patterns.
    const eyeForbidden =
      usedEyes.length >= 3
        ? new Set<string>()
        : new Set(usedEyes);
    const noseForbidden =
      usedNoses.length >= 3
        ? new Set<string>()
        : new Set(usedNoses);

    const eyes = pickWeighted(
      URBAN_EYE_POOL,
      rng,
      usage.eyes,
      avoidanceWeight,
      eyeForbidden,
    );
    const nose = pickWeighted(
      URBAN_NOSE_POOL,
      rng,
      usage.nose,
      avoidanceWeight,
      noseForbidden,
    );
    usedEyes.push(eyes);
    usedNoses.push(nose);

    const lips = pickWeighted(
      URBAN_LIP_POOL,
      rng,
      {},
      0,
      usedLips.size < URBAN_LIP_POOL.length ? usedLips : new Set(),
    );
    usedLips.add(lips);

    // Optional cheekbones — include for most slots (~75%).
    const includeCheeks = rng() < 0.75 || slot === "A" || slot === "D";
    let cheekbones: UrbanCheekboneTrait | null = null;
    if (includeCheeks) {
      cheekbones = pickWeighted(
        URBAN_CHEEKBONE_POOL,
        rng,
        {},
        0,
        usedCheeks.size < URBAN_CHEEKBONE_POOL.length
          ? usedCheeks
          : new Set(),
      );
      usedCheeks.add(cheekbones);
    }

    const draft = { faceShape, jaw, eyes, nose, lips, cheekbones };
    recipes[slot] = {
      ...draft,
      promptLine: formatUrbanFaceIdentityPromptLine(draft),
    };
  }

  // Within-run soft repair: ensure ≥3 eye and nose patterns.
  repairMinDistinctAxis(recipes, "eyes", URBAN_EYE_POOL, rng, 3);
  repairMinDistinctAxis(recipes, "nose", URBAN_NOSE_POOL, rng, 3);

  const facialHairLanes = pickUrbanFacialHairLanes(rng);

  // Sanity — face shapes must all differ.
  if (new Set(SLOTS.map((s) => recipes[s].faceShape)).size < 4) {
    forceUniqueFaceShapes(recipes, rng);
  }
  if (new Set(SLOTS.map((s) => recipes[s].jaw)).size < 4) {
    forceUniqueJaws(recipes, rng);
  }

  return { recipes, facialHairLanes };
}

function repairMinDistinctAxis(
  recipes: Record<DiscoverySlot, UrbanFaceIdentityRecipe>,
  axis: "eyes" | "nose",
  pool: readonly UrbanEyeTrait[] | readonly UrbanNoseTrait[],
  rng: () => number,
  minDistinct: number,
): void {
  const current = SLOTS.map((s) => recipes[s][axis]);
  if (ensureMinDistinct(current, minDistinct)) return;

  const used = new Set(current);
  for (const slot of SLOTS) {
    if (ensureMinDistinct(SLOTS.map((s) => recipes[s][axis]), minDistinct)) {
      break;
    }
    const available = pool.filter((p) => !used.has(p));
    if (available.length === 0) break;
    const pick = available[Math.floor(rng() * available.length)]!;
    used.add(pick);
    if (axis === "eyes") {
      const next = {
        ...recipes[slot],
        eyes: pick as UrbanEyeTrait,
      };
      recipes[slot] = {
        ...next,
        promptLine: formatUrbanFaceIdentityPromptLine(next),
      };
    } else {
      const next = {
        ...recipes[slot],
        nose: pick as UrbanNoseTrait,
      };
      recipes[slot] = {
        ...next,
        promptLine: formatUrbanFaceIdentityPromptLine(next),
      };
    }
  }
}

function forceUniqueFaceShapes(
  recipes: Record<DiscoverySlot, UrbanFaceIdentityRecipe>,
  rng: () => number,
): void {
  const bag = [...URBAN_FACE_SHAPE_POOL];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }
  for (let i = 0; i < SLOTS.length; i += 1) {
    const slot = SLOTS[i]!;
    const next = { ...recipes[slot], faceShape: bag[i]! };
    recipes[slot] = {
      ...next,
      promptLine: formatUrbanFaceIdentityPromptLine(next),
    };
  }
}

function forceUniqueJaws(
  recipes: Record<DiscoverySlot, UrbanFaceIdentityRecipe>,
  rng: () => number,
): void {
  const bag = [...URBAN_JAW_POOL];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }
  for (let i = 0; i < SLOTS.length; i += 1) {
    const slot = SLOTS[i]!;
    const next = { ...recipes[slot], jaw: bag[i]! };
    recipes[slot] = {
      ...next,
      promptLine: formatUrbanFaceIdentityPromptLine(next),
    };
  }
}

/**
 * Facial hair for A/B/C/D — younger bias with slight early-20s maturity.
 * Most: clean shaven / faint moustache / very light or light neat stubble.
 * Occasionally: short neat beard (never heavy).
 */
export function pickUrbanFacialHairLanes(
  rng: () => number,
): Record<DiscoverySlot, UrbanFacialHairLane> {
  const used = new Set<string>();
  const lanes: UrbanFacialHairLane[] = [];
  let beardUsed = false;

  for (let i = 0; i < 4; i += 1) {
    const pool = URBAN_FACIAL_HAIR_LANE_POOL.filter((lane) => {
      if (beardUsed && BEARDED_FACIAL_HAIR.has(lane)) return false;
      return true;
    });
    const weights = pool.map((lane) => {
      let w = FACIAL_HAIR_WEIGHTS[lane];
      // Prefer unused younger options within the run.
      if (used.has(lane) && CLEAN_FACIAL_HAIR.has(lane)) w *= 0.55;
      return w;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * total;
    let pick = pool[pool.length - 1]!;
    for (let j = 0; j < pool.length; j += 1) {
      roll -= weights[j]!;
      if (roll <= 0) {
        pick = pool[j]!;
        break;
      }
    }
    if (BEARDED_FACIAL_HAIR.has(pick)) beardUsed = true;
    used.add(pick);
    lanes.push(pick);
  }

  // Never all bearded; prefer at least three younger/clean-family looks.
  const beardedCount = lanes.filter((l) => BEARDED_FACIAL_HAIR.has(l)).length;
  if (beardedCount > 1) {
    for (let i = 0; i < lanes.length && beardedCount > 1; i += 1) {
      if (BEARDED_FACIAL_HAIR.has(lanes[i]!)) {
        lanes[i] = "clean shaven";
        break;
      }
    }
  }

  return {
    A: lanes[0]!,
    B: lanes[1]!,
    C: lanes[2]!,
    D: lanes[3]!,
  };
}

/** Assert within-run separation rules for tests / debug. */
export function assertUrbanFaceIdentityWithinRunSeparation(
  recipes: Record<DiscoverySlot, UrbanFaceIdentityRecipe>,
): {
  faceShapesDistinct: boolean;
  jawsDistinct: boolean;
  eyePatterns: number;
  nosePatterns: number;
  ok: boolean;
} {
  const shapes = SLOTS.map((s) => recipes[s].faceShape);
  const jaws = SLOTS.map((s) => recipes[s].jaw);
  const eyes = SLOTS.map((s) => recipes[s].eyes);
  const noses = SLOTS.map((s) => recipes[s].nose);
  const faceShapesDistinct = new Set(shapes).size === 4;
  const jawsDistinct = new Set(jaws).size === 4;
  const eyePatterns = new Set(eyes).size;
  const nosePatterns = new Set(noses).size;
  return {
    faceShapesDistinct,
    jawsDistinct,
    eyePatterns,
    nosePatterns,
    ok:
      faceShapesDistinct &&
      jawsDistinct &&
      eyePatterns >= 3 &&
      nosePatterns >= 3,
  };
}
