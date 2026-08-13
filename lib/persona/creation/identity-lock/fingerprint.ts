/**
 * Phase 2.4A — Deterministic Reference Package fingerprint for identity lock.
 */

import { createHash } from "node:crypto";
import type { LockedCanonicalReferenceSnapshot } from "./types";

export function computeReferencePackageFingerprint(input: {
  masterAssetId: string;
  masterChecksum: string;
  canonicalReferences: readonly LockedCanonicalReferenceSnapshot[];
  lockVersion: number;
  referencePackageVersion: string;
}): string {
  const canonical = [...input.canonicalReferences]
    .sort((a, b) => a.slot.localeCompare(b.slot))
    .map((ref) => ({
      slot: ref.slot,
      assetId: ref.assetId,
      checksum: ref.checksum,
      effectiveSlot: ref.effectiveSlot,
      provenance: ref.provenance,
      identitySourceConfidence: ref.identitySourceConfidence,
      referenceProvenance: ref.referenceProvenance,
    }));

  const payload = {
    policy: "identity-lock-fingerprint-v1",
    master: {
      assetId: input.masterAssetId,
      checksum: input.masterChecksum,
    },
    canonical,
    lockVersion: input.lockVersion,
    referencePackageVersion: input.referencePackageVersion,
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
