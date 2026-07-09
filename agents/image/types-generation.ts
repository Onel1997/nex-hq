import { z } from "zod";

export const IMAGE_GENERATION_PROVIDERS = ["openai", "flux"] as const;
export type ImageGenerationProvider =
  (typeof IMAGE_GENERATION_PROVIDERS)[number];

export const imageGenerateRequestSchema = z.object({
  reportRecordId: z.string().uuid(),
  reportId: z.string().uuid(),
  assetId: z.string().min(1),
  provider: z.enum(IMAGE_GENERATION_PROVIDERS),
  promptVariant: z.enum(["openai", "flux", "midjourney"]).default("openai"),
});

export type ImageGenerateRequest = z.infer<typeof imageGenerateRequestSchema>;

export interface ImageGenerateResult {
  asset: {
    id: string;
    title: string;
    type: string;
    dimensions: string;
    platform?: string;
    provider: ImageGenerationProvider;
    status: "ready" | "generating" | "completed" | "failed";
    imageUrl?: string;
    storagePath?: string;
    createdAt?: string;
    message?: string;
  };
  providerConfigured: boolean;
}
