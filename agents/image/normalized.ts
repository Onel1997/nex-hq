export {
  IMAGE_SCHEMA_VERSION,
  IMAGE_SCHEMA_VERSION_V2,
  IMAGE_OUTPUT_CATEGORIES,
  IMAGE_STUDIO_ASSET_TYPES,
  IMAGE_ASSET_PRIORITIES,
  IMAGE_ASSET_STATUSES,
  imageAiPromptsSchema,
  imageMoodboardSchema,
  imagePaletteSchema,
  imageStudioAssetSchema,
  imageLookbookShotSchema,
  imageOutputSchema,
  countProductionAssets,
  countImageAssets,
  findStudioAsset,
  findImageAsset,
} from "./studio-schema";

export type {
  ImageOutputCategory,
  ImageStudioAssetType,
  ImageAssetPriority,
  ImageAssetStatus,
  ImageAiPrompts,
  ImageMoodboardSection,
  ImagePalette,
  ImageStudioAsset,
  ImageLookbookShot,
  ImageOutput,
  ImageRunInput,
  ImageRunResult,
} from "./studio-schema";

/** V3 primary asset type. */
export type NormalizedImageAsset = import("./studio-schema").ImageStudioAsset;
export type ImageCampaignShot = import("./studio-schema").ImageLookbookShot;

export {
  IMAGE_ASSET_PACKAGES,
  type ImageAssetPackage,
  type LegacyImageAssetType,
  type LegacyNormalizedImageAsset,
  type LegacyImageCampaignShot,
} from "./legacy-v2";
