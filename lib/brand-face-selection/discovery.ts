/**
 * A1 Discovery — four candidates, one portrait each.
 * No auto-expansion, no additional angles, no automatic shortlist/selection.
 */

import {
  STAGE_A1_DISCOVERY_ASSET_TYPES,
  imagesPerCandidateForCastingPhase,
} from "@/lib/persona/creation/casting-funnel";
import { BrandFaceSelectionError } from "./constants";
import { markSelectionStatus } from "./selection-project";
import {
  A1_DISCOVERY_CANDIDATE_COUNT,
  A1_PORTRAITS_PER_CANDIDATE,
  type BrandFaceSelectionProject,
  type DiscoveryCandidateReview,
} from "./types";

export type A1DiscoveryPlan = {
  candidateCount: number;
  portraitsPerCandidate: number;
  totalImages: number;
  assetTypes: readonly string[];
  autoStartA2: false;
  autoShortlist: false;
  autoSelect: false;
  autoExpandAngles: false;
  requiresPaidConfirmation: true;
};

export function buildA1DiscoveryPlan(
  project: Pick<BrandFaceSelectionProject, "discoveryCandidateCount">,
): A1DiscoveryPlan {
  const candidateCount = project.discoveryCandidateCount;
  if (candidateCount !== A1_DISCOVERY_CANDIDATE_COUNT) {
    throw new BrandFaceSelectionError(
      `A1 discovery requires exactly ${A1_DISCOVERY_CANDIDATE_COUNT} candidates`,
      "WORKFLOW",
      { candidateCount },
    );
  }

  const portraitsPerCandidate = imagesPerCandidateForCastingPhase("a1_discovery");
  if (portraitsPerCandidate !== A1_PORTRAITS_PER_CANDIDATE) {
    throw new BrandFaceSelectionError(
      "A1 discovery must generate exactly one portrait per candidate",
      "CONFIG",
    );
  }

  return {
    candidateCount,
    portraitsPerCandidate,
    totalImages: candidateCount * portraitsPerCandidate,
    assetTypes: STAGE_A1_DISCOVERY_ASSET_TYPES,
    autoStartA2: false,
    autoShortlist: false,
    autoSelect: false,
    autoExpandAngles: false,
    requiresPaidConfirmation: true,
  };
}

export function assertA1DoesNotAutoStartA2(plan: A1DiscoveryPlan): void {
  if (plan.autoStartA2) {
    throw new BrandFaceSelectionError(
      "A1 must not auto-start A2 validation",
      "WORKFLOW",
    );
  }
}

export function prepareDiscoveryReady(
  project: BrandFaceSelectionProject,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  buildA1DiscoveryPlan(project);
  return markSelectionStatus(project, "discovery_ready", now);
}

export function beginDiscoveryGenerating(
  project: BrandFaceSelectionProject,
  confirmationFingerprint: string,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  if (!confirmationFingerprint) {
    throw new BrandFaceSelectionError(
      "A1 discovery requires a paid confirmation token fingerprint",
      "CONFIRMATION",
    );
  }
  const next = markSelectionStatus(project, "discovery_generating", now);
  return {
    ...next,
    lastConfirmationFingerprint: confirmationFingerprint,
    updatedAt: now,
  };
}

export function completeA1Discovery(
  project: BrandFaceSelectionProject,
  candidateIds: string[],
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  if (candidateIds.length !== A1_DISCOVERY_CANDIDATE_COUNT) {
    throw new BrandFaceSelectionError(
      `A1 must produce exactly ${A1_DISCOVERY_CANDIDATE_COUNT} candidates`,
      "WORKFLOW",
      { got: candidateIds.length },
    );
  }

  const reviews: Record<string, DiscoveryCandidateReview> = {};
  for (const id of candidateIds) {
    reviews[id] = {
      candidateId: id,
      decision: "undecided",
      notes: "",
      manualRating: null,
      briefFitVisible: true,
      technicalCompletenessVisible: true,
      visualEvaluation: "not_performed",
    };
  }

  const next = markSelectionStatus(project, "discovery_review", now);
  return {
    ...next,
    discoveryCandidateIds: [...candidateIds],
    candidateReviews: reviews,
    shortlistCandidateIds: [],
    selectedCandidateId: null,
    a1CompletedAt: now,
    updatedAt: now,
  };
}

/** Explicit guard: finishing A1 never flips into validation_generating. */
export function assertA1CompleteLeavesA2Idle(
  project: BrandFaceSelectionProject,
): void {
  if (
    project.status === "validation_generating" ||
    project.status === "validation_ready"
  ) {
    throw new BrandFaceSelectionError(
      "A1 completion must not enter A2 validation automatically",
      "WORKFLOW",
      { status: project.status },
    );
  }
  if (project.a2CompletedAt) {
    throw new BrandFaceSelectionError(
      "A2 must not complete as a side effect of A1",
      "WORKFLOW",
    );
  }
}
