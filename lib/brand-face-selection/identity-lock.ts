/**
 * Identity Lock — locks facial/body identity traits.
 * Does NOT automatically enable image or video use.
 */

import { BrandFaceSelectionError, emptyIdentityLockRecord } from "./constants";
import { assertIdentityReviewPassed } from "./identity-review";
import { markSelectionStatus } from "./selection-project";
import type { BrandFaceSelectionProject, IdentityLockRecord } from "./types";

export function lockBrandFaceIdentity(
  project: BrandFaceSelectionProject,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  assertIdentityReviewPassed(project);

  const lock: IdentityLockRecord = {
    ...emptyIdentityLockRecord(),
    status: "locked",
    version: `il_${project.archetypeId}_${Date.now()}`,
    lockedAt: now,
    locked: {
      facialIdentity: true,
      skinTone: true,
      eyeStructure: true,
      nose: true,
      lips: true,
      jaw: true,
      bodyProportions: true,
      approvedAgeRange: true,
      distinguishingFeatures: true,
      approvedHairstyleRange: true,
      approvedExpressionRange: true,
    },
    flexible: {
      clothing: true,
      pose: true,
      lighting: true,
      location: true,
      campaignStyling: true,
    },
    imageUseEnabledByLock: false,
    videoUseEnabledByLock: false,
  };

  const next = markSelectionStatus(project, "identity_locked", now);
  return {
    ...next,
    identityLock: lock,
    identityLockStatus: "locked",
    // Explicit: lock never flips image/video readiness.
    imageUseApproved: project.imageUseApproved,
    videoReady: project.videoReady,
    updatedAt: now,
  };
}

export function assertIdentityLockApproved(
  project: BrandFaceSelectionProject,
): void {
  if (project.identityLockStatus !== "locked") {
    throw new BrandFaceSelectionError(
      "Identity lock is required before Official Brand Face approval",
      "WORKFLOW",
      { identityLockStatus: project.identityLockStatus },
    );
  }
  const lock = project.identityLock;
  if (!lock || lock.status !== "locked") {
    throw new BrandFaceSelectionError("Identity lock record missing", "WORKFLOW");
  }
  if (lock.imageUseEnabledByLock !== false || lock.videoUseEnabledByLock !== false) {
    throw new BrandFaceSelectionError(
      "Identity lock must not auto-enable image or video use",
      "SECURITY",
    );
  }
  const required = Object.values(lock.locked);
  if (required.some((v) => v !== true)) {
    throw new BrandFaceSelectionError(
      "All identity lock traits must be locked",
      "WORKFLOW",
    );
  }
}
