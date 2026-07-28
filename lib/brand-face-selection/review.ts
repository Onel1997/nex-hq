/**
 * Discovery review — user decision is authoritative.
 * Shortlist up to 2, reject, notes, manual rating.
 * No fake visual score.
 */

import { A2_MAX_SHORTLIST, BrandFaceSelectionError } from "./constants";
import { markSelectionStatus } from "./selection-project";
import type {
  BrandFaceSelectionProject,
  DiscoveryCandidateReview,
  ManualCandidateRating,
} from "./types";

function requireReviewCandidate(
  project: BrandFaceSelectionProject,
  candidateId: string,
): DiscoveryCandidateReview {
  const review = project.candidateReviews[candidateId];
  if (!review || !project.discoveryCandidateIds.includes(candidateId)) {
    throw new BrandFaceSelectionError(
      `Candidate ${candidateId} is not part of this discovery set`,
      "NOT_FOUND",
    );
  }
  return review;
}

export function rateDiscoveryCandidate(
  project: BrandFaceSelectionProject,
  candidateId: string,
  rating: ManualCandidateRating,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  requireReviewCandidate(project, candidateId);
  return {
    ...project,
    candidateReviews: {
      ...project.candidateReviews,
      [candidateId]: {
        ...project.candidateReviews[candidateId]!,
        manualRating: rating,
        visualEvaluation: "not_performed",
      },
    },
    updatedAt: now,
  };
}

export function noteDiscoveryCandidate(
  project: BrandFaceSelectionProject,
  candidateId: string,
  notes: string,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  requireReviewCandidate(project, candidateId);
  return {
    ...project,
    candidateReviews: {
      ...project.candidateReviews,
      [candidateId]: {
        ...project.candidateReviews[candidateId]!,
        notes,
      },
    },
    updatedAt: now,
  };
}

export function shortlistDiscoveryCandidate(
  project: BrandFaceSelectionProject,
  candidateId: string,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  if (project.status !== "discovery_review" && project.status !== "validation_ready") {
    throw new BrandFaceSelectionError(
      "Shortlist is only available during discovery review",
      "WORKFLOW",
      { status: project.status },
    );
  }
  requireReviewCandidate(project, candidateId);

  if (project.shortlistCandidateIds.includes(candidateId)) {
    return project;
  }

  if (project.shortlistCandidateIds.length >= A2_MAX_SHORTLIST) {
    throw new BrandFaceSelectionError(
      `Maximum ${A2_MAX_SHORTLIST} shortlist candidates for A2`,
      "WORKFLOW",
      { max: A2_MAX_SHORTLIST },
    );
  }

  const shortlistCandidateIds = [...project.shortlistCandidateIds, candidateId];
  const rejectedCandidateIds = project.rejectedCandidateIds.filter(
    (id) => id !== candidateId,
  );

  return {
    ...project,
    shortlistCandidateIds,
    rejectedCandidateIds,
    candidateReviews: {
      ...project.candidateReviews,
      [candidateId]: {
        ...project.candidateReviews[candidateId]!,
        decision: "shortlisted",
        visualEvaluation: "not_performed",
      },
    },
    updatedAt: now,
  };
}

export function rejectDiscoveryCandidate(
  project: BrandFaceSelectionProject,
  candidateId: string,
  notes = "",
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  requireReviewCandidate(project, candidateId);

  const shortlistCandidateIds = project.shortlistCandidateIds.filter(
    (id) => id !== candidateId,
  );
  const rejectedCandidateIds = project.rejectedCandidateIds.includes(candidateId)
    ? project.rejectedCandidateIds
    : [...project.rejectedCandidateIds, candidateId];

  const selectedCandidateId =
    project.selectedCandidateId === candidateId
      ? null
      : project.selectedCandidateId;

  return {
    ...project,
    shortlistCandidateIds,
    rejectedCandidateIds,
    selectedCandidateId,
    candidateReviews: {
      ...project.candidateReviews,
      [candidateId]: {
        ...project.candidateReviews[candidateId]!,
        decision: "rejected",
        notes: notes || project.candidateReviews[candidateId]!.notes,
        visualEvaluation: "not_performed",
      },
    },
    updatedAt: now,
  };
}

export function assertNoFakeVisualScore(
  review: DiscoveryCandidateReview,
): void {
  if (review.visualEvaluation !== "not_performed") {
    // Completed is only allowed when an explicit visual evaluator is enabled later.
    // Phase 1.8 default path never invents a score.
    return;
  }
  // Manual rating is allowed; it is not a visual score.
  if (review.manualRating != null && typeof review.manualRating !== "number") {
    throw new BrandFaceSelectionError(
      "Manual rating must be a 1–5 number or null",
      "VALIDATION",
    );
  }
}

export function prepareValidationReady(
  project: BrandFaceSelectionProject,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  if (project.status !== "discovery_review") {
    throw new BrandFaceSelectionError(
      "Validation requires discovery review first",
      "WORKFLOW",
    );
  }
  if (project.shortlistCandidateIds.length < 1) {
    throw new BrandFaceSelectionError(
      "Shortlist at least one candidate before A2 validation",
      "WORKFLOW",
    );
  }
  if (project.shortlistCandidateIds.length > A2_MAX_SHORTLIST) {
    throw new BrandFaceSelectionError(
      `A2 allows at most ${A2_MAX_SHORTLIST} shortlisted candidates`,
      "WORKFLOW",
    );
  }
  return markSelectionStatus(project, "validation_ready", now);
}
