/**
 * Official Brand Face Selection — Phase 1.8
 *
 * Production workflow for selecting exactly three permanent Milaene Brand Faces,
 * one per Brand Archetype. Does not start Image Studio or Video Studio.
 */

export const BRAND_FACE_SELECTION_VERSION = "1.8.0";

export const OFFICIAL_MILAENE_ARCHETYPE_COUNT = 3;

export const A1_DISCOVERY_CANDIDATE_COUNT = 4;
export const A1_PORTRAITS_PER_CANDIDATE = 1;
export const A2_MAX_SHORTLIST = 2;

export type BrandFaceSelectionStatus =
  | "draft"
  | "discovery_ready"
  | "discovery_generating"
  | "discovery_review"
  | "candidate_selected"
  | "validation_ready"
  | "validation_generating"
  | "identity_review"
  | "identity_locked"
  | "approved"
  | "archived";

export type BrandFaceTargetRole =
  | "mediterranean_premium_hero"
  | "urban_community_hero"
  | "female_lifestyle_hero";

export type PackageAssetStatus = "missing" | "pending" | "approved" | "rejected";

export type ReferencePackageStatus =
  | "not_started"
  | "collecting"
  | "incomplete"
  | "complete"
  | "blocked_openai_expansion";

export type IdentityReviewStatus =
  | "not_started"
  | "in_progress"
  | "passed"
  | "failed"
  | "needs_revision";

export type IdentityLockStatus =
  | "not_started"
  | "ready"
  | "locked"
  | "rejected";

export type BrandFaceApprovalStatus =
  | "not_started"
  | "pending"
  | "approved"
  | "rejected";

export type CandidateReviewDecision =
  | "undecided"
  | "shortlisted"
  | "rejected"
  | "selected"
  | "preserved_rejected";

/** Manual rating only — never a fake visual score. */
export type ManualCandidateRating = 1 | 2 | 3 | 4 | 5 | null;

export type BrandFaceIdentityCheckKey =
  | "same_person_across_references"
  | "stable_face_geometry"
  | "stable_eye_color_and_shape"
  | "stable_skin_tone"
  | "stable_hairline"
  | "stable_age_range"
  | "stable_body_proportions"
  | "no_visible_anatomy_defects"
  | "no_text_or_watermark_artifacts"
  | "suitable_for_image_generation"
  | "suitable_for_future_video_generation";

export type BrandFaceIdentityChecklist = Record<
  BrandFaceIdentityCheckKey,
  { passed: boolean; notes: string }
>;

export type ReferencePackageSlot =
  | "approved_primary_portrait"
  | "approved_body_reference"
  | "front"
  | "three_quarter"
  | "half_body"
  | "optional_profile"
  | "optional_full_body"
  | "neutral_expression"
  | "approved_expression_range";

export type ReferencePackage = {
  status: ReferencePackageStatus;
  slots: Record<ReferencePackageSlot, PackageAssetStatus>;
  openaiSamePersonExpansionBlocked: boolean;
  openaiBlockReason: string | null;
  manualUploadFirstClass: boolean;
  notes: string;
};

export type IdentityLockRecord = {
  status: IdentityLockStatus;
  version: string | null;
  lockedAt: string | null;
  locked: {
    facialIdentity: boolean;
    skinTone: boolean;
    eyeStructure: boolean;
    nose: boolean;
    lips: boolean;
    jaw: boolean;
    bodyProportions: boolean;
    approvedAgeRange: boolean;
    distinguishingFeatures: boolean;
    approvedHairstyleRange: boolean;
    approvedExpressionRange: boolean;
  };
  flexible: {
    clothing: boolean;
    pose: boolean;
    lighting: boolean;
    location: boolean;
    campaignStyling: boolean;
  };
  /** Lock must not auto-enable image or video use. */
  imageUseEnabledByLock: false;
  videoUseEnabledByLock: false;
};

export type DiscoveryCandidateReview = {
  candidateId: string;
  decision: CandidateReviewDecision;
  notes: string;
  manualRating: ManualCandidateRating;
  briefFitVisible: boolean;
  technicalCompletenessVisible: boolean;
  /** Always "not_performed" unless visual evaluation is explicitly enabled later. */
  visualEvaluation: "not_performed" | "completed";
};

