import type {
  BrandFaceIdentityCheckKey,
  BrandFaceIdentityChecklist,
  BrandFaceSelectionStatus,
  IdentityLockRecord,
  ReferencePackage,
  ReferencePackageSlot,
} from "./types";

export {
  A1_DISCOVERY_CANDIDATE_COUNT,
  A1_PORTRAITS_PER_CANDIDATE,
  A2_MAX_SHORTLIST,
  OFFICIAL_MILAENE_ARCHETYPE_COUNT,
  BRAND_FACE_SELECTION_VERSION,
} from "./types";

export const BRAND_FACE_IDENTITY_CHECK_KEYS: readonly BrandFaceIdentityCheckKey[] = [
  "same_person_across_references",
  "stable_face_geometry",
  "stable_eye_color_and_shape",
  "stable_skin_tone",
  "stable_hairline",
  "stable_age_range",
  "stable_body_proportions",
  "no_visible_anatomy_defects",
  "no_text_or_watermark_artifacts",
  "suitable_for_image_generation",
  "suitable_for_future_video_generation",
] as const;

export const REQUIRED_REFERENCE_PACKAGE_SLOTS: readonly ReferencePackageSlot[] = [
  "approved_primary_portrait",
  "approved_body_reference",
  "front",
  "three_quarter",
  "half_body",
  "neutral_expression",
  "approved_expression_range",
] as const;

export const OPTIONAL_REFERENCE_PACKAGE_SLOTS: readonly ReferencePackageSlot[] = [
  "optional_profile",
  "optional_full_body",
] as const;

/** Allowed status transitions for a selection project. */
export const SELECTION_STATUS_TRANSITIONS: Record<
  BrandFaceSelectionStatus,
  readonly BrandFaceSelectionStatus[]
> = {
  draft: ["discovery_ready", "archived"],
  discovery_ready: ["discovery_generating", "draft", "archived"],
  discovery_generating: ["discovery_review", "discovery_ready", "archived"],
  discovery_review: [
    "candidate_selected",
    "validation_ready",
    "discovery_ready",
    "archived",
  ],
  candidate_selected: ["validation_ready", "identity_review", "archived"],
  validation_ready: ["validation_generating", "discovery_review", "archived"],
  validation_generating: ["candidate_selected", "validation_ready", "archived"],
  identity_review: ["identity_locked", "candidate_selected", "archived"],
  identity_locked: ["approved", "identity_review", "archived"],
  approved: ["archived"],
  archived: ["draft"],
};

export const OPENAI_SAME_PERSON_EXPANSION_BLOCK_REASON =
  "OpenAI same-person expansion is blocked until identity consistency can be guaranteed. Manual upload remains first-class.";

export function emptyIdentityChecklist(): BrandFaceIdentityChecklist {
  return Object.fromEntries(
    BRAND_FACE_IDENTITY_CHECK_KEYS.map((key) => [
      key,
      { passed: false, notes: "" },
    ]),
  ) as BrandFaceIdentityChecklist;
}

export function emptyReferencePackage(): ReferencePackage {
  const slots = Object.fromEntries(
    [
      ...REQUIRED_REFERENCE_PACKAGE_SLOTS,
      ...OPTIONAL_REFERENCE_PACKAGE_SLOTS,
    ].map((slot) => [slot, "missing" as const]),
  ) as ReferencePackage["slots"];

  return {
    status: "not_started",
    slots,
    openaiSamePersonExpansionBlocked: true,
    openaiBlockReason: OPENAI_SAME_PERSON_EXPANSION_BLOCK_REASON,
    manualUploadFirstClass: true,
    notes: "",
  };
}

export function emptyIdentityLockRecord(): IdentityLockRecord {
  return {
    status: "not_started",
    version: null,
    lockedAt: null,
    locked: {
      facialIdentity: false,
      skinTone: false,
      eyeStructure: false,
      nose: false,
      lips: false,
      jaw: false,
      bodyProportions: false,
      approvedAgeRange: false,
      distinguishingFeatures: false,
      approvedHairstyleRange: false,
      approvedExpressionRange: false,
    },
    flexible: {
      clothing: true,
      pose: true,
      lighting: true,
      location: true,
      campaignStyling: true,
    },
    imageUseEnabledByLock: false,
    videoUseEnabledByLock: false,
  };
}

export class BrandFaceSelectionError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code = "WORKFLOW",
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BrandFaceSelectionError";
    this.code = code;
    this.details = details;
  }
}
