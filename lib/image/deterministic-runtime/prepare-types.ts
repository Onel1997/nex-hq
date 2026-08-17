import { z } from "zod";
import { brandModelTraceSchema } from "@/lib/persona/domain/brand-model-contract";
import { masterArtworkReferenceSchema } from "@/lib/design/master-artwork-authority/types";

export const prepareDeterministicJobRequestSchema = z.object({
  reportRecordId: z.string().uuid(),
  reportId: z.string().uuid(),
  assetId: z.string().min(1),
  brandModelTrace: brandModelTraceSchema,
  masterArtwork: z.object({ reference: masterArtworkReferenceSchema }).strict(),
  productProfile: z.object({
    profileKey: z.string().min(1),
    version: z.number().int().positive(),
    variantId: z.string().min(1),
  }).strict(),
  printSurface: z.object({
    printSurfaceId: z.string().min(1),
    version: z.number().int().positive(),
  }).strict(),
}).strict();
export type PrepareDeterministicJobRequest = z.infer<typeof prepareDeterministicJobRequestSchema>;

export const deterministicJobActionSchema = z.object({
  action: z.enum(["confirm", "execute_fake", "retry_composite"]),
  inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
