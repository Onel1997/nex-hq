import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaStoreError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type {
  CreateApprovedMasterArtwork,
  MasterArtworkAuthorityRepository,
} from "./repository";
import { approvedMasterArtworkSchema, type ApprovedMasterArtwork } from "./types";

function mapArtwork(row: Record<string, unknown>): ApprovedMasterArtwork {
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
    placement: row.placement,
    printMethod: row.print_method,
    sourceReportId: row.source_report_id,
    sourceHandoffAt: row.source_handoff_at,
    provenance: row.provenance,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  });
}

export class SupabaseMasterArtworkAuthorityRepository
  implements MasterArtworkAuthorityRepository
{
  async createOrGet(
    scope: WorkspaceScope & { actorId: string },
    input: CreateApprovedMasterArtwork,
  ) {
    const db = createAdminClient();
    const existing = await db
      .from("design_master_artworks")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("design_id", input.designId)
      .eq("version", input.version)
      .eq("checksum", input.checksum)
      .maybeSingle();
    if (existing.error) throw new PersonaStoreError(existing.error.message);
    if (existing.data) return mapArtwork(existing.data as Record<string, unknown>);

    const inserted = await db
      .from("design_master_artworks")
      .insert({
        id: input.id,
        workspace_id: scope.workspaceId,
        design_id: input.designId,
        version: input.version,
        checksum: input.checksum,
        mime_type: input.mimeType,
        byte_length: input.byteLength,
        source_type: input.sourceType,
        storage_path: input.storagePath,
        status: input.status,
        placement: input.placement,
        print_method: input.printMethod,
        source_report_id: input.sourceReportId,
        source_handoff_at: input.sourceHandoffAt,
        provenance: input.provenance,
        approved_by: input.approvedBy,
        approved_at: input.approvedAt,
      })
      .select("*")
      .single();
    if (inserted.error || !inserted.data) {
      const replay = await db
        .from("design_master_artworks")
        .select("*")
        .eq("workspace_id", scope.workspaceId)
        .eq("design_id", input.designId)
        .eq("version", input.version)
        .eq("checksum", input.checksum)
        .maybeSingle();
      if (replay.data) return mapArtwork(replay.data as Record<string, unknown>);
      throw new PersonaStoreError(
        inserted.error?.message ?? "Failed to persist approved Master Artwork",
      );
    }
    return mapArtwork(inserted.data as Record<string, unknown>);
  }

  async get(scope: WorkspaceScope, id: string) {
    const { data, error } = await createAdminClient()
      .from("design_master_artworks")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new PersonaStoreError(error.message);
    return data ? mapArtwork(data as Record<string, unknown>) : null;
  }

  async list(scope: WorkspaceScope, designId?: string) {
    let query = createAdminClient()
      .from("design_master_artworks")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .order("approved_at", { ascending: false });
    if (designId) query = query.eq("design_id", designId);
    const { data, error } = await query;
    if (error) throw new PersonaStoreError(error.message);
    return (data ?? []).map((row) => mapArtwork(row as Record<string, unknown>));
  }
}
