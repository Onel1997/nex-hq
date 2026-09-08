import { z } from "zod";

export const PRINT_FILE_OPERATION = "PRINT_FILE_300_DPI" as const;
export const PRINT_FILE_VERSION = "xeriamo-design-print-file-v1" as const;
export const PRINT_FILE_WIDTH = 4_500 as const;
export const PRINT_FILE_HEIGHT = 6_000 as const;
export const PRINT_FILE_DPI = 300 as const;
export const PRINT_FILE_SAFE_AREA = Object.freeze({ width: 4_050, height: 5_400 });

export const printFileRequestSchema = z.object({
  jobId: z.string().uuid(),
  sourceAssetId: z.string().uuid(),
  removeBackground: z.boolean(),
}).strict();

export const printFileManifestSchema = z.object({
  version: z.literal(PRINT_FILE_VERSION),
  jobId: z.string().uuid(),
  workspaceId: z.string().min(1),
  actorId: z.string().min(1),
  requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  sourceAssetId: z.string().uuid(),
  removeBackground: z.boolean(),
  status: z.enum(["PREPARING", "SUCCEEDED", "FAILED"]),
  resultAssetId: z.string().uuid().nullable(),
  resultCreationId: z.string().uuid().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type PrintFileManifest = z.infer<typeof printFileManifestSchema>;
