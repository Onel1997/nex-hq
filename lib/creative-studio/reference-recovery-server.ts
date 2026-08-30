import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  creativeReferenceSnapshotSchema,
  type CreativeReferenceSnapshot,
  type CreativeReferenceSnapshotEntry,
} from "@/lib/creative-studio/contracts";
import {
  SupabaseCreativeJobStore,
  type CreativeJobScope,
} from "@/lib/creative-studio/server-storage";

export class CreativeReferenceSnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreativeReferenceSnapshotValidationError";
  }
}

export async function validateCreativeReferenceSnapshotAuthority(input: {
  accountId: string;
  scope: CreativeJobScope;
  snapshot: CreativeReferenceSnapshot;
}): Promise<CreativeReferenceSnapshot> {
  const snapshot = creativeReferenceSnapshotSchema.parse(input.snapshot);
  const admin = createAdminClient();
  const libraryIds = snapshot.references.flatMap((entry) =>
    entry.source.kind === "LIBRARY_REFERENCE"
      ? [entry.source.libraryAssetId]
      : [],
  );
  const libraryById = new Map<
    string,
    {
      mime_type: string;
      byte_length: number;
      checksum_sha256: string | null;
    }
  >();
  if (libraryIds.length) {
    const { data, error } = await admin
      .from("xeriano_library_assets")
      .select("id,mime_type,byte_length,checksum_sha256")
      .eq("account_id", input.accountId)
      .in("id", [...new Set(libraryIds)]);
    if (error) throw error;
    for (const row of data ?? []) {
      libraryById.set(row.id, {
        mime_type: row.mime_type,
        byte_length: Number(row.byte_length),
        checksum_sha256: row.checksum_sha256,
      });
    }
  }

  const store = new SupabaseCreativeJobStore();
  const manifests = new Map<
    string,
    Awaited<ReturnType<SupabaseCreativeJobStore["readManifest"]>>
  >();
  const enriched: CreativeReferenceSnapshotEntry[] = [];
  for (const entry of snapshot.references) {
    if (entry.source.kind === "LIBRARY_REFERENCE") {
      const asset = libraryById.get(entry.source.libraryAssetId);
      if (!asset) {
        throw new CreativeReferenceSnapshotValidationError(
          "Bibliotheks-Referenz gehört nicht zum aktiven Xeriamo-Konto.",
        );
      }
      enriched.push({
        ...entry,
        mimeType: asset.mime_type,
        byteLength: asset.byte_length,
        checksumSha256: asset.checksum_sha256,
      });
      continue;
    }
    if (entry.source.kind === "GENERATED_RESULT_REFERENCE") {
      const source = entry.source;
      let manifest = manifests.get(source.sourceJobId);
      if (manifest === undefined) {
        manifest = await store.readManifest(input.scope, source.sourceJobId);
        manifests.set(source.sourceJobId, manifest);
      }
      const result = manifest?.results.find(
        (candidate) => candidate.publicView.id === source.sourceResultId,
      );
      if (!result) {
        throw new CreativeReferenceSnapshotValidationError(
          "Ergebnis-Referenz gehört nicht zum aktiven Studio-Kontext.",
        );
      }
      enriched.push({
        ...entry,
        mimeType: result.publicView.mimeType,
        byteLength: result.byteLength,
        checksumSha256: result.sha256,
      });
      continue;
    }
    enriched.push({ ...entry, checksumSha256: null });
  }

  return creativeReferenceSnapshotSchema.parse({
    ...snapshot,
    references: enriched.sort((a, b) => a.order - b.order),
  });
}
