/**
 * Discovery history service — answers questions about exhausted and forbidden
 * identities before building a generation plan.
 *
 * Must be loaded before any new discovery run begins.
 */

import type { CandidateAssetReference, DiscoveryHistory } from "./types";
import type { NoveltyRepository } from "./novelty-repository";

/**
 * Load the discovery history for a given workspace + archetype.
 * Builds the forbidden sets used by evaluateDiscoveryNovelty.
 */
export async function loadDiscoveryHistory(
  repo: NoveltyRepository,
  workspaceId: string,
  archetypeId: string,
): Promise<DiscoveryHistory> {
  const allRecords = await repo.findMany({ workspaceId, archetypeId });

  const forbiddenIdentityFingerprints = new Set<string>();
  const forbiddenImageChecksums = new Set<string>();
  const forbiddenPerceptualHashes = new Set<string>();
  const forbiddenStorageKeys = new Set<string>();
  const priorAssetReferences: CandidateAssetReference[] = [];

  let totalShown = 0;
  let totalExhausted = 0;
  let totalSaved = 0;
  let totalApproved = 0;
  let totalRejected = 0;

  for (const record of allRecords) {
    switch (record.state) {
      case "shown":
        totalShown++;
        break;
      case "exhausted":
        totalExhausted++;
        break;
      case "saved":
        totalSaved++;
        break;
      case "approved":
        totalApproved++;
        break;
      case "rejected":
        totalRejected++;
        break;
      default:
        break;
    }

    // All states except "generated" contribute to the forbidden sets.
    // "generated" is a transitional state — not yet shown; do not block on it.
    const excluded: typeof record.state[] = [
      "shown",
      "shortlisted",
      "saved",
      "rejected",
      "exhausted",
      "approved",
    ];
    if (excluded.includes(record.state)) {
      if (record.identityFingerprint) {
        forbiddenIdentityFingerprints.add(record.identityFingerprint);
      }
      if (record.imageChecksum) {
        forbiddenImageChecksums.add(record.imageChecksum);
      }
      if (record.perceptualHash) {
        forbiddenPerceptualHashes.add(record.perceptualHash);
      }
      if (record.storageObjectKey) {
        forbiddenStorageKeys.add(record.storageObjectKey);
      }
      priorAssetReferences.push({
        candidateId: record.candidateId,
        assetId: record.assetId,
        storageObjectKey: record.storageObjectKey,
        imageChecksum: record.imageChecksum,
        perceptualHash: record.perceptualHash,
      });
    }
  }

  return {
    workspaceId,
    archetypeId,
    totalShown,
    totalExhausted,
    totalSaved,
    totalApproved,
    totalRejected,
    forbiddenIdentityFingerprints,
    forbiddenImageChecksums,
    forbiddenPerceptualHashes,
    forbiddenStorageKeys,
    priorAssetReferences,
  };
}

/**
 * Mark all candidates from earlier unfinished runs (state "shown" or
 * "generated") as exhausted when a new discovery begins.
 *
 * Candidates that are saved, shortlisted, or approved are preserved.
 */
export async function exhaustUnfinishedCandidates(
  repo: NoveltyRepository,
  workspaceId: string,
  archetypeId: string,
): Promise<number> {
  const records = await repo.findMany({
    workspaceId,
    archetypeId,
    states: ["shown", "generated"],
  });

  const now = new Date().toISOString();
  let exhausted = 0;
  for (const record of records) {
    await repo.updateState(record.id, workspaceId, "exhausted", { exhaustedAt: now });
    exhausted++;
  }
  return exhausted;
}
