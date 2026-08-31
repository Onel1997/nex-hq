import { z } from "zod";

export const XERIAMO_TEMP_REFERENCE_BUCKET =
  "xeriamo-temp-references" as const;
export const XERIAMO_TEMP_REFERENCE_TTL_SECONDS = 24 * 60 * 60;
export const XERIAMO_PROVIDER_REFERENCE_URL_TTL_SECONDS = 60 * 60;

export const xerianoTempReferenceStudioSchema = z.enum([
  "CREATIVE_STUDIO",
  "UGC_VIDEO_STUDIO",
]);
export const xerianoTempReferenceKindSchema = z.enum([
  "IMAGE",
  "VIDEO",
  "AUDIO",
]);
export const xerianoTempReferenceUploadStateSchema = z.enum([
  "PENDING",
  "READY",
  "BOUND",
  "DELETED",
]);

export type XerianoTempReferenceStudio = z.infer<
  typeof xerianoTempReferenceStudioSchema
>;
export type XerianoTempReferenceKind = z.infer<
  typeof xerianoTempReferenceKindSchema
>;
export type XerianoTempReferenceUploadState = z.infer<
  typeof xerianoTempReferenceUploadStateSchema
>;

export const xerianoTempReferenceSlotRequestSchema = z
  .object({
    studio: xerianoTempReferenceStudioSchema,
    kind: xerianoTempReferenceKindSchema,
    mimeType: z.string().trim().min(1).max(120),
    byteSize: z.number().int().positive().max(200 * 1024 * 1024),
    filename: z.string().trim().min(1).max(255),
  })
  .strict();

export const xerianoTempReferenceGenerateEntrySchema = z
  .object({
    referenceId: z.string().min(1).max(160),
    tempReferenceId: z.string().uuid(),
  })
  .strict();

export type XerianoTempReferenceGenerateEntry = z.infer<
  typeof xerianoTempReferenceGenerateEntrySchema
>;

export type XerianoTempReferenceClientState =
  | "UPLOADING"
  | "READY"
  | "FAILED";
