import { z } from "zod";
import { brandModelTraceSchema } from "@/lib/persona/domain/brand-model-contract";
import { imageGenerationProvenanceSchema } from "@/lib/image/image-generation-identity-contract";

export const IMAGE_GENERATION_PROVIDERS = ["openai", "flux"] as const;
export type ImageGenerationProvider =
  (typeof IMAGE_GENERATION_PROVIDERS)[number];

export const imageGenerateRequestSchema = z
  .object({
    reportRecordId: z.string().uuid(),
    reportId: z.string().uuid(),
    assetId: z.string().min(1),
    provider: z.enum(IMAGE_GENERATION_PROVIDERS),
    promptVariant: z
      .enum(["openai", "flux", "midjourney"])
      .default("openai"),
    /** Safe identity IDs only. Private paths/URLs are rejected by strict parsing. */
    brandModelTrace: brandModelTraceSchema.optional(),
  })
  .strict();

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
    generationProvenance?: z.infer<typeof imageGenerationProvenanceSchema>;
  };
  providerConfigured: boolean;
}
