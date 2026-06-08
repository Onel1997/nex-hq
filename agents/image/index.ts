/**
 * Image Agent — Creative Director workspace grounded in Brain intelligence.
 */

export { runImage, ImageKnowledgeError } from "./run";
export { parseImageOutput, ImageParseError } from "./parse-output";
export { enrichImagePayload } from "./enrich-packages";
export { saveImageToBrain } from "./save";
export { retrieveImageKnowledge } from "./retrieve-context";
export {
  generateImageAsset,
  ImageProviderNotConfiguredError,
} from "./generate";
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
  NormalizedImageAsset,
  ImageCampaignShot,
  ImageAssetPackage,
  ImageAssetType,
} from "./types";
export {
  IMAGE_SCHEMA_VERSION,
  countImageAssets,
  findImageAsset,
} from "./normalized";
export { IMAGE_PROJECT_TYPE_VALUE } from "./types";
