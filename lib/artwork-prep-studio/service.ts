import "server-only";

import { createHash } from "node:crypto";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import {
  completeDesignUtilityManifest,
  DesignUtilityError,
  executeDesignUtility,
  recoverDesignUtility,
} from "@/lib/design-studio/utility-service";
import {
  completeDesignPrintFileManifest,
  executeDesignPrintFile,
} from "@/lib/design-studio/print-file";
import { recordDesignProviderCostEvent } from "@/lib/design-studio/projection";
import { PRINT_FILE_WIDTH, PRINT_FILE_HEIGHT } from "@/lib/design-studio/print-file-contracts";
import { isRasterPrintUpscaleRequired } from "@/lib/design-studio/print-file-render";
import { artworkPrepOwnerEstimate, ARTWORK_PREP_PRICING_VERSION } from "@/lib/artwork-prep-studio/economics";
import {
  loadOwnedArtworkPrepAsset,
  persistArtworkPrepAsset,
} from "@/lib/artwork-prep-studio/assets";
import { renderArtworkBackground } from "@/lib/artwork-prep-studio/image";
import {
  SupabaseArtworkPrepLocalStore,
  SupabaseArtworkPrepPrintStore,
  SupabaseArtworkPrepUtilityStore,
  artworkPrepLocalManifestSchema,
} from "@/lib/artwork-prep-studio/storage";

export class ArtworkPrepProcessError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "ArtworkPrepProcessError";
  }
}

function scope(context: XerianoAccountContext) {
  return { workspaceId: context.workspaceKey, actorId: context.userId };
}

async function projectUtilityResult(input: {
  context: XerianoAccountContext;
  projectId: string;
  sourceAssetId: string;
  operation: "BACKGROUND_REMOVE" | "UPSCALE";
  factor?: 2 | 4;
  jobId: string;
  manifest: Awaited<ReturnType<typeof executeDesignUtility>>["manifest"];
  bytes: Buffer;
  sourceDimensions?: { width: number; height: number };
}) {
  const projected = await persistArtworkPrepAsset({
    context: input.context,
    projectId: input.projectId,
    jobId: input.jobId,
    resultId: "derived",
    title: input.operation === "BACKGROUND_REMOVE"
      ? "Freigestelltes Design"
      : `Hochskaliertes Design ${input.factor ?? 2}×`,
    bytes: input.bytes,
    mimeType: "image/png",
    operation: input.operation,
    sourceAssetId: input.sourceAssetId,
    sourceDimensions: input.sourceDimensions,
    upscaleFactor: input.operation === "UPSCALE" ? input.factor ?? 2 : null,
  });
  const completed = await completeDesignUtilityManifest({
    manifest: input.manifest,
    result: {
      assetId: projected.asset.id,
      creationId: projected.creationId,
      width: projected.asset.width!,
      height: projected.asset.height!,
    },
    store: new SupabaseArtworkPrepUtilityStore(input.projectId),
  });
  return { manifest: completed, asset: projected.asset };
}

