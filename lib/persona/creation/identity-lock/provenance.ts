/**
 * Phase 2.4A — Identity lock provenance mapping.
 */

import type { ReconciledReferencePackageSlot } from "../reference-package/reconcile-reference-package-state";
import type {
  IdentityLockProvenanceCounts,
  IdentityLockReferenceProvenance,
  LockedCanonicalReferenceSnapshot,
} from "./types";

export function resolveLockReferenceProvenance(
  row: ReconciledReferencePackageSlot,
): IdentityLockReferenceProvenance {
  if (row.provenance === "mirror_derivation") return "derived_mirror";
  if (row.provenance === "reassigned") return "reassigned";
  if (row.provenance === "replacement" || row.replacementState === "approved") {
    return "replacement_approved";
  }
  if (row.identitySourceConfidence === "human_mismatch_override") {
    return "human_mismatch_override";
  }
  if (row.identitySourceConfidence === "human_warning_approved") {
    return "human_warning_approved";
  }
  return "machine_match";
}

export function countProvenance(
  refs: readonly LockedCanonicalReferenceSnapshot[],
): IdentityLockProvenanceCounts {
  const counts: IdentityLockProvenanceCounts = {
    machineMatchCount: 0,
    warningApprovedCount: 0,
    mismatchOverrideCount: 0,
    derivedReferenceCount: 0,
    reassignedCount: 0,
    replacementApprovedCount: 0,
  };
  for (const ref of refs) {
    switch (ref.provenance) {
      case "machine_match":
        counts.machineMatchCount += 1;
        break;
      case "human_warning_approved":
        counts.warningApprovedCount += 1;
        break;
      case "human_mismatch_override":
        counts.mismatchOverrideCount += 1;
        break;
      case "derived_mirror":
        counts.derivedReferenceCount += 1;
        break;
      case "reassigned":
        counts.reassignedCount += 1;
        break;
      case "replacement_approved":
        counts.replacementApprovedCount += 1;
        break;
    }
  }
  return counts;
}
