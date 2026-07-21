export {
  BRAND_ARCHETYPE_VERSION,
  type ArchetypeRecommendation,
  type BrandArchetype,
  type BrandArchetypeCatalog,
  type BrandArchetypePlatform,
  type BrandArchetypeProductAffinity,
  type BrandArchetypeRole,
  type BrandArchetypeSnapshot,
  type BrandArchetypeStatus,
  type BrandFaceMemory,
  type CampaignRecommendationInput,
  type IdentityDna,
  type IdentityDnaAppearance,
  type IdentityDnaLifestyle,
  type IdentityDnaMovement,
  type IdentityDnaPhotography,
  type IdentityDnaPresence,
  type ProductAffinityRating,
  type VideoRecommendationInput,
} from "./types";

export {
  MILAENE_BRAND_ARCHETYPES,
  MILAENE_BRAND_ARCHETYPE_CATALOG,
  MILAENE_ARCHETYPE_CATALOG_VERSION,
  MILAENE_IDENTITY_DNA,
} from "./archetypes";

export {
  assertIdentityDnaImmutableContract,
  createIdentityDnaFingerprint,
  finalizeIdentityDna,
} from "./identity-dna";

export {
  BRAND_ARCHETYPE_CATALOG_BY_SLUG,
  DEFAULT_BRAND_ARCHETYPE_SLUG,
  getBrandArchetypeBySlug,
  getBrandArchetypeCatalogForSlug,
  getIdentityDnaForArchetype,
  listBrandArchetypeSlugs,
  resolveArchetypeForCandidate,
} from "./registry";

export {
  loadArchetypeForCandidate,
  loadBrandArchetypeCatalog,
  loadBrandArchetypeCatalogBySlug,
  loadBrandArchetypeSnapshotForCandidate,
} from "./load";

export {
  bestArchetypeForPlatform,
  getArchetypePlatformScore,
  getProductAffinityForArchetype,
  recommendArchetypeForCampaign,
  recommendArchetypeForVideo,
} from "./scoring";

export {
  formatArchetypeAppearancePrompt,
  formatArchetypeCatalogPrompt,
  formatArchetypeDirectionPrompt,
  formatArchetypePresencePrompt,
  formatIdentityDnaPrompt,
} from "./prompt";

export { createBrandArchetypeSnapshot } from "./snapshot";
