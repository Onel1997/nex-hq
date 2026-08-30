import {
  creativeReferenceSnapshotSchema,
  type CreativeReferenceImage,
  type CreativeReferenceSnapshot,
  type CreativeReferenceSnapshotEntry,
  type CreativeRun,
} from "@/lib/creative-studio/contracts";

export type CreativeRecoveredReference = {
  entry: CreativeReferenceSnapshotEntry;
  blob: Blob;
};

export type CreativeReferenceRecoveryResult = {
  restored: CreativeRecoveredReference[];
  localOnly: CreativeReferenceSnapshotEntry[];
  unavailable: CreativeReferenceSnapshotEntry[];
};

export function buildCreativeReferenceSnapshot(input: {
  jobId: string;
  references: CreativeReferenceImage[];
  createdAt?: string;
}): CreativeReferenceSnapshot {
  return creativeReferenceSnapshotSchema.parse({
    version: "xeriano-creative-reference-snapshot-v1",
    jobId: input.jobId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    references: [...input.references]
      .sort((a, b) => a.order - b.order)
      .map((reference) => ({
        referenceId: reference.id,
        order: reference.order,
        role: reference.role,
        source: reference.source,
        filename: reference.name,
        mimeType: reference.mimeType,
        byteLength: reference.byteLength,
        checksumSha256: null,
      })),
  });
}

export function fallbackSnapshotFromRun(run: CreativeRun): CreativeReferenceSnapshot {
  return creativeReferenceSnapshotSchema.parse({
    version: "xeriano-creative-reference-snapshot-v1",
    jobId: run.id,
    createdAt: run.createdAt,
    references: [...run.setup.references]
      .sort((a, b) => a.order - b.order)
      .map((reference) => ({
        referenceId: reference.id,
        order: reference.order,
        role: reference.role,
        source: { kind: "LOCAL_FILE_REFERENCE" },
        filename: reference.name,
        mimeType: reference.mimeType,
        byteLength: reference.byteLength,
        checksumSha256: null,
      })),
  });
}

export function creativeReferenceContentUrl(
  entry: CreativeReferenceSnapshotEntry,
): string | null {
  if (entry.source.kind === "LIBRARY_REFERENCE") {
    return `/api/xeriano/library/${encodeURIComponent(entry.source.libraryAssetId)}/content`;
  }
  if (entry.source.kind === "GENERATED_RESULT_REFERENCE") {
    return `/api/creative-studio/assets/${encodeURIComponent(entry.source.sourceJobId)}/${encodeURIComponent(entry.source.sourceResultId)}`;
  }
  return null;
}

export async function saveCreativeReferenceSnapshot(input: {
  snapshot: CreativeReferenceSnapshot;
  fetcher?: typeof fetch;
}): Promise<CreativeReferenceSnapshot> {
  const response = await (input.fetcher ?? fetch)(
    `/api/creative-studio/jobs/${encodeURIComponent(input.snapshot.jobId)}/reference-snapshot`,
    {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.snapshot),
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    snapshot?: unknown;
  } | null;
  if (!response.ok || !payload?.snapshot) {
    throw new Error("creative_reference_snapshot_save_failed");
  }
  return creativeReferenceSnapshotSchema.parse(payload.snapshot);
}

export async function fetchCreativeReferenceSnapshot(input: {
  jobId: string;
  fetcher?: typeof fetch;
}): Promise<CreativeReferenceSnapshot | null> {
  const response = await (input.fetcher ?? fetch)(
    `/api/creative-studio/jobs/${encodeURIComponent(input.jobId)}/reference-snapshot`,
    { method: "GET", credentials: "same-origin", cache: "no-store" },
  );
  if (response.status === 404) return null;
  const payload = (await response.json().catch(() => null)) as {
    snapshot?: unknown;
  } | null;
  if (!response.ok || !payload?.snapshot) {
    throw new Error("creative_reference_snapshot_read_failed");
  }
  return creativeReferenceSnapshotSchema.parse(payload.snapshot);
}

export async function recoverCreativeReferenceBlobs(input: {
  snapshot: CreativeReferenceSnapshot;
  fetcher?: typeof fetch;
}): Promise<CreativeReferenceRecoveryResult> {
  const fetcher = input.fetcher ?? fetch;
  const restored: CreativeRecoveredReference[] = [];
  const localOnly: CreativeReferenceSnapshotEntry[] = [];
  const unavailable: CreativeReferenceSnapshotEntry[] = [];

  await Promise.all(
    [...input.snapshot.references]
      .sort((a, b) => a.order - b.order)
      .map(async (entry) => {
        const url = creativeReferenceContentUrl(entry);
        if (!url) {
          localOnly.push(entry);
          return;
        }
        try {
          const response = await fetcher(url, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
          });
          if (!response.ok) throw new Error(`reference_${response.status}`);
          const blob = await response.blob();
          restored.push({ entry, blob });
        } catch {
          unavailable.push(entry);
        }
      }),
  );

  const byOrder = (a: { entry: CreativeReferenceSnapshotEntry }, b: { entry: CreativeReferenceSnapshotEntry }) =>
    a.entry.order - b.entry.order;
  restored.sort(byOrder);
  localOnly.sort((a, b) => a.order - b.order);
  unavailable.sort((a, b) => a.order - b.order);
  return { restored, localOnly, unavailable };
}

/** Preserve browser-only recovery/favorite/import state when a server run refreshes. */
export function mergeCreativeRunClientState(
  incoming: CreativeRun,
  existing: CreativeRun | null | undefined,
): CreativeRun {
  if (!existing || existing.id !== incoming.id) return incoming;
  const previousResults = new Map(existing.results.map((result) => [result.id, result]));
  return {
    ...incoming,
    ...(incoming.referenceSnapshot
      ? {}
      : existing.referenceSnapshot
        ? { referenceSnapshot: existing.referenceSnapshot }
        : {}),
    results: incoming.results.map((result) => {
      const previous = previousResults.get(result.id);
      return previous
        ? {
            ...result,
            favorite: previous.favorite,
            ...(previous.libraryAssetId
              ? { libraryAssetId: previous.libraryAssetId }
              : {}),
            ...(previous.creationId
              ? { creationId: previous.creationId }
              : {}),
          }
        : result;
    }),
  };
}