export async function startArtworkPrepUtility(input: {
  context: XerianoAccountContext;
  projectId: string;
  jobId: string;
  sourceAssetId: string;
  operation: "BACKGROUND_REMOVE" | "UPSCALE";
  factor?: 2 | 4;
}) {
  const source = await loadOwnedArtworkPrepAsset(input.context, input.sourceAssetId, {
    maxBytes: input.operation === "BACKGROUND_REMOVE" ? 10 * 1024 * 1024 : undefined,
  });
  if (input.operation === "BACKGROUND_REMOVE" && source.metadata.mimeType === "image/svg+xml") {
    throw new ArtworkPrepProcessError("BACKGROUND_INPUT_UNSUPPORTED", "SVG muss für die Freistellung zuerst als PNG gespeichert werden.", 400);
  }
  if (input.operation === "BACKGROUND_REMOVE" && source.metadata.hasTransparency) {
    throw new ArtworkPrepProcessError("BACKGROUND_ALREADY_TRANSPARENT", "Dieses Artwork besitzt bereits einen transparenten Hintergrund.", 400);
  }
  if (input.operation === "UPSCALE" && source.metadata.mimeType === "image/svg+xml") {
    throw new ArtworkPrepProcessError("VECTOR_UPSCALE_NOT_REQUIRED", "SVG ist bereits eine verlustfreie Vektorquelle.", 400);
  }
  const factor = input.operation === "UPSCALE" ? input.factor ?? 2 : undefined;
  if (factor && (
    source.metadata.width * factor > 10_000
    || source.metadata.height * factor > 10_000
    || source.metadata.width * factor * source.metadata.height * factor > 40_000_000
  )) {
    throw new ArtworkPrepProcessError("UPSCALE_OUTPUT_TOO_LARGE", "Diese Vergrößerung würde die sichere Ausgabegröße überschreiten.", 400);
  }
  const store = new SupabaseArtworkPrepUtilityStore(input.projectId);
  const execution = await executeDesignUtility({
    context: input.context,
    scope: scope(input.context),
    jobId: input.jobId,
    sourceAssetId: input.sourceAssetId,
    operation: input.operation,
    ...(factor ? { upscaleFactor: factor, allowLargerUpscaleSource: true } : {}),
    source: { bytes: source.bytes, mimeType: source.metadata.mimeType, dimensions: source.metadata },
    onAccepted: async (providerRequestId, providerModel, occurredAt) => {
      const quote = artworkPrepOwnerEstimate({ operation: input.operation, ...(factor ? { factor } : {}) });
      await recordDesignProviderCostEvent({
        context: input.context,
        jobId: input.jobId,
        providerModel,
        providerRequestId,
        estimatedCostUsdMicros: quote.estimatedCostUsdMicros,
        occurredAt,
        operation: input.operation,
        costVersion: ARTWORK_PREP_PRICING_VERSION,
        studio: "ARTWORK_PREP_STUDIO",
      });
    },
  }, { store });
  if (!execution.bytes) return { status: execution.manifest.status, asset: null };
  if (factor) {
    const output = await import("@/lib/artwork-prep-studio/image").then((module) => module.inspectArtworkBytes({
      bytes: execution.bytes!, mimeType: "image/png", allowDerivedSize: true,
    }));
    if (output.width !== source.metadata.width * factor || output.height !== source.metadata.height * factor) {
      throw new ArtworkPrepProcessError("UPSCALE_RESULT_INVALID", "Das hochskalierte Ergebnis besitzt unerwartete Abmessungen.", 503);
    }
  }
  const completed = await projectUtilityResult({ ...input, ...(factor ? { factor } : {}), sourceDimensions: source.metadata, manifest: execution.manifest, bytes: execution.bytes });
  return { status: completed.manifest.status, asset: completed.asset };
}

export async function recoverArtworkPrepUtility(input: {
  context: XerianoAccountContext;
  projectId: string;
  jobId: string;
}) {
  const store = new SupabaseArtworkPrepUtilityStore(input.projectId);
  const observation = await recoverDesignUtility({ scope: scope(input.context), jobId: input.jobId }, { store });
  if (!observation.bytes) {
    const asset = observation.manifest.resultAssetId
      ? await loadOwnedArtworkPrepAsset(input.context, observation.manifest.resultAssetId).then((value) => value.asset)
      : null;
    return { status: observation.manifest.status, asset };
  }
  const completed = await projectUtilityResult({
    context: input.context,
    projectId: input.projectId,
    jobId: input.jobId,
    sourceAssetId: observation.manifest.sourceAssetId,
    operation: observation.manifest.operation,
    ...(observation.manifest.upscaleFactor ? { factor: observation.manifest.upscaleFactor } : {}),
    manifest: observation.manifest,
    bytes: observation.bytes,
    sourceDimensions: await loadOwnedArtworkPrepAsset(input.context, observation.manifest.sourceAssetId)
      .then((value) => ({ width: value.metadata.width, height: value.metadata.height })),
  });
  return { status: completed.manifest.status, asset: completed.asset };
}

