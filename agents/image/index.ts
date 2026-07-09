/**
 * Image Agent — Creative Director workspace grounded in Brain intelligence.
 */

export { runImage, ImageKnowledgeError } from "./run";
export { parseImageOutput, ImageParseError } from "./parse-output";
export {
  enrichStudioPayload,
  buildV3ImageOutput,
  normalizeStudioSections,
} from "./enrich-studio";
export type { EnrichStudioOptions } from "./enrich-studio";
export { STUDIO_ASSET_SPECS, STUDIO_SPECS_BY_CATEGORY } from "./studio-specs";
export {
  extractCollectionIdentity,
  formatAssetTitle,
  resolveIdentityFromPayload,
  buildProjectName,
  isGenericCollectionName,
} from "./collection-identity";
export type { ImageCollectionIdentity } from "./collection-identity";
export {
  CORE_ASSET_SPECS,
  ADVANCED_ASSET_SPECS,
} from "./asset-specs";
export { dedupeImageAssets } from "./dedupe-assets";
export { saveImageToBrain } from "./save";
export { retrieveImageKnowledge } from "./retrieve-context";
export {
  generateImageAsset,
  ImageProviderNotConfiguredError,
} from "./generate";
export {
  ImageOpenAiQuotaExceededError,
  OPENAI_QUOTA_ERROR_CODE,
  OPENAI_QUOTA_USER_MESSAGE,
} from "./generation-errors";
export { normalizeImageSections, migrateLegacyImageSections } from "./migrate-legacy";
export type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./providers/image-provider";
export {
  PromptOnlyImageProvider,
  FUTURE_IMAGE_PROVIDERS,
} from "./providers/image-provider";
export type {
  ImageGenerateRequest,
  ImageGenerateResult,
  ImageGenerationProvider,
} from "./types-generation";
export { IMAGE_GENERATION_PROVIDERS } from "./types-generation";
export type {
  ImageRunInput,
  ImageRunResult,
  ImageOutput,
  ImageAiPrompts,
  ImageMoodboardSection,
  ImagePalette,
  ImageStudioAsset,
  ImageLookbookShot,
  ImageAssetPackage,
  LegacyImageAssetType as ImageAssetType,
} from "./types";
export {
  IMAGE_SCHEMA_VERSION,
  countImageAssets,
  findImageAsset,
} from "./studio-schema";
export { IMAGE_PROJECT_TYPE_VALUE } from "./types";
