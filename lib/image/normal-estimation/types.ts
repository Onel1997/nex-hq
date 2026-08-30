import { z } from "zod";

export const MIDAS_NORMAL_CONTRACT_VERSION = "nexhq-fal-midas-normal-v1" as const;
export const NORMAL_ESTIMATION_POLICY_VERSION = "nexhq-normal-estimation-policy-v1" as const;
export const NORMAL_ASSISTED_TORSO_VERSION = "nexhq-normal-assisted-oriented-torso-v1" as const;
export const FAL_MIDAS_ADAPTER_VERSION = "nexhq-fal-midas-v1" as const;
export const FAL_MIDAS_MODEL = "fal-ai/image-preprocessors/midas" as const;

export const normalEstimationPolicySchema = z.object({
  contractVersion: z.literal(NORMAL_ESTIMATION_POLICY_VERSION),
  provider: z.literal("fal"),
  model: z.string().min(1),
  adapterVersion: z.literal(FAL_MIDAS_ADAPTER_VERSION),
  required: z.boolean(),
  maximumCostUsd: z.number().nonnegative(),
  minimumUsableSamples: z.number().int().positive(),
  minimumFieldConsistency: z.number().min(0).max(1),
}).strict();
export type NormalEstimationPolicy = z.infer<typeof normalEstimationPolicySchema>;

export type NormalEstimationProviderDescriptor = {
  provider: "fal";
  model: string;
  adapterVersion: typeof FAL_MIDAS_ADAPTER_VERSION;
  maximumCostUsd: number;
};

export type NormalEstimationProviderInput = {
  jobId: string;
  baseImage: {
    bytes: Buffer;
    checksumSha256: string;
    mimeType: "image/png" | "image/jpeg" | "image/webp";
  };
  idempotencyKey: string;
};

export type NormalEstimationProviderResult = {
  provider: string;
  model: string;
  adapterVersion: string;
  providerRequestId: string | null;
  jobId: string;
  sourceBaseChecksumSha256: string;
  normalMapBytes: Buffer;
  outputWidth: number;
  outputHeight: number;
  outputMimeType: string;
  depthOutputIncluded: boolean;
};

export interface NormalEstimationProvider {
  describe(): NormalEstimationProviderDescriptor;
  isConfigured(): boolean;
  estimateNormals(input: NormalEstimationProviderInput): Promise<NormalEstimationProviderResult>;
}

/**
 * The provider request may already have been accepted, but the polling
 * transport ended before NexHQ received a terminal result. Callers must
 * persist UNKNOWN_OUTCOME and must not issue a blind second paid request.
 */
export class NormalEstimationProviderOutcomeUnknownError extends Error {
  readonly code = "MIDAS_NORMAL_PROVIDER_OUTCOME_UNKNOWN" as const;

  constructor(message = "fal MiDaS provider outcome is unknown.") {
    super(message);
    this.name = "NormalEstimationProviderOutcomeUnknownError";
  }
}

const dimensionsSchema = z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).strict();
const vectorSchema = z.object({ x: z.number().min(-1).max(1), y: z.number().min(-1).max(1), z: z.number().min(-1).max(1) }).strict();

export const normalEstimationProvenanceSchema = z.object({
  contractVersion: z.literal(MIDAS_NORMAL_CONTRACT_VERSION),
  policy: normalEstimationPolicySchema,
  status: z.enum(["VALIDATED", "REJECTED", "MISSING", "UNKNOWN_OUTCOME"]),
  validationReason: z.enum([
    "ACCEPTED",
    "PROVIDER_UNAVAILABLE",
    "PROVIDER_RESPONSE_INVALID",
    "SOURCE_BINDING_MISMATCH",
    "NORMAL_DECODE_FAILED",
    "NORMAL_DIMENSIONS_INVALID",
    "NORMAL_FIELD_DEGENERATE",
    "NORMAL_SAMPLES_INSUFFICIENT",
    "NORMAL_FIELD_UNSTABLE",
    "NORMAL_STORAGE_FAILED",
    "PROVIDER_OUTCOME_UNKNOWN",
  ]),
  provider: z.string().min(1),
  model: z.string().min(1),
  adapterVersion: z.string().min(1),
  providerRequestId: z.string().min(1).nullable(),
  jobId: z.string().uuid(),
  sourceBaseChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  idempotencyKeyHash: z.string().regex(/^[a-f0-9]{64}$/i),
  sourceDimensions: dimensionsSchema,
  providerOutputDimensions: dimensionsSchema.nullable(),
  normalizedDimensions: dimensionsSchema.nullable(),
  normalMapChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable(),
  validation: z.object({
    decoding: z.literal("RGB_SIGNED_UNIT_VECTOR_X_RIGHT_Y_UP_Z_CAMERA"),
    usableGarmentSamples: z.number().int().nonnegative(),
    rejectedOutliers: z.number().int().nonnegative(),
    medianNormal: vectorSchema,
    fieldConsistency: z.number().min(0).max(1),
    directionalVariation: z.number().min(0).max(1),
  }).strict().nullable(),
  artworkInputIncluded: z.literal(false),
  depthOutputPersisted: z.literal(false),
}).strict();
export type NormalEstimationProvenance = z.infer<typeof normalEstimationProvenanceSchema>;

export type ValidatedNormalEstimation = {
  provenance: NormalEstimationProvenance & {
    status: "VALIDATED";
    validationReason: "ACCEPTED";
    normalMapChecksumSha256: string;
    normalizedDimensions: { width: number; height: number };
    validation: NonNullable<NormalEstimationProvenance["validation"]>;
  };
  normalizedNormalMapPngBytes: Buffer;
};

export const normalOrientationEvidenceSchema = z.object({
  contractVersion: z.literal(NORMAL_ASSISTED_TORSO_VERSION),
  status: z.enum(["READY", "REFUSED"]),
  reason: z.enum(["READY", "NORMAL_EVIDENCE_INSUFFICIENT", "NORMAL_FIELD_UNSTABLE"]),
  orientationDegrees: z.number().min(-20).max(20),
  confidence: z.number().min(0).max(1),
  usableSamples: z.number().int().nonnegative(),
  rejectedOutliers: z.number().int().nonnegative(),
  medianNormal: vectorSchema,
  fieldConsistency: z.number().min(0).max(1),
  directionalAnisotropy: z.number().min(0).max(1),
  backgroundEvidenceExcluded: z.literal(true),
  sleevesExcluded: z.literal(true),
  collarTransitionExcluded: z.literal(true),
  coordinateConvention: z.literal("IMAGE_X_RIGHT_IMAGE_Y_DOWN_NORMAL_Y_UP"),
}).strict();
export type NormalOrientationEvidence = z.infer<typeof normalOrientationEvidenceSchema>;
