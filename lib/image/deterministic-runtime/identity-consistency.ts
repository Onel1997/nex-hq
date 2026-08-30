import { z } from "zod";

import {
  extractFaceEmbedding,
  type FaceExtractionResult,
} from "@/lib/persona/face-novelty-memory/local-face-embedding-evaluator";
import {
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
  FACE_SIMILARITY_EMBEDDING_DIMENSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
  FACE_SIMILARITY_MODEL,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  euclideanDistance,
  euclideanToCosineSimilarity,
} from "@/lib/persona/face-novelty-memory/similarity-threshold";

export const BRAND_MODEL_IDENTITY_CONSISTENCY_VERSION =
  "nexhq-brand-model-identity-consistency-v1" as const;
export const BRAND_MODEL_IDENTITY_SIMILARITY_FORMULA_VERSION =
  "nexhq-euclidean-distance-reporting-similarity-v1" as const;
export const BRAND_MODEL_IDENTITY_SIMILARITY_FORMULA =
  "1 - euclideanDistance / 2" as const;

const detectionSchema = z
  .object({
    status: z.enum([
      "performed",
      "no_face",
      "multiple_faces",
      "low_confidence",
      "too_small",
      "unavailable",
      "error",
    ]),
    confidence: z.number().min(0).max(1),
    faceCount: z.number().int().nonnegative(),
  })
  .strict();

export const brandModelIdentityConsistencySchema = z
  .object({
    contractVersion: z.literal(BRAND_MODEL_IDENTITY_CONSISTENCY_VERSION),
    status: z.enum(["PASS", "FAIL"]),
    reason: z.enum([
      "IDENTITY_CONFIRMED",
      "MASTER_FACE_UNAVAILABLE",
      "GENERATED_FACE_UNAVAILABLE",
      "EMBEDDING_DIMENSION_MISMATCH",
      "IDENTITY_DISTANCE_TOO_HIGH",
    ]),
    authoritySource: z.literal("PERSONA_MASTER_IDENTITY_LOCK"),
    identityLockActive: z.literal(true),
    identityFallbackPrevented: z.literal(true),
    identityLockSnapshotId: z.string().min(1),
    masterIdentityAssetId: z.string().min(1),
    evaluatorVersion: z.literal(FACE_SIMILARITY_EVALUATOR_VERSION),
    thresholdVersion: z.literal(FACE_SIMILARITY_THRESHOLD_VERSION),
    gateMetric: z.literal("EUCLIDEAN_DISTANCE").optional(),
    distanceMetric: z
      .literal("EUCLIDEAN_DISTANCE_L2_NORMALIZED_128D")
      .optional(),
    gateComparison: z
      .literal("DISTANCE_LESS_THAN_OR_EQUAL_MAXIMUM")
      .optional(),
    embeddingModel: z.literal(FACE_SIMILARITY_MODEL).optional(),
    embeddingDimension: z
      .literal(FACE_SIMILARITY_EMBEDDING_DIMENSION)
      .optional(),
    similarityFormulaVersion: z
      .literal(BRAND_MODEL_IDENTITY_SIMILARITY_FORMULA_VERSION)
      .optional(),
    similarityFormula: z
      .literal(BRAND_MODEL_IDENTITY_SIMILARITY_FORMULA)
      .optional(),
    minimumDerivedSimilarityEquivalent: z.number().min(-1).max(1).optional(),
    referenceComparisonMode: z
      .literal("PERSONA_MASTER_IDENTITY_ONLY")
      .optional(),
    identityLockVersion: z.number().int().positive().optional(),
    referencePackageVersion: z.string().min(1).optional(),
    supportingReferenceCount: z.number().int().nonnegative().optional(),
    maximumEuclideanDistance: z.number().positive(),
    euclideanDistance: z.number().nonnegative().nullable(),
    similarity: z.number().min(-1).max(1).nullable(),
    masterDetection: detectionSchema,
    generatedDetection: detectionSchema,
  })
  .strict();

export type BrandModelIdentityConsistency = z.infer<
  typeof brandModelIdentityConsistencySchema
>;

type ExtractFace = (bytes: Buffer) => Promise<FaceExtractionResult>;

