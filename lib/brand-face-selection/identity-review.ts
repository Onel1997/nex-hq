/**
 * Mandatory identity review for Official Brand Face candidates.
 */

import {
  BrandFaceSelectionError,
  BRAND_FACE_IDENTITY_CHECK_KEYS,
  emptyIdentityChecklist,
} from "./constants";
import { assertReferencePackageReadyForIdentityReview } from "./reference-package";
import { markSelectionStatus } from "./selection-project";
import type {
  BrandFaceIdentityChecklist,
  BrandFaceSelectionProject,
} from "./types";

export function beginIdentityReview(
  project: BrandFaceSelectionProject,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  if (!project.selectedCandidateId) {
    throw new BrandFaceSelectionError(
      "Identity review requires a selected candidate",
      "WORKFLOW",
    );
  }
  if (!project.draftPersonaId) {
    throw new BrandFaceSelectionError(
      "Identity review requires Draft Persona conversion first",
      "WORKFLOW",
    );
  }
  assertReferencePackageReadyForIdentityReview(project);

  const next = markSelectionStatus(project, "identity_review", now);
  return {
    ...next,
    identityReviewStatus: "in_progress",
    identityChecklist: project.identityChecklist ?? emptyIdentityChecklist(),
    updatedAt: now,
  };
}

export function updateIdentityCheck(
  project: BrandFaceSelectionProject,
  key: keyof BrandFaceIdentityChecklist,
  passed: boolean,
  notes = "",
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  const checklist = {
    ...(project.identityChecklist ?? emptyIdentityChecklist()),
    [key]: { passed, notes },
  };
  return {
    ...project,
    identityChecklist: checklist,
    identityReviewStatus: "in_progress",
    updatedAt: now,
  };
}

export function submitIdentityReview(
  project: BrandFaceSelectionProject,
  checklist: BrandFaceIdentityChecklist,
  notes = "",
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  if (project.status !== "identity_review") {
    throw new BrandFaceSelectionError(
      "Submit identity review only while in identity_review status",
      "WORKFLOW",
    );
  }

  const allPassed = BRAND_FACE_IDENTITY_CHECK_KEYS.every(
    (key) => checklist[key]?.passed === true,
  );

  return {
    ...project,
    identityChecklist: checklist,
    identityReviewNotes: notes,
    identityReviewStatus: allPassed ? "passed" : "failed",
    updatedAt: now,
  };
}

export function assertIdentityReviewPassed(
  project: BrandFaceSelectionProject,
): void {
  if (project.identityReviewStatus !== "passed") {
    throw new BrandFaceSelectionError(
      "Identity review must pass before identity lock",
      "WORKFLOW",
      { identityReviewStatus: project.identityReviewStatus },
    );
  }
  const checklist = project.identityChecklist;
  if (!checklist) {
    throw new BrandFaceSelectionError("Identity checklist missing", "WORKFLOW");
  }
  for (const key of BRAND_FACE_IDENTITY_CHECK_KEYS) {
    if (!checklist[key]?.passed) {
      throw new BrandFaceSelectionError(
        `Identity check failed: ${key}`,
        "WORKFLOW",
      );
    }
  }
}

export function passAllIdentityChecks(
  project: BrandFaceSelectionProject,
  notes = "All identity checks passed",
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  const checklist = emptyIdentityChecklist();
  for (const key of BRAND_FACE_IDENTITY_CHECK_KEYS) {
    checklist[key] = { passed: true, notes: "" };
  }
  return submitIdentityReview(project, checklist, notes, now);
}
