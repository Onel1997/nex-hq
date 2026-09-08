import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import { validateDesignSignature } from "@/lib/xeriano/library";
import { readRasterDimensions } from "@/lib/design-studio/raster-metadata";
import { resolveDesignUtilityConfig, type DesignUtilityOperation } from "@/lib/design-studio/utility-config";
import { designUtilityManifestSchema, type DesignUtilityManifest, type DesignUtilityQueueHandle } from "@/lib/design-studio/utility-contracts";
import { FalDesignUtilityProvider, DesignUtilityUnknownOutcomeError } from "@/lib/design-studio/providers/fal-utility";
import type { DesignJobScope } from "@/lib/design-studio/server-storage";
import { SupabaseDesignUtilityStore } from "@/lib/design-studio/utility-storage";
import { assertTransparentPng } from "@/lib/design-studio/png-metadata";

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 40_000_000;
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
    .eq("id", assetId).eq("account_id", context.accountId).eq("owner_user_id", context.userId)
    .eq("asset_type", "DESIGN").maybeSingle();
  if (found.error || !found.data) throw new DesignUtilityError("SOURCE_NOT_FOUND", "Design nicht gefunden.", 404);
  if (!RASTER_MIME_TYPES.has(found.data.mime_type)) throw new DesignUtilityError("VECTOR_UNSUPPORTED", "Für Vektor nicht erforderlich.", 400);
  const provenance = found.data.provenance && typeof found.data.provenance === "object"
    ? found.data.provenance as Record<string, unknown>
    : {};
  if (operation === "BACKGROUND_REMOVE" && provenance.operation === "BACKGROUND_REMOVE") {
    throw new DesignUtilityError("BACKGROUND_ALREADY_REMOVED", "Der Hintergrund wurde bereits entfernt.", 400);
  }
  const configuredMaxBytes = operation ? resolveDesignUtilityConfig(operation).maxInputBytes : MAX_BYTES;
  const expectedBytes = Number(found.data.byte_length);
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || expectedBytes > configuredMaxBytes) {
    throw new DesignUtilityError("SOURCE_INVALID", "Dieses Design kann nicht verwendet werden.", 400);
  }
  const object = await admin.storage.from(found.data.storage_bucket).download(found.data.storage_path);
  if (object.error) throw new DesignUtilityError("SOURCE_UNAVAILABLE", "Dieses Design kann gerade nicht verwendet werden.", 503);
  const bytes = Buffer.from(await object.data.arrayBuffer());
  if (bytes.length !== expectedBytes) throw new DesignUtilityError("SOURCE_INVALID", "Dieses Design kann nicht verwendet werden.", 400);
  if (!validateDesignSignature(bytes, found.data.mime_type)) throw new DesignUtilityError("SOURCE_INVALID", "Dieses Design kann nicht verwendet werden.", 400);
  const dimensions = await readRasterDimensions(bytes);
  if (dimensions.width * dimensions.height > MAX_SOURCE_PIXELS) {
    throw new DesignUtilityError("SOURCE_INVALID", "Dieses Design ist für diese Aktion zu groß.", 400);
  }
  if (operation === "UPSCALE" && Math.max(dimensions.width, dimensions.height) > 2_560) {
    throw new DesignUtilityError("UPSCALE_NOT_REQUIRED", "Dieses Design liegt bereits in hoher Auflösung vor.", 400);
  }
  return { bytes, mimeType: found.data.mime_type as "image/png" | "image/jpeg" | "image/webp", dimensions };
}

async function downloadPng(url: string, fetcher: typeof fetch, operation: DesignUtilityOperation) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("UNSAFE_UTILITY_RESULT_URL");
  const response = await fetcher(url, { redirect: "follow" });
  if (!response.ok || (response.url && new URL(response.url).protocol !== "https:")) throw new Error("UTILITY_RESULT_DOWNLOAD_FAILED");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES || !validateDesignSignature(bytes, "image/png")) throw new Error("UTILITY_RESULT_PNG_INVALID");
  if (operation === "BACKGROUND_REMOVE") {
    try {
      await assertTransparentPng(bytes);
    } catch {
      throw new DesignUtilityError(
        "BACKGROUND_RESULT_INVALID",
        "Das freigestellte Design konnte nicht sicher geprüft werden.",
        503,
      );
    }
  }
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
    providerQueueHandle: null,
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
      onAccepted: async (requestId, endpoint, queueHandle?: DesignUtilityQueueHandle) => {
        manifest = designUtilityManifestSchema.parse({
          ...manifest,
          providerRequestId: requestId,
          providerModel: endpoint,
          providerQueueHandle: queueHandle ?? null,
          updatedAt: now(),
        });
        await store.write(manifest);
        await input.onAccepted?.(requestId, endpoint, manifest.updatedAt);
      },
    });
    const bytes = await downloadPng(response.url, dependencies.fetcher ?? fetch, input.operation);
    return { manifest, bytes };
  } catch (error) {
    const terminalResultFailure = error instanceof DesignUtilityError && error.code === "BACKGROUND_RESULT_INVALID";
    const unknown = !terminalResultFailure
      && (error instanceof DesignUtilityUnknownOutcomeError || Boolean(manifest.providerRequestId));
    manifest = designUtilityManifestSchema.parse({ ...manifest, status: unknown ? "UNKNOWN_OUTCOME" : "FAILED", updatedAt: now() });
    await store.write(manifest);
    if (unknown) throw new DesignUtilityError("UNKNOWN_OUTCOME", "Der Anbieterstatus wird sicher geprüft.", 202);
    throw error;
  }
}

/** Observes one already-accepted utility job. It never uploads or submits. */
export async function recoverDesignUtility(input: {
  scope: DesignJobScope;
  jobId: string;
}, dependencies: {
  provider?: FalDesignUtilityProvider;
  store?: SupabaseDesignUtilityStore;
  fetcher?: typeof fetch;
  now?: () => string;
} = {}): Promise<{ manifest: DesignUtilityManifest; bytes: Buffer | null }> {
  const store = dependencies.store ?? new SupabaseDesignUtilityStore();
  let manifest = await store.read(input.scope, input.jobId);
  if (!manifest) throw new DesignUtilityError("UTILITY_NOT_FOUND", "Die Aktion wurde nicht gefunden.", 404);
  if (!["RUNNING", "UNKNOWN_OUTCOME"].includes(manifest.status) || !manifest.providerRequestId) {
    return { manifest, bytes: null };
  }
  const provider = dependencies.provider ?? new FalDesignUtilityProvider();
  const response = await provider.recover({
    operation: manifest.operation,
    providerRequestId: manifest.providerRequestId,
    providerModel: manifest.providerModel,
    providerQueueHandle: manifest.providerQueueHandle,
  });
  if (!response) return { manifest, bytes: null };
  try {
    const bytes = await downloadPng(response.url, dependencies.fetcher ?? fetch, manifest.operation);
    return { manifest, bytes };
  } catch (error) {
    const terminalResultFailure = error instanceof DesignUtilityError && error.code === "BACKGROUND_RESULT_INVALID";
    if (terminalResultFailure) {
      manifest = designUtilityManifestSchema.parse({
        ...manifest,
        status: "FAILED",
        updatedAt: (dependencies.now ?? (() => new Date().toISOString()))(),
      });
      await store.write(manifest);
    }
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
