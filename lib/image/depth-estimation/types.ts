import { z } from "zod";

export const DEPTH_ESTIMATION_CONTRACT_VERSION =
  "nexhq-depth-estimation-v1" as const;
export const FAL_DEPTH_ANYTHING_V2_ADAPTER_VERSION =
  "nexhq-fal-depth-anything-v2-v1" as const;
export const FAL_DEPTH_ANYTHING_V2_MODEL =
  "fal-ai/image-preprocessors/depth-anything/v2" as const;

export const depthEstimationPolicySchema = z
  .object({
    contractVersion: z.literal("nexhq-depth-estimation-policy-v1"),
    provider: z.literal("fal"),
    model: z.string().min(1),
    adapterVersion: z.literal(FAL_DEPTH_ANYTHING_V2_ADAPTER_VERSION),
    requiredInProduction: z.boolean(),
    localFallbackAllowed: z.boolean(),
    maximumCostUsd: z.number().nonnegative(),
    minimumDynamicRange: z.number().min(0).max(1),
    maximumDiscontinuityFraction: z.number().min(0).max(1),
  })
  .strict();
export type DepthEstimationPolicy = z.infer<typeof depthEstimationPolicySchema>;

export type DepthEstimationProviderDescriptor = {
  provider: "fal";
  model: string;
  adapterVersion: typeof FAL_DEPTH_ANYTHING_V2_ADAPTER_VERSION;
  maximumCostUsd: number;
};

export type DepthEstimationProviderInput = {
  jobId: string;
  baseImage: {
    bytes: Buffer;
    checksumSha256: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp";
  };
  idempotencyKey: string;
};

export type DepthEstimationProviderResult = {
  provider: string;
  model: string;
  adapterVersion: string;
  providerRequestId: string | null;
  jobId: string;
  sourceBaseChecksumSha256: string;
  depthMapBytes: Buffer;
  outputWidth: number;
  outputHeight: number;
  outputMimeType: string;
};

export interface DepthEstimationProvider {
  describe(): DepthEstimationProviderDescriptor;
  isConfigured(): boolean;
  estimateDepth(
    input: DepthEstimationProviderInput,
  ): Promise<DepthEstimationProviderResult>;
}

const depthDimensionsSchema = z
  .object({ width: z.number().int().positive(), height: z.number().int().positive() })
  .strict();

export const depthEstimationProvenanceSchema = z
  .object({
    contractVersion: z.literal(DEPTH_ESTIMATION_CONTRACT_VERSION),
    policy: depthEstimationPolicySchema,
    status: z.enum(["VALIDATED", "REJECTED"]),
    validationReason: z.enum([
      "ACCEPTED",
      "PROVIDER_UNAVAILABLE",
      "PROVIDER_RESPONSE_INVALID",
      "SOURCE_BINDING_MISMATCH",
      "DEPTH_DECODE_FAILED",
      "DEPTH_DIMENSIONS_INVALID",
      "DEPTH_DYNAMIC_RANGE_WEAK",
      "DEPTH_DISCONTINUITY_UNSAFE",
      "DEPTH_STORAGE_FAILED",
    ]),
    provider: z.string().min(1),
    model: z.string().min(1),
    adapterVersion: z.string().min(1),
    providerRequestId: z.string().min(1).nullable(),
    jobId: z.string().uuid(),
    sourceBaseChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    idempotencyKeyHash: z.string().regex(/^[a-f0-9]{64}$/i),
    sourceDimensions: depthDimensionsSchema,
    providerOutputDimensions: depthDimensionsSchema.nullable(),
    normalizedDimensions: depthDimensionsSchema.nullable(),
    depthMapChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
    normalization: z
      .object({
        version: z.literal("nexhq-relative-depth-normalization-v1"),
        channel: z.literal("LUMINANCE"),
        orientation: z.literal("RELATIVE_ONLY_UNKNOWN_POLARITY"),
        p05: z.number().min(0).max(1),
        p95: z.number().min(0).max(1),
        dynamicRange: z.number().min(0).max(1),
        discontinuityFraction: z.number().min(0).max(1),
      })
      .strict()
      .nullable(),
    realDepth: z.literal(true),
    artworkInputIncluded: z.literal(false),
  })
  .strict();
export type DepthEstimationProvenance = z.infer<
  typeof depthEstimationProvenanceSchema
>;

export type ValidatedDepthEstimation = {
  provenance: DepthEstimationProvenance & {
    status: "VALIDATED";
    validationReason: "ACCEPTED";
    depthMapChecksumSha256: string;
    normalizedDimensions: { width: number; height: number };
    normalization: NonNullable<DepthEstimationProvenance["normalization"]>;
  };
  normalizedDepthMapPngBytes: Buffer;
};
