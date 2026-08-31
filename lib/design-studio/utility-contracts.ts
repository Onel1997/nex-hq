import { z } from "zod";
import { DESIGN_UTILITY_OPERATIONS } from "@/lib/design-studio/utility-config";

export const designUtilityRequestSchema = z.object({
  jobId: z.string().uuid(),
  sourceAssetId: z.string().uuid(),
  operation: z.enum(DESIGN_UTILITY_OPERATIONS),
}).strict();
export type DesignUtilityRequest = z.infer<typeof designUtilityRequestSchema>;

export const designUtilityManifestSchema = z.object({
  version: z.literal("xeriamo-design-utility-job-v1"),
  jobId: z.string().uuid(),
  workspaceId: z.string().min(1),
  actorId: z.string().min(1),
  requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  sourceAssetId: z.string().uuid(),
  operation: z.enum(DESIGN_UTILITY_OPERATIONS),
  status: z.enum(["RUNNING", "SUCCEEDED", "UNKNOWN_OUTCOME", "FAILED"]),
  providerRequestId: z.string().min(1).nullable(),
  providerModel: z.string().min(1),
  resultAssetId: z.string().uuid().nullable(),
  resultCreationId: z.string().uuid().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type DesignUtilityManifest = z.infer<typeof designUtilityManifestSchema>;
