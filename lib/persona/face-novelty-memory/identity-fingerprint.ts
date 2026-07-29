/**
 * Pre-generation identity fingerprint — Layer A novelty.
 *
 * Built from biological + styling keys.  Two candidates with the same
 * fingerprint are treated as the same identity recipe regardless of which
 * project they belong to or which prompt was used.
 *
 * This does NOT guarantee visual difference between newly generated images —
 * that requires a real face-similarity evaluator (Layer B).
 */

export interface IdentityFingerprintInput {
  archetypeId: string;
  blueprintId?: string;
  runVariationToken?: string;
  ancestryDirection?: string;
  headShape?: string;
  faceGeometry?: string;
  jawShape?: string;
  noseShape?: string;
  eyeShape?: string;
  lipShape?: string;
  hairTexture?: string;
  haircut?: string;
  facialHair?: string;
  bodyStructure?: string;
  skinTone?: string;
}

function normalize(value: string | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Build a deterministic identity fingerprint string from biological keys.
 * The fingerprint is a pipe-separated ordered composite; do NOT hash it so
 * it remains human-readable for debugging.
 */
export function buildIdentityFingerprint(input: IdentityFingerprintInput): string {
  const parts = [
    `archetype:${normalize(input.archetypeId)}`,
    `blueprint:${normalize(input.blueprintId)}`,
    `variation:${normalize(input.runVariationToken)}`,
    `ancestry:${normalize(input.ancestryDirection)}`,
    `head:${normalize(input.headShape)}`,
    `geometry:${normalize(input.faceGeometry)}`,
    `jaw:${normalize(input.jawShape)}`,
    `nose:${normalize(input.noseShape)}`,
    `eye:${normalize(input.eyeShape)}`,
    `lip:${normalize(input.lipShape)}`,
    `hair:${normalize(input.hairTexture)}|${normalize(input.haircut)}`,
    `facial_hair:${normalize(input.facialHair)}`,
    `body:${normalize(input.bodyStructure)}`,
    `skin:${normalize(input.skinTone)}`,
  ];
  return parts.join(";");
}

/**
 * Build a visual fingerprint from storage + checksum metadata.
 * This is a post-generation Layer A fallback — it detects exact asset reuse
 * but cannot detect biologically similar newly generated images.
 */
export function buildVisualFingerprint(input: {
  storageObjectKey?: string;
  imageChecksum?: string;
}): string {
  const key = normalize(input.storageObjectKey);
  const checksum = normalize(input.imageChecksum);
  return `storage:${key};checksum:${checksum}`;
}
