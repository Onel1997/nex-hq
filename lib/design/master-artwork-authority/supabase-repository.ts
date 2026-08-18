import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaStoreError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { mapApprovedMasterArtworkRow } from "./normalize";
import type {
  CreateApprovedMasterArtwork,
  MasterArtworkAuthorityRepository,
} from "./repository";
import type { ApprovedMasterArtwork } from "./types";

function mapArtwork(row: Record<string, unknown>): ApprovedMasterArtwork {
  return mapApprovedMasterArtworkRow(row);
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
        display_name: input.displayName ?? null,
        original_file_name: input.originalFileName ?? null,
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

  async updateDisplayName(
    scope: WorkspaceScope & { actorId: string },
    artworkId: string,
    displayName: string,
  ) {
    const { data, error } = await createAdminClient()
      .from("design_master_artworks")
      .update({ display_name: displayName })
      .eq("workspace_id", scope.workspaceId)
      .eq("id", artworkId)
      .select("*")
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
