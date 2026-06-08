export {
  IMAGE_SCHEMA_VERSION,
  IMAGE_ASSET_PACKAGES,
  IMAGE_ASSET_STATUSES,
  IMAGE_ASSET_TYPES,
  CORE_ASSET_TYPES,
  ADVANCED_ASSET_TYPES,
  imageAiPromptsSchema,
  imageMoodboardSchema,
  imagePaletteSchema,
  normalizedImageAssetSchema,
  imageCampaignShotSchema,
  imageOutputSchema,
  countImageAssets,
  findImageAsset,
} from "./normalized";

export type {
  ImageAssetPackage,
  ImageAssetStatus,
  ImageAssetType,
  ImageAiPrompts,
  ImageMoodboardSection,
  ImagePalette,
  NormalizedImageAsset,
  ImageCampaignShot,
  ImageOutput,
  ImageRunInput,
  ImageRunResult,
} from "./normalized";

export const IMAGE_PROJECT_TYPE_VALUE = "image-project" as const;