/**
 * One selection project per archetype casting session.
 * Tied to exactly one Brand Archetype.
 */
export type BrandFaceSelectionProject = {
  id: string;
  workspaceId: string;
  archetypeId: string;
  archetypeVersion: string;
  identityDnaFingerprint: string;
  targetRole: BrandFaceTargetRole;
  status: BrandFaceSelectionStatus;
  discoveryCandidateCount: number;
  selectedCandidateId: string | null;
  shortlistCandidateIds: string[];
  /** Preserved rejected candidate IDs (not deleted). */
  rejectedCandidateIds: string[];
  discoveryCandidateIds: string[];
  candidateReviews: Record<string, DiscoveryCandidateReview>;
  /** Linked Persona Creation project when generation runs. */
  creationProjectId: string | null;
  /** Draft Persona created after final selection conversion. */
  draftPersonaId: string | null;
  referencePackage: ReferencePackage;
  referencePackageStatus: ReferencePackageStatus;
  identityReviewStatus: IdentityReviewStatus;
  identityChecklist: BrandFaceIdentityChecklist | null;
  identityReviewNotes: string;
  identityLockStatus: IdentityLockStatus;
  identityLock: IdentityLockRecord | null;
  brandFaceApprovalStatus: BrandFaceApprovalStatus;
  rightsConfirmed: boolean;
  imageUseApproved: boolean;
  /** Video readiness remains separate from Brand Face approval. */
  videoReady: boolean;
  /** Confirmation token fingerprint for last paid step (never reused across A1→A2). */
  lastConfirmationFingerprint: string | null;
  a1CompletedAt: string | null;
  a2CompletedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfficialBrandFaceRecord = {
  id: string;
  workspaceId: string;
  archetypeId: string;
  version: number;
  personaId: string;
  candidateId: string;
  selectionProjectId: string;
  identityDnaFingerprint: string;
  imageReady: boolean;
  videoReady: boolean;
  status: "active" | "retired";
  approvedAt: string;
  retiredAt: string | null;
};

export type OfficialBrandFaceRegistry = {
  workspaceId: string;
  brandSlug: string;
  version: string;
  /** Exactly one active face per archetype when set. */
  activeByArchetypeId: Record<string, OfficialBrandFaceRecord | null>;
  /** All faces including retired, keyed by face id. */
  facesById: Record<string, OfficialBrandFaceRecord>;
  previousByArchetypeId: Record<string, OfficialBrandFaceRecord[]>;
  updatedAt: string;
};

export type BrandFaceArchetypeMilestone = {
  archetypeId: string;
  archetypeSlug: string;
  archetypeName: string;
  approvedCount: number;
  requiredCount: 1;
  activeFaceId: string | null;
  label: string;
};

export type OfficialBrandFaceMilestone = {
  archetypes: BrandFaceArchetypeMilestone[];
  approvedCount: number;
  requiredCount: typeof OFFICIAL_MILAENE_ARCHETYPE_COUNT;
  complete: boolean;
  label: string;
};

export type BrandFaceProductionPackage = {
  personaId: string;
  brandFaceId: string | null;
  archetypeId: string | null;
  identityDnaFingerprint: string | null;
  identityLockVersion: string | null;
  imageReady: boolean;
  videoReady: boolean;
  referencePackageStatus: ReferencePackageStatus | null;
  immutableFeatures: string[];
  flexibleFeatures: string[];
};

export type CampaignBrandFaceRecommendationInput = {
  campaign?: string | null;
  collection?: string | null;
  product?: string | null;
  audience?: string | null;
  platform: string;
};

export type VideoBrandFaceRecommendationInput = {
  platform: string;
  product?: string | null;
  audience?: string | null;
};

export type BrandFaceRecommendation = {
  brandFaceId: string;
  personaId: string;
  archetypeId: string;
  archetypeName: string;
  confidence: number;
  reason: string;
  imageReady: boolean;
  videoReady: boolean;
};
