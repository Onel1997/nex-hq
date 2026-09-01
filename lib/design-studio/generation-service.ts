import { createHash, randomUUID } from "node:crypto";
import { designGenerationSetupSchema, type DesignGenerationSetup, type DesignRun } from "@/lib/design-studio/contracts";
import { buildDesignProviderPrompt, resolveDesignEndpoint } from "@/lib/design-studio/model-config";
import { resolveDesignProviderCost } from "@/lib/design-studio/pricing-config";
import { readRasterDimensions } from "@/lib/design-studio/raster-metadata";
import { FalDesignProvider } from "@/lib/design-studio/providers/fal-design";
import type { DesignProvider, DesignProviderQueueHandle, DesignProviderReference } from "@/lib/design-studio/provider";
import { DesignProviderUnknownOutcomeError } from "@/lib/design-studio/provider";
import { DesignProviderCapacityError, RECRAFT_CAPACITY_MESSAGE } from "@/lib/design-studio/provider-errors";
import { DESIGN_JOB_VERSION, designJobManifestSchema, type DesignJobManifest } from "@/lib/design-studio/server-contracts";
import { sha256, SupabaseDesignJobStore, type DesignJobScope } from "@/lib/design-studio/server-storage";
import { validateDesignSignature } from "@/lib/xeriano/library";

const MAX_RESULT_BYTES = 40 * 1024 * 1024;

export class DesignGenerationError extends Error {
  constructor(readonly code: "INVALID_REQUEST" | "REFERENCE_INVALID" | "PROVIDER_NOT_CONFIGURED" | "IDEMPOTENCY_CONFLICT" | "DUPLICATE_REQUEST_RUNNING", message: string, readonly status: number) {
    super(message); this.name = "DesignGenerationError";
  }
}

export function designManifestToRun(manifest: DesignJobManifest): DesignRun {
  return {
    id: manifest.jobId,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
    status: manifest.status,
    setup: manifest.setup,
    results: manifest.results.map((item) => item.publicView),
    message: manifest.message,
    failureCode: manifest.failureCode,
  };
}

function fingerprint(jobId: string, setup: DesignGenerationSetup, reference: DesignProviderReference | null) {
  const hash = createHash("sha256").update(jobId).update(JSON.stringify(setup));
  if (reference) hash.update(reference.bytes);
  return hash.digest("hex");
}

function safeSvg(bytes: Buffer) {
  const text = bytes.toString("utf8").trim();
  return /^<\?xml[^>]*>\s*<svg\b|^<svg\b/i.test(text)
    && !/<(?:script|foreignObject|iframe|object|embed)\b/i.test(text)
    && !/\son[a-z]+\s*=/i.test(text)
    && !/(?:href|src)\s*=\s*["']\s*(?:javascript:|https?:|\/\/)/i.test(text);
}

async function downloadResult(url: string, expectedMime: string, fetcher: typeof fetch) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("UNSAFE_PROVIDER_RESULT_URL");
  const response = await fetcher(url, { redirect: "follow" });
  if (!response.ok || (response.url && new URL(response.url).protocol !== "https:")) throw new Error("PROVIDER_RESULT_DOWNLOAD_FAILED");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_RESULT_BYTES) throw new Error("PROVIDER_RESULT_SIZE_INVALID");
  const headerMime = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const mimeType = expectedMime === "image/svg+xml" ? "image/svg+xml" : ["image/png", "image/jpeg", "image/webp"].includes(headerMime) ? headerMime : expectedMime;
  if (mimeType === "image/svg+xml" ? !safeSvg(bytes) : !validateDesignSignature(bytes, mimeType)) throw new Error("PROVIDER_RESULT_SIGNATURE_INVALID");
  return { bytes, mimeType };
}

