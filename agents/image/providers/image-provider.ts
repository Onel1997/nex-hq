/** Request to generate a single image asset. */
export interface ImageGenerationRequest {
  prompt: string;
  dimensions: string;
  assetType: string;
  styleNotes?: string;
  /** Persona Studio quality override — does not change Image Studio defaults. */
  qualityOverride?: "low" | "medium" | "high" | "auto";
}

/** Result from an image provider — Phase 1 stores prompts only. */
export interface ImageGenerationResult {
  prompt: string;
  dimensions: string;
  assetType: string;
  status: "pending" | "completed" | "failed";
  providerId: string;
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
