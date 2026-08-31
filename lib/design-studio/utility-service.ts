import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import { validateDesignSignature } from "@/lib/xeriano/library";
import { readRasterDimensions } from "@/lib/design-studio/raster-metadata";
import { resolveDesignUtilityConfig, type DesignUtilityOperation } from "@/lib/design-studio/utility-config";
import { designUtilityManifestSchema, type DesignUtilityManifest } from "@/lib/design-studio/utility-contracts";
import { FalDesignUtilityProvider, DesignUtilityUnknownOutcomeError } from "@/lib/design-studio/providers/fal-utility";
import type { DesignJobScope } from "@/lib/design-studio/server-storage";
import { SupabaseDesignUtilityStore } from "@/lib/design-studio/utility-storage";

const MAX_BYTES = 50 * 1024 * 1024;
const RASTER_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export class DesignUtilityError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) { super(message); }
}

export async function loadOwnedDesignRasterSource(
  context: XerianoAccountContext,
  assetId: string,
  operation?: DesignUtilityOperation,
) {
  const admin = createAdminClient();
  const found = await admin.from("xeriano_library_assets")
    .select("id,storage_bucket,storage_path,mime_type,byte_length,provenance")
    .eq("id", assetId).eq("account_id", context.accountId).eq("asset_type", "DESIGN").maybeSingle();
  if (found.error || !found.data) throw new DesignUtilityError("SOURCE_NOT_FOUND", "Design nicht gefunden.", 404);
  if (!RASTER_MIME_TYPES.has(found.data.mime_type)) throw new DesignUtilityError("VECTOR_UNSUPPORTED", "Für Vektor nicht erforderlich.", 400);
  const provenance = found.data.provenance && typeof found.data.provenance === "object"
    ? found.data.provenance as Record<string, unknown>
    : {};
  if (operation === "BACKGROUND_REMOVE" && provenance.operation === "BACKGROUND_REMOVE") {
    throw new DesignUtilityError("BACKGROUND_ALREADY_REMOVED", "Der Hintergrund wurde bereits entfernt.", 400);
  }
  if (Number(found.data.byte_length) <= 0 || Number(found.data.byte_length) > MAX_BYTES) {
    throw new DesignUtilityError("SOURCE_INVALID", "Dieses Design kann nicht verwendet werden.", 400);
  }
  const object = await admin.storage.from(found.data.storage_bucket).download(found.data.storage_path);
  if (object.error) throw new DesignUtilityError("SOURCE_UNAVAILABLE", "Dieses Design kann gerade nicht verwendet werden.", 503);
  const bytes = Buffer.from(await object.data.arrayBuffer());
  if (!validateDesignSignature(bytes, found.data.mime_type)) throw new DesignUtilityError("SOURCE_INVALID", "Dieses Design kann nicht verwendet werden.", 400);
  const dimensions = await readRasterDimensions(bytes);
  if (operation === "UPSCALE" && Math.max(dimensions.width, dimensions.height) > 2_560) {
    throw new DesignUtilityError("UPSCALE_NOT_REQUIRED", "Dieses Design liegt bereits in hoher Auflösung vor.", 400);
  }
  return { bytes, mimeType: found.data.mime_type as "image/png" | "image/jpeg" | "image/webp", dimensions };
}

async function downloadPng(url: string, fetcher: typeof fetch) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("UNSAFE_UTILITY_RESULT_URL");
  const response = await fetcher(url, { redirect: "follow" });
  if (!response.ok || (response.url && new URL(response.url).protocol !== "https:")) throw new Error("UTILITY_RESULT_DOWNLOAD_FAILED");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES || !validateDesignSignature(bytes, "image/png")) throw new Error("UTILITY_RESULT_PNG_INVALID");
  return bytes;
}