async function persistProviderResults(input: {
  manifest: DesignJobManifest;
  response: Awaited<ReturnType<DesignProvider["generate"]>>;
  store: SupabaseDesignJobStore;
  scope: DesignJobScope;
  fetcher: typeof fetch;
  now: () => string;
}): Promise<DesignJobManifest> {
  const results: DesignJobManifest["results"] = [];
  for (const providerResult of input.response.results.slice(0, input.manifest.setup.count)) {
    try {
      const downloaded = await downloadResult(providerResult.url, providerResult.mimeType, input.fetcher);
      const actualDimensions = downloaded.mimeType === "image/svg+xml"
        ? { width: null, height: null }
        : await readRasterDimensions(downloaded.bytes);
      const resultId = randomUUID();
      const storagePath = await input.store.persistResult({
        scope: input.scope,
        jobId: input.manifest.jobId,
        resultId,
        ...downloaded,
      });
      results.push({
        publicView: {
          id: resultId,
          url: `/api/design-studio/assets/${input.manifest.jobId}/${resultId}`,
          downloadUrl: `/api/design-studio/assets/${input.manifest.jobId}/${resultId}?download=1`,
          mimeType: downloaded.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml",
          width: actualDimensions.width,
          height: actualDimensions.height,
          resolution: downloaded.mimeType === "image/svg+xml" ? null : input.manifest.setup.resolution,
          favorite: false,
          libraryAssetId: null,
          creationId: null,
        },
        storagePath,
        byteLength: downloaded.bytes.length,
        checksumSha256: sha256(downloaded.bytes),
      });
    } catch { /* One corrupt result must not hide other accepted outputs. */ }
  }
  const status = results.length === input.manifest.setup.count
    ? "SUCCEEDED"
    : results.length
      ? "PARTIALLY_SUCCEEDED"
      : "FAILED";
  const manifest = designJobManifestSchema.parse({
    ...input.manifest,
    providerRequestId: input.response.providerRequestId,
    providerModel: input.response.providerModel,
    providerPrompt: input.response.providerPrompt,
    results,
    status,
    updatedAt: input.now(),
    message: results.length ? null : "Design konnte nicht erstellt werden. Bitte versuche es erneut.",
    failureCode: null,
    technicalError: null,
  });
  await input.store.writeManifest(manifest);
  return manifest;
}

export async function generateDesignJob(input: {
  scope: DesignJobScope;
  jobId: string;
  setup: DesignGenerationSetup;
  reference: DesignProviderReference | null;
  onProviderAccepted?: (evidence: {
    providerRequestId: string;
    providerModel: string;
    updatedAt: string;
  }) => Promise<void> | void;
}, dependencies: { provider?: DesignProvider; store?: SupabaseDesignJobStore; fetcher?: typeof fetch; now?: () => string } = {}): Promise<DesignRun> {
  if (!/^[0-9a-f-]{36}$/i.test(input.jobId)) throw new DesignGenerationError("INVALID_REQUEST", "Der Design-Auftrag ist ungültig.", 400);
  const setup = designGenerationSetupSchema.parse(input.setup);
  if ((setup.reference === null) !== (input.reference === null)) throw new DesignGenerationError("REFERENCE_INVALID", "Diese Referenz kann nicht verwendet werden.", 400);
  const store = dependencies.store ?? new SupabaseDesignJobStore();
  const requestFingerprint = fingerprint(input.jobId, setup, input.reference);
  const claim = await store.claim({ scope: input.scope, jobId: input.jobId, fingerprint: requestFingerprint });
  if (claim === "EXISTS") {
    const existing = await store.readManifest(input.scope, input.jobId);
    if (!existing) throw new DesignGenerationError("DUPLICATE_REQUEST_RUNNING", "Dieser Auftrag wird bereits verarbeitet.", 409);
    if (existing.requestFingerprint !== requestFingerprint) throw new DesignGenerationError("IDEMPOTENCY_CONFLICT", "Diese Auftrags-ID gehört zu einem anderen Setup.", 409);
    return designManifestToRun(existing);
  }
  const provider = dependencies.provider ?? new FalDesignProvider();
  if (!provider.isConfigured()) throw new DesignGenerationError("PROVIDER_NOT_CONFIGURED", "Designgenerierung ist noch nicht vollständig eingerichtet.", 503);
  const now = dependencies.now ?? (() => new Date().toISOString());
  const cost = resolveDesignProviderCost(setup);
  const referenceStoragePath = input.reference
    ? await store.persistReference({ scope: input.scope, jobId: input.jobId, bytes: input.reference.bytes, mimeType: input.reference.mimeType })
    : null;
  let manifest = designJobManifestSchema.parse({
    version: DESIGN_JOB_VERSION,
    jobId: input.jobId,
    workspaceId: input.scope.workspaceId,
    actorId: input.scope.actorId,
    requestFingerprint,
    createdAt: now(), updatedAt: now(), status: "RUNNING",
    setup, originalPrompt: setup.prompt, providerPrompt: null,
    providerModel: cost.providerModel, providerRequestId: null,
    providerQueueHandle: null,
    estimatedCostUsdMicros: cost.totalCostMicros,
    referenceChecksumSha256: input.reference ? sha256(input.reference.bytes) : null,
    referenceStoragePath,
    results: [], message: "Dein Design wird erstellt.", failureCode: null, technicalError: null,
  });
  await store.writeManifest(manifest);
  try {
    const response = await provider.generate({
      jobId: input.jobId, setup, reference: input.reference,
      onAccepted: async (requestId, endpoint, queueHandle?: DesignProviderQueueHandle) => {
        manifest = designJobManifestSchema.parse({
          ...manifest,
          providerRequestId: requestId,
          providerModel: endpoint,
          providerQueueHandle: queueHandle ?? null,
          updatedAt: now(),
        });
        await store.writeManifest(manifest);
        await input.onProviderAccepted?.({
          providerRequestId: requestId,
          providerModel: endpoint,
          updatedAt: manifest.updatedAt,
        });
      },
    });
    manifest = designJobManifestSchema.parse({ ...manifest, providerRequestId: response.providerRequestId, providerModel: response.providerModel, providerPrompt: response.providerPrompt, updatedAt: now() });
    await store.writeManifest(manifest);
    manifest = await persistProviderResults({
      manifest,
      response,
      store,
      scope: input.scope,
      fetcher: dependencies.fetcher ?? fetch,
      now,
    });
    return designManifestToRun(manifest);
  } catch (error) {
    const capacity = error instanceof DesignProviderCapacityError;
    const unknown = !capacity && (error instanceof DesignProviderUnknownOutcomeError || Boolean(manifest.providerRequestId));
    manifest = designJobManifestSchema.parse({
      ...manifest,
      status: unknown ? "UNKNOWN_OUTCOME" : "FAILED",
      updatedAt: now(),
      message: capacity
        ? RECRAFT_CAPACITY_MESSAGE
        : unknown
          ? "Der Anbieterstatus wird sicher geprüft."
          : "Design konnte nicht erstellt werden. Bitte versuche es erneut.",
      failureCode: capacity ? "PROVIDER_CAPACITY" : null,
      technicalError: capacity
        ? `PROVIDER_CAPACITY:${error.providerStatus ?? "unknown"}`
        : error instanceof Error ? error.message.slice(0, 2000) : "unknown",
    });
    await store.writeManifest(manifest);
    return designManifestToRun(manifest);
  }
}

