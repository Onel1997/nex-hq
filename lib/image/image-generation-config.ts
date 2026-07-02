export type ImageGenerationMode = "draft" | "production";

export type OpenAiImageQuality = "low" | "medium" | "high" | "auto";
export type OpenAiImageSize = "1024x1024" | "1536x1024" | "1024x1536";
export type OpenAiOutputFormat = "png" | "jpeg" | "webp";

export interface OpenAiGenerationProfile {
  model: "gpt-image-1";
  quality: OpenAiImageQuality;
  outputFormat: OpenAiOutputFormat;
  /** Used when useAspectAwareSize is false (draft). */
  size: OpenAiImageSize;
  /** Production maps asset dimensions to the best supported OpenAI size. */
  useAspectAwareSize: boolean;
  label: string;
}

export interface ImageGenerationConfig {
  mode: ImageGenerationMode;
  draft: OpenAiGenerationProfile;
  production: OpenAiGenerationProfile;
}

function resolveImageGenerationMode(): ImageGenerationMode {
  const explicit =
    process.env.NEXT_PUBLIC_IMAGE_GENERATION_MODE ??
    process.env.IMAGE_GENERATION_MODE;

  if (explicit === "production" || explicit === "draft") {
    return explicit;
  }

  return process.env.NODE_ENV === "production" ? "production" : "draft";
}

/** Single switch for Image Studio OpenAI generation cost vs quality. */
export const IMAGE_GENERATION: ImageGenerationConfig = {
  mode: resolveImageGenerationMode(),
  draft: {
    model: "gpt-image-1",
    size: "1024x1024",
    quality: "low",
    outputFormat: "png",
    useAspectAwareSize: false,
    label: "Draft Mode",
  },
  production: {
    model: "gpt-image-1",
    size: "1024x1024",
    quality: "high",
    outputFormat: "png",
    useAspectAwareSize: true,
    label: "Production Mode",
  },
};

export function getImageGenerationMode(): ImageGenerationMode {
  return IMAGE_GENERATION.mode;
}

export function getActiveImageGenerationProfile(): OpenAiGenerationProfile {
  return IMAGE_GENERATION[IMAGE_GENERATION.mode];
}

export function getImageGenerationModeLabel(): string {
  return getActiveImageGenerationProfile().label;
}

export function getOpenAiImageModel(): OpenAiGenerationProfile["model"] {
  return getActiveImageGenerationProfile().model;
}

function resolveAspectAwareOpenAiSize(dimensions: string): OpenAiImageSize {
  const match = dimensions.match(/(\d+)x(\d+)/i);
  if (!match) return "1024x1024";

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width > height) return "1536x1024";
  if (height > width) return "1024x1536";
  return "1024x1024";
}

export function resolveOpenAiImageSize(dimensions: string): OpenAiImageSize {
  const profile = getActiveImageGenerationProfile();
  if (profile.useAspectAwareSize) {
    return resolveAspectAwareOpenAiSize(dimensions);
  }
  return profile.size;
}

export function resolveOpenAiImageQuality(): OpenAiImageQuality {
  return getActiveImageGenerationProfile().quality;
}

export function resolveOpenAiOutputFormat(): OpenAiOutputFormat {
  return getActiveImageGenerationProfile().outputFormat;
}

export function buildOpenAiGenerationPayload(
  prompt: string,
  dimensions: string,
): {
  model: OpenAiGenerationProfile["model"];
  prompt: string;
  n: 1;
  size: OpenAiImageSize;
  quality: OpenAiImageQuality;
  output_format: OpenAiOutputFormat;
  generationMode: ImageGenerationMode;
} {
  const profile = getActiveImageGenerationProfile();

  return {
    model: profile.model,
    prompt,
    n: 1,
    size: resolveOpenAiImageSize(dimensions),
    quality: profile.quality,
    output_format: profile.outputFormat,
    generationMode: IMAGE_GENERATION.mode,
  };
}
