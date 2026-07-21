/**
 * Brand Archetype Intelligence — official casting-agency roles for Persona / Image / Video.
 *
 * Identity DNA is permanent per archetype. Users never edit DNA directly.
 * Prompt builders consume DNA. Product affinity reads Product Intelligence — never invents inventory.
 */

export const BRAND_ARCHETYPE_VERSION = "1.7D.1";

export type BrandArchetypeStatus = "draft" | "active" | "retired" | "archived";

export type BrandArchetypeRole =
  | "homepage_hero"
  | "campaign_hero"
  | "community_hero"
  | "lifestyle_hero"
  | "social_hero"
  | "product_hero"
  | "couple_hero"
  | "video_hero"
  | "newsletter_hero"
  | "ads_hero";

export type BrandArchetypePlatform =
  | "homepage"
  | "shopify"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "email"
  | "newsletter"
  | "ads"
  | "community"
  | "lifestyle"
  | "campaign";

export type ProductAffinityRating = 1 | 2 | 3 | 4 | 5;

export type BrandArchetypeProductAffinity = {
  /** Product Intelligence product id when known. */
  productId: string | null;
  /** Normalized product type from Product Intelligence. */
  productType: string;
  rating: ProductAffinityRating;
  reason: string;
};

export type IdentityDnaAppearance = {
  faceGeometryFamily: string;
  proportions: string;
  eyeFeeling: string;
  noseFamily: string;
  lips: string;
  jawFamily: string;
  beardFamily: string;
  skinToneFamily: string;
  hairFamily: string;
};

export type IdentityDnaPresence = {
  confidence: string;
  approachability: string;
  calmness: string;
  communityFeeling: string;
  luxuryFeeling: string;
  authenticity: string;
  socialEnergy: string;
};

export type IdentityDnaMovement = {
  posture: string;
  shoulderPosition: string;
  naturalAsymmetry: string;
  bodyEnergy: string;
};

export type IdentityDnaPhotography = {
  framingPreference: string;
  cameraEnergy: string;
  expressionFamily: string;
  editorialRestraint: string;
};

export type IdentityDnaLifestyle = {
  fashionDirection: string;
  socialBehavior: string;
  communityRole: string;
  campaignRole: string;
};

/** Permanent Identity DNA — never user-edited. */
export type IdentityDna = {
  id: string;
  archetypeId: string;
  version: string;
  appearance: IdentityDnaAppearance;
  presence: IdentityDnaPresence;
  movement: IdentityDnaMovement;
  photography: IdentityDnaPhotography;
  lifestyle: IdentityDnaLifestyle;
  /** Deterministic fingerprint of DNA content. */
  fingerprint: string;
};

export type BrandArchetype = {
  id: string;
  slug: string;
  name: string;
  workspaceId: string;
  status: BrandArchetypeStatus;
  genderPresentation: string;
  ageRange: string;
  ethnicityDirection: string;
  bodyDirection: string;
  faceDirection: string;
  hairDirection: string;
  groomingDirection: string;
  personality: string;
  socialEnergy: string;
  commercialRole: string;
  wardrobeDirection: string;
  photographyDirection: string;
  cameraDirection: string;
  lightingDirection: string;
  communityRole: string;
  campaignRole: string;
  productAffinity: BrandArchetypeProductAffinity[];
  strengths: string[];
  avoid: string[];
  /** Primary casting / campaign roles this archetype fills. */
  roles: BrandArchetypeRole[];
  /** Platform recommendation scores (0–100) — recommendation only, not image quality. */
  platformScores: Partial<Record<BrandArchetypePlatform, number>>;
  purpose: string[];
  bestPlatforms: BrandArchetypePlatform[];
  identityDnaId: string;
  version: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Future Brand Face memory — architecture only (no image persistence yet).
 */
export type BrandFaceMemory = {
  archetypeId: string;
  currentActiveFaceId: string | null;
  approvedBrandFaceIds: string[];
  brandFaceHistoryIds: string[];
  retiredFaceIds: string[];
  identityLockVersion: string | null;
  brandFaceVersion: string;
};

export type CampaignRecommendationInput = {
  campaign?: string | null;
  collection?: string | null;
  product?: string | null;
  audience?: string | null;
  platform: BrandArchetypePlatform;
};

export type VideoRecommendationInput = {
  platform: Extract<
    BrandArchetypePlatform,
    "instagram" | "tiktok" | "youtube" | "homepage" | "email"
  >;
  product?: string | null;
  audience?: string | null;
};

export type ArchetypeRecommendation = {
  archetypeId: string;
  archetypeSlug: string;
  archetypeName: string;
  confidence: number;
  reason: string;
  roles: BrandArchetypeRole[];
};

export type BrandArchetypeSnapshot = {
  brandArchetypeVersion: string;
  archetypeId: string;
  archetypeSlug: string;
  archetypeVersion: string;
  identityDnaId: string;
  identityDnaVersion: string;
  identityDnaFingerprint: string;
  brandFaceVersion: string;
  capturedAt: string;
  productAffinityProductTypes: string[];
  roles: BrandArchetypeRole[];
};

export type BrandArchetypeCatalog = {
  brandSlug: string;
  workspaceId: string;
  version: string;
  archetypes: BrandArchetype[];
  identityDnaById: Record<string, IdentityDna>;
  brandFaceMemoryByArchetypeId: Record<string, BrandFaceMemory>;
  updatedAt: string;
};
