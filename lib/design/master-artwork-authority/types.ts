import { z } from "zod";

export const DESIGN_MASTER_ARTWORK_VERSION = "design-master-artwork-v1" as const;
export const DESIGN_MASTER_ARTWORK_BINARY_META_HEADER =
  "x-nexhq-artwork-meta" as const;
export const DESIGN_ARTWORK_INCOMPLETE_OWNER_ERROR =
  "Artwork konnte nicht vollständig hochgeladen werden. Bitte erneut versuchen." as const;
export const DESIGN_MASTER_ARTWORK_SOURCE_TYPES = [
  "uploaded",
  "vector-artwork",
  "ai-designer-artwork",
  "svg-draft",
] as const;

const postgresDateTime = z.string().datetime({ offset: true });

export const approvedMasterArtworkSchema = z
  .object({
    contractVersion: z.literal(DESIGN_MASTER_ARTWORK_VERSION),
    id: z.string().uuid(),
    workspaceId: z.string().uuid(),
    designId: z.string().min(1),
    version: z.string().min(1),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    byteLength: z.number().int().positive(),
    sourceType: z.enum(DESIGN_MASTER_ARTWORK_SOURCE_TYPES),
    storagePath: z.string().min(1),
    status: z.literal("APPROVED"),
    displayName: z.string().min(1).max(120).nullable().optional(),
    originalFileName: z.string().min(1).max(255).nullable().optional(),
    placement: z.string().min(1).nullable(),
    printMethod: z.string().min(1).nullable(),
    sourceReportId: z.string().min(1).nullable(),
    sourceHandoffAt: postgresDateTime,
    provenance: z
      .object({
        authority: z.literal("DESIGN_STUDIO"),
        humanApproved: z.literal(true),
        source: z.string().min(1),
      })
      .strict(),
    approvedBy: z.string().min(1),
    approvedAt: postgresDateTime,
    createdAt: postgresDateTime,
  })
  .strict();

export type ApprovedMasterArtwork = z.infer<typeof approvedMasterArtworkSchema>;

export type ApprovedMasterArtworkView = Omit<ApprovedMasterArtwork, "storagePath">;

export function toApprovedMasterArtworkView(
  artwork: ApprovedMasterArtwork,
): ApprovedMasterArtworkView {
  const { storagePath: _privatePath, ...view } = artwork;
  void _privatePath;
  return view;
}

export const approveMasterArtworkMetaSchema = z
  .object({
    designId: z.string().min(1),
    version: z.string().min(1),
    sourceType: z.enum(DESIGN_MASTER_ARTWORK_SOURCE_TYPES),
    sourceReportId: z.string().min(1).nullable(),
    sourceHandoffAt: postgresDateTime,
    placement: z.string().min(1).nullable(),
    printMethod: z.string().min(1).nullable(),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    approvalAttestation: z.literal(true),
    provenance: z.string().min(1),
    displayName: z.string().min(1).max(120).nullable().optional(),
    originalFileName: z.string().min(1).max(255).nullable().optional(),
    expectedByteLength: z.number().int().positive().max(20_971_520),
    expectedChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type ApproveMasterArtworkMeta = z.infer<typeof approveMasterArtworkMetaSchema>;

export const approveMasterArtworkRequestSchema = approveMasterArtworkMetaSchema.extend({
  contentBase64: z.string().min(4),
});

export type ApproveMasterArtworkRequest = z.infer<
  typeof approveMasterArtworkRequestSchema
>;

export const masterArtworkReferenceSchema = z
  .object({
    id: z.string().uuid(),
    designId: z.string().min(1),
    version: z.string().min(1),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type MasterArtworkReference = z.infer<typeof masterArtworkReferenceSchema>;

/**
 * Browser-safe handoff request. The server resolves every other authority field
 * from the workspace-scoped durable Artwork record.
 */
export const masterArtworkHandoffRequestSchema = z
  .object({
    artworkId: z.string().uuid(),
  })
  .strict();

export type MasterArtworkHandoffRequest = z.infer<
  typeof masterArtworkHandoffRequestSchema
>;
