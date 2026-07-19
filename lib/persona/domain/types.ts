/**
 * Persona Studio domain types — Brand Cast + reference library.
 */

export const PERSONA_STATUSES = [
  "Draft",
  "Review",
  "Approved",
  "Archived",
] as const;
export type PersonaStatus = (typeof PERSONA_STATUSES)[number];

export const LOCATION_SETTINGS = ["indoor", "outdoor"] as const;
export type LocationSetting = (typeof LOCATION_SETTINGS)[number];

export const REFERENCE_ASSET_TYPES = [
  "portrait",
  "profile",
  "full_body",
  "three_quarter",
  "video_reference",
  "other",
] as const;
export type ReferenceAssetType = (typeof REFERENCE_ASSET_TYPES)[number];

export const REFERENCE_STATUSES = [
  "uploaded",
  "review",
  "approved",
  "rejected",
  "archived",
] as const;
export type ReferenceStatus = (typeof REFERENCE_STATUSES)[number];

export const VIEW_ANGLES = [
  "front",
  "left_profile",
  "right_profile",
  "back",
  "three_quarter_left",
  "three_quarter_right",
  "unknown",
] as const;
export type ViewAngle = (typeof VIEW_ANGLES)[number];

export const FRAMINGS = [
  "face",
  "head_shoulders",
  "half_body",
  "full_body",
  "unknown",
] as const;
export type Framing = (typeof FRAMINGS)[number];

