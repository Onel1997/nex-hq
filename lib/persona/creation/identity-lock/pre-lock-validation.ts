/**
 * Phase 2.4A — Pre-lock validation via authoritative Reference Package reconciliation.
 */

import type { Persona, PersonaReferenceAsset } from "@/lib/persona/domain/types";
import type { PersonaIdentityReview } from "@/lib/persona/domain/creation-types";
import {
  isMasterIdentityReference,
  parseMasterIdentityNotes,
} from "../master-identity-reference";
import type {
  ReconciledReferencePackageSlot,
  ReconciledReferencePackageState,
} from "../reference-package/reconcile-reference-package-state";
import type { ReferencePackageSlot } from "../reference-package/slots";
import { REFERENCE_PACKAGE_SLOTS } from "../reference-package/slots";
import type {
  IdentityLockEligibilityView,
  IdentityLockPreview,
  LockedCanonicalReferenceSnapshot,
} from "./types";
import { computeReferencePackageFingerprint } from "./fingerprint";
import { countProvenance, resolveLockReferenceProvenance } from "./provenance";
import { evaluateIdentityReviewQualityGate } from "./identity-review-quality-gate";

function slotBlockingReason(row: ReconciledReferencePackageSlot): string | null {
  if (row.replacementState === "pending") {
    return `${row.slot}: pending replacement candidate must be resolved`;
  }
  if (row.state === "review") {
    return `${row.slot}: slot in review`;
  }
  if (row.state === "wrong_camera_direction") {
    return `${row.slot}: wrong camera direction`;
  }
  if (row.state === "missing") {
    return `${row.slot}: missing slot`;
  }
  if (row.state === "identity_mismatch") {
    return `${row.slot}: identity mismatch without explicit override`;
  }
  if (row.state === "identity_warning") {
    return `${row.slot}: identity warning requires human approval`;
  }
  if (row.state === "rejected") {
    return `${row.slot}: rejected`;
  }
  if (!row.usable || !row.countsTowardCoverage) {
    return `${row.slot}: not accepted for coverage`;
  }
  return null;
}

function buildCanonicalSnapshot(
  row: ReconciledReferencePackageSlot,
  assets: readonly PersonaReferenceAsset[],
): LockedCanonicalReferenceSnapshot | null {
  if (!row.activeAssetId) return null;
  const asset = assets.find((a) => a.id === row.activeAssetId);
  if (!asset) return null;
  return {
    slot: row.slot,
    assetId: asset.id,
    checksum: asset.checksum,
    provenance: resolveLockReferenceProvenance(row),
    identitySourceConfidence: row.identitySourceConfidence,
    referenceProvenance: row.provenance,
    effectiveSlot: row.effectiveSlot,
  };
}

/**
 * Canonical validation of the durable Master + Reference Package evidence.
 *
 * This intentionally does not evaluate a review or Persona lock status. It is
 * reused by the legacy reconciliation flow so that recovery cannot invent a
 * second, weaker Reference Package formula.
 */
