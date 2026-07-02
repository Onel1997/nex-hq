import { getOpenAIClient } from "@/lib/openai/client";
import {
  buildOpenAiGenerationPayload,
  getOpenAiImageModel,
  type OpenAiImageSize,
} from "@/lib/image/image-generation-config";
import type { Image } from "openai/resources/images";
import {
  extractOpenAiErrorDetails,
  ImageOpenAiQuotaExceededError,
  OPENAI_QUOTA_USER_MESSAGE,
  toOpenAiQuotaError,
} from "../generation-errors";
import type { ImageGenerationRequest, ImageGenerationResult } from "./image-provider";

/** @deprecated Use getOpenAiImageModel() from lib/image/image-generation-config */
export const OPENAI_IMAGE_MODEL = getOpenAiImageModel();

export type GptImageSize = OpenAiImageSize;

export function buildOpenAiImageRequest(
  request: ImageGenerationRequest,
): ReturnType<typeof buildOpenAiGenerationPayload> {
  return buildOpenAiGenerationPayload(request.prompt, request.dimensions);
}

async function decodeOpenAiImageItem(item: Image): Promise<Buffer> {
  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }

  if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) {
      throw new Error(`Failed to fetch OpenAI image URL: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("OpenAI Images returned no b64_json or url");
}

export function isOpenAiImagesConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateOpenAiImage(
  request: ImageGenerationRequest,
): Promise<ImageGenerationResult & { imageBytes?: Buffer }> {
  const openai = getOpenAIClient();
  const payload = buildOpenAiImageRequest(request);

  console.info("[OpenAI Images] Request payload", {
    generationMode: payload.generationMode,
    model: payload.model,
    size: payload.size,
    quality: payload.quality,
    output_format: payload.output_format,
    promptLength: payload.prompt.length,
    assetDimensions: request.dimensions,
    hasResponseFormat: "response_format" in payload,
  });

  try {
    const response = await openai.images.generate(payload);

    const item = response.data?.[0];
    if (!item) {
      throw new Error("OpenAI Images returned no image data");
    }

    const imageBytes = await decodeOpenAiImageItem(item);

    return {
      prompt: request.prompt,
      dimensions: request.dimensions,
      assetType: request.assetType,
      status: "completed",
      providerId: "openai",
      url: item.url,
      imageBytes,
    };
  } catch (error) {
    const quotaError = toOpenAiQuotaError(error, payload.model);
    if (quotaError) {
      const details = extractOpenAiErrorDetails(error, payload.model);
      console.error("[OpenAI Images] Quota exceeded", {
        generationMode: payload.generationMode,
        model: details.model,
        requestId: details.requestId,
        responseBody: details.responseBody,
        message: OPENAI_QUOTA_USER_MESSAGE,
      });
      throw quotaError;
    }
    throw error;
  }
}
