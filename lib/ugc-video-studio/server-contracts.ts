import { z } from "zod";

import {
  ugcVideoGenerationSetupSchema,
  ugcVideoProviderErrorSchema,
  ugcVideoQueueObservationSchema,
  ugcVideoResultSchema,
} from "@/lib/ugc-video-studio/contracts";

export const UGC_VIDEO_SERVER_JOB_VERSION =
  "nexhq-ugc-video-generation-job-v1" as const;

export const ugcVideoReferenceAuthoritySchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().nonnegative(),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    mediaType: z.enum(["IMAGE", "VIDEO", "AUDIO"]),
    byteLength: z.number().int().positive(),
    durationSeconds: z.number().positive().max(3600).nullable(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const ugcVideoStoredResultSchema = z
  .object({
    publicView: ugcVideoResultSchema,
    storagePath: z.string().min(1),
    byteLength: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const ugcVideoJobManifestSchema = z
  .object({
    version: z.literal(UGC_VIDEO_SERVER_JOB_VERSION),
    jobId: z.string().uuid(),
    workspaceId: z.string().min(1),
    actorId: z.string().min(1),
    requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    status: z.enum(["RUNNING", "SUCCEEDED", "FAILED", "UNKNOWN_OUTCOME"]),
    setup: ugcVideoGenerationSetupSchema,
    originalPrompt: z.string().max(12000),
    providerPrompt: z.string().max(20000).nullable(),
    referenceAuthority: z.array(ugcVideoReferenceAuthoritySchema).max(50),
    provider: z.literal("fal"),
    providerModel: z.string().min(1),
    providerRequestId: z.string().min(1).nullable(),
    providerSubmittedAt: z.string().datetime().nullable().default(null),
    providerStatus: z
      .enum(["SUBMITTING", "IN_QUEUE", "IN_PROGRESS", "COMPLETED", "FAILED"])
      .nullable()
      .default(null),
    providerStatusCheckedAt: z.string().datetime().nullable().default(null),
    providerStatusUrl: z.string().url().nullable().default(null),
    providerResponseUrl: z.string().url().nullable().default(null),
    providerCancelUrl: z.string().url().nullable().default(null),
    providerQueuePosition: z.number().int().nonnegative().nullable().default(null),
    providerObservationError: z.string().max(4000).nullable().default(null),
    providerError: ugcVideoProviderErrorSchema.nullable().default(null),
    queueObservations: z
      .array(ugcVideoQueueObservationSchema)
      .max(8)
      .default([]),
    estimatedMaximumCostUsd: z.number().nonnegative(),
    actualCostUsd: z.number().nonnegative().nullable(),
    providerResult: ugcVideoResultSchema.nullable().default(null),
    result: ugcVideoStoredResultSchema.nullable(),
    message: z.string().max(1000).nullable(),
    technicalError: z.string().max(4000).nullable(),
  })
  .strict();
export type UgcVideoJobManifest = z.infer<typeof ugcVideoJobManifestSchema>;
