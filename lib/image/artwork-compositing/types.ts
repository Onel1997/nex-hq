import { z } from "zod";

import { printRegionSchema, printSurfaceSchema } from "@/lib/image/print-surface/types";

export const COMPOSITOR_VERSION = "nexhq-deterministic-compositor-v1" as const;
export const COMPOSITOR_SAMPLING = "BILINEAR_SOURCE_PIXEL" as const;

export const artworkFidelityContractSchema = z.object({
  contractVersion: z.literal("artwork-fidelity-v1"),
  sourceChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  prohibitedMutations: z.tuple([
    z.literal("TEXT_REWRITE"),
    z.literal("LOGO_REPLACEMENT"),
    z.literal("ELEMENT_REMOVAL"),
    z.literal("ELEMENT_ADDITION"),
    z.literal("RELATIVE_LAYOUT_CHANGE"),
  ]),
  allowedTransforms: z.tuple([
    z.literal("SCALING"),
    z.literal("ROTATION"),
    z.literal("PERSPECTIVE_WARP"),
    z.literal("CLIPPING"),
    z.literal("ALPHA_BLEND"),
    z.literal("PHYSICAL_SHADING"),
    z.literal("PHYSICAL_DISPLACEMENT"),
  ]),
});

export const compositingProvenanceSchema = z.object({
  contractVersion: z.literal("compositing-provenance-v1"),
  compositorVersion: z.literal(COMPOSITOR_VERSION),
  masterArtworkId: z.string().uuid(),
  masterArtworkVersion: z.string().min(1),
  masterArtworkChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  baseImageId: z.string().min(1),
  baseImageChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  printSurfaceId: z.string().min(1),
  targetPrintRegion: printRegionSchema,
  transformMatrix: z.array(z.number()).length(9),
  blendingStrategy: z.enum(["SOURCE_OVER", "SOURCE_OVER_WITH_UNIFORM_SHADING"]),
  shadingFactor: z.number().min(0).max(1),
  samplingStrategy: z.literal("BILINEAR_SOURCE_PIXEL"),
  sourceWidth: z.number().int().positive(),
  sourceHeight: z.number().int().positive(),
  outputWidth: z.number().int().positive(),
  outputHeight: z.number().int().positive(),
  printRegionWidth: z.number().int().positive(),
  printRegionHeight: z.number().int().positive(),
  outputChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  createdAt: z.string().datetime(),
});

export const deterministicCompositeRequestSchema = z.object({
  artwork: z.object({
    id: z.string().uuid(),
    version: z.string().min(1),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    bytes: z.instanceof(Buffer),
  }),
  baseImage: z.object({
    id: z.string().min(1),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    bytes: z.instanceof(Buffer),
  }),
  printSurface: printSurfaceSchema,
  shadingFactor: z.number().min(0).max(1).default(1),
});

export type CompositingProvenance = z.infer<typeof compositingProvenanceSchema>;
export type DeterministicCompositeRequest = z.input<typeof deterministicCompositeRequestSchema>;

export interface DeterministicCompositeResult {
  pngBytes: Buffer;
  outputChecksumSha256: string;
  provenance: CompositingProvenance;
}
