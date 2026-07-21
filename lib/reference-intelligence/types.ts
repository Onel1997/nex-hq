/**
 * Reference Intelligence — abstract visual inspiration SSOT.
 *
 * NEVER stores or prompts for: exact faces, celebrity identity, logos,
 * copyrighted artwork, exact garment graphics, or composition clones.
 * Descriptors are abstract reusable characteristics only.
 */

export const REFERENCE_INTELLIGENCE_VERSION = "1.7C.1";

export type ReferenceSourceType =
  | "user_upload"
  | "brand_reference"
  | "campaign_reference"
  | "social_reference"
  | "product_reference"
  | "internal_generated"
  | "unknown";

export type ReferenceUsage =
  | "persona_casting"
  | "image_campaign"
  | "video_campaign"
  | "product_art"
  | "social_content"
  | "lighting"
  | "pose"
  | "styling"
  | "environment"
  | "camera"
  | "mood";

export type ReferenceApprovalStatus =
  | "draft"
  | "approved"
  | "rejected"
  | "archived";

/** Vision models are reserved and must remain disabled in V1. */
export type ReferenceExtractionMethod =
  | "manual"
  | "imported_metadata"
  | "vision_model";

export type ReferenceTag = string;

export type ReferenceCameraDescriptor = {
  shotType?: string;
  cameraDistance?: string;
  cameraAngle?: string;
  lensFeeling?: string;
  depthOfField?: string;
  crop?: string;
  orientation?: string;
};

export type ReferenceLightingDescriptor = {
  sourceType?: string;
  softness?: string;
  direction?: string;
  contrast?: string;
  temperature?: string;
  shadowStyle?: string;
};

export type ReferencePoseDescriptor = {
  posture?: string;
  shoulderPosition?: string;
  armPosition?: string;
  movement?: string;
  bodyEnergy?: string;
  eyeDirection?: string;
};

export type ReferenceExpressionDescriptor = {
  mood?: string;
  intensity?: string;
  approachability?: string;
  confidence?: string;
  smileLevel?: string;
};

export type ReferenceStylingDescriptor = {
  silhouette?: string;
  layering?: string;
  fit?: string;
  garmentCategories?: string[];
  palette?: string[];
  texture?: string;
  /** Accessories must stay abstract — never exact jewelry/logos. */
  accessories?: string;
};

export type ReferenceEnvironmentDescriptor = {
  environmentType?: string;
  architecture?: string;
  surfaceMaterials?: string[];
  backgroundComplexity?: string;
  indoorOutdoor?: string;
};

export type ReferenceVisualMoodDescriptor = {
  campaignEnergy?: string;
  authenticity?: string;
  polish?: string;
  grain?: string;
  saturation?: string;
  contrast?: string;
  premiumLevel?: string;
  socialMediaFeel?: string;
};

export type ReferencePersonaDirectionDescriptor = {
  ageFeeling?: string;
  hairDirection?: string;
  grooming?: string;
  bodyDirection?: string;
  socialPresence?: string;
  streetwearCredibility?: string;
};

/**
 * Abstract descriptor payload. Forbidden fields (person identity, embeddings,
 * celebrity, logos, exact artwork) must never appear here.
 */
export type ReferenceDescriptor = {
  id: string;
  assetId: string;
  boardId: string;
  extractionMethod: ReferenceExtractionMethod;
  camera: ReferenceCameraDescriptor;
  lighting: ReferenceLightingDescriptor;
  pose: ReferencePoseDescriptor;
  expression: ReferenceExpressionDescriptor;
  styling: ReferenceStylingDescriptor;
  environment: ReferenceEnvironmentDescriptor;
  visualMood: ReferenceVisualMoodDescriptor;
  personaDirection: ReferencePersonaDirectionDescriptor;
  /** Freeform abstract notes — sanitized before prompt use. */
  notes?: string;
  createdAt: string;
  updatedAt: string;
  version: string;
};

export type ReferenceAsset = {
  id: string;
  workspaceId: string;
  boardId: string;
  title: string;
  description: string;
  sourceType: ReferenceSourceType;
  sourceLabel: string;
  /** External URL if any — never emit as public generation URL in prompts. */
  sourceUrl: string | null;
  localAssetId: string | null;
  storagePath: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  tags: ReferenceTag[];
  usage: ReferenceUsage[];
  approvalStatus: ReferenceApprovalStatus;
  rightsNotes: string;
  extractionMethod: ReferenceExtractionMethod;
  descriptorId: string | null;
  createdAt: string;
  updatedAt: string;
  version: string;
};

export type ReferenceBoard = {
  id: string;
  workspaceId: string;
  brandSlug: string;
  name: string;
  description: string;
  primaryUsage: ReferenceUsage;
  allowedUsages: ReferenceUsage[];
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
  version: string;
};

export type ReferenceWorkspaceCatalog = {
  brandSlug: string;
  workspaceId: string;
  version: string;
  boards: ReferenceBoard[];
  assets: ReferenceAsset[];
  descriptors: ReferenceDescriptor[];
  /** Vision extraction is reserved and disabled. */
  visionExtractionEnabled: false;
  updatedAt: string;
};

export type ReferenceDirection = {
  usage: ReferenceUsage;
  descriptorIds: string[];
  assetIds: string[];
  boardIds: string[];
  abstractLines: string[];
  fingerprint: string;
};

export type ReferenceIntelligenceSnapshot = {
  referenceIntelligenceVersion: string;
  brandSlug: string;
  workspaceId: string;
  catalogVersion: string;
  capturedAt: string;
  referenceBoardIds: string[];
  referenceAssetIds: string[];
  referenceDescriptorSnapshot: ReferenceDescriptor[];
  referenceFingerprint: string;
  extractionMethods: ReferenceExtractionMethod[];
  approvalStates: ReferenceApprovalStatus[];
  usageFilter: ReferenceUsage | null;
};
