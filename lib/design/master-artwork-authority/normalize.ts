import { approvedMasterArtworkSchema, type ApprovedMasterArtwork } from "./types";
import { normalizeRfc3339Timestamp } from "@/lib/datetime/rfc3339";

/** PostgREST timestamptz values often use +00:00 instead of Z. */
export function normalizePostgresTimestamp(value: unknown): string {
  return normalizeRfc3339Timestamp(value);
}

export function mapApprovedMasterArtworkRow(
  row: Record<string, unknown>,
): ApprovedMasterArtwork {
  return approvedMasterArtworkSchema.parse({
    contractVersion: "design-master-artwork-v1",
    id: row.id,
    workspaceId: row.workspace_id,
    designId: row.design_id,
    version: row.version,
    checksum: row.checksum,
    mimeType: row.mime_type,
    byteLength: Number(row.byte_length),
    sourceType: row.source_type,
    storagePath: row.storage_path,
    status: row.status,
    displayName:
      typeof row.display_name === "string" && row.display_name.trim()
        ? row.display_name.trim()
        : null,
    originalFileName:
      typeof row.original_file_name === "string" && row.original_file_name.trim()
        ? row.original_file_name.trim()
        : null,
    placement: row.placement,
    printMethod: row.print_method,
    sourceReportId: row.source_report_id,
    sourceHandoffAt: normalizePostgresTimestamp(row.source_handoff_at),
    provenance: row.provenance,
    approvedBy: row.approved_by,
    approvedAt: normalizePostgresTimestamp(row.approved_at),
    createdAt: normalizePostgresTimestamp(row.created_at),
  });
}
