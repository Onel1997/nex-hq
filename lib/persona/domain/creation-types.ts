/**
 * Persona Studio Phase 1.2 — creation / candidate / Brand Cast types.
 */

export const CREATION_PROJECT_STATUSES = [
  "draft",
  "ready",
  "generating",
  "review",
  "selected",
  "cancelled",
  "failed",
  "archived",
] as const;
export type CreationProjectStatus = (typeof CREATION_PROJECT_STATUSES)[number];

export const GENERATION_STAGES = [
  "discovery",
  "shortlist_validation",
  "identity_lock",
] as const;
export type GenerationStage = (typeof GENERATION_STAGES)[number];

export const PROVIDER_MODES = [
  "disabled",
  "manual_upload",
  "image_provider",
  "hybrid",
] as const;
export type ProviderMode = (typeof PROVIDER_MODES)[number];

export const BRAND_ROLES = [
  "primary_male",
  "secondary_male",
  "primary_female",
  "secondary_female",
  "unisex_editorial",
  "campaign_specialist",
] as const;
export type BrandRole = (typeof BRAND_ROLES)[number];

export const INTENDED_USAGES = ["image", "video", "image_and_video"] as const;
export type IntendedUsage = (typeof INTENDED_USAGES)[number];

export const CANDIDATE_STATUSES = [
  "queued",
  "generating",
  "ready",
  "shortlisted",
  "selected",
  "rejected",
  "failed",
  "archived",
  "needs_manual_references",
  "identity_validation_failed",
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const QUALITY_MODES = [
  "draft_discovery",
  "premium_editorial",
  "ultra_brand_cast",
] as const;
export type QualityMode = (typeof QUALITY_MODES)[number];

export const GENERATION_JOB_STATUSES = [
  "pending_confirmation",
  "queued",
  "generating",
  "partially_completed",
  "completed",
  "failed",
  "cancelled",
] as const;
export type GenerationJobStatus = (typeof GENERATION_JOB_STATUSES)[number];

export const CANDIDATE_ASSET_TYPES = [
  "portrait_front",
  "portrait_three_quarter",
  "portrait_profile",
  "half_body",
  "full_body",
  "expression_variant",
  "outfit_variant",
  "test_contact_sheet",
] as const;
export type CandidateAssetType = (typeof CANDIDATE_ASSET_TYPES)[number];

export const CANDIDATE_ASSET_STATUSES = [
  "uploaded",
  "ready",
  "rejected",
  "archived",
  "pending_cleanup",
] as const;
export type CandidateAssetStatus = (typeof CANDIDATE_ASSET_STATUSES)[number];

export const IDENTITY_LOCK_STATUSES = [
  "not_started",
  "collecting_references",
  "review",
  "approved",
  "needs_revision",
  "archived",
] as const;
export type IdentityLockStatus = (typeof IDENTITY_LOCK_STATUSES)[number];

/** Stage A discovery assets — keep costs low. */
export const STAGE_A_ASSET_TYPES: CandidateAssetType[] = [
  "portrait_front",
  "portrait_three_quarter",
  "half_body",
];

/** Stage B shortlist validation assets — full reference package intent. */
export const STAGE_B_ASSET_TYPES: CandidateAssetType[] = [
  "portrait_front",
  "portrait_three_quarter",
  "portrait_profile",
  "half_body",
  "full_body",
  "expression_variant",
  "outfit_variant",
];

/** Target Brand Cast spend band per completed approved persona (EUR). */
export const TARGET_PERSONA_BUDGET_EUR_MIN = 10;
export const TARGET_PERSONA_BUDGET_EUR_MAX = 20;

export const DEFAULT_CANDIDATE_COUNT = 4;
export const MAX_CANDIDATE_BATCH_SIZE = 8;
export const MAX_DAILY_GENERATION_EUR = 25;

export interface PersonaCreationProject {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  gender_presentation: string;
  age_range: string;
  height_range: string;
  body_type: string;
  skin_tone_direction: string;
  face_shape_direction: string;
  hair_direction: string;
  facial_hair_direction: string;
  eye_direction: string;
  expression_direction: string;
  personality: string;
  fashion_style: string;
  brand_role: BrandRole;
  visual_keywords: string;
  excluded_features: string;
  preferred_brand_looks: string;
  preferred_outfits: string;
  intended_usage: IntendedUsage;
  candidate_count: number;
  provider_mode: ProviderMode;
  quality_mode: QualityMode;
  status: CreationProjectStatus;
  generation_stage: GenerationStage;
  estimated_cost_min: number;
  estimated_cost_max: number;
  actual_cost: number;
  cost_confirmed_at: string | null;
  last_estimate_hash: string | null;
  last_estimate_at: string | null;
  last_confirmation_token: string | null;
  additional_description: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonaCandidate {
  id: string;
  workspace_id: string;
  creation_project_id: string;
  candidate_number: number;
  candidate_name: string;
  status: CandidateStatus;
  provider: string;
  provider_job_id: string | null;
  generation_seed: string | null;
  generation_prompt: string;
  negative_prompt: string;
  generation_settings: Record<string, unknown>;
  primary_preview_asset_id: string | null;
  identity_summary: string;
  distinguishing_features: string;
  visual_strengths: string;
  visual_risks: string;
  brand_fit_score: number | null;
  identity_consistency_score: number | null;
  realism_score: number | null;
  video_suitability_score: number | null;
  user_rating: number | null;
  user_notes: string;
  rejection_reason: string;
  fashion_fit_review: string;
  body_proportion_review: string;
  hand_anatomy_review: string;
  face_consistency_review: string;
  realism_review: string;
  image_suitability_label: string;
  video_suitability_label: string;
  parent_candidate_id: string | null;
  variation_of_asset_id: string | null;
  actual_generation_cost: number;
  selected_at: string | null;
  converted_persona_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonaGenerationJob {
  id: string;
  workspace_id: string;
  creation_project_id: string;
  candidate_id: string | null;
  stage: GenerationStage;
  provider: string;
  provider_job_id: string | null;
  status: GenerationJobStatus;
  requested_asset_types: CandidateAssetType[];
  quality_mode: QualityMode;
  estimated_cost_min: number;
  estimated_cost_max: number;
  actual_cost: number;
  cost_is_estimated: boolean;
  confirmation_token: string | null;
  estimate_hash: string | null;
  confirmation_payload: Record<string, unknown>;
  confirmed_at: string | null;
  retry_count: number;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonaGenerationConfirmation {
  id: string;
  workspace_id: string;
  creation_project_id: string;
  generation_job_id: string | null;
  confirmation_token: string;
  estimate_hash: string;
  stage: GenerationStage;
  quality_mode: QualityMode;
  candidate_count: number;
  asset_count: number;
  estimated_cost_min: number;
  estimated_cost_max: number;
  payload: Record<string, unknown>;
  confirmed_at: string;
  consumed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PersonaCandidateAsset {
  id: string;
  workspace_id: string;
  candidate_id: string;
  asset_type: CandidateAssetType;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number;
  checksum: string;
  provider_output_id: string | null;
  generation_metadata: Record<string, unknown>;
  status: CandidateAssetStatus;
  is_primary: boolean;
  retention_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonaCandidateAssetView extends PersonaCandidateAsset {
  signed_url: string | null;
  signed_url_expires_at: string | null;
}

export const IDENTITY_REVIEW_CHECK_KEYS = [
  "same_person_across_references",
  "stable_face_structure",
  "stable_skin_tone",
  "stable_body_proportions",
  "no_ai_anatomy_defects",
  "no_inconsistent_age",
  "no_changing_eye_color",
  "no_unapproved_hairline_change",
  "no_text_watermark_artifacts",
  "realistic_hands_where_visible",
  "suitable_for_image_generation",
  "suitable_for_video_generation",
] as const;
export type IdentityReviewCheckKey = (typeof IDENTITY_REVIEW_CHECK_KEYS)[number];

export type IdentityReviewChecklist = Record<IdentityReviewCheckKey, boolean>;

export interface PersonaIdentityReview {
  id: string;
  workspace_id: string;
  persona_id: string;
  checklist: IdentityReviewChecklist;
  all_passed: boolean;
  reviewer_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonaBrandCastRequirements {
  id: string;
  workspace_id: string;
  required_male_approved: number;
  required_female_approved: number;
  milestone_label: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandCastMilestoneProgress {
  requirements: PersonaBrandCastRequirements;
  male_approved: number;
  female_approved: number;
  male_required: number;
  female_required: number;
  image_ready_count: number;
  video_ready_count: number;
  missing_reference_requirements: string[];
  milestone_reached: boolean;
  milestone_label: string;
}

export type CreateCreationProjectInput = Omit<
  PersonaCreationProject,
  | "id"
  | "workspace_id"
  | "created_at"
  | "updated_at"
  | "status"
  | "actual_cost"
  | "cost_confirmed_at"
  | "created_by"
  | "estimated_cost_min"
  | "estimated_cost_max"
  | "generation_stage"
  | "quality_mode"
  | "last_estimate_hash"
  | "last_estimate_at"
  | "last_confirmation_token"
> & {
  status?: CreationProjectStatus;
  generation_stage?: GenerationStage;
  quality_mode?: QualityMode;
  estimated_cost_min?: number;
  estimated_cost_max?: number;
  actual_cost?: number;
  cost_confirmed_at?: string | null;
  created_by?: string | null;
  last_estimate_hash?: string | null;
  last_estimate_at?: string | null;
  last_confirmation_token?: string | null;
};

export type UpdateCreationProjectInput = Partial<
  Omit<PersonaCreationProject, "id" | "workspace_id" | "created_at" | "updated_at">
>;

export type CreateCandidateInput = Omit<
  PersonaCandidate,
  | "id"
  | "workspace_id"
  | "created_at"
  | "updated_at"
  | "selected_at"
  | "converted_persona_id"
  | "status"
  | "primary_preview_asset_id"
  | "fashion_fit_review"
  | "body_proportion_review"
  | "hand_anatomy_review"
  | "face_consistency_review"
  | "realism_review"
  | "image_suitability_label"
  | "video_suitability_label"
  | "parent_candidate_id"
  | "variation_of_asset_id"
  | "actual_generation_cost"
> & {
  status?: CandidateStatus;
  selected_at?: string | null;
  converted_persona_id?: string | null;
  primary_preview_asset_id?: string | null;
  fashion_fit_review?: string;
  body_proportion_review?: string;
  hand_anatomy_review?: string;
  face_consistency_review?: string;
  realism_review?: string;
  image_suitability_label?: string;
  video_suitability_label?: string;
  parent_candidate_id?: string | null;
  variation_of_asset_id?: string | null;
  actual_generation_cost?: number;
};

export type UpdateCandidateInput = Partial<
  Omit<PersonaCandidate, "id" | "workspace_id" | "creation_project_id" | "created_at" | "updated_at">
>;

export type CreateCandidateAssetInput = Omit<
  PersonaCandidateAsset,
  | "id"
  | "workspace_id"
  | "created_at"
  | "updated_at"
  | "status"
  | "is_primary"
  | "retention_until"
> & {
  status?: CandidateAssetStatus;
  is_primary?: boolean;
  retention_until?: string | null;
};

export type UpdateCandidateAssetInput = Partial<
  Omit<
    PersonaCandidateAsset,
    "id" | "workspace_id" | "candidate_id" | "storage_path" | "created_at" | "updated_at"
  >
>;

export interface CandidateGenerationCostEstimate {
  currency: "EUR";
  candidateCount: number;
  imagesPerCandidate: number;
  totalImages: number;
  provider: string;
  providerMode: ProviderMode;
  estimatedMin: number;
  estimatedMax: number;
  estimatedTotal: number;
  stage: GenerationStage;
  note: string;
  available: boolean;
}

export interface CreationProjectPreset {
  id: string;
  label: string;
  brand_role: BrandRole;
  gender_presentation: string;
  age_range: string;
  height_range: string;
  body_type: string;
  skin_tone_direction: string;
  face_shape_direction: string;
  hair_direction: string;
  facial_hair_direction: string;
  eye_direction: string;
  expression_direction: string;
  personality: string;
  fashion_style: string;
  visual_keywords: string;
  excluded_features: string;
  preferred_brand_looks: string;
  preferred_outfits: string;
  intended_usage: IntendedUsage;
  candidate_count: number;
}
