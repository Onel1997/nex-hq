/**
 * Phase 2.2A — Discovery run state machine.
 *
 * READY = 4 allowed/selectable candidates.
 * READY_PARTIAL = budget exhausted with 1–3 allowed.
 * FAILED = technical workflow failure (not biological rejection).
 */

export const DISCOVERY_RUN_STATES = [
  "preparing",
  "generating",
  "evaluating",
  "resolving_duplicates",
  "ready",
  "ready_partial",
  "failed",
] as const;

export type DiscoveryRunState = (typeof DISCOVERY_RUN_STATES)[number];

export type DiscoveryAttemptStatus =
  | "planned"
  | "generating"
  | "evaluating"
  | "allowed"
  | "blocked"
  | "failed"
  | "superseded"
  | "timeout";

export function isTerminalDiscoveryRunState(state: DiscoveryRunState): boolean {
  return state === "ready" || state === "ready_partial" || state === "failed";
}

export function resolveDiscoveryRunState(input: {
  allowedCount: number;
  technicalFailure?: boolean;
  budgetExhausted: boolean;
  slotsTarget?: number;
}): DiscoveryRunState {
  const target = input.slotsTarget ?? 4;
  if (input.technicalFailure) return "failed";
  if (input.allowedCount >= target) return "ready";
  if (input.budgetExhausted && input.allowedCount >= 1) return "ready_partial";
  if (input.budgetExhausted && input.allowedCount === 0) return "failed";
  return "resolving_duplicates";
}

/** Biological face rejection is a normal casting rejection — not GENERATION_FAILED. */
export function isBiologicalCastingRejection(noveltyDecision: string | null | undefined): boolean {
  return (
    noveltyDecision === "face_similarity_duplicate" ||
    noveltyDecision === "novelty_blocked" ||
    noveltyDecision === "blocked"
  );
}