export function validateIdentityPackageEvidence(input: {
  reconciled: ReconciledReferencePackageState;
  master: PersonaReferenceAsset | null;
  assets: readonly PersonaReferenceAsset[];
}): {
  blockingReasons: string[];
  coverage: { accepted: number; required: number };
  referencePackageReady: boolean;
  masterReferenceId: string | null;
  masterImmutable: boolean;
  canonicalReferences: LockedCanonicalReferenceSnapshot[];
} {
  const blockingReasons: string[] = [];

  if (!input.master) {
    blockingReasons.push("Master Identity Reference missing");
  } else {
    const meta = parseMasterIdentityNotes(input.master.notes);
    if (!meta) {
      blockingReasons.push("Master Identity Reference metadata invalid");
    } else if (!meta.immutable_source_reference) {
      blockingReasons.push("Master Identity Reference is not immutable");
    }
    if (!isMasterIdentityReference(input.master)) {
      blockingReasons.push("Master Identity Reference marker missing");
    }
  }

  if (!input.reconciled.referencePackageReady) {
    blockingReasons.push(
      `Reference Package not ready (${input.reconciled.acceptedCount}/${input.reconciled.requiredCount})`,
    );
  }

  for (const slot of REFERENCE_PACKAGE_SLOTS) {
    const row = input.reconciled.slots.find((s) => s.slot === slot);
    if (!row) {
      blockingReasons.push(`${slot}: slot not reconciled`);
      continue;
    }
    const reason = slotBlockingReason(row);
    if (reason) blockingReasons.push(reason);
  }

  const canonicalReferences = REFERENCE_PACKAGE_SLOTS.map((slot) => {
    const row = input.reconciled.slots.find((s) => s.slot === slot);
    return row ? buildCanonicalSnapshot(row, input.assets) : null;
  }).filter((r): r is LockedCanonicalReferenceSnapshot => r != null);

  if (canonicalReferences.length !== REFERENCE_PACKAGE_SLOTS.length) {
    blockingReasons.push("Canonical reference snapshot incomplete");
  }

  return {
    blockingReasons,
    coverage: {
      accepted: input.reconciled.acceptedCount,
      required: input.reconciled.requiredCount,
    },
    referencePackageReady: input.reconciled.referencePackageReady,
    masterReferenceId: input.master?.id ?? null,
    masterImmutable: Boolean(
      input.master &&
        parseMasterIdentityNotes(input.master.notes)?.immutable_source_reference,
    ),
    canonicalReferences,
  };
}

export function slotAssetIdFor(
  preview: Pick<
    IdentityLockPreview,
    | "canonicalReferences"
    | "masterReferenceAssetId"
  >,
  slot: ReferencePackageSlot,
): string | null {
  if (slot === "front") {
    return preview.canonicalReferences.find((r) => r.slot === "front")?.assetId ?? null;
  }
  const ref = preview.canonicalReferences.find((r) => r.slot === slot);
  return ref?.assetId ?? null;
}

export function validateIdentityLockEligibility(input: {
  persona: Persona;
  reconciled: ReconciledReferencePackageState;
  master: PersonaReferenceAsset | null;
  assets: readonly PersonaReferenceAsset[];
  identityReview: PersonaIdentityReview | null;
  nextLockVersion: number;
}): IdentityLockEligibilityView {
  const evidence = validateIdentityPackageEvidence(input);
  const blockingReasons: string[] = [...evidence.blockingReasons];
  const alreadyLocked = input.persona.identity_lock_status === "approved";
  const reviewGate = evaluateIdentityReviewQualityGate(input.identityReview);

  if (alreadyLocked) {
    blockingReasons.push("Identity already locked");
  }

  blockingReasons.push(...reviewGate.blockingReasons);

  const { canonicalReferences, masterReferenceId, masterImmutable } = evidence;

  let preview: IdentityLockPreview | null = null;
  if (
    masterReferenceId &&
    canonicalReferences.length === REFERENCE_PACKAGE_SLOTS.length &&
    reviewGate.identityLockPassed &&
    input.identityReview?.reviewed_at &&
    !alreadyLocked
  ) {
    const fingerprint = computeReferencePackageFingerprint({
      masterAssetId: masterReferenceId,
      masterChecksum: input.master!.checksum,
      canonicalReferences,
      lockVersion: input.nextLockVersion,
      referencePackageVersion: input.reconciled.reconcilerVersion,
    });
    preview = {
      masterReferenceAssetId: masterReferenceId,
      canonicalReferences,
      referencePackageFingerprint: fingerprint,
      identityLockVersion: input.nextLockVersion,
      provenanceCounts: countProvenance(canonicalReferences),
      identityReviewId: input.identityReview.id,
      identityReviewedAt: input.identityReview.reviewed_at,
      identityReviewedBy: input.identityReview.reviewed_by,
    };
  }

  const eligibleForIdentityLock =
    blockingReasons.length === 0 && preview != null && !alreadyLocked;

  return {
    eligibleForIdentityLock,
    blockingReasons,
    alreadyLocked,
    coverage: evidence.coverage,
    referencePackageReady: evidence.referencePackageReady,
    masterReferenceId,
    masterImmutable,
    identityReview: input.identityReview,
    identityReviewPassed: reviewGate.identityLockPassed,
    preview,
  };
}
