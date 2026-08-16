/**
 * Phase 2.5B.5 — Urban Community Hero face diversity (fresh-run, simplified).
 *
 * Light A/B/C/D cues only. Hair + mood come from per-project fresh-run recipe.
 * No provider calls.
 */

import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";
import type { ControlledPoolKey } from "@/lib/persona/identity-blueprints/types";
import {
  SAME_RUN_AVOID_AXES,
  countSameRunAxisDiffs,
} from "@/lib/persona/identity-blueprints/attempt-diversity";
import type { UrbanFreshRunRecipe } from "./urban-fresh-run-casting";
import {
  URBAN_SLOT_MOODS,
  buildUrbanFreshRunRecipe,
} from "./urban-fresh-run-casting";

/**
 * @deprecated Phase 2.5B.5 — fixed short-hair defaults. Prefer buildUrbanFreshRunRecipe().
 * Kept for Mediterranean/camera helpers that still import the symbol.
 */
export const URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES = {
  A: "short textured curls + low taper",
  B: "very short crop / buzz-adjacent + clean fade",
  C: "short natural curls with slightly fuller top",
  D: "short textured afro / neat natural texture",
} as const;

/**
 * @deprecated Phase 2.5B.5 — do not inject fixed anatomy into Urban prompts.
 * Prefer mood labels from URBAN_SLOT_MOODS / fresh-run recipe.
 */
export const URBAN_CASTING_DIVERSITY_FACE_GEOMETRY = {
  A: "softer oval face, softer jaw, fuller lips",
  B: "longer narrow oval, more defined jaw, thinner lips",
  C: "heart / tapered face, higher cheekbones, fuller upper lip",
  D: "broader rectangular face, wider jaw, stronger chin",
} as const;

/** Compact exclusions — keep short; optional soft cues only. */
export const URBAN_CROSS_SLOT_EXCLUSIONS: Record<
  DiscoverySlot,
  readonly string[]
> = {
  A: ["not the same person as B", "not the same person as C", "not the same person as D"],
  B: ["not the same person as A", "not the same person as C", "not the same person as D"],
  C: ["not the same person as A", "not the same person as B", "not the same person as D"],
  D: ["not the same person as A", "not the same person as B", "not the same person as C"],
};

/** Soft DNA axes for light pre-check only. */
export const URBAN_SIBLING_DNA_AXES = [
  "faceGeometry",
  "jaw",
  "noseWidth",
  "eyeSpacing",
  "lips",
  "hairline",
] as const satisfies readonly ControlledPoolKey[];

/** Soft minimum — avoid forcing near-identical L3 recipes, not micro-anatomy. */
export const URBAN_MIN_SIBLING_DNA_DIFFS = 3;

export type UrbanAnatomySample = Partial<Record<ControlledPoolKey, string>>;

export type UrbanSiblingDnaReport = {
  slot: DiscoverySlot;
  baseFaceGeometry: string;
  retryNumber: number;
  diversityEscalationLevel: number;
  siblingSlotsConsidered: DiscoverySlot[];
  siblingCandidateIds: string[];
  overlapTooHigh: boolean;
  minDiffsRequired: number;
  maxOverlapDiffsObserved: number | null;
  mutatedBeforeProvider: boolean;
};

export type UrbanFaceDiversityDebug = UrbanSiblingDnaReport & {
  noveltyResult?: string | null;
  similarityEvidence?: {
    closestPriorCandidateId?: string | null;
    similarity?: number | null;
  } | null;
  variationSeed?: string;
  hairLane?: string;
};

/** Compact candidate-specific Urban face lock for the prompt layer. */
export function urbanSlotFaceDiversityBlock(
  slot: DiscoverySlot,
  options?: {
    escalationLevel?: number;
    /** @deprecated 2.5B.5 — do not inject prior candidate geometry descriptions. */
    siblingGeometries?: readonly string[];
    recipe?: UrbanFreshRunRecipe | null;
    creationProjectId?: string;
  },
): string {
  const escalation = options?.escalationLevel ?? 0;
  const recipe =
    options?.recipe ??
    (options?.creationProjectId
      ? buildUrbanFreshRunRecipe(options.creationProjectId)
      : null);
  const cue = recipe?.slots[slot];
  const hair = cue?.hairLabel ?? URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES[slot];
  const mood = cue?.mood ?? URBAN_SLOT_MOODS[slot];

  const lines = [
    `URBAN SLOT ${slot} — ${mood}`,
    `Hair for this run: ${hair}`,
    cue
      ? `Light cues: ${cue.facialEmphasis}; ${cue.faceShapeMood}; ${cue.skinUndertone}; ${cue.facialHair}; ${cue.expression}.`
      : "Natural commercial casting portrait.",
    recipe?.freshFaceDirection
      ? `Fresh face: ${recipe.freshFaceDirection}`
      : "Create a clearly different person from the other board slots.",
    "Do NOT force detailed jaw / nose / lip / eye micro-geometry.",
    "Creative freedom within Black / Afro-European male streetwear casting.",
  ];

  if (escalation > 0) {
    lines.push(urbanSiblingSeparationEscalationSuffix(slot, escalation));
  }

  return lines.join("\n");
}

