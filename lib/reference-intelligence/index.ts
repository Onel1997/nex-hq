export {
  REFERENCE_INTELLIGENCE_VERSION,
  type ReferenceApprovalStatus,
  type ReferenceAsset,
  type ReferenceBoard,
  type ReferenceCameraDescriptor,
  type ReferenceDescriptor,
  type ReferenceDirection,
  type ReferenceEnvironmentDescriptor,
  type ReferenceExpressionDescriptor,
  type ReferenceExtractionMethod,
  type ReferenceIntelligenceSnapshot,
  type ReferenceLightingDescriptor,
  type ReferencePersonaDirectionDescriptor,
  type ReferencePoseDescriptor,
  type ReferenceSourceType,
  type ReferenceStylingDescriptor,
  type ReferenceTag,
  type ReferenceUsage,
  type ReferenceVisualMoodDescriptor,
  type ReferenceWorkspaceCatalog,
} from "./types";

export {
  MANUAL_DESCRIPTOR_OPTIONS,
  assertVisionExtractionDisabled,
  createEmptyDescriptorTemplate,
  flattenDescriptorValues,
  isVisionExtractionEnabled,
  personaCastingFieldsFromDescriptor,
} from "./descriptors";

export {
  MILAENE_REFERENCE_CATALOG,
  MILAENE_REFERENCE_CATALOG_VERSION,
  DEFAULT_REFERENCE_INTELLIGENCE_SLUG,
  REFERENCE_CATALOG_BY_SLUG,
  cloneReferenceCatalog,
  getReferenceCatalogForSlug,
  listReferenceCatalogSlugs,
} from "./registry";

export {
  loadReferenceCatalog,
  loadReferenceCatalogBySlug,
  loadReferenceIntelligenceSnapshot,
} from "./load";

export {
  approvalCounts,
  assertReferenceUsageAllowed,
  buildReferenceDirection,
  canReferenceBeUsedFor,
  createReferenceDescriptorFingerprint,
  dedupeReferenceDescriptors,
  getApprovedReferencesForUsage,
  isReferenceApproved,
  mergeReferenceDescriptors,
  sanitizeReferenceDescriptor,
  sanitizeReferencePromptDirection,
} from "./rules";

export {
  formatImageCampaignReferenceDirection,
  formatPersonaReferenceDirection,
  formatProductArtReferenceDirection,
  formatReferenceDirectionForUsage,
  formatReferenceIntelligencePrompt,
  formatVideoCampaignReferenceDirection,
} from "./prompt";

export {
  buildReferenceCatalogFingerprint,
  createReferenceIntelligenceSnapshot,
} from "./snapshot";
