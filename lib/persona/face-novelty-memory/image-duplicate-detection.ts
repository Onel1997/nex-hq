/**
 * Image-level duplicate detection — local, non-paid.
 *
 * Detects exact and near-exact image reuse:
 *   - identical file checksum (SHA-256)
 *   - same storage object (different signed URL, same key)
 *   - perceptual hash near-duplicate (Hamming distance)
 *
 * IMPORTANT: This does NOT detect biologically similar but newly generated
 * faces.  It only catches accidental storage/asset reuse.
 */

import type { CandidateAssetReference, ImageDuplicateResult } from "./types";

/** Hamming distance between two binary strings of equal length. */
function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

/**
 * Convert a hex perceptual hash to a binary bit-string for Hamming comparison.
 * Non-hex characters are treated as zero bits.
 */
function hexToBits(hex: string): string {
  return hex
    .toLowerCase()
    .split("")
    .map((c) => {
      const n = parseInt(c, 16);
      if (isNaN(n)) return "0000";
      return n.toString(2).padStart(4, "0");
    })
    .join("");
}

/**
 * Near-duplicate threshold for perceptual hashes.
 * Hamming distance <= this value means near-duplicate.
 * A 64-bit pHash with distance <= 10 is widely considered near-identical.
 */
export const PERCEPTUAL_HASH_NEAR_DUPLICATE_THRESHOLD = 10;

/**
 * Detect whether a candidate asset is an image-level duplicate of any
 * prior asset in the comparison set.
 *
 * Returns the first match found (most specific first: checksum → storage key
 * → perceptual hash).
 */
export function detectImageDuplicate(
  candidate: CandidateAssetReference,
  priorAssets: CandidateAssetReference[],
  options?: { perceptualThreshold?: number },
): ImageDuplicateResult {
  const threshold = options?.perceptualThreshold ?? PERCEPTUAL_HASH_NEAR_DUPLICATE_THRESHOLD;

  for (const prior of priorAssets) {
    // 1. Exact checksum match (same image bytes / same file).
    if (
      candidate.imageChecksum &&
      prior.imageChecksum &&
      candidate.imageChecksum === prior.imageChecksum
    ) {
      return {
        isDuplicate: true,
        reason: "exact_checksum",
        matchedAssetId: prior.assetId,
        matchedStorageKey: prior.storageObjectKey,
      };
    }

    // 2. Same storage object (different signed URL, same key).
    if (
      candidate.storageObjectKey &&
      prior.storageObjectKey &&
      candidate.storageObjectKey === prior.storageObjectKey
    ) {
      return {
        isDuplicate: true,
        reason: "same_storage_object",
        matchedAssetId: prior.assetId,
        matchedStorageKey: prior.storageObjectKey,
      };
    }

    // 3. Perceptual hash near-duplicate.
    if (candidate.perceptualHash && prior.perceptualHash) {
      const aBits = hexToBits(candidate.perceptualHash);
      const bBits = hexToBits(prior.perceptualHash);
      const dist = hammingDistance(aBits, bBits);
      if (dist <= threshold) {
        return {
          isDuplicate: true,
          reason: "perceptual_near_duplicate",
          matchedAssetId: prior.assetId,
          matchedStorageKey: prior.storageObjectKey,
          perceptualDistance: dist,
          threshold,
        };
      }
    }
  }

  return { isDuplicate: false };
}
