/**
 * Phase 2.2A — selection handoff.
 * SELECT CANDIDATE creates a draft selected discovery identity.
 * Does NOT generate Identity Lock / reference angles (Phase 2.2B).
 */

export type SelectedDiscoveryIdentity = {
  creationProjectId: string;
  generationRunId: string;
  candidateId: string;
  slot: "A" | "B" | "C" | "D";
  selectedAt: string;
  status: "draft_selected";
  identityLockStarted: false;
  referenceAnglesRequested: false;
};

export function selectDiscoveryCandidate(input: {
  creationProjectId: string;
  generationRunId: string;
  candidateId: string;
  slot: "A" | "B" | "C" | "D";
  selectedAt?: string;
}): SelectedDiscoveryIdentity {
  return {
    creationProjectId: input.creationProjectId,
    generationRunId: input.generationRunId,
    candidateId: input.candidateId,
    slot: input.slot,
    selectedAt: input.selectedAt ?? new Date().toISOString(),
    status: "draft_selected",
    identityLockStarted: false,
    referenceAnglesRequested: false,
  };
}
