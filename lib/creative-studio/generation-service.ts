import { createHash, randomUUID } from "node:crypto";

import {
  CREATIVE_REFERENCE_MAX_BYTES,
  CREATIVE_REFERENCE_MIME_TYPES,
  CREATIVE_REFERENCE_TOTAL_MAX_BYTES,
  creativeGenerationSetupSchema,
  type CreativeGenerationSetup,
  type CreativeResult,
  type CreativeRun,
} from "@/lib/creative-studio/contracts";
import {
  assertNanoBananaCostAllowed,
  estimateNanoBananaMaximumCostUsd,
  NANO_BANANA_PRO_COST_CAP_ENV,
  NANO_BANANA_PRO_EDIT_MODEL_ID,
  NANO_BANANA_PRO_TEXT_MODEL_ID,
  parseCreativeCostCap,
} from "@/lib/creative-studio/nano-banana-config";
import {
  FalNanoBananaProvider,
  FalNanoBananaUnknownOutcomeError,
} from "@/lib/creative-studio/providers/fal-nano-banana";
import {
  CREATIVE_SERVER_JOB_VERSION,
  creativeJobManifestSchema,
  type CreativeJobManifest,
} from "@/lib/creative-studio/server-contracts";
import {
  sha256Hex,
  SupabaseCreativeJobStore,
  type CreativeJobScope,
  type CreativeJobStore,
} from "@/lib/creative-studio/server-storage";
import type {
  CreativeImageProvider,
  CreativeProviderReference,
} from "@/lib/creative-studio/provider";

const MAX_PROVIDER_RESULT_BYTES = 40 * 1024 * 1024;
const ALLOWED_PROVIDER_RESULT_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function hasExpectedImageSignature(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8;
  }
  if (mimeType === "image/webp") {
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export class CreativeGenerationError extends Error {
  constructor(
    readonly code:
      | "INVALID_REQUEST"
      | "REFERENCE_LIMIT_EXCEEDED"
      | "REFERENCE_INVALID"
      | "PROVIDER_NOT_CONFIGURED"
      | "DUPLICATE_REQUEST_RUNNING"
      | "IDEMPOTENCY_CONFLICT"
      | "RESULT_PERSISTENCE_FAILED",
    message: string,
    readonly status: number,
    readonly technicalDetails?: string,
  ) {
    super(message);
    this.name = "CreativeGenerationError";
  }
}

function buildFingerprint(input: {
  jobId: string;
  setup: CreativeGenerationSetup;
  references: CreativeProviderReference[];
}): string {
  const hash = createHash("sha256");
  hash.update(input.jobId);
  hash.update(JSON.stringify(input.setup));
  for (const reference of input.references) {
    hash.update(reference.metadata.id);
    hash.update(String(reference.metadata.order));
    hash.update(reference.bytes);
  }
  return hash.digest("hex");
}

function validateReferences(
  setup: CreativeGenerationSetup,
  references: CreativeProviderReference[],
): void {
  if (references.length !== setup.references.length) {
    throw new CreativeGenerationError(
      "REFERENCE_INVALID",
      "Die Referenzbilder konnten nicht vollständig gelesen werden.",
      400,
      `metadata=${setup.references.length};files=${references.length}`,
    );
  }
  if (references.length > 14) {
    throw new CreativeGenerationError(
      "REFERENCE_LIMIT_EXCEEDED",
      "Für dieses Modell sind zu viele Referenzbilder ausgewählt.",
      400,
    );
  }
  let total = 0;
  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index]!;
    const metadata = setup.references[index]!;
    const expectedMime = metadata.mimeType.toLowerCase();
    if (
      reference.metadata.id !== metadata.id ||
      reference.metadata.order !== index ||
      reference.bytes.byteLength !== metadata.byteLength ||
      reference.bytes.byteLength > CREATIVE_REFERENCE_MAX_BYTES ||
      !CREATIVE_REFERENCE_MIME_TYPES.includes(
        expectedMime as (typeof CREATIVE_REFERENCE_MIME_TYPES)[number],
      )
    ) {
      throw new CreativeGenerationError(
        "REFERENCE_INVALID",
        "Mindestens ein Referenzbild ist ungültig oder zu groß.",
        400,
        `reference=${metadata.id};order=${index};expectedBytes=${metadata.byteLength};receivedBytes=${reference.bytes.byteLength};mime=${expectedMime}`,
      );
    }
    total += reference.bytes.byteLength;
  }
  if (total > CREATIVE_REFERENCE_TOTAL_MAX_BYTES) {
    throw new CreativeGenerationError(
      "REFERENCE_INVALID",
      "Die Referenzbilder sind zusammen zu groß.",
      413,
      `receivedBytes=${total};maximumBytes=${CREATIVE_REFERENCE_TOTAL_MAX_BYTES}`,
    );
  }
}

function toPublicResultUrl(jobId: string, resultId: string): string {
  return `/api/creative-studio/assets/${jobId}/${resultId}`;
}

