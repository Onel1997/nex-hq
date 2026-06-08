import type { ImageGenerationRequest, ImageGenerationResult } from "./image-provider";

const FLUX_MODEL = "black-forest-labs/flux-schnell";

function fluxAspectRatio(dimensions: string): string {
  const match = dimensions.match(/(\d+)x(\d+)/i);
  if (!match) return "1:1";
  const width = Number(match[1]);
  const height = Number(match[2]);
  const ratio = width / height;
  if (ratio > 1.3) return "16:9";
  if (ratio < 0.77) return "9:16";
  if (ratio > 1.1) return "4:3";
  if (ratio < 0.9) return "3:4";
  return "1:1";
}

export function isFluxReplicateConfigured(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

async function extractImageUrl(output: unknown): Promise<string> {
  if (typeof output === "string" && output.startsWith("http")) {
    return output;
  }
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string" && first.startsWith("http")) {
      return first;
    }
  }
  throw new Error("Flux (Replicate) returned unexpected output format");
}

export async function generateFluxImage(
  request: ImageGenerationRequest,
): Promise<ImageGenerationResult & { imageBytes?: Buffer }> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }

  const response = await fetch(
    `https://api.replicate.com/v1/models/${FLUX_MODEL}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          prompt: request.prompt,
          aspect_ratio: fluxAspectRatio(request.dimensions),
          output_format: "png",
          num_outputs: 1,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Flux (Replicate) failed: ${response.status} ${detail}`);
  }

  const prediction = (await response.json()) as {
    status?: string;
    output?: unknown;
    error?: string;
  };

  if (prediction.status === "failed" || prediction.error) {
    throw new Error(prediction.error ?? "Flux (Replicate) prediction failed");
  }

  const imageUrl = await extractImageUrl(prediction.output);
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error("Failed to download Flux image from Replicate");
  }

  const arrayBuffer = await imageResponse.arrayBuffer();

  return {
    prompt: request.prompt,
    dimensions: request.dimensions,
    assetType: request.assetType,
    status: "completed",
    providerId: "flux",
    url: imageUrl,
    imageBytes: Buffer.from(arrayBuffer),
  };
}
