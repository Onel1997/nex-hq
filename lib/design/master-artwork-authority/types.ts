import { z } from "zod";

export const DESIGN_MASTER_ARTWORK_VERSION = "design-master-artwork-v1" as const;
export const DESIGN_MASTER_ARTWORK_SOURCE_TYPES = [
  "uploaded",
  "vector-artwork",
  "ai-designer-artwork",
  "svg-draft",
] as const;

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
    placement: z.string().min(1).nullable(),
    printMethod: z.string().min(1).nullable(),
    sourceReportId: z.string().min(1).nullable(),
    sourceHandoffAt: z.string().datetime(),
    provenance: z
      .object({
        authority: z.literal("DESIGN_STUDIO"),
        humanApproved: z.literal(true),
        source: z.string().min(1),
      })
      .strict(),
    approvedBy: z.string().min(1),
    approvedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
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

export const approveMasterArtworkRequestSchema = z
  .object({
    designId: z.string().min(1),
    version: z.string().min(1),
    sourceType: z.enum(DESIGN_MASTER_ARTWORK_SOURCE_TYPES),
    sourceReportId: z.string().min(1).nullable(),
    sourceHandoffAt: z.string().datetime(),
    placement: z.string().min(1).nullable(),
    printMethod: z.string().min(1).nullable(),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    contentBase64: z.string().min(4),
    approvalAttestation: z.literal(true),
    provenance: z.string().min(1),
  })
  .strict();

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