function safeDetection(result: FaceExtractionResult) {
  return {
    status: result.status,
    confidence: result.detectionConfidence,
    faceCount: result.faceCount,
  };
}

/**
 * Local, server-side output gate for one identity-conditioned Stage-A Base.
 * Embedding vectors remain transient and are never returned, logged or stored.
 * A missing/ambiguous face fails closed because a wrong generic model must not
 * become a reviewable deterministic asset.
 */
export async function assessBrandModelIdentityConsistency(input: {
  masterIdentityBytes: Buffer;
  generatedBaseBytes: Buffer;
  identityLockSnapshotId: string;
  masterIdentityAssetId: string;
  identityLockVersion?: number;
  referencePackageVersion?: string;
  supportingReferenceCount?: number;
  extractFace?: ExtractFace;
}): Promise<BrandModelIdentityConsistency> {
  const extract = input.extractFace ?? extractFaceEmbedding;
  const [master, generated] = await Promise.all([
    extract(input.masterIdentityBytes),
    extract(input.generatedBaseBytes),
  ]);
  const common = {
    contractVersion: BRAND_MODEL_IDENTITY_CONSISTENCY_VERSION,
    authoritySource: "PERSONA_MASTER_IDENTITY_LOCK" as const,
    identityLockActive: true as const,
    identityFallbackPrevented: true as const,
    identityLockSnapshotId: input.identityLockSnapshotId,
    masterIdentityAssetId: input.masterIdentityAssetId,
    evaluatorVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
    thresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    gateMetric: "EUCLIDEAN_DISTANCE" as const,
    distanceMetric: "EUCLIDEAN_DISTANCE_L2_NORMALIZED_128D" as const,
    gateComparison: "DISTANCE_LESS_THAN_OR_EQUAL_MAXIMUM" as const,
    embeddingModel: FACE_SIMILARITY_MODEL,
    embeddingDimension: FACE_SIMILARITY_EMBEDDING_DIMENSION,
    similarityFormulaVersion:
      BRAND_MODEL_IDENTITY_SIMILARITY_FORMULA_VERSION,
    similarityFormula: BRAND_MODEL_IDENTITY_SIMILARITY_FORMULA,
    maximumEuclideanDistance:
      FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
    minimumDerivedSimilarityEquivalent: euclideanToCosineSimilarity(
      FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
    ),
    referenceComparisonMode: "PERSONA_MASTER_IDENTITY_ONLY" as const,
    ...(input.identityLockVersion
      ? { identityLockVersion: input.identityLockVersion }
      : {}),
    ...(input.referencePackageVersion
      ? { referencePackageVersion: input.referencePackageVersion }
      : {}),
    ...(input.supportingReferenceCount !== undefined
      ? { supportingReferenceCount: input.supportingReferenceCount }
      : {}),
    masterDetection: safeDetection(master),
    generatedDetection: safeDetection(generated),
  };
  if (master.status !== "performed" || !master.embedding) {
    return brandModelIdentityConsistencySchema.parse({
      ...common,
      status: "FAIL",
      reason: "MASTER_FACE_UNAVAILABLE",
      euclideanDistance: null,
      similarity: null,
    });
  }
  if (generated.status !== "performed" || !generated.embedding) {
    return brandModelIdentityConsistencySchema.parse({
      ...common,
      status: "FAIL",
      reason: "GENERATED_FACE_UNAVAILABLE",
      euclideanDistance: null,
      similarity: null,
    });
  }
  if (master.embedding.length !== generated.embedding.length) {
    return brandModelIdentityConsistencySchema.parse({
      ...common,
      status: "FAIL",
      reason: "EMBEDDING_DIMENSION_MISMATCH",
      euclideanDistance: null,
      similarity: null,
    });
  }
  const distance = euclideanDistance(master.embedding, generated.embedding);
  const passed =
    Number.isFinite(distance) &&
    distance <= FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD;
  return brandModelIdentityConsistencySchema.parse({
    ...common,
    status: passed ? "PASS" : "FAIL",
    reason: passed
      ? "IDENTITY_CONFIRMED"
      : "IDENTITY_DISTANCE_TOO_HIGH",
    euclideanDistance: distance,
    similarity: euclideanToCosineSimilarity(distance),
  });
}