export async function createArtworkBackgroundVariant(input: {
  context: XerianoAccountContext;
  projectId: string;
  jobId: string;
  sourceAssetId: string;
  color: string;
}) {
  const store = new SupabaseArtworkPrepLocalStore();
  const fingerprint = createHash("sha256")
    .update(input.context.accountId).update(input.jobId).update(input.sourceAssetId).update(input.color.toLowerCase()).digest("hex");
  const claimed = await store.claim({ scope: scope(input.context), jobId: input.jobId, fingerprint });
  if (claimed === "EXISTS") {
    const existing = await store.read(scope(input.context), input.jobId);
    if (!existing || existing.fingerprint !== fingerprint) throw new ArtworkPrepProcessError("IDEMPOTENCY_CONFLICT", "Diese Aktion wurde bereits verwendet.", 409);
    return {
      status: existing.status,
      asset: existing.resultAssetId ? await loadOwnedArtworkPrepAsset(input.context, existing.resultAssetId).then((value) => value.asset) : null,
    };
  }
  const now = new Date().toISOString();
  let manifest = artworkPrepLocalManifestSchema.parse({
    version: "xeriamo-artwork-prep-local-job-v1", jobId: input.jobId, projectId: input.projectId,
    workspaceId: input.context.workspaceKey, actorId: input.context.userId, fingerprint,
    sourceAssetId: input.sourceAssetId, operation: "BACKGROUND_COLOR", color: input.color,
    status: "PREPARING", resultAssetId: null, createdAt: now, updatedAt: now,
  });
  await store.write(manifest);
  try {
    const source = await loadOwnedArtworkPrepAsset(input.context, input.sourceAssetId);
    const rendered = await renderArtworkBackground({ bytes: source.bytes, mimeType: source.metadata.mimeType, color: input.color });
    const projected = await persistArtworkPrepAsset({
      context: input.context, projectId: input.projectId, jobId: input.jobId, resultId: "derived",
      title: `Design mit Hintergrund ${input.color.toUpperCase()}`, bytes: rendered.bytes,
      mimeType: "image/png", operation: "BACKGROUND_COLOR", sourceAssetId: input.sourceAssetId,
      sourceDimensions: source.metadata, backgroundColor: input.color.toUpperCase(),
    });
    manifest = artworkPrepLocalManifestSchema.parse({ ...manifest, status: "SUCCEEDED", resultAssetId: projected.asset.id, updatedAt: new Date().toISOString() });
    await store.write(manifest);
    return { status: manifest.status, asset: projected.asset };
  } catch (error) {
    manifest = artworkPrepLocalManifestSchema.parse({ ...manifest, status: "FAILED", updatedAt: new Date().toISOString() });
    await store.write(manifest);
    throw error;
  }
}

export async function createArtworkPrintFile(input: {
  context: XerianoAccountContext;
  projectId: string;
  jobId: string;
  sourceAssetId: string;
}) {
  const source = await loadOwnedArtworkPrepAsset(input.context, input.sourceAssetId);
  const store = new SupabaseArtworkPrepPrintStore(input.projectId);
  const execution = await executeDesignPrintFile({
    context: input.context, scope: scope(input.context), jobId: input.jobId,
    sourceAssetId: input.sourceAssetId, removeBackground: false,
    source: {
      bytes: source.bytes, mimeType: source.metadata.mimeType,
      sourceWidth: source.metadata.width, sourceHeight: source.metadata.height,
      rasterUpscaled: source.metadata.mimeType !== "image/svg+xml"
        && isRasterPrintUpscaleRequired(source.metadata.width, source.metadata.height),
    },
  }, { store });
  if (!execution.bytes) return { status: execution.manifest.status, asset: null };
  const printBytes = source.asset.operation === "BACKGROUND_COLOR" && source.asset.backgroundColor
    ? (await renderArtworkBackground({
        bytes: execution.bytes,
        mimeType: "image/png",
        color: source.asset.backgroundColor,
        resolution: 300,
      })).bytes
    : execution.bytes;
  const projected = await persistArtworkPrepAsset({
    context: input.context, projectId: input.projectId, jobId: input.jobId, resultId: "derived",
    title: "Druckdatei · 300 DPI", bytes: printBytes, mimeType: "image/png",
    operation: "PRINT_FILE_300_DPI", sourceAssetId: input.sourceAssetId,
    sourceDimensions: source.metadata,
    rasterSourceUpscaled: source.metadata.mimeType !== "image/svg+xml"
      && isRasterPrintUpscaleRequired(source.metadata.width, source.metadata.height),
  });
  await completeDesignPrintFileManifest({
    manifest: execution.manifest,
    result: { assetId: projected.asset.id, creationId: projected.creationId, width: PRINT_FILE_WIDTH, height: PRINT_FILE_HEIGHT },
    store,
  });
  return { status: "SUCCEEDED" as const, asset: projected.asset };
}

export function normalizeArtworkPrepError(error: unknown) {
  if (error instanceof ArtworkPrepProcessError || error instanceof DesignUtilityError) {
    return { error: error.message, code: error.code, status: error.status };
  }
  if (error instanceof Error && "status" in error && "code" in error) {
    return { error: error.message, code: String(error.code), status: Number(error.status) || 400 };
  }
  return { error: "Die Aktion konnte nicht abgeschlossen werden.", code: "ARTWORK_PREP_FAILED", status: 503 };
}
