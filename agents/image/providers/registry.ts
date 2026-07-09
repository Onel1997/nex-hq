import type { ImageGenerationProvider } from "../types-generation";
import {
  generateFluxImage,
  isFluxReplicateConfigured,
} from "./flux-replicate-provider";
import {
  generateOpenAiImage,
  isOpenAiImagesConfigured,
} from "./openai-images-provider";
import type { ImageGenerationRequest } from "./image-provider";

export function isImageProviderConfigured(
  provider: ImageGenerationProvider,
): boolean {
  switch (provider) {
    case "openai":
      return isOpenAiImagesConfigured();
    case "flux":
      return isFluxReplicateConfigured();
    default:
      return false;
  }
}

export async function generateWithProvider(
  provider: ImageGenerationProvider,
  request: ImageGenerationRequest,
) {
  switch (provider) {
    case "openai":
      return generateOpenAiImage(request);
    case "flux":
      return generateFluxImage(request);
    default:
      throw new Error(`Unsupported image provider: ${provider}`);
  }
}
