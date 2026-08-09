/**
 * Phase 2.3D.7 — Controlled inverted provider-direction fallback.
 *
 * Canonical requested_slot never changes.
 * Provider may be instructed with the opposite L/R direction when
 * repeated actual-image validation shows consistent inversion.
 * Post-generation landmark validation always judges the CANONICAL slot.
 */

import type { DetectedOrientation } from "./orientation-from-landmarks";
import type { ReferencePackageSlot } from "./slots";
import { REFERENCE_PACKAGE_SLOT_LABELS } from "./slots";
import type { ReferencePackageAttempt } from "./types";

export const PROVIDER_DIRECTION_STRATEGIES = [
  "canonical",
  "inverted_fallback",
] as const;

export type ProviderDirectionStrategy =
  (typeof PROVIDER_DIRECTION_STRATEGIES)[number];

/** Direction instruction sent to the provider (same vocabulary as slots). */
export type ProviderRequestedDirection = ReferencePackageSlot;

export const DIRECTION_FALLBACK_POLICY_VERSION =
  "provider-direction-inverted-fallback-v1.0.0" as const;

/** Max validated canonical-direction attempts before inverted path. */
export const MAX_CANONICAL_DIRECTION_ATTEMPTS = 2;

/** Max inverted-fallback attempts after activation. */
export const MAX_INVERTED_FALLBACK_ATTEMPTS = 2;

export const DIRECTION_GENERATION_UNRELIABLE_MESSAGE =
  "OpenAI could not reliably produce this camera direction." as const;

export const INVERTED_FALLBACK_REASON =
  "OpenAI produced the opposite validated orientation on the previous repeated attempts." as const;

const INVERTIBLE_PAIRS: ReadonlyArray<
  readonly [ReferencePackageSlot, ReferencePackageSlot]
> = [
  ["three_quarter_left", "three_quarter_right"],
  ["left_profile", "right_profile"],
];

/**
 * Opposite semantic direction for provider instruction.
 * FRONT never inverts.
 */
export function invertProviderDirection(
  slot: ReferencePackageSlot,
): ReferencePackageSlot | null {
  if (slot === "front") return null;
  for (const [a, b] of INVERTIBLE_PAIRS) {
    if (slot === a) return b;
    if (slot === b) return a;
  }
  return null;
}

/** Orientations that mean the provider produced the opposite of `slot`. */
export function oppositeOrientationsForSlot(
  slot: ReferencePackageSlot,
): DetectedOrientation[] {
  switch (slot) {
    case "front":
      return [];
    case "three_quarter_left":
      return ["image_right"];
    case "three_quarter_right":
      return ["image_left"];
    case "left_profile":
      return ["profile_right", "image_right"];
    case "right_profile":
      return ["profile_left", "image_left"];
  }
}

export function isOppositeOrientationFailure(input: {
  slot: ReferencePackageSlot;
  angle_direction: string | null | undefined;
  detected_orientation: DetectedOrientation | null | undefined;
}): boolean {
  if (input.angle_direction !== "incorrect") return false;
  if (!input.detected_orientation || input.detected_orientation === "uncertain") {
    return false;
  }
  return oppositeOrientationsForSlot(input.slot).includes(
    input.detected_orientation,
  );
}

function attemptStrategy(
  attempt: Pick<ReferencePackageAttempt, "provider_direction_strategy">,
): ProviderDirectionStrategy {
  return attempt.provider_direction_strategy === "inverted_fallback"
    ? "inverted_fallback"
    : "canonical";
}

/**
 * Attempts that carry Phase 2.3D.6 actual-image orientation evidence
 * for the given canonical requested slot (never mutates history).
 */
