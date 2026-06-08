import { getOpenAIClient } from "@/lib/openai/client";
import type { Image } from "openai/resources/images";
import type { ImageGenerationRequest, ImageGenerationResult } from "./image-provider";

/** GPT Image models always return base64 — response_format is not supported. */
export const OPENAI_IMAGE_MODEL = "gpt-image-1" as const;

type GptImageSize = "1024x1024" | "1536x1024" | "1024x1536";

function gptImageSize(dimensions: string): GptImageSize {
  const match = dimensions.match(/(\d+)x(\d+)/i);
  if (!match) return "1024x1024";
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width > height) return "1536x1024";
  if (height > width) return "1024x1536";
  return "1024x1024";
}

export function buildOpenAiImageRequest(
  request: ImageGenerationRequest,
): {
  model: typeof OPENAI_IMAGE_MODEL;
  prompt: string;
  n: 1;
  size: GptImageSize;
  quality: "medium";
  output_format: "png";
} {
  return {
    model: OPENAI_IMAGE_MODEL,
    prompt: request.prompt,
    n: 1,
    size: gptImageSize(request.dimensions),
    quality: "medium",
    output_format: "png",
  };
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
    model: payload.model,
    size: payload.size,
    quality: payload.quality,
    output_format: payload.output_format,
    promptLength: payload.prompt.length,
    hasResponseFormat: "response_format" in payload,
  });

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
}
