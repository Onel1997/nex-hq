import { getOpenAIClient } from "@/lib/openai/client";
import type { ImageGenerationRequest, ImageGenerationResult } from "./image-provider";

function openAiSize(
  dimensions: string,
): "1024x1024" | "1792x1024" | "1024x1792" {
  const match = dimensions.match(/(\d+)x(\d+)/i);
  if (!match) return "1024x1024";
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width > height) return "1792x1024";
  if (height > width) return "1024x1792";
  return "1024x1024";
}

export function isOpenAiImagesConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateOpenAiImage(
  request: ImageGenerationRequest,
): Promise<ImageGenerationResult & { imageBytes?: Buffer }> {
  const openai = getOpenAIClient();
  const size = openAiSize(request.dimensions);

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: request.prompt,
    n: 1,
    size,
    quality: "standard",
    response_format: "b64_json",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI Images returned no image data");
  }

  return {
    prompt: request.prompt,
    dimensions: request.dimensions,
    assetType: request.assetType,
    status: "completed",
    providerId: "openai",
    imageBytes: Buffer.from(b64, "base64"),
  };
}
