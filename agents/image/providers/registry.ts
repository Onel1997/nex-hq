import type { ImageGenerationProvider } from "../types-generation";
import {
  FLUX_MODEL,
  generateFluxImage,
  isFluxReplicateConfigured,
} from "./flux-replicate-provider";
import {
  generateOpenAiImage,
  isOpenAiImagesConfigured,
} from "./openai-images-provider";
import type { ImageGenerationRequest } from "./image-provider";
import { getOpenAiImageModel } from "@/lib/image/image-generation-config";
import type { ImageProviderIdentityStrategy } from "@/lib/image/image-generation-identity-contract";

export function getImageProviderModel(
  provider: ImageGenerationProvider,
): string {
  return provider === "openai" ? getOpenAiImageModel() : FLUX_MODEL;
}

export function getImageProviderIdentityStrategy(
  provider: ImageGenerationProvider,
  hasIdentity: boolean,
  hasArtwork = false,
): ImageProviderIdentityStrategy | null {
  if (!hasIdentity) return null;
  if (provider === "openai") {
    return hasArtwork
      ? "openai_master_identity_and_artwork_edit_high_fidelity"
      : "openai_master_image_edit_high_fidelity";
  }
  throw new Error(
    "Selected Brand Models require a provider with identity-reference support. The current Flux adapter is text-only.",
  );
}

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