async function downloadProviderResult(
  url: string,
  expectedMimeType: string,
  fetcher: typeof fetch,
): Promise<{ bytes: Buffer; mimeType: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("provider_result_url_invalid");
  }
  if (parsed.protocol !== "https:") throw new Error("provider_result_url_unsafe");
  const response = await fetcher(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`provider_result_download_${response.status}`);
  if (response.url && new URL(response.url).protocol !== "https:") {
    throw new Error("provider_result_redirect_unsafe");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PROVIDER_RESULT_BYTES) {
    throw new Error("provider_result_too_large");
  }
  const responseMimeType = (response.headers.get("content-type") ?? "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  const mimeType = ALLOWED_PROVIDER_RESULT_MIME_TYPES.has(responseMimeType)
    ? responseMimeType
    : expectedMimeType.toLowerCase();
  if (!ALLOWED_PROVIDER_RESULT_MIME_TYPES.has(mimeType)) {
    throw new Error(`provider_result_mime_${mimeType}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_PROVIDER_RESULT_BYTES) {
    throw new Error("provider_result_size_invalid");
  }
  if (!hasExpectedImageSignature(bytes, mimeType)) {
    throw new Error("provider_result_corrupt");
  }
  return { bytes, mimeType };
}

export function creativeManifestToRun(manifest: CreativeJobManifest): CreativeRun {
  return {
    id: manifest.jobId,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
    status: manifest.status,
    setup: manifest.setup,
    results: manifest.results.map((result) => result.publicView),
    message: manifest.message,
    provider: manifest.provider,
    providerModel: manifest.providerModel,
    providerRequestId: manifest.providerRequestId,
    ...(manifest.providerPrompt
      ? { providerPrompt: manifest.providerPrompt }
      : {}),
    estimatedMaximumCostUsd: manifest.estimatedMaximumCostUsd,
  };
}

export type GenerateCreativeJobDependencies = {
  store?: CreativeJobStore;
  provider?: CreativeImageProvider;
  fetcher?: typeof fetch;
  configuredCostCapUsd?: number | null;
  costLimitPolicy?: "REQUIRE_CONFIGURED_CAP" | "OWNER_ESTIMATE_ONLY";
  now?: () => string;
};

export async function generateCreativeJob(
  input: {
    scope: CreativeJobScope;
    jobId: string;
    setup: CreativeGenerationSetup;
    references: CreativeProviderReference[];
  },
  dependencies: GenerateCreativeJobDependencies = {},
): Promise<CreativeRun> {
  if (!/^[0-9a-f-]{36}$/i.test(input.jobId)) {
    throw new CreativeGenerationError(
      "INVALID_REQUEST",
      "Der Generierungsauftrag ist ungültig.",
      400,
    );
  }
  const setup = creativeGenerationSetupSchema.parse(input.setup);
  if (setup.modelId !== "nano-banana-pro") {
    throw new CreativeGenerationError(
      "PROVIDER_NOT_CONFIGURED",
      "Das ausgewählte Modell ist noch nicht live verbunden.",
      503,
    );
  }
  validateReferences(setup, input.references);
  const costCap =
    dependencies.configuredCostCapUsd === undefined
      ? parseCreativeCostCap(process.env[NANO_BANANA_PRO_COST_CAP_ENV])
      : dependencies.configuredCostCapUsd;
  const estimatedMaximumCostUsd =
    dependencies.costLimitPolicy === "OWNER_ESTIMATE_ONLY"
      ? estimateNanoBananaMaximumCostUsd(setup.quality, setup.batchSize)
      : assertNanoBananaCostAllowed({
          quality: setup.quality,
          batchSize: setup.batchSize,
          configuredCostCapUsd: costCap,
        });
  const provider =
    dependencies.provider ?? new FalNanoBananaProvider(process.env.FAL_KEY);
  if (!provider.isConfigured()) {
    throw new CreativeGenerationError(
      "PROVIDER_NOT_CONFIGURED",
      "Nano Banana Pro ist serverseitig noch nicht vollständig eingerichtet.",
      503,
    );
  }
  const store = dependencies.store ?? new SupabaseCreativeJobStore();
  const fetcher = dependencies.fetcher ?? fetch;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const requestFingerprint = buildFingerprint({
    jobId: input.jobId,
    setup,
    references: input.references,
  });
  const claim = await store.claim({
    scope: input.scope,
    jobId: input.jobId,
    requestFingerprint,
  });
  if (claim === "EXISTS") {
    const existing = await store.readManifest(input.scope, input.jobId);
    if (!existing) {
      throw new CreativeGenerationError(
        "DUPLICATE_REQUEST_RUNNING",
        "Dieser Auftrag wird bereits verarbeitet.",
        409,
      );
    }
    if (existing.requestFingerprint !== requestFingerprint) {
      throw new CreativeGenerationError(
        "IDEMPOTENCY_CONFLICT",
        "Die Auftrags-ID wurde bereits für ein anderes Setup verwendet.",
        409,
      );
    }
    return creativeManifestToRun(existing);
  }

  const timestamp = now();
  let manifest: CreativeJobManifest = creativeJobManifestSchema.parse({
    version: CREATIVE_SERVER_JOB_VERSION,
    jobId: input.jobId,
    workspaceId: input.scope.workspaceId,
    actorId: input.scope.actorId,
    requestFingerprint,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "RUNNING",
    setup,
    originalPrompt: setup.prompt,
    providerPrompt: null,
    referenceAuthority: input.references.map((reference) => ({
      id: reference.metadata.id,
      order: reference.metadata.order,
      name: reference.metadata.name,
      mimeType: reference.metadata.mimeType,
      byteLength: reference.bytes.byteLength,
      sha256: sha256Hex(reference.bytes),
    })),
    provider: "fal",
    providerModel: input.references.length
      ? NANO_BANANA_PRO_EDIT_MODEL_ID
      : NANO_BANANA_PRO_TEXT_MODEL_ID,
    providerRequestId: null,
    estimatedMaximumCostUsd,
    actualCostUsd: null,
    results: [],
    message: "Das Bild wird erstellt.",
    technicalError: null,
  });
  await store.writeManifest(manifest);

  try {
    const providerResponse = await provider.generate({
      clientRequestId: input.jobId,
      setup,
      references: input.references,
      onProviderRequestId: async (providerRequestId) => {
        manifest = creativeJobManifestSchema.parse({
          ...manifest,
          providerRequestId,
          updatedAt: now(),
        });
        await store.writeManifest(manifest);
      },
    });
    manifest = creativeJobManifestSchema.parse({
      ...manifest,
      provider: providerResponse.provider,
      providerModel: providerResponse.providerModel,
      providerRequestId: providerResponse.providerRequestId,
      providerPrompt: providerResponse.providerPrompt,
      updatedAt: now(),
    });
    await store.writeManifest(manifest);

    const persisted: CreativeJobManifest["results"] = [];
    const providerResults = providerResponse.results.slice(0, setup.batchSize);
    for (const providerResult of providerResults) {
      try {
        const downloaded = await downloadProviderResult(
          providerResult.url,
          providerResult.mimeType,
          fetcher,
        );
        const resultId = randomUUID();
        const storagePath = await store.persistResult({
          scope: input.scope,
          jobId: input.jobId,
          resultId,
          bytes: downloaded.bytes,
          mimeType: downloaded.mimeType,
        });
        const publicUrl = toPublicResultUrl(input.jobId, resultId);
        const publicView: CreativeResult = {
          ...providerResult,
          id: resultId,
          url: publicUrl,
          downloadUrl: `${publicUrl}?download=1`,
          mimeType: downloaded.mimeType,
          providerModel: providerResponse.providerModel,
        };
        persisted.push({
          publicView,
          storagePath,
          byteLength: downloaded.bytes.byteLength,
          sha256: sha256Hex(downloaded.bytes),
        });
      } catch (error) {
        console.error("[Creative Studio] Result persistence failed", {
          jobId: input.jobId,
          providerRequestId: providerResponse.providerRequestId,
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    }
    const complete =
      providerResponse.results.length === setup.batchSize &&
      persisted.length === setup.batchSize;
    const status = complete
      ? "SUCCEEDED"
      : persisted.length
        ? "PARTIALLY_SUCCEEDED"
        : "FAILED";
    manifest = creativeJobManifestSchema.parse({
      ...manifest,
      status,
      results: persisted,
      updatedAt: now(),
      message: complete
        ? setup.batchSize === 1
          ? "Das Bild wurde erfolgreich erstellt."
          : `${setup.batchSize} Bilder wurden erfolgreich erstellt.`
        : persisted.length
          ? "Der Anbieter hat nur einen Teil der Ergebnisse dauerhaft bereitgestellt."
          : "Das Bild wurde erstellt, konnte aber nicht dauerhaft gespeichert werden.",
      technicalError: complete
        ? null
        : `providerResults=${providerResponse.results.length};persistedResults=${persisted.length};expectedResults=${setup.batchSize}`,
    });
    await store.writeManifest(manifest);
    return creativeManifestToRun(manifest);
  } catch (error) {
    const unknown = error instanceof FalNanoBananaUnknownOutcomeError;
    manifest = creativeJobManifestSchema.parse({
      ...manifest,
      status: unknown ? "UNKNOWN_OUTCOME" : "FAILED",
      providerRequestId: unknown
        ? error.providerRequestId
        : manifest.providerRequestId,
      updatedAt: now(),
      message: unknown
        ? "Der Anbieter hat den Auftrag nicht eindeutig abgeschlossen. Es wurde kein neuer Versuch gestartet."
        : "Das Bild konnte nicht erstellt werden.",
      technicalError:
        error instanceof Error
          ? `${error.name}: ${error.message}`.slice(0, 4000)
          : "unknown_generation_error",
    });
    await store.writeManifest(manifest);
    return creativeManifestToRun(manifest);
  }
}
