/**
 * Reference package for the selected Brand Face candidate.
 * OpenAI same-person expansion remains blocked when identity consistency
 * cannot be guaranteed. Manual upload is first-class.
 */

import {
  BrandFaceSelectionError,
  OPENAI_SAME_PERSON_EXPANSION_BLOCK_REASON,
  OPTIONAL_REFERENCE_PACKAGE_SLOTS,
  REQUIRED_REFERENCE_PACKAGE_SLOTS,
} from "./constants";
import type {
  BrandFaceSelectionProject,
  PackageAssetStatus,
  ReferencePackage,
  ReferencePackageSlot,
} from "./types";

export function isReferencePackageComplete(
  pkg: ReferencePackage,
): boolean {
  return REQUIRED_REFERENCE_PACKAGE_SLOTS.every(
    (slot) => pkg.slots[slot] === "approved",
  );
}

export function computeReferencePackageStatus(
  pkg: ReferencePackage,
): ReferencePackage["status"] {
  if (pkg.openaiSamePersonExpansionBlocked && pkg.status === "blocked_openai_expansion") {
    // Stay blocked until manual slots complete — then complete may override.
  }
  const required = REQUIRED_REFERENCE_PACKAGE_SLOTS.map((s) => pkg.slots[s]);
  if (required.every((s) => s === "missing")) return "not_started";
  if (required.every((s) => s === "approved")) return "complete";
  if (required.some((s) => s === "pending" || s === "approved")) return "collecting";
  return "incomplete";
}

export function setReferencePackageSlot(
  project: BrandFaceSelectionProject,
  slot: ReferencePackageSlot,
  status: PackageAssetStatus,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  if (!project.selectedCandidateId) {
    throw new BrandFaceSelectionError(
      "Reference package requires a selected candidate",
      "WORKFLOW",
    );
  }

  const slots = {
    ...project.referencePackage.slots,
    [slot]: status,
  };
  const pkg: ReferencePackage = {
    ...project.referencePackage,
    slots,
    openaiSamePersonExpansionBlocked: true,
    openaiBlockReason: OPENAI_SAME_PERSON_EXPANSION_BLOCK_REASON,
    manualUploadFirstClass: true,
  };
  pkg.status = computeReferencePackageStatus(pkg);

  return {
    ...project,
    referencePackage: pkg,
    referencePackageStatus: pkg.status,
    updatedAt: now,
  };
}

export function markOpenAiExpansionBlocked(
  project: BrandFaceSelectionProject,
  reason = OPENAI_SAME_PERSON_EXPANSION_BLOCK_REASON,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  const pkg: ReferencePackage = {
    ...project.referencePackage,
    openaiSamePersonExpansionBlocked: true,
    openaiBlockReason: reason,
    manualUploadFirstClass: true,
    status: "blocked_openai_expansion",
  };
  return {
    ...project,
    referencePackage: pkg,
    referencePackageStatus: "blocked_openai_expansion",
    updatedAt: now,
  };
}

export function assertOpenAiSamePersonExpansionBlocked(
  project: BrandFaceSelectionProject,
): void {
  if (!project.referencePackage.openaiSamePersonExpansionBlocked) {
    throw new BrandFaceSelectionError(
      "OpenAI same-person expansion must remain blocked without identity guarantees",
      "SECURITY",
    );
  }
}

export function assertReferencePackageReadyForIdentityReview(
  project: BrandFaceSelectionProject,
): void {
  if (!isReferencePackageComplete(project.referencePackage)) {
    const missing = REQUIRED_REFERENCE_PACKAGE_SLOTS.filter(
      (s) => project.referencePackage.slots[s] !== "approved",
    );
    throw new BrandFaceSelectionError(
      "Reference package must be complete before identity review",
      "WORKFLOW",
      { missing },
    );
  }
}

export function approveAllRequiredReferenceSlots(
  project: BrandFaceSelectionProject,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  let next = project;
  for (const slot of REQUIRED_REFERENCE_PACKAGE_SLOTS) {
    next = setReferencePackageSlot(next, slot, "approved", now);
  }
  for (const slot of OPTIONAL_REFERENCE_PACKAGE_SLOTS) {
    // Optional slots stay missing unless explicitly set.
    void slot;
  }
  return next;
}
