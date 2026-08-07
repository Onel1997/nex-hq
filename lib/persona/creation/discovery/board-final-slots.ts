/**
 * Phase 2.2A — final Candidate Board slots from the current discovery run only.
 * Never substitutes stale/previous-run candidates.
 */

import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";
import type { DiscoveryAttemptRecord } from "./attempt-types";

export type FinalBoardCard = {
  slot: DiscoverySlot;
  lane: DiscoverySlot;
  candidateId: string;
  assetId: string | null;
  provider: string;
  generationAttempt: number;
  noveltyStatus: "allowed";
  similaritySummary: string | null;
  selectable: true;
  generationRunId: string;
  creationProjectId: string;
};

export function buildFinalDiscoveryBoard(input: {
  generationRunId: string;
  creationProjectId: string;
  attempts: readonly DiscoveryAttemptRecord[];
}): {
  cards: FinalBoardCard[];
  historyBlocked: DiscoveryAttemptRecord[];
  ready: boolean;
  readyPartial: boolean;
} {
  const slots: DiscoverySlot[] = ["A", "B", "C", "D"];
  const cards: FinalBoardCard[] = [];
  const historyBlocked: DiscoveryAttemptRecord[] = [];

  for (const slot of slots) {
    const slotAttempts = input.attempts
      .filter(
        (a) =>
          a.slot === slot &&
          a.generationRunId === input.generationRunId &&
          a.creationProjectId === input.creationProjectId,
      )
      .sort((a, b) => b.attemptNumber - a.attemptNumber);

    const allowed = slotAttempts.find((a) => a.status === "allowed" && a.candidateId);
    for (const attempt of slotAttempts) {
      if (attempt.status === "blocked" || attempt.status === "superseded") {
        historyBlocked.push(attempt);
      }
    }
    if (!allowed || !allowed.candidateId) continue;

    cards.push({
      slot,
      lane: slot,
      candidateId: allowed.candidateId,
      assetId: allowed.assetId,
      provider: String(allowed.provider),
      generationAttempt: allowed.attemptNumber,
      noveltyStatus: "allowed",
      similaritySummary:
        allowed.highestSimilarity != null
          ? `closest similarity ${allowed.highestSimilarity.toFixed(3)}`
          : null,
      selectable: true,
      generationRunId: input.generationRunId,
      creationProjectId: input.creationProjectId,
    });
  }

  return {
    cards,
    historyBlocked,
    ready: cards.length === 4,
    readyPartial: cards.length >= 1 && cards.length < 4,
  };
}

/** Assert board entries belong only to the current project + run. */
export function assertBoardIsCurrentRunOnly(
  cards: readonly FinalBoardCard[],
  generationRunId: string,
  creationProjectId: string,
): void {
  for (const card of cards) {
    if (card.generationRunId !== generationRunId) {
      throw new Error("stale_board_candidate_rejected");
    }
    if (card.creationProjectId !== creationProjectId) {
      throw new Error("cross_project_board_candidate_rejected");
    }
  }
}
