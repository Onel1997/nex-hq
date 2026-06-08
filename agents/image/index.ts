/**
 * Image Agent — structured image-generation projects grounded in Brain intelligence.
 * Phase 1: prompts only — no image API calls.
 */

export { runImage, ImageKnowledgeError } from "./run";
export { parseImageOutput, ImageParseError } from "./parse-output";
export { enrichImagePayload } from "./enrich-output";
export { saveImageToBrain } from "./save";
export { retrieveImageKnowledge } from "./retrieve-context";
export type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  MoodboardRequest,
  MockupRequest,
  FutureImageProviderId,
} from "./providers/image-provider";
export {
  PromptOnlyImageProvider,
  FUTURE_IMAGE_PROVIDERS,
} from "./providers/image-provider";
export type {
  ImageRunInput,
  ImageRunResult,
  ImageOutput,
  ImageAsset,
  ImageAssetType,
} from "./types";
export { IMAGE_ASSET_TYPES } from "./types";
