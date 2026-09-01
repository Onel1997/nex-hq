import { z } from "zod";
import { designGenerationSetupSchema, designResultSchema } from "@/lib/design-studio/contracts";

export const DESIGN_JOB_VERSION = "xeriamo-design-job-v1" as const;
export const designProviderQueueHandleSchema = z.object({
  requestId: z.string().min(1).max(512),
  endpoint: z.string().min(1).max(300),
  statusUrl: z.string().url().max(2048),
  responseUrl: z.string().url().max(2048),
  cancelUrl: z.string().url().max(2048).nullable(),
}).strict();
export const designStoredResultSchema = z.object({
  publicView: designResultSchema,
  storagePath: z.string().min(1),
  byteLength: z.number().int().positive(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export const designJobManifestSchema = z.object({
  version: z.literal(DESIGN_JOB_VERSION),
  jobId: z.string().uuid(),
  workspaceId: z.string().min(1),
  actorId: z.string().min(1),
  requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(["RUNNING", "SUCCEEDED", "PARTIALLY_SUCCEEDED", "FAILED", "UNKNOWN_OUTCOME"]),
  setup: designGenerationSetupSchema,
  originalPrompt: z.string().min(1).max(6000),
  providerPrompt: z.string().max(12000).nullable(),
  providerModel: z.string().min(1),
  providerRequestId: z.string().min(1).nullable(),
  providerQueueHandle: designProviderQueueHandleSchema.nullable().default(null),
  estimatedCostUsdMicros: z.number().int().nonnegative(),
  referenceChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  referenceStoragePath: z.string().min(1).nullable(),
  results: z.array(designStoredResultSchema).max(4),
  message: z.string().max(1000).nullable(),
  failureCode: z.enum(["PROVIDER_CAPACITY"]).nullable().default(null),
  technicalError: z.string().max(2000).nullable(),
}).strict();
export type DesignJobManifest = z.infer<typeof designJobManifestSchema>;