/**
 * Recovers an accepted fal queue request after reload, mobile backgrounding or
 * a terminated HTTP request. It never calls submit and therefore cannot create
 * a second provider or financial effect.
 */
export async function recoverDesignJob(
  input: { scope: DesignJobScope; jobId: string },
  dependencies: {
    provider?: DesignProvider;
    store?: SupabaseDesignJobStore;
    fetcher?: typeof fetch;
    now?: () => string;
  } = {},
): Promise<DesignRun> {
  const store = dependencies.store ?? new SupabaseDesignJobStore();
  let manifest = await store.readManifest(input.scope, input.jobId);
  if (!manifest) throw new DesignGenerationError("INVALID_REQUEST", "Der Design-Auftrag wurde nicht gefunden.", 404);
  if (!["RUNNING", "UNKNOWN_OUTCOME"].includes(manifest.status) || !manifest.providerRequestId) {
    return designManifestToRun(manifest);
  }
  const provider = dependencies.provider ?? new FalDesignProvider();
  if (!provider.recover || !provider.isConfigured()) return designManifestToRun(manifest);
  try {
    const approvedEndpoint = resolveDesignEndpoint(manifest.setup);
    if (manifest.providerModel !== approvedEndpoint) return designManifestToRun(manifest);
    const response = await provider.recover({
      setup: manifest.setup,
      providerRequestId: manifest.providerRequestId,
      providerModel: approvedEndpoint,
      providerPrompt: manifest.providerPrompt ?? buildRecoveryPrompt(manifest),
      providerQueueHandle: manifest.providerQueueHandle as DesignProviderQueueHandle | null,
    });
    if (!response) return designManifestToRun(manifest);
    manifest = await persistProviderResults({
      manifest,
      response,
      store,
      scope: input.scope,
      fetcher: dependencies.fetcher ?? fetch,
      now: dependencies.now ?? (() => new Date().toISOString()),
    });
  } catch (error) {
    if (error instanceof DesignProviderCapacityError) {
      manifest = designJobManifestSchema.parse({
        ...manifest,
        status: "FAILED",
        updatedAt: (dependencies.now ?? (() => new Date().toISOString()))(),
        message: RECRAFT_CAPACITY_MESSAGE,
        failureCode: "PROVIDER_CAPACITY",
        technicalError: `PROVIDER_CAPACITY:${error.providerStatus ?? "unknown"}`,
      });
      await store.writeManifest(manifest);
    }
    // Observation failures are not provider failure evidence. Preserve the
    // accepted request for a later bounded recovery observation. An explicit
    // terminal capacity response is the sole normalized exception above.
  }
  return designManifestToRun(manifest);
}

function buildRecoveryPrompt(manifest: DesignJobManifest): string {
  // Older accepted manifests may have been persisted immediately after queue
  // acceptance, before the provider prompt was written a second time.
  return buildDesignProviderPrompt(manifest.setup);
}
