/**
 * Official Milaene Brand Face approval — explicit, never automatic.
 */

import { BrandFaceSelectionError } from "./constants";
import { assertIdentityLockApproved } from "./identity-lock";
import { assertIdentityReviewPassed } from "./identity-review";
import { assertExactlyOneSelected } from "./final-selection";
import { assertReferencePackageReadyForIdentityReview } from "./reference-package";
import { markSelectionStatus, resolveArchetypeBundle } from "./selection-project";
import type { BrandFaceSelectionProject } from "./types";

export type OfficialBrandFaceApprovalInput = {
  rightsConfirmed: boolean;
  imageUseApproved: boolean;
  /** Video readiness is separate and must not be required for Brand Face approval. */
  videoReady?: boolean;
};

export type OfficialBrandFaceApprovalGates = {
  correctArchetype: boolean;
  candidateSelected: boolean;
  draftPersonaCreated: boolean;
  referencePackageComplete: boolean;
  identityReviewPassed: boolean;
  identityLockApproved: boolean;
  rightsConfirmed: boolean;
  imageUseApproved: boolean;
};

export function evaluateApprovalGates(
  project: BrandFaceSelectionProject,
  input?: Partial<OfficialBrandFaceApprovalInput>,
): OfficialBrandFaceApprovalGates {
  let correctArchetype = false;
  try {
    resolveArchetypeBundle(project.archetypeId, project.workspaceId);
    correctArchetype = true;
  } catch {
    correctArchetype = false;
  }

  return {
    correctArchetype,
    candidateSelected: Boolean(project.selectedCandidateId),
    draftPersonaCreated: Boolean(project.draftPersonaId),
    referencePackageComplete:
      project.referencePackageStatus === "complete" ||
      (() => {
        try {
          assertReferencePackageReadyForIdentityReview(project);
          return true;
        } catch {
          return false;
        }
      })(),
    identityReviewPassed: project.identityReviewStatus === "passed",
    identityLockApproved: project.identityLockStatus === "locked",
    rightsConfirmed: input?.rightsConfirmed ?? project.rightsConfirmed,
    imageUseApproved: input?.imageUseApproved ?? project.imageUseApproved,
  };
}

export function assertApprovalGates(
  project: BrandFaceSelectionProject,
  input: OfficialBrandFaceApprovalInput,
): void {
  if (project.status !== "identity_locked") {
    throw new BrandFaceSelectionError(
      "Official Brand Face approval requires identity_locked status",
      "WORKFLOW",
      { status: project.status },
    );
  }

  assertExactlyOneSelected(project);

  if (!project.draftPersonaId) {
    throw new BrandFaceSelectionError(
      "Draft Persona must be created before Official Brand Face approval",
      "WORKFLOW",
    );
  }

  assertReferencePackageReadyForIdentityReview(project);
  assertIdentityReviewPassed(project);
  assertIdentityLockApproved(project);

  try {
    resolveArchetypeBundle(project.archetypeId, project.workspaceId);
  } catch {
    throw new BrandFaceSelectionError(
      "Approval requires a valid Brand Archetype",
      "WORKFLOW",
    );
  }

  if (!input.rightsConfirmed) {
    throw new BrandFaceSelectionError(
      "Rights must be confirmed for Official Brand Face approval",
      "WORKFLOW",
    );
  }

  if (!input.imageUseApproved) {
    throw new BrandFaceSelectionError(
      "image_use_approved must be true for Official Brand Face approval",
      "WORKFLOW",
    );
  }
}

/**
 * Approve as Official Milaene Brand Face.
 * Does not call Image Studio or Video Studio.
 * Video readiness remains separate.
 */
export function approveOfficialBrandFace(
  project: BrandFaceSelectionProject,
  input: OfficialBrandFaceApprovalInput,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  assertApprovalGates(project, input);

  const next = markSelectionStatus(project, "approved", now);
  return {
    ...next,
    rightsConfirmed: true,
    imageUseApproved: true,
    videoReady: input.videoReady ?? false,
    brandFaceApprovalStatus: "approved",
    approvedAt: now,
    updatedAt: now,
  };
}
