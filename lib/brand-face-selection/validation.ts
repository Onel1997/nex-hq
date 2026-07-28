/**
 * A2 Validation — only shortlisted candidates may expand.
 * Requires fresh confirmation token (never reuse A1).
 * Max 2 candidates by default. No automatic continuation.
 */

import {
  DEFAULT_A2_MAX_SELECTED,
  STAGE_A2_VALIDATION_ASSET_TYPES,
  clampA2Selection,
  missingValidationAssetTypes,
} from "@/lib/persona/creation/casting-funnel";
import type { CandidateAssetType } from "@/lib/persona/domain/creation-types";
import { A2_MAX_SHORTLIST, BrandFaceSelectionError } from "./constants";
import { markSelectionStatus } from "./selection-project";
import type { BrandFaceSelectionProject } from "./types";

export type A2ValidationPlan = {
  candidateIds: string[];
  maxCandidates: number;
  assetTypes: readonly CandidateAssetType[];
  reuseDiscoveryPortraitIfValid: true;
  requiresFreshConfirmation: true;
  requiresExplicitUserApproval: true;
  autoContinue: false;
};

export function buildA2ValidationPlan(
  project: BrandFaceSelectionProject,
  existingAssetTypesByCandidate: Record<string, CandidateAssetType[]> = {},
): A2ValidationPlan {
  if (
    project.status !== "validation_ready" &&
    project.status !== "validation_generating"
  ) {
    throw new BrandFaceSelectionError(
      "A2 validation plan requires validation_ready status",
      "WORKFLOW",
      { status: project.status },
    );
  }

  const candidateIds = clampA2Selection(
    project.shortlistCandidateIds,
    A2_MAX_SHORTLIST,
  );

  if (candidateIds.length < 1) {
    throw new BrandFaceSelectionError(
      "A2 requires at least one shortlisted candidate",
      "WORKFLOW",
    );
  }
  if (candidateIds.length > DEFAULT_A2_MAX_SELECTED) {
    throw new BrandFaceSelectionError(
      `A2 allows at most ${DEFAULT_A2_MAX_SELECTED} candidates`,
      "WORKFLOW",
    );
  }

  for (const id of candidateIds) {
    if (!project.shortlistCandidateIds.includes(id)) {
      throw new BrandFaceSelectionError(
        "Only shortlisted candidates may expand in A2",
        "WORKFLOW",
        { candidateId: id },
      );
    }
    if (project.rejectedCandidateIds.includes(id)) {
      throw new BrandFaceSelectionError(
        "Rejected candidates cannot expand in A2",
        "WORKFLOW",
        { candidateId: id },
      );
    }
  }

  // Reuse discovery portrait — missingValidationAssetTypes skips existing types.
  for (const id of candidateIds) {
    const existing = existingAssetTypesByCandidate[id] ?? ["portrait_front"];
    missingValidationAssetTypes(existing);
  }

  return {
    candidateIds,
    maxCandidates: DEFAULT_A2_MAX_SELECTED,
    assetTypes: STAGE_A2_VALIDATION_ASSET_TYPES,
    reuseDiscoveryPortraitIfValid: true,
    requiresFreshConfirmation: true,
    requiresExplicitUserApproval: true,
    autoContinue: false,
  };
}

export function assertFreshA2Confirmation(
  project: BrandFaceSelectionProject,
  confirmationFingerprint: string,
): void {
  if (!confirmationFingerprint) {
    throw new BrandFaceSelectionError(
      "A2 validation requires a fresh paid confirmation token",
      "CONFIRMATION",
    );
  }
  if (
    project.lastConfirmationFingerprint &&
    project.lastConfirmationFingerprint === confirmationFingerprint
  ) {
    throw new BrandFaceSelectionError(
      "A2 requires a new confirmation token — A1 token cannot be reused",
      "CONFIRMATION",
    );
  }
}

export function assertCandidateMayExpandInA2(
  project: BrandFaceSelectionProject,
  candidateId: string,
): void {
  if (!project.shortlistCandidateIds.includes(candidateId)) {
    throw new BrandFaceSelectionError(
      "Only shortlisted candidates can expand in A2",
      "WORKFLOW",
      { candidateId },
    );
  }
}

export function beginA2Validation(
  project: BrandFaceSelectionProject,
  confirmationFingerprint: string,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  assertFreshA2Confirmation(project, confirmationFingerprint);
  buildA2ValidationPlan(project);
  const next = markSelectionStatus(project, "validation_generating", now);
  return {
    ...next,
    lastConfirmationFingerprint: confirmationFingerprint,
    updatedAt: now,
  };
}

export function completeA2Validation(
  project: BrandFaceSelectionProject,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  if (project.status !== "validation_generating") {
    throw new BrandFaceSelectionError(
      "A2 completion requires validation_generating status",
      "WORKFLOW",
    );
  }
  const next = markSelectionStatus(project, "candidate_selected", now);
  return {
    ...next,
    a2CompletedAt: now,
    // Final pick still required — status name reflects funnel stage readiness.
    selectedCandidateId: null,
    updatedAt: now,
  };
}