export const SOURCE_TYPES = [
  "user_upload",
  "generated_external",
  "photoshoot",
  "licensed_asset",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const PERSONA_READINESS_STATES = [
  "profile_incomplete",
  "references_incomplete",
  "image_ready",
  "video_ready",
  "production_ready",
  "archived",
] as const;
export type PersonaReadinessState = (typeof PERSONA_READINESS_STATES)[number];

export interface Persona {
  id: string;
  workspace_id: string;
  name: string;
  role: string;
  status: PersonaStatus;
  gender: string;
  age_range: string;
  height: string;
  body_type: string;
  skin_tone: string;
  hair: string;
  beard: string;
  eye_color: string;
  expression: string;
  personality: string;
  style: string;
  notes: string;
  brand_fit_score: number;
  approved: boolean;
  identity_lock_version: number;
  image_use_approved: boolean;
  video_use_approved: boolean;
  primary_reference_asset_id: string | null;
  visual_identity_notes: string;
  distinguishing_features: string;
  prohibited_changes: string;
  default_hair_style: string;
  default_facial_hair: string;
  default_expression: string;
  default_body_proportions: string;
  default_styling_notes: string;
  preferred_location_ids: string[];
  preferred_camera_preset_ids: string[];
  preferred_pose_ids: string[];
  preferred_brand_look_ids: string[];
  preferred_outfit_ids: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  workspace_id: string;
  name: string;
  category: string;
  setting: LocationSetting;
  description: string;
  tags: string[];
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CameraPreset {
  id: string;
  workspace_id: string;
  name: string;
  focal_length: string;
  framing: string;
  lighting_style: string;
  color_grade: string;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pose {
  id: string;
  workspace_id: string;
  name: string;
  category: string;
  description: string;
  body_direction: string;
  suitable_products: string[];
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandLook {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  mood: string;
  color_style: string;
  styling_notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Outfit {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  items: string[];
  tags: string[];
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonaReferenceAsset {
  id: string;
  workspace_id: string;
  persona_id: string;
  asset_type: ReferenceAssetType;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number;
  checksum: string;
  status: ReferenceStatus;
  is_primary: boolean;
  view_angle: ViewAngle;
  framing: Framing;
  expression: string;
  body_visibility: string;
  notes: string;
  source_type: SourceType;
  rights_confirmed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Signed URL payload for private reference viewing — never a permanent public URL. */
export interface PersonaReferenceAssetView extends PersonaReferenceAsset {
  signed_url: string | null;
  signed_url_expires_at: string | null;
}

export type PersonaLibraryEntity =
  | "persona"
  | "location"
  | "camera"
  | "pose"
  | "brand_look"
  | "outfit"
  | "reference_asset";

export interface PersonaStudioSnapshot {
  personas: Persona[];
  locations: Location[];
  camera_presets: CameraPreset[];
  poses: Pose[];
  brand_looks: BrandLook[];
  outfits: Outfit[];
  reference_assets: PersonaReferenceAsset[];
}

export interface PersonaStudioDashboardCounts {
  approved_personas: number;
  locations: number;
  camera_presets: number;
  pose_packs: number;
  brand_looks: number;
  outfits: number;
  draft_personas: number;
  review_personas: number;
  image_ready_personas: number;
  video_ready_personas: number;
}

export interface ReferenceCompleteness {
  front_portrait: boolean;
  left_profile: boolean;
  right_profile: boolean;
  full_body_front: boolean;
  full_body_side_or_three_quarter: boolean;
  neutral_expression: boolean;
  optional_video_reference: boolean;
  visually_complete: boolean;
}

export interface PersonaReadinessReport {
  state: PersonaReadinessState;
  states: PersonaReadinessState[];
  profile_complete: boolean;
  references_complete: boolean;
  image_ready: boolean;
  video_ready: boolean;
  production_ready: boolean;
  missing: string[];
  completeness: ReferenceCompleteness;
}

export type CreatePersonaInput = Omit<
  Persona,
  | "id"
  | "workspace_id"
  | "status"
  | "approved"
  | "created_at"
  | "updated_at"
  | "preferred_location_ids"
  | "preferred_camera_preset_ids"
  | "preferred_pose_ids"
  | "preferred_brand_look_ids"
  | "preferred_outfit_ids"
  | "identity_lock_version"
  | "primary_reference_asset_id"
  | "created_by"
  | "image_use_approved"
  | "video_use_approved"
  | "visual_identity_notes"
  | "distinguishing_features"
  | "prohibited_changes"
  | "default_hair_style"
  | "default_facial_hair"
  | "default_expression"
  | "default_body_proportions"
  | "default_styling_notes"
> & {
  status?: PersonaStatus;
  preferred_location_ids?: string[];
  preferred_camera_preset_ids?: string[];
  preferred_pose_ids?: string[];
  preferred_brand_look_ids?: string[];
  preferred_outfit_ids?: string[];
  identity_lock_version?: number;
  primary_reference_asset_id?: string | null;
  created_by?: string | null;
  image_use_approved?: boolean;
  video_use_approved?: boolean;
  visual_identity_notes?: string;
  distinguishing_features?: string;
  prohibited_changes?: string;
  default_hair_style?: string;
  default_facial_hair?: string;
  default_expression?: string;
  default_body_proportions?: string;
  default_styling_notes?: string;
};

export type UpdatePersonaInput = Partial<
  Omit<Persona, "id" | "workspace_id" | "created_at" | "updated_at" | "approved">
>;

export type CreateLocationInput = Omit<
  Location,
  "id" | "workspace_id" | "created_at" | "updated_at" | "created_by"
> & { created_by?: string | null };

export type UpdateLocationInput = Partial<
  Omit<Location, "id" | "workspace_id" | "created_at" | "updated_at">
>;

export type CreateCameraPresetInput = Omit<
  CameraPreset,
  "id" | "workspace_id" | "created_at" | "updated_at" | "created_by"
> & { created_by?: string | null };

export type UpdateCameraPresetInput = Partial<
  Omit<CameraPreset, "id" | "workspace_id" | "created_at" | "updated_at">
>;

export type CreatePoseInput = Omit<
  Pose,
  "id" | "workspace_id" | "created_at" | "updated_at" | "created_by"
> & { created_by?: string | null };

export type UpdatePoseInput = Partial<
  Omit<Pose, "id" | "workspace_id" | "created_at" | "updated_at">
>;

export type CreateBrandLookInput = Omit<
  BrandLook,
  "id" | "workspace_id" | "created_at" | "updated_at" | "created_by"
> & { created_by?: string | null };

export type UpdateBrandLookInput = Partial<
  Omit<BrandLook, "id" | "workspace_id" | "created_at" | "updated_at">
>;

export type CreateOutfitInput = Omit<
  Outfit,
  "id" | "workspace_id" | "created_at" | "updated_at" | "created_by"
> & { created_by?: string | null };

export type UpdateOutfitInput = Partial<
  Omit<Outfit, "id" | "workspace_id" | "created_at" | "updated_at">
>;

export type CreateReferenceAssetInput = Omit<
  PersonaReferenceAsset,
  | "id"
  | "workspace_id"
  | "created_at"
  | "updated_at"
  | "created_by"
  | "status"
  | "is_primary"
> & {
  status?: ReferenceStatus;
  is_primary?: boolean;
  created_by?: string | null;
};

export type UpdateReferenceAssetInput = Partial<
  Omit<
    PersonaReferenceAsset,
    "id" | "workspace_id" | "persona_id" | "storage_path" | "created_at" | "updated_at"
  >
>;

export type PersonaRelationKind =
  | "locations"
  | "camera_presets"
  | "poses"
  | "brand_looks"
  | "outfits";

export interface PersonaRelations {
  locations: Location[];
  camera_presets: CameraPreset[];
  poses: Pose[];
  brand_looks: BrandLook[];
  outfits: Outfit[];
}

export interface PersonaProductionPackage {
  persona: Persona;
  readiness: PersonaReadinessReport;
  approved_reference_assets: PersonaReferenceAsset[];
  primary_reference: PersonaReferenceAsset | null;
  preferred: PersonaRelations;
  prohibited_changes: string;
  usage: {
    image_eligible: boolean;
    video_eligible: boolean;
  };
}

export interface LibraryDeleteImpact {
  referencing_persona_ids: string[];
  referencing_persona_count: number;
}

export interface WorkspaceScope {
  workspaceId: string;
  actorId?: string | null;
}
