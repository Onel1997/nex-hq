/**
 * Phase 2.1E — Attempt-aware L3 diversity for novelty replacement retries.
 * Sampling / prompt diversity only — never uses face embeddings in prompts.
 */

import {
  type ControlledPoolKey,
  type DiscoveryIdentityInstance,
  IdentityBlueprintError,
} from "./types";

/** Axes that must rotate across Slot A / novelty replacement attempts. */
export const RETRY_DIVERSITY_AXES = [
  "faceGeometry",
  "eyeSpacing",
  "noseBridge",
  "noseWidth",
  "jaw",
  "hairline",
  "haircut",
  "beardPattern",
  "optionalMicroMarks",
] as const satisfies readonly ControlledPoolKey[];

export type RetryDiversityAxis = (typeof RETRY_DIVERSITY_AXES)[number];

/** Minimum axes that must differ from the previous attempt when attemptNumber > 1. */
export const MIN_RETRY_AXIS_DIFFS = 5;

/**
 * Historical Soft Luxury cluster (July 29 Slot A) — avoid on attempts ≥ 3.
 * Matched as case-insensitive substring against sampled attribute text.
 */
export const HISTORICAL_SOFT_LUXURY_CLUSTER_MARKERS: readonly {
  axis: ControlledPoolKey;
  markers: readonly string[];
}[] = [
  {
    axis: "faceGeometry",
    markers: ["soft oval", "rounded temples", "calm temple curves"],
  },
  {
    axis: "noseBridge",
    markers: ["narrow straight", "slim straight", "narrow elegant bridge"],
  },
  {
    axis: "noseWidth",
    markers: ["narrow alar", "delicate nostrils", "slim alar", "delicate narrow"],
  },
  {
    axis: "eyeShape",
    markers: ["soft almond", "luminous soft lid", "softly open lids"],
  },
  {
    axis: "jaw",
    markers: ["refined elegant jaw", "refined tapered", "soft masculine angle"],
  },
  {
    axis: "haircut",
    markers: ["textured soft taper", "soft taper"],
  },
  {
    axis: "optionalMicroMarks",
    markers: ["freckling across nose bridge", "faint freckling"],
  },
];

export type AnatomySampleAttrs = Pick<
  DiscoveryIdentityInstance,
  | "faceGeometry"
  | "eyeSpacing"
  | "eyeShape"
  | "noseBridge"
  | "noseWidth"
  | "noseTip"
  | "jaw"
  | "chin"
  | "hairline"
  | "haircut"
  | "beardPattern"
  | "optionalMicroMarks"
  | "facialRatioVariant"
  | "forehead"
  | "eyebrows"
  | "asymmetry"
>;

export function countRetryAxisDiffs(
  current: Partial<Record<RetryDiversityAxis, string>>,
  previous: Partial<Record<RetryDiversityAxis, string>>,
): number {
  let diffs = 0;
  for (const axis of RETRY_DIVERSITY_AXES) {
    const a = current[axis]?.trim();
    const b = previous[axis]?.trim();
    if (!a || !b) continue;
    if (a !== b) diffs += 1;
  }
  return diffs;
}

export function matchesHistoricalSoftLuxuryCluster(
  sample: Partial<Record<ControlledPoolKey, string>>,
): boolean {
  let hits = 0;
  for (const rule of HISTORICAL_SOFT_LUXURY_CLUSTER_MARKERS) {
    const value = (sample[rule.axis] ?? "").toLowerCase();
    if (!value) continue;
    if (rule.markers.some((m) => value.includes(m.toLowerCase()))) {
      hits += 1;
    }
  }
  // Cluster hit when a majority of historical markers appear together.
  return hits >= 4;
}

export function assertRetryAxisDiversity(input: {
  attemptNumber: number;
  current: Partial<Record<RetryDiversityAxis, string>>;
  previous: Partial<Record<RetryDiversityAxis, string>> | null | undefined;
}): void {
  if (input.attemptNumber <= 1 || !input.previous) return;
  const diffs = countRetryAxisDiffs(input.current, input.previous);
  if (diffs < MIN_RETRY_AXIS_DIFFS) {
    throw new IdentityBlueprintError(
      `Retry diversity requires at least ${MIN_RETRY_AXIS_DIFFS} of ${RETRY_DIVERSITY_AXES.length} axes to differ (got ${diffs})`,
      { diffs, attemptNumber: input.attemptNumber },
    );
  }
}

export function assertAvoidsHistoricalSoftLuxuryCluster(input: {
  attemptNumber: number;
  slot: string;
  sample: Partial<Record<ControlledPoolKey, string>>;
}): void {
  if (input.slot !== "A" || input.attemptNumber < 3) return;
  if (matchesHistoricalSoftLuxuryCluster(input.sample)) {
    throw new IdentityBlueprintError(
      `Slot A attempt ${input.attemptNumber} must avoid the historical Soft Luxury cluster`,
      { attemptNumber: input.attemptNumber },
    );
  }
}

/** High-leverage key subset used for same-run collision avoidance. */
export const SAME_RUN_AVOID_AXES = [
  "faceGeometry",
  "eyeSpacing",
  "noseBridge",
  "noseWidth",
  "jaw",
  "hairline",
  "haircut",
  "beardPattern",
] as const satisfies readonly ControlledPoolKey[];

export function countSameRunAxisDiffs(
  current: Partial<Record<ControlledPoolKey, string>>,
  matched: Partial<Record<ControlledPoolKey, string>>,
): number {
  let diffs = 0;
  for (const axis of SAME_RUN_AVOID_AXES) {
    const a = current[axis]?.trim();
    const b = matched[axis]?.trim();
    if (!a || !b) continue;
    if (a !== b) diffs += 1;
  }
  return diffs;
}

export function assertSameRunCollisionDiversity(input: {
  current: Partial<Record<ControlledPoolKey, string>>;
  matchedSameRun: Partial<Record<ControlledPoolKey, string>> | null | undefined;
}): void {
  if (!input.matchedSameRun) return;
  const diffs = countSameRunAxisDiffs(input.current, input.matchedSameRun);
  if (diffs < MIN_RETRY_AXIS_DIFFS) {
    throw new IdentityBlueprintError(
      `Same-run collision retry must differ on at least ${MIN_RETRY_AXIS_DIFFS} high-leverage axes from the matched slot (got ${diffs})`,
      { diffs },
    );
  }
}
