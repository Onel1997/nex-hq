import type {
  ImageGenerationIdentityTrace,
  ImageIdentityConstraints,
  ImageProviderIdentityStrategy,
} from "@/lib/image/image-generation-identity-contract";
import type { ProductProductionContext } from "@/lib/image/product-production-context";

/** Server-resolved Persona identity material. Never accepted from the browser. */
export interface ImageProviderIdentityInput {
  trace: ImageGenerationIdentityTrace;
  masterReference: {
    assetId: string;
    checksum: string;
    mimeType: string;
    bytes: Buffer;
  };
  supportingReferences: Array<{
    role:
      | "front"
      | "three_quarter_left"
      | "three_quarter_right"
      | "left_profile"
      | "right_profile";
    assetId: string;
    checksum: string;
    mimeType: string;
  }>;
  constraints: ImageIdentityConstraints;
}

/** Server-frozen approved Master Artwork. Never sourced from browser paths. */
export interface ImageProviderArtworkInput {
  artworkId: string;
  designId: string;
  version: string;
  checksum: string;
  mimeType: string;
  bytes: Buffer;
  placement?: string | null;
  printMethod?: string | null;
}

/** Provider-neutral WHAT/PRODUCT/HOW context, separate from Persona identity. */
export interface ImageProviderProductionInput {
  product: ProductProductionContext;
  shot: {
    scene: string;
    lighting: string;
    poseDirection: string | null;
    shotTitle: string;
  };
}

/** Request to generate a single image asset. */
export interface ImageGenerationRequest {
  prompt: string;
  dimensions: string;
  assetType: string;
  styleNotes?: string;
  /** Persona Studio quality override — does not change Image Studio defaults. */
  qualityOverride?: "low" | "medium" | "high" | "auto";
  /** Persona Master is authoritative; supporting references are context only. */
  identity?: ImageProviderIdentityInput;
  /** WHAT is worn, independent from Persona WHO. */
  artwork?: ImageProviderArtworkInput;
  production?: ImageProviderProductionInput;
  /** Abort signal for the underlying OpenAI/fetch request. */
  signal?: AbortSignal;
}

/** Result from an image provider — Phase 1 stores prompts only. */
export interface ImageGenerationResult {
  prompt: string;
  dimensions: string;
  assetType: string;
  status: "pending" | "completed" | "failed";
  providerId: string;
  modelId: string;
  providerRequestId?: string | null;
  identityStrategy?: ImageProviderIdentityStrategy;
  imageBytes?: Buffer;
  url?: string;
  message?: string;
}

/** Moodboard generation request (multi-prompt collage). */
export interface MoodboardRequest {
  prompts: string[];
  styleNotes: string;
  dimensions?: string;
}

/** Product mockup generation request. */
export interface MockupRequest {
  productType: "hoodie" | "tshirt" | "cargo" | string;
  prompt: string;
  dimensions: string;
  styleNotes?: string;
}

/**
 * Provider abstraction for future image generation backends.
 * Phase 1: not invoked — prompts are stored in Brain only.
 */
export interface ImageProvider {
  readonly id: string;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  generateMoodboard(request: MoodboardRequest): Promise<ImageGenerationResult[]>;
  generateMockup(request: MockupRequest): Promise<ImageGenerationResult>;
}

/** Stub provider for Phase 1 — returns pending status without calling external APIs. */
export class PromptOnlyImageProvider implements ImageProvider {
  readonly id = "prompt-only";

  async generateImage(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResult> {
    return {
      prompt: request.prompt,
      dimensions: request.dimensions,
      assetType: request.assetType,
      status: "pending",
      providerId: this.id,
      modelId: "prompt-only",
      message: "Phase 1: prompt stored — image API not invoked.",
    };
  }

  async generateMoodboard(
    request: MoodboardRequest,
  ): Promise<ImageGenerationResult[]> {
    return request.prompts.map((prompt) => ({
      prompt,
      dimensions: request.dimensions ?? "2048x2048",
      assetType: "moodboard" as const,
      status: "pending" as const,
      providerId: this.id,
      modelId: "prompt-only",
      message: "Phase 1: moodboard prompt stored — image API not invoked.",
    }));
  }

  async generateMockup(request: MockupRequest): Promise<ImageGenerationResult> {
    const assetType =
      request.productType === "hoodie"
        ? "hoodie_mockup"
        : request.productType === "tshirt"
          ? "tshirt_mockup"
          : request.productType === "cargo"
            ? "cargo_mockup"
            : "hoodie_mockup";

    return {
      prompt: request.prompt,
      dimensions: request.dimensions,
      assetType,
      status: "pending",
      providerId: this.id,
      modelId: "prompt-only",
      message: "Phase 1: mockup prompt stored — image API not invoked.",
    };
  }
}

/** Registry placeholder for future providers: OpenAI Images, Flux, Recraft, Ideogram. */
export const FUTURE_IMAGE_PROVIDERS = [
  "openai-images",
  "flux",
  "recraft",
  "ideogram",
] as const;

export type FutureImageProviderId = (typeof FUTURE_IMAGE_PROVIDERS)[number];