/**
 * Retry instruction — simple, not escalating anatomy essays.
 */
export function urbanSiblingSeparationEscalationSuffix(
  slot: DiscoverySlot,
  escalationLevel: number,
): string {
  const level = Math.max(1, Math.min(escalationLevel, 5));
  return [
    `RETRY ${level} — SLOT ${slot}`,
    "Generate a clearly different person from the existing candidates.",
    "Change hairstyle, undertone, expression, and overall face impression.",
  ].join("\n");
}

export function diversityEscalationLevelFromAttempt(
  attemptNumber: number,
): number {
  if (attemptNumber <= 1) return 0;
  return Math.min(5, attemptNumber - 1);
}

export function countUrbanSiblingDnaDiffs(
  current: UrbanAnatomySample,
  sibling: UrbanAnatomySample,
): number {
  let diffs = 0;
  for (const axis of URBAN_SIBLING_DNA_AXES) {
    const a = current[axis]?.trim().toLowerCase();
    const b = sibling[axis]?.trim().toLowerCase();
    if (!a || !b) continue;
    if (a !== b) diffs += 1;
  }
  return diffs;
}

export function urbanSiblingDnaOverlapTooHigh(
  current: UrbanAnatomySample,
  siblings: readonly UrbanAnatomySample[],
): { tooHigh: boolean; maxDiffsObserved: number | null } {
  if (siblings.length === 0) {
    return { tooHigh: false, maxDiffsObserved: null };
  }
  let minDiffs = Number.POSITIVE_INFINITY;
  for (const sibling of siblings) {
    const diffs = countUrbanSiblingDnaDiffs(current, sibling);
    if (diffs < minDiffs) minDiffs = diffs;
  }
  const maxDiffsObserved = Number.isFinite(minDiffs) ? minDiffs : null;
  return {
    tooHigh:
      maxDiffsObserved != null &&
      maxDiffsObserved < URBAN_MIN_SIBLING_DNA_DIFFS,
    maxDiffsObserved,
  };
}

export function mergeSiblingAvoidSamples(
  samples: readonly UrbanAnatomySample[],
): UrbanAnatomySample | null {
  if (samples.length === 0) return null;
  const merged: UrbanAnatomySample = {};
  for (const sample of samples) {
    for (const axis of SAME_RUN_AVOID_AXES) {
      if (!merged[axis] && sample[axis]) merged[axis] = sample[axis];
    }
    for (const axis of URBAN_SIBLING_DNA_AXES) {
      if (!merged[axis] && sample[axis]) merged[axis] = sample[axis];
    }
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

export function extractUrbanGeometryCue(
  sample: UrbanAnatomySample | null | undefined,
): string | null {
  const geo = sample?.faceGeometry?.trim();
  return geo ? geo : null;
}

export function anatomySampleFromDiscoveryInstance(input: {
  faceGeometry?: string;
  [key: string]: unknown;
}): UrbanAnatomySample {
  const out: UrbanAnatomySample = {};
  for (const axis of URBAN_SIBLING_DNA_AXES) {
    const v = input[axis];
    if (typeof v === "string" && v.trim()) out[axis] = v;
  }
  if (
    typeof input.faceGeometry === "string" &&
    input.faceGeometry.trim() &&
    !out.faceGeometry
  ) {
    out.faceGeometry = input.faceGeometry;
  }
  return out;
}

export function buildUrbanSiblingDnaReport(input: {
  slot: DiscoverySlot;
  retryNumber: number;
  siblingSlots: readonly DiscoverySlot[];
  siblingCandidateIds: readonly string[];
  currentSample: UrbanAnatomySample;
  siblingSamples: readonly UrbanAnatomySample[];
  mutatedBeforeProvider: boolean;
  recipe?: UrbanFreshRunRecipe | null;
}): UrbanFaceDiversityDebug {
  const overlap = urbanSiblingDnaOverlapTooHigh(
    input.currentSample,
    input.siblingSamples,
  );
  const cue = input.recipe?.slots[input.slot];
  return {
    slot: input.slot,
    baseFaceGeometry:
      cue?.faceShapeMood ?? URBAN_CASTING_DIVERSITY_FACE_GEOMETRY[input.slot],
    retryNumber: input.retryNumber,
    diversityEscalationLevel: diversityEscalationLevelFromAttempt(
      input.retryNumber,
    ),
    siblingSlotsConsidered: [...input.siblingSlots],
    siblingCandidateIds: [...input.siblingCandidateIds],
    overlapTooHigh: overlap.tooHigh,
    minDiffsRequired: URBAN_MIN_SIBLING_DNA_DIFFS,
    maxOverlapDiffsObserved: overlap.maxDiffsObserved,
    mutatedBeforeProvider: input.mutatedBeforeProvider,
    variationSeed: input.recipe?.variationSeed,
    hairLane: cue?.hairLabel,
  };
}

/** Re-export for callers that count same-run axis diffs on Urban samples. */
export { countSameRunAxisDiffs };