export async function executeDesignUtility(input: {
  context: XerianoAccountContext;
  scope: DesignJobScope;
  jobId: string;
  sourceAssetId: string;
  operation: DesignUtilityOperation;
  source: { bytes: Buffer; mimeType: string; dimensions: { width: number; height: number } };
  onAccepted?: (requestId: string, endpoint: string, updatedAt: string) => Promise<void> | void;
}, dependencies: {
  provider?: FalDesignUtilityProvider;
  store?: SupabaseDesignUtilityStore;
  fetcher?: typeof fetch;
  now?: () => string;
} = {}): Promise<{ manifest: DesignUtilityManifest; bytes: Buffer | null }> {
  if (input.operation === "UPSCALE" && Math.max(input.source.dimensions.width, input.source.dimensions.height) > 2_560) {
    throw new DesignUtilityError("UPSCALE_NOT_REQUIRED", "Dieses Design liegt bereits in hoher Auflösung vor.", 400);
  }
  const now = dependencies.now ?? (() => new Date().toISOString());
  const store = dependencies.store ?? new SupabaseDesignUtilityStore();
  const fingerprint = createHash("sha256")
    .update(input.jobId).update(input.context.accountId).update(input.sourceAssetId).update(input.operation)
    .digest("hex");
  const claim = await store.claim({ scope: input.scope, jobId: input.jobId, fingerprint });
  if (claim === "EXISTS") {
    const existing = await store.read(input.scope, input.jobId);
    if (!existing) throw new DesignUtilityError("UTILITY_RUNNING", "Diese Aktion wird bereits verarbeitet.", 409);
    if (existing.requestFingerprint !== fingerprint) throw new DesignUtilityError("IDEMPOTENCY_CONFLICT", "Diese Aktions-ID wurde bereits verwendet.", 409);
    return { manifest: existing, bytes: null };
  }
  const config = resolveDesignUtilityConfig(input.operation);
  let manifest = designUtilityManifestSchema.parse({
    version: "xeriamo-design-utility-job-v1", jobId: input.jobId,
    workspaceId: input.scope.workspaceId, actorId: input.scope.actorId,
    requestFingerprint: fingerprint, sourceAssetId: input.sourceAssetId, operation: input.operation,
    status: "RUNNING", providerRequestId: null, providerModel: config.endpoint,
    resultAssetId: null, resultCreationId: null, width: null, height: null,
    createdAt: now(), updatedAt: now(),
  });
  await store.write(manifest);
  const provider = dependencies.provider ?? new FalDesignUtilityProvider();
  if (!provider.isConfigured()) {
    manifest = designUtilityManifestSchema.parse({ ...manifest, status: "FAILED", updatedAt: now() });
    await store.write(manifest);
    throw new DesignUtilityError("PROVIDER_NOT_CONFIGURED", "Diese Aktion ist noch nicht verfügbar.", 503);
  }
  try {
    const response = await provider.generate({
      operation: input.operation, sourceBytes: input.source.bytes, sourceMimeType: input.source.mimeType,
      onAccepted: async (requestId, endpoint) => {
        manifest = designUtilityManifestSchema.parse({ ...manifest, providerRequestId: requestId, providerModel: endpoint, updatedAt: now() });
        await store.write(manifest);
        await input.onAccepted?.(requestId, endpoint, manifest.updatedAt);
      },
    });
    const bytes = await downloadPng(response.url, dependencies.fetcher ?? fetch);
    return { manifest, bytes };
  } catch (error) {
    const unknown = error instanceof DesignUtilityUnknownOutcomeError || Boolean(manifest.providerRequestId);
    manifest = designUtilityManifestSchema.parse({ ...manifest, status: unknown ? "UNKNOWN_OUTCOME" : "FAILED", updatedAt: now() });
    await store.write(manifest);
    if (unknown) throw new DesignUtilityError("UNKNOWN_OUTCOME", "Der Anbieterstatus wird sicher geprüft.", 202);
    throw error;
  }
}

export async function completeDesignUtilityManifest(input: {
  manifest: DesignUtilityManifest;
  result: { assetId: string; creationId: string; width: number; height: number };
  store?: SupabaseDesignUtilityStore;
}) {
  const completed = designUtilityManifestSchema.parse({
    ...input.manifest, status: "SUCCEEDED", resultAssetId: input.result.assetId,
    resultCreationId: input.result.creationId, width: input.result.width, height: input.result.height,
    updatedAt: new Date().toISOString(),
  });
  await (input.store ?? new SupabaseDesignUtilityStore()).write(completed);
  return completed;
}
