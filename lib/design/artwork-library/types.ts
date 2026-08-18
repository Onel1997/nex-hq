import { z } from "zod";

import type { ApprovedMasterArtwork } from "@/lib/design/master-artwork-authority/types";

export const ARTWORK_LIBRARY_SCHEMA_VERSION = "artwork-library-entry-v1" as const;

export const artworkRepresentationRoleSchema = z.enum([
  "ORIGINAL_SOURCE",
  "PRODUCTION_RASTER",
  "PRODUCTION_VECTOR",
  "PREVIEW",
]);

export const artworkTransparencySchema = z.enum([
  "HAS_ALPHA",
  "OPAQUE",
  "UNKNOWN",
]);

export const artworkRepresentationSchema = z.object({
  representationId: z.string().min(1),
  role: artworkRepresentationRoleSchema,
  mimeType: z.string().min(1),
  byteLength: z.number().int().positive(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  transparency: artworkTransparencySchema.default("UNKNOWN"),
  storagePath: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const artworkLibraryEntrySchema = z.object({
  schemaVersion: z.literal(ARTWORK_LIBRARY_SCHEMA_VERSION),
  artworkId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  designId: z.string().min(1),
  version: z.string().min(1),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  approvalStatus: z.literal("APPROVED"),
  displayName: z.string().min(1).max(120).nullable().optional(),
  originalFileName: z.string().min(1).max(255).nullable().optional(),
  status: z.enum(["ACTIVE", "SUPERSEDED", "REVOKED"]).default("ACTIVE"),
  representations: z.array(artworkRepresentationSchema).min(1),
  placementDefaults: z.array(z.string().min(1)).default([]),
  printMethodDefaults: z.array(z.string().min(1)).default([]),
  provenance: z.object({
    sourceType: z.string().min(1),
    sourceReportId: z.string().min(1).nullable(),
    sourceHandoffAt: z.string().datetime({ offset: true }),
  }),
  approvedBy: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
  approvedAt: z.string().datetime({ offset: true }),
});

export type ArtworkRepresentation = z.infer<typeof artworkRepresentationSchema>;
export type ArtworkLibraryEntry = z.infer<typeof artworkLibraryEntrySchema>;

/**
 * Adapts the existing durable Master Artwork authority into a product-independent
 * Artwork Library entry. The persisted private object remains canonical; the
 * library contract does not carry a Product or Shopify identity.
 */
export function toArtworkLibraryEntry(
  artwork: ApprovedMasterArtwork,
  representationMetadata?: {
    width?: number | null;
    height?: number | null;
    transparency?: z.infer<typeof artworkTransparencySchema>;
  },
): ArtworkLibraryEntry {
  return artworkLibraryEntrySchema.parse({
    schemaVersion: ARTWORK_LIBRARY_SCHEMA_VERSION,
    artworkId: artwork.id,
    workspaceId: artwork.workspaceId,
    designId: artwork.designId,
    version: artwork.version,
    checksumSha256: artwork.checksum,
    approvalStatus: artwork.status,
    displayName: artwork.displayName ?? null,
    originalFileName: artwork.originalFileName ?? null,
    status: "ACTIVE",
    representations: [
      {
        representationId: `${artwork.id}:original`,
        role: "ORIGINAL_SOURCE",
        mimeType: artwork.mimeType,
        byteLength: artwork.byteLength,
        checksumSha256: artwork.checksum,
        width: representationMetadata?.width ?? null,
        height: representationMetadata?.height ?? null,
        transparency: representationMetadata?.transparency ?? "UNKNOWN",
        storagePath: artwork.storagePath,
        createdAt: artwork.createdAt,
      },
    ],
    placementDefaults: artwork.placement ? [artwork.placement] : [],
    printMethodDefaults: artwork.printMethod
      ? artwork.printMethod.split("/").map((entry) => entry.trim()).filter(Boolean)
      : [],
    provenance: {
      sourceType: artwork.sourceType,
      sourceReportId: artwork.sourceReportId,
      sourceHandoffAt: artwork.sourceHandoffAt,
    },
    approvedBy: artwork.approvedBy,
    createdAt: artwork.createdAt,
    approvedAt: artwork.approvedAt,
  });
}
