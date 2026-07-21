import { BRAND_ARCHETYPE_VERSION } from "./types";
import type {
  BrandArchetype,
  BrandArchetypeSnapshot,
  BrandFaceMemory,
  IdentityDna,
} from "./types";

export function createBrandArchetypeSnapshot(params: {
  archetype: BrandArchetype;
  dna: IdentityDna;
  brandFaceMemory?: BrandFaceMemory;
  capturedAt?: string;
}): BrandArchetypeSnapshot {
  return {
    brandArchetypeVersion: BRAND_ARCHETYPE_VERSION,
    archetypeId: params.archetype.id,
    archetypeSlug: params.archetype.slug,
    archetypeVersion: params.archetype.version,
    identityDnaId: params.dna.id,
    identityDnaVersion: params.dna.version,
    identityDnaFingerprint: params.dna.fingerprint,
    brandFaceVersion:
      params.brandFaceMemory?.brandFaceVersion ?? "0.0.0-architecture",
    capturedAt: params.capturedAt ?? params.archetype.updatedAt,
    productAffinityProductTypes: params.archetype.productAffinity
      .map((a) => a.productType)
      .sort(),
    roles: [...params.archetype.roles].sort(),
  };
}
