import { z } from "zod";

import type { NormalizedBounds } from "@/lib/image/deterministic-runtime/garment-registration-v3";
import type { ProductFamilySide } from "@/lib/product-library/product-family";

export const GARMENT_SEGMENTATION_CONTRACT_VERSION =
  "garment-segmentation-v1" as const;
export const SAM3_HTTP_ADAPTER_VERSION = "nexhq-sam3-http-v1" as const;
export const FAL_SAM3_ADAPTER_VERSION = "nexhq-fal-sam3-image-v1" as const;
export const FAL_SAM3_IMAGE_MODEL = "fal-ai/sam-3/image" as const;

export const garmentSegmentationPolicySchema = z
  .object({
    contractVersion: z.literal("garment-segmentation-policy-v1"),
    required: z.literal(true),
    provider: z.enum(["SAM3", "fal"]),
    adapterVersion: z.enum([
      SAM3_HTTP_ADAPTER_VERSION,
      FAL_SAM3_ADAPTER_VERSION,
    ]),
    model: z.string().min(1),
    maximumCostUsd: z.number().nonnegative(),
  })
  .strict()
  .superRefine((policy, context) => {
    const validPair =
      (policy.provider === "SAM3" &&
        policy.adapterVersion === SAM3_HTTP_ADAPTER_VERSION) ||
      (policy.provider === "fal" &&
        policy.adapterVersion === FAL_SAM3_ADAPTER_VERSION);
    if (!validPair) {
      context.addIssue({
        code: "custom",
        path: ["adapterVersion"],
        message: "Segmentation provider and adapter version do not match.",
      });
    }
  });
export type GarmentSegmentationPolicy = z.infer<
  typeof garmentSegmentationPolicySchema
>;

export const segmentationBoundsSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .strict()
  .refine((box) => box.x + box.width <= 1.000001, {
    message: "Segmentation bounds exceed image width.",
  })
  .refine((box) => box.y + box.height <= 1.000001, {
    message: "Segmentation bounds exceed image height.",
  });

export type GarmentSegmentationCandidate = {
  candidateId: string;
  maskPngBytes: Buffer;
  maskWidth: number;
  maskHeight: number;
  bounds: z.infer<typeof segmentationBoundsSchema> | null;
  confidence: number | null;
};

export type GarmentSegmentationProviderInput = {
  baseImage: {
    bytes: Buffer;
    checksumSha256: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp";
  };
  jobId: string;
  garmentType: string;
  side: ProductFamilySide;
  textPrompt: string;
  optionalRegistrationHint: NormalizedBounds | null;
  idempotencyKey: string;
};

export type GarmentSegmentationProviderResult = {
  provider: string;
  model: string;
  providerVersion: string;
  providerRequestId: string | null;
  sourceBaseChecksumSha256: string;
  jobId: string;
  candidates: GarmentSegmentationCandidate[];
};

export type GarmentSegmentationProviderDescriptor = {
  provider: "SAM3" | "fal";
  adapterVersion:
    | typeof SAM3_HTTP_ADAPTER_VERSION
    | typeof FAL_SAM3_ADAPTER_VERSION;
  model: string;
  maximumCostUsd: number;
};

export interface GarmentSegmentationProvider {
  describe(): GarmentSegmentationProviderDescriptor;
  isConfigured(): boolean;
  segmentGarment(
    input: GarmentSegmentationProviderInput,
  ): Promise<GarmentSegmentationProviderResult>;
}

export const garmentSegmentationProvenanceSchema = z
  .object({
    contractVersion: z.literal(GARMENT_SEGMENTATION_CONTRACT_VERSION),
    policy: garmentSegmentationPolicySchema,
    status: z.enum(["VALIDATED", "REJECTED"]),
    validationReason: z.enum([
      "ACCEPTED",
      "PROVIDER_UNAVAILABLE",
      "PROVIDER_RESPONSE_INVALID",
      "SOURCE_BINDING_MISMATCH",
      "MASK_DIMENSIONS_MISMATCH",
      "MASK_STORAGE_FAILED",
      "NO_CANDIDATES",
      "TINY_MASK",
      "BACKGROUND_SIZED_MASK",
      "DISCONNECTED_MASK",
      "SKIN_OR_BODY_MASK",
      "GARMENT_TYPE_MISMATCH",
      "IMPLAUSIBLE_POSITION",
      "NO_SAFE_CANDIDATE",
    ]),
    sourceBaseChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    jobId: z.string().uuid(),
    garmentType: z.string().min(1),
    side: z.enum(["FRONT", "BACK"]),
    provider: z.string().min(1),
    model: z.string().min(1),
    providerVersion: z.string().min(1),
    providerRequestId: z.string().min(1).nullable(),
    candidateCount: z.number().int().nonnegative(),
    selectedCandidateId: z.string().min(1).nullable(),
    mask: z
      .object({
        checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        bounds: segmentationBoundsSchema,
        foregroundFraction: z.number().min(0).max(1),
        largestComponentFraction: z.number().min(0).max(1),
        skinLikeFraction: z.number().min(0).max(1),
        hintOverlap: z.number().min(0).max(1),
        selectionScore: z.number(),
      })
      .strict()
      .nullable(),
    prompt: z.string().min(1),
    idempotencyKeyHash: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .strict();

export type GarmentSegmentationProvenance = z.infer<
  typeof garmentSegmentationProvenanceSchema
>;

export type ValidatedGarmentSegmentation = {
  provenance: GarmentSegmentationProvenance & {
    status: "VALIDATED";
    validationReason: "ACCEPTED";
    mask: NonNullable<GarmentSegmentationProvenance["mask"]>;
  };
  normalizedMaskPngBytes: Buffer;
};
