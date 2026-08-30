import { z } from "zod";

import { imageCostEstimateSchema, IMAGE_GENERATION_JOB_STATUSES } from "@/lib/image/paid-generation/types";
import { imageGenerationInputSnapshotV2Schema, mockupHumanReviewSchema } from "@/lib/image/paid-generation/types-v2";
import { rfc3339DateTimeSchema } from "@/lib/datetime/rfc3339";
import { productionStageOutputSchema } from "@/lib/image/deterministic-production/two-stage-attempt";

export const deterministicImageJobSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  createdBy: z.string().min(1),
  createdAt: rfc3339DateTimeSchema,
  updatedAt: rfc3339DateTimeSchema,
  inputSnapshot: imageGenerationInputSnapshotV2Schema,
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  productionProjectId: z.string().uuid(),
  productionProjectVersion: z.number().int().positive(),
  artworkStoragePath: z.string().min(1),
  estimate: imageCostEstimateSchema,
  status: z.enum(IMAGE_GENERATION_JOB_STATUSES),
  confirmationToken: z.string().nullable(),
  confirmationFingerprint: z.string().nullable(),
  confirmationExpiresAt: rfc3339DateTimeSchema,
  confirmedBy: z.string().nullable(),
  confirmedAt: rfc3339DateTimeSchema.nullable(),
  attemptCount: z.number().int().nonnegative(),
  providerRequestId: z.string().nullable(),
  resultAssetIds: z.array(z.string()),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  safeRetryAllowed: z.boolean(),
  unknownOutcomeReason: z.string().nullable(),
  reconciliationState: z.enum(["not_required", "required", "resolved_no_charge", "resolved_charged"]).nullable(),
  startedAt: rfc3339DateTimeSchema.nullable(),
  completedAt: rfc3339DateTimeSchema.nullable(),
  cancelledAt: rfc3339DateTimeSchema.nullable(),
});

export type DeterministicImageJob = z.infer<typeof deterministicImageJobSchema>;

export const deterministicAssetSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  productionProjectId: z.string().uuid(),
  generationJobId: z.string().uuid(),
  shotId: z.string().min(1),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  storagePath: z.string().min(1),
  baseStageOutputId: z.string().uuid(),
  compositeStageOutputId: z.string().uuid(),
  reviewStatus: z.enum(["REVIEW_REQUIRED", "APPROVED", "REJECTED"]),
  mockupReview: mockupHumanReviewSchema,
  reviewedBy: z.string().nullable(),
  reviewedAt: rfc3339DateTimeSchema.nullable(),
  reviewNote: z.string().nullable(),
  generatedAt: rfc3339DateTimeSchema,
  createdAt: rfc3339DateTimeSchema,
  updatedAt: rfc3339DateTimeSchema,
});
export type DeterministicAsset = z.infer<typeof deterministicAssetSchema>;

export const deterministicReviewRequestSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  checklist: z.object({
    identity: z.enum(["PASS", "NEEDS_REVIEW", "FAIL"]),
    productFidelity: z.enum(["PASS", "NEEDS_REVIEW", "FAIL"]),
    artworkFidelityExact: z.enum(["PASS", "NEEDS_REVIEW", "FAIL"]),
    placement: z.enum(["PASS", "NEEDS_REVIEW", "FAIL"]),
    perspective: z.enum(["PASS", "NEEDS_REVIEW", "FAIL"]),
    lightingIntegration: z.enum(["PASS", "NEEDS_REVIEW", "FAIL"]),
  }).strict(),
  note: z.string().max(2000).nullable().default(null),
}).strict();

export const deterministicRecoverySchema = z.object({
  state: z.enum([
    "AWAITING_CONFIRMATION", "CONFIRMED", "BASE_RUNNING", "BASE_READY", "COMPOSITING", "SAVING_RESULT",
    "REVIEW_REQUIRED", "APPROVED", "REJECTED", "COMPOSITE_FAILED",
    "UNKNOWN_PROVIDER_OUTCOME", "CANCELLED", "BASE_FAILED",
  ]),
  job: deterministicImageJobSchema,
  stages: z.array(productionStageOutputSchema),
  asset: deterministicAssetSchema.nullable(),
});

export type DeterministicRecovery = z.infer<typeof deterministicRecoverySchema>;

export type DeterministicImageJobView = Omit<DeterministicImageJob, "artworkStoragePath" | "confirmationToken" | "inputSnapshot"> & {
  inputSnapshot: Omit<DeterministicImageJob["inputSnapshot"], "productVisualInput"> & {
    productVisualInput: DeterministicImageJob["inputSnapshot"]["productVisualInput"];
  };
};

export function toDeterministicImageJobView(job: DeterministicImageJob): DeterministicImageJobView {
  const { artworkStoragePath: _artwork, confirmationToken: _token, ...view } = job;
  void _artwork; void _token;
  return {
    ...view,
    inputSnapshot: {
      ...job.inputSnapshot,
      productVisualInput: {
        ...job.inputSnapshot.productVisualInput,
        referencePackage: {
          ...job.inputSnapshot.productVisualInput.referencePackage,
          references: job.inputSnapshot.productVisualInput.referencePackage.references.map((reference) => ({
            ...reference,
            privateStoragePath: null,
          })),
        },
      },
    },
  };
}
