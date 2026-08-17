import { z } from "zod";
import { brandModelTraceSchema } from "@/lib/persona/domain/brand-model-contract";
import { IMAGE_GENERATION_PROVIDERS } from "@/agents/image/types-generation";
import { rfc3339DateTimeSchema } from "@/lib/datetime/rfc3339";
import {
  productProductionContextSchema,
  productProductionSelectionSchema,
} from "@/lib/image/product-production-context";
import { masterArtworkReferenceSchema } from "@/lib/design/master-artwork-authority/types";

export const IMAGE_GENERATION_INPUT_VERSION = "image-generation-input-v1" as const;

export const imageMasterArtworkSnapshotSchema = z.object({
  artworkId: z.string().uuid(),
  designId: z.string().min(1),
  version: z.string().min(1),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  byteLength: z.number().int().positive(),
  sourceType: z.enum(["vector-artwork", "ai-designer-artwork", "svg-draft", "uploaded"]),
  approvalStatus: z.literal("APPROVED"),
  sourceReportId: z.string().min(1).nullable(),
  sourceHandoffAt: z.string().min(1),
  placement: z.string().nullable(),
  printMethod: z.string().nullable(),
  provenance: z.literal("DESIGN_STUDIO_DURABLE"),
}).strict();

export const imageProductSnapshotSchema = productProductionContextSchema;

export const imageGenerationInputSnapshotSchema = z.object({
  version: z.literal(IMAGE_GENERATION_INPUT_VERSION),
  workspaceId: z.string().min(1),
  brandModel: brandModelTraceSchema.extend({
    displayName: z.string().min(1),
    masterIdentityAssetId: z.string().min(1),
  }),
  masterArtwork: imageMasterArtworkSnapshotSchema,
  product: imageProductSnapshotSchema,
  production: z.object({
    projectId: z.string().uuid(),
    projectVersion: z.number().int().positive(),
    reportRecordId: z.string().uuid(),
    reportId: z.string().uuid(),
    projectName: z.string().min(1),
    assetId: z.string().min(1),
    assetType: z.string().min(1),
    shotTitle: z.string().min(1),
    prompt: z.string().min(1),
    scene: z.string().min(1),
    lighting: z.string().min(1),
    poseDirection: z.string().nullable(),
    provider: z.enum(IMAGE_GENERATION_PROVIDERS),
    model: z.string().min(1),
    dimensions: z.string().min(1),
    quality: z.enum(["low", "medium", "high", "auto"]),
    identityStrategy: z.literal("openai_master_identity_and_artwork_edit_high_fidelity"),
    artworkStrategy: z.literal("openai_secondary_master_artwork_reference"),
  }).strict(),
}).strict();

export type ImageGenerationInputSnapshot = z.infer<typeof imageGenerationInputSnapshotSchema>;
export type ImageMasterArtworkSnapshot = z.infer<typeof imageMasterArtworkSnapshotSchema>;

export const imageCostEstimateSchema = z.object({
  currency: z.literal("USD"),
  minimum: z.number().nonnegative(),
  maximum: z.number().positive(),
  isMaximumOperatorConfigured: z.literal(true),
  pricingVersion: z.string().min(1),
  basis: z.string().min(1),
}).strict();
export type ImageCostEstimate = z.infer<typeof imageCostEstimateSchema>;

export const IMAGE_GENERATION_JOB_STATUSES = [
  "awaiting_confirmation", "confirmed", "running", "succeeded", "failed",
  "unknown_outcome", "cancelled",
] as const;

export const imageGenerationJobSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().min(1),
  createdBy: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  inputSnapshot: imageGenerationInputSnapshotSchema,
  productionProjectId: z.string().uuid(),
  productionProjectVersion: z.number().int().positive(),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  artworkStoragePath: z.string().min(1),
  estimate: imageCostEstimateSchema,
  status: z.enum(IMAGE_GENERATION_JOB_STATUSES),
  confirmationToken: z.string().min(1).nullable(),
  confirmationFingerprint: z.string().nullable(),
  confirmationExpiresAt: rfc3339DateTimeSchema,
  confirmedBy: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  attemptCount: z.number().int().nonnegative(),
  providerRequestId: z.string().nullable(),
  resultAssetIds: z.array(z.string()),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  safeRetryAllowed: z.boolean(),
  unknownOutcomeReason: z.string().nullable(),
  reconciliationState: z.enum(["not_required", "required", "resolved_no_charge", "resolved_charged"]).nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
}).strict();
export type ImageGenerationJob = z.infer<typeof imageGenerationJobSchema>;
export type ImageGenerationJobView = Omit<ImageGenerationJob, "artworkStoragePath" | "confirmationToken">;

/** Client-safe projection. Private storage paths never leave the server. */
export function toImageGenerationJobView(job: ImageGenerationJob): ImageGenerationJobView {
  const {
    artworkStoragePath: _privatePath,
    confirmationToken: _serverConfirmationToken,
    ...view
  } = job;
  void _privatePath;
  void _serverConfirmationToken;
  return view;
}

export const prepareImageGenerationJobRequestSchema = z.object({
  reportRecordId: z.string().uuid(),
  reportId: z.string().uuid(),
  assetId: z.string().min(1),
  provider: z.enum(IMAGE_GENERATION_PROVIDERS),
  brandModelTrace: brandModelTraceSchema,
  masterArtwork: z.object({
    reference: masterArtworkReferenceSchema,
  }).strict(),
  product: productProductionSelectionSchema,
}).strict();
export type PrepareImageGenerationJobRequest = z.infer<typeof prepareImageGenerationJobRequestSchema>;

export const imageGenerationJobActionSchema = z.object({
  action: z.enum(["confirm", "execute", "retry_known_failure", "cancel"]),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  confirmationToken: z.string().min(1).optional(),
}).strict();
