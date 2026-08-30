import { z } from "zod";

import {
  creativeGenerationSetupSchema,
  creativeResultSchema,
} from "@/lib/creative-studio/contracts";

export const CREATIVE_SERVER_JOB_VERSION =
  "nexhq-creative-generation-job-v1" as const;

export const creativeReferenceAuthoritySchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().nonnegative(),
    name: z.string().min(1),
    mimeType: z.string().min(1),
    byteLength: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const creativeStoredResultSchema = z
  .object({
    publicView: creativeResultSchema,
    storagePath: z.string().min(1),
    byteLength: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const creativeJobManifestSchema = z
  .object({
    version: z.literal(CREATIVE_SERVER_JOB_VERSION),
    jobId: z.string().uuid(),
    workspaceId: z.string().min(1),
    actorId: z.string().min(1),
    requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    status: z.enum([
      "RUNNING",
      "SUCCEEDED",
      "PARTIALLY_SUCCEEDED",
      "FAILED",
      "UNKNOWN_OUTCOME",
    ]),
    setup: creativeGenerationSetupSchema,
    originalPrompt: z.string().min(1).max(12000),
    providerPrompt: z.string().max(20000).nullable(),
    referenceAuthority: z.array(creativeReferenceAuthoritySchema),
    provider: z.literal("fal"),
    providerModel: z.string().min(1),
    providerRequestId: z.string().min(1).nullable(),
    estimatedMaximumCostUsd: z.number().nonnegative(),
    actualCostUsd: z.number().nonnegative().nullable(),
    results: z.array(creativeStoredResultSchema),
    message: z.string().max(1000).nullable(),
    technicalError: z.string().max(4000).nullable(),
  })
  .strict();
export type CreativeJobManifest = z.infer<typeof creativeJobManifestSchema>;

export const creativeGenerateResponseSchema = z
  .object({
    success: z.boolean(),
    run: z
      .object({
        id: z.string().uuid(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        status: z.enum([
          "RUNNING",
          "SUCCEEDED",
          "PARTIALLY_SUCCEEDED",
          "FAILED",
          "UNKNOWN_OUTCOME",
        ]),
        setup: creativeGenerationSetupSchema,
        results: z.array(creativeResultSchema),
        message: z.string().max(1000).nullable(),
        provider: z.literal("fal"),
        providerModel: z.string().min(1),
        providerRequestId: z.string().min(1).nullable(),
        providerPrompt: z.string().max(20000).optional(),
        estimatedMaximumCostUsd: z.number().nonnegative(),
      })
      .strict(),
    code: z.string().min(1).optional(),
    technicalDetails: z.string().max(2000).optional(),
  })
  .strict();
export type CreativeGenerateResponse = z.infer<
  typeof creativeGenerateResponseSchema
>;