export function validatedAttemptsForCanonicalSlot(
  attempts: readonly ReferencePackageAttempt[],
  slot: ReferencePackageSlot,
): ReferencePackageAttempt[] {
  return attempts
    .filter(
      (a) =>
        a.reference_slot === slot &&
        a.detected_orientation != null &&
        a.angle_direction != null,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export type ProviderDirectionPlan = {
  policyVersion: typeof DIRECTION_FALLBACK_POLICY_VERSION;
  /** Canonical Reference Package slot — never rewritten. */
  requested_slot: ReferencePackageSlot;
  provider_direction_strategy: ProviderDirectionStrategy;
  provider_requested_direction: ProviderRequestedDirection;
  invertedFallbackEligible: boolean;
  direction_generation_unreliable: boolean;
  reason: string | null;
  /** Human-readable disclosure for prepare confirmation. */
  disclosure: {
    targetSlotLabel: string;
    directionStrategyLabel: string;
    reason: string | null;
    providerInstructionNote: string;
    finalAcceptanceNote: string;
  };
  counts: {
    canonicalValidated: number;
    invertedValidated: number;
    recentOppositeIncorrect: number;
  };
  allowPaidRegeneration: boolean;
};

function buildDisclosure(plan: {
  requested_slot: ReferencePackageSlot;
  provider_direction_strategy: ProviderDirectionStrategy;
  provider_requested_direction: ProviderRequestedDirection;
  direction_generation_unreliable: boolean;
  reason: string | null;
}): ProviderDirectionPlan["disclosure"] {
  const targetSlotLabel = REFERENCE_PACKAGE_SLOT_LABELS[plan.requested_slot];
  if (plan.direction_generation_unreliable) {
    return {
      targetSlotLabel,
      directionStrategyLabel: "Stopped — direction unreliable",
      reason: DIRECTION_GENERATION_UNRELIABLE_MESSAGE,
      providerInstructionNote: "No further automatic paid retries.",
      finalAcceptanceNote: `Manual upload, keep slot incomplete, or use another supported reference workflow later.`,
    };
  }
  if (plan.provider_direction_strategy === "inverted_fallback") {
    return {
      targetSlotLabel,
      directionStrategyLabel: "Inverted provider fallback",
      reason: plan.reason ?? INVERTED_FALLBACK_REASON,
      providerInstructionNote: "Opposite direction requested internally",
      finalAcceptanceNote: `Actual image orientation will still be validated against ${targetSlotLabel}.`,
    };
  }
  return {
    targetSlotLabel,
    directionStrategyLabel: "Canonical",
    reason: null,
    providerInstructionNote: "Canonical direction requested",
    finalAcceptanceNote: `Actual image orientation will be validated against ${targetSlotLabel}.`,
  };
}

/**
 * Decide provider direction for the NEXT regeneration of a canonical slot.
 * Prepare must call this — zero provider calls.
 */
export function resolveProviderDirectionPlan(
  attempts: readonly ReferencePackageAttempt[],
  slot: ReferencePackageSlot,
): ProviderDirectionPlan {
  const validated = validatedAttemptsForCanonicalSlot(attempts, slot);
  const canonicalValidated = validated.filter(
    (a) => attemptStrategy(a) === "canonical",
  );
  const invertedValidated = validated.filter(
    (a) => attemptStrategy(a) === "inverted_fallback",
  );

  const recentOpposite = [...canonicalValidated]
    .reverse()
    .filter((a) =>
      isOppositeOrientationFailure({
        slot,
        angle_direction: a.angle_direction,
        detected_orientation: a.detected_orientation,
      }),
    );

  // Need at least 2 recent opposite-incorrect canonical attempts (not first fail).
  const invertedFallbackEligible =
    slot !== "front" &&
    invertProviderDirection(slot) != null &&
    recentOpposite.length >= 2 &&
    // The two most recent opposite failures among canonical validated history
    // — require the last two canonical validated (when >=2) to both be opposite,
    // OR at least two opposite failures exist in recent canonical history.
    (() => {
      if (canonicalValidated.length < 2) return false;
      const lastTwo = canonicalValidated.slice(-2);
      return lastTwo.every((a) =>
        isOppositeOrientationFailure({
          slot,
          angle_direction: a.angle_direction,
          detected_orientation: a.detected_orientation,
        }),
      );
    })();

  const invertedExhausted =
    invertedValidated.length >= MAX_INVERTED_FALLBACK_ATTEMPTS &&
    invertedValidated
      .slice(-MAX_INVERTED_FALLBACK_ATTEMPTS)
      .every((a) => a.angle_direction !== "correct");

  const canonicalExhaustedWithoutInvertPath =
    canonicalValidated.length >= MAX_CANONICAL_DIRECTION_ATTEMPTS &&
    !invertedFallbackEligible &&
    invertedValidated.length === 0 &&
    canonicalValidated.every((a) => a.angle_direction !== "correct");

  const direction_generation_unreliable =
    invertedExhausted || canonicalExhaustedWithoutInvertPath;

  let provider_direction_strategy: ProviderDirectionStrategy = "canonical";
  let provider_requested_direction: ProviderRequestedDirection = slot;
  let reason: string | null = null;

  if (direction_generation_unreliable) {
    provider_direction_strategy = "canonical";
    provider_requested_direction = slot;
    reason = DIRECTION_GENERATION_UNRELIABLE_MESSAGE;
  } else if (
    invertedFallbackEligible &&
    invertedValidated.length < MAX_INVERTED_FALLBACK_ATTEMPTS
  ) {
    const inverted = invertProviderDirection(slot);
    if (inverted) {
      provider_direction_strategy = "inverted_fallback";
      provider_requested_direction = inverted;
      reason = INVERTED_FALLBACK_REASON;
    }
  } else {
    provider_direction_strategy = "canonical";
    provider_requested_direction = slot;
  }

  const planCore = {
    requested_slot: slot,
    provider_direction_strategy,
    provider_requested_direction,
    direction_generation_unreliable,
    reason,
  };

  return {
    policyVersion: DIRECTION_FALLBACK_POLICY_VERSION,
    ...planCore,
    invertedFallbackEligible,
    counts: {
      canonicalValidated: canonicalValidated.length,
      invertedValidated: invertedValidated.length,
      recentOppositeIncorrect: recentOpposite.length,
    },
    allowPaidRegeneration: !direction_generation_unreliable,
    disclosure: buildDisclosure(planCore),
  };
}

export function isProviderDirectionStrategy(
  value: string | null | undefined,
): value is ProviderDirectionStrategy {
  return (
    value === "canonical" || value === "inverted_fallback"
  );
}
