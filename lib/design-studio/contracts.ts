import { z } from "zod";

export const DESIGN_STUDIO_CONTRACT_VERSION = "xeriamo-design-studio-v1" as const;
export const DESIGN_MODELS = ["IDEOGRAM_4", "RECRAFT_4"] as const;
export const DESIGN_OUTPUT_MODES = ["RASTER", "VECTOR"] as const;
export const DESIGN_ASPECT_RATIOS = ["1:1", "4:5", "3:4", "2:3"] as const;
export const DESIGN_QUALITIES = ["FAST", "STANDARD", "HIGH"] as const;
export const DESIGN_RASTER_RESOLUTIONS = ["2K", "4K"] as const;
export const DESIGN_COUNTS = [1, 2, 4] as const;
export const DESIGN_STYLE_PRESETS = [
  "NONE", "STREETWEAR", "VINTAGE", "TYPOGRAPHY", "EDITORIAL", "ILLUSTRATION", "MINIMAL",
] as const;
export const DESIGN_REFERENCE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const DESIGN_REFERENCE_MAX_BYTES = 8 * 1024 * 1024;

export const designReferenceSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.enum(DESIGN_REFERENCE_MIME_TYPES),
  byteLength: z.number().int().positive().max(DESIGN_REFERENCE_MAX_BYTES),
}).strict();

export const designGenerationSetupSchema = z.object({
  contractVersion: z.literal(DESIGN_STUDIO_CONTRACT_VERSION),
  prompt: z.string().trim().min(3).max(6000),
  stylePreset: z.enum(DESIGN_STYLE_PRESETS),
  model: z.enum(DESIGN_MODELS),
  outputMode: z.enum(DESIGN_OUTPUT_MODES),
  aspectRatio: z.enum(DESIGN_ASPECT_RATIOS),
  quality: z.enum(DESIGN_QUALITIES),
  resolution: z.enum(DESIGN_RASTER_RESOLUTIONS).default("2K"),
  count: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  reference: designReferenceSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (value.model === "IDEOGRAM_4" && value.outputMode === "VECTOR") {
    context.addIssue({ code: "custom", path: ["outputMode"], message: "Ideogram unterstützt nur Bildausgabe." });
  }
  if (value.model === "RECRAFT_4" && value.quality !== "STANDARD") {
    context.addIssue({ code: "custom", path: ["quality"], message: "Recraft verwendet die Standardqualität." });
  }
  if (value.model === "RECRAFT_4" && value.count !== 1) {
    context.addIssue({ code: "custom", path: ["count"], message: "Recraft unterstützt in V1 eine Ausgabe pro Auftrag." });
  }
});
export type DesignGenerationSetup = z.infer<typeof designGenerationSetupSchema>;

export const designResultSchema = z.object({
  id: z.string().uuid(),
  url: z.string().min(1),
  downloadUrl: z.string().min(1),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  resolution: z.enum(DESIGN_RASTER_RESOLUTIONS).nullable().default(null),
  favorite: z.boolean(),
  libraryAssetId: z.string().uuid().nullable(),
  creationId: z.string().uuid().nullable(),
}).strict();
export type DesignResult = z.infer<typeof designResultSchema>;

export const designRunSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(["RUNNING", "SUCCEEDED", "PARTIALLY_SUCCEEDED", "FAILED", "UNKNOWN_OUTCOME"]),
  setup: designGenerationSetupSchema,
  results: z.array(designResultSchema).max(4),
  message: z.string().max(1000).nullable(),
  failureCode: z.enum(["PROVIDER_CAPACITY"]).nullable().optional(),
}).strict();
export type DesignRun = z.infer<typeof designRunSchema>;

export const designGenerateResponseSchema = z.object({
  success: z.boolean(),
  run: designRunSchema.optional(),
  credit: z.object({
    quotedCredits: z.number().int().positive(),
    pricingVersion: z.string(),
    state: z.string(),
    availableCredits: z.number().int().nonnegative(),
  }).optional(),
  code: z.string().optional(),
  error: z.string().optional(),
}).strict();

export const DESIGN_MODEL_LABELS: Record<DesignGenerationSetup["model"], string> = {
  IDEOGRAM_4: "Ideogram 4",
  RECRAFT_4: "Recraft 4",
};
