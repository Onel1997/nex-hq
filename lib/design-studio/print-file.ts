import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import { validateDesignSignature } from "@/lib/xeriano/library";
import { isSafePrivateSvg } from "@/lib/xeriano/svg-raster";
import {
  PRINT_FILE_VERSION,
  printFileManifestSchema,
  type PrintFileManifest,
} from "@/lib/design-studio/print-file-contracts";
import { assertTransparentPng } from "@/lib/design-studio/png-metadata";
import { readRasterDimensions } from "@/lib/design-studio/raster-metadata";
import { isRasterPrintUpscaleRequired, renderDesignPrintFile } from "@/lib/design-studio/print-file-render";
import type { DesignJobScope } from "@/lib/design-studio/server-storage";
import { SupabaseDesignPrintFileStore } from "@/lib/design-studio/print-file-storage";

const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 40_000_000;
const RASTER_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export class DesignPrintFileError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

export async function loadOwnedDesignPrintSource(
  context: XerianoAccountContext,
  assetId: string,
  removeBackground: boolean,
) {
  const admin = createAdminClient();
  const found = await admin.from("xeriano_library_assets")
    .select("id,storage_bucket,storage_path,mime_type,byte_length,provenance")
    .eq("id", assetId)
    .eq("account_id", context.accountId)
    .eq("owner_user_id", context.userId)
    .eq("asset_type", "DESIGN")
    .maybeSingle();
  if (found.error || !found.data) throw new DesignPrintFileError("SOURCE_NOT_FOUND", "Design nicht gefunden.", 404);
  const mimeType = found.data.mime_type;
  if (mimeType !== "image/svg+xml" && !RASTER_MIME_TYPES.has(mimeType)) {
    throw new DesignPrintFileError("SOURCE_UNSUPPORTED", "Dieses Design kann nicht als Druckdatei verwendet werden.", 400);
  }
  const expectedBytes = Number(found.data.byte_length);
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || expectedBytes > MAX_SOURCE_BYTES) {
    throw new DesignPrintFileError("SOURCE_INVALID", "Dieses Design kann nicht als Druckdatei verwendet werden.", 400);
  }
  const downloaded = await admin.storage.from(found.data.storage_bucket).download(found.data.storage_path);
  if (downloaded.error) throw new DesignPrintFileError("SOURCE_UNAVAILABLE", "Dieses Design kann gerade nicht geladen werden.", 503);
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (bytes.length !== expectedBytes) throw new DesignPrintFileError("SOURCE_INVALID", "Dieses Design kann nicht als Druckdatei verwendet werden.", 400);
  if (mimeType === "image/svg+xml") {
    if (!isSafePrivateSvg(bytes)) throw new DesignPrintFileError("SOURCE_INVALID", "Dieses SVG kann nicht verwendet werden.", 400);
    return {
      bytes,
      mimeType: "image/svg+xml" as const,
      sourceWidth: null,
      sourceHeight: null,
      rasterUpscaled: false,
    };
  }
  if (!validateDesignSignature(bytes, mimeType)) throw new DesignPrintFileError("SOURCE_INVALID", "Dieses Design kann nicht als Druckdatei verwendet werden.", 400);
  const dimensions = await readRasterDimensions(bytes);
  if (dimensions.width * dimensions.height > MAX_SOURCE_PIXELS) {
    throw new DesignPrintFileError("SOURCE_INVALID", "Dieses Design ist für die Druckvorbereitung zu groß.", 400);
  }
  if (removeBackground) {
    if (mimeType !== "image/png") {
      throw new DesignPrintFileError("BACKGROUND_REMOVAL_REQUIRED", "Der Hintergrund muss zuerst entfernt werden.", 400);
    }
    try {
      await assertTransparentPng(bytes);
    } catch {
      throw new DesignPrintFileError("BACKGROUND_REMOVAL_REQUIRED", "Der Hintergrund muss zuerst entfernt werden.", 400);
    }
  }
  return {
    bytes,
    mimeType: mimeType as "image/png" | "image/jpeg" | "image/webp",
    sourceWidth: dimensions.width,
    sourceHeight: dimensions.height,
    rasterUpscaled: isRasterPrintUpscaleRequired(dimensions.width, dimensions.height),
  };
}

export async function executeDesignPrintFile(input: {
  context: XerianoAccountContext;
  scope: DesignJobScope;
  jobId: string;
  sourceAssetId: string;
  removeBackground: boolean;
  source: {
    bytes: Buffer;
    mimeType: string;
    sourceWidth?: number | null;
    sourceHeight?: number | null;
    rasterUpscaled?: boolean;
  };
}, dependencies: {
  store?: SupabaseDesignPrintFileStore;
  now?: () => string;
} = {}): Promise<{ manifest: PrintFileManifest; bytes: Buffer | null }> {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const store = dependencies.store ?? new SupabaseDesignPrintFileStore();
  const fingerprint = createHash("sha256")
    .update(input.jobId)
    .update(input.context.accountId)
    .update(input.sourceAssetId)
    .update(input.removeBackground ? "transparent" : "preserve")
    .digest("hex");
  const claim = await store.claim({ scope: input.scope, jobId: input.jobId, fingerprint });
  if (claim === "EXISTS") {
    const existing = await store.read(input.scope, input.jobId);
    if (!existing) throw new DesignPrintFileError("PRINT_FILE_RUNNING", "Die Druckdatei wird bereits erstellt.", 409);
    if (existing.requestFingerprint !== fingerprint) throw new DesignPrintFileError("IDEMPOTENCY_CONFLICT", "Diese Aktions-ID wurde bereits verwendet.", 409);
    return { manifest: existing, bytes: null };
  }
  let manifest = printFileManifestSchema.parse({
    version: PRINT_FILE_VERSION,
    jobId: input.jobId,
    workspaceId: input.scope.workspaceId,
    actorId: input.scope.actorId,
    requestFingerprint: fingerprint,
    sourceAssetId: input.sourceAssetId,
    removeBackground: input.removeBackground,
    status: "PREPARING",
    resultAssetId: null,
    resultCreationId: null,
    width: null,
    height: null,
    createdAt: now(),
    updatedAt: now(),
  });
  await store.write(manifest);
  try {
    return { manifest, bytes: await renderDesignPrintFile(input.source) };
  } catch (error) {
    manifest = printFileManifestSchema.parse({ ...manifest, status: "FAILED", updatedAt: now() });
    await store.write(manifest);
    throw error;
  }
}

export async function completeDesignPrintFileManifest(input: {
  manifest: PrintFileManifest;
  result: { assetId: string; creationId: string; width: number; height: number };
  store?: SupabaseDesignPrintFileStore;
}) {
  const completed = printFileManifestSchema.parse({
    ...input.manifest,
    status: "SUCCEEDED",
    resultAssetId: input.result.assetId,
    resultCreationId: input.result.creationId,
    width: input.result.width,
    height: input.result.height,
    updatedAt: new Date().toISOString(),
  });
  await (input.store ?? new SupabaseDesignPrintFileStore()).write(completed);
  return completed;
}
