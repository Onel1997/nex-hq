import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import { bindTempReferences, resolveTempReferences } from "@/lib/xeriano/temp-references/server";
import {
  ARTWORK_PREP_CONTRACT_VERSION,
  ARTWORK_PREP_OUTPUT_MAX_BYTES,
  ARTWORK_PREP_RASTER_MAX_BYTES,
  ARTWORK_PREP_SVG_MAX_BYTES,
  type ArtworkPrepAsset,
} from "@/lib/artwork-prep-studio/contracts";
import { ArtworkPrepImageError, inspectArtworkBytes } from "@/lib/artwork-prep-studio/image";

const LIBRARY_BUCKET = "xeriano-library-assets";

type ArtworkOperation = ArtworkPrepAsset["operation"];

type LibraryRow = {
  id: string;
  account_id: string;
  owner_user_id: string;
  title: string;
  source_studio: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  byte_length: number | string;
  provenance: Record<string, unknown> | null;
  created_at: string;
};

export class ArtworkPrepAssetError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "ArtworkPrepAssetError";
  }
}

function extension(mimeType: string) {
  if (mimeType === "image/svg+xml") return "svg";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function provenance(row: LibraryRow) {
  return row.provenance && typeof row.provenance === "object" ? row.provenance : {};
}

async function rowToAsset(row: LibraryRow, bytes?: Buffer): Promise<ArtworkPrepAsset> {
  const details = provenance(row);
  const inspected = bytes
    ? await inspectArtworkBytes({ bytes, mimeType: row.mime_type, allowDerivedSize: true })
    : null;
  const operationValues = new Set<ArtworkOperation>([
    "ARTWORK_ORIGINAL",
    "BACKGROUND_REMOVE",
    "BACKGROUND_COLOR",
    "UPSCALE",
    "PRINT_FILE_300_DPI",
  ]);
  const rawOperation = typeof details.operation === "string" ? details.operation as ArtworkOperation : null;
  const operation = rawOperation && operationValues.has(rawOperation) ? rawOperation : null;
  return {
    id: row.id,
    title: row.title,
    mimeType: row.mime_type as ArtworkPrepAsset["mimeType"],
    byteLength: Number(row.byte_length),
    width: inspected?.width ?? (typeof details.width === "number" ? details.width : null),
    height: inspected?.height ?? (typeof details.height === "number" ? details.height : null),
    hasAlpha: inspected?.hasAlpha ?? details.has_alpha === true,
    hasTransparency: inspected?.hasTransparency ?? details.has_transparency === true,
    operation,
    derivedFromAssetId: typeof details.derived_from_asset_id === "string" ? details.derived_from_asset_id : null,
    upscaleFactor: details.upscale_factor === 2 || details.upscale_factor === 4 ? details.upscale_factor : null,
    backgroundColor: typeof details.background_color === "string" ? details.background_color : null,
    rasterSourceUpscaled: typeof details.raster_source_upscaled === "boolean" ? details.raster_source_upscaled : null,
    createdAt: row.created_at,
    contentUrl: `/api/xeriano/library/${row.id}/content`,
    downloadUrl: `/api/xeriano/library/${row.id}/content?download=1`,
  };
}

async function ownedDesignRow(context: XerianoAccountContext, assetId: string): Promise<LibraryRow> {
  const found = await createAdminClient().from("xeriano_library_assets")
    .select("id,account_id,owner_user_id,title,source_studio,storage_bucket,storage_path,mime_type,byte_length,provenance,created_at")
    .eq("id", assetId)
    .eq("account_id", context.accountId)
    .eq("owner_user_id", context.userId)
    .eq("asset_type", "DESIGN")
    .maybeSingle();
  if (found.error || !found.data) {
    throw new ArtworkPrepAssetError("ARTWORK_NOT_FOUND", "Artwork nicht gefunden.", 404);
  }
  return found.data as LibraryRow;
}

export async function loadOwnedArtworkPrepAsset(
  context: XerianoAccountContext,
  assetId: string,
  options: { maxBytes?: number; includeBytes?: boolean } = {},
) {
  const row = await ownedDesignRow(context, assetId);
  const expectedBytes = Number(row.byte_length);
  const maxBytes = options.maxBytes ?? ARTWORK_PREP_OUTPUT_MAX_BYTES;
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || expectedBytes > maxBytes) {
    throw new ArtworkPrepAssetError("ARTWORK_TOO_LARGE", "Dieses Artwork ist für diese Aktion zu groß.", 400);
  }
  const downloaded = await createAdminClient().storage.from(row.storage_bucket).download(row.storage_path);
  if (downloaded.error) {
    throw new ArtworkPrepAssetError("ARTWORK_UNAVAILABLE", "Das Artwork kann gerade nicht geladen werden.", 503);
  }
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (bytes.length !== expectedBytes) {
    throw new ArtworkPrepAssetError("ARTWORK_SIZE_MISMATCH", "Das Artwork konnte nicht sicher geprüft werden.", 400);
  }
  const metadata = await inspectArtworkBytes({ bytes, mimeType: row.mime_type, allowDerivedSize: true });
  return {
    row,
    bytes,
    metadata,
    asset: await rowToAsset(row, bytes),
  };
}

export async function readOwnedArtworkPrepAsset(context: XerianoAccountContext, assetId: string) {
  return (await loadOwnedArtworkPrepAsset(context, assetId)).asset;
}

export async function selectOwnedArtworkPrepSource(context: XerianoAccountContext, assetId: string) {
  const row = await ownedDesignRow(context, assetId);
  const maxBytes = row.mime_type === "image/svg+xml" ? ARTWORK_PREP_SVG_MAX_BYTES : ARTWORK_PREP_RASTER_MAX_BYTES;
  return (await loadOwnedArtworkPrepAsset(context, assetId, { maxBytes })).asset;
}

export async function persistArtworkPrepAsset(input: {
  context: XerianoAccountContext;
  projectId: string;
  jobId: string;
  resultId: string;
  title: string;
  bytes: Buffer;
  mimeType: string;
  operation: Exclude<ArtworkOperation, null>;
  sourceAssetId?: string | null;
  sourceDimensions?: { width: number | null; height: number | null };
  upscaleFactor?: 2 | 4 | null;
  backgroundColor?: string | null;
  rasterSourceUpscaled?: boolean | null;
}) {
  const metadata = await inspectArtworkBytes({ bytes: input.bytes, mimeType: input.mimeType, allowDerivedSize: true });
  const admin = createAdminClient();
  const existing = await admin.from("xeriano_library_assets")
    .select("id,account_id,owner_user_id,title,source_studio,storage_bucket,storage_path,mime_type,byte_length,provenance,created_at")
    .eq("account_id", input.context.accountId)
    .eq("source_studio", "ARTWORK_PREP_STUDIO")
    .eq("source_job_id", input.jobId)
    .eq("source_result_id", input.resultId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const assetId = existing.data?.id ?? randomUUID();
  const path = `accounts/${input.context.accountId}/artwork-prep/${input.projectId}/${input.jobId}/${input.resultId}.${extension(input.mimeType)}`;
  const now = new Date().toISOString();
  const assetPayload = {
    id: assetId,
    account_id: input.context.accountId,
    owner_user_id: input.context.userId,
    asset_type: "DESIGN",
    title: input.title.slice(0, 160),
    description: null,
    source_studio: "ARTWORK_PREP_STUDIO",
    source_job_id: input.jobId,
    source_result_id: input.resultId,
    storage_bucket: LIBRARY_BUCKET,
    storage_path: path,
    mime_type: input.mimeType,
    byte_length: input.bytes.length,
    checksum_sha256: createHash("sha256").update(input.bytes).digest("hex"),
    favorite: false,
    tags: input.operation === "ARTWORK_ORIGINAL"
      ? ["Artwork Prep", "Original"]
      : input.operation === "PRINT_FILE_300_DPI"
        ? ["Artwork Prep", "Druckdatei · 300 DPI"]
        : ["Artwork Prep", input.operation],
    provenance: {
      contractVersion: ARTWORK_PREP_CONTRACT_VERSION,
      project_id: input.projectId,
      operation: input.operation,
      derived_from_asset_id: input.sourceAssetId ?? null,
      source_width: input.sourceDimensions?.width ?? null,
      source_height: input.sourceDimensions?.height ?? null,
      width: metadata.width,
      height: metadata.height,
      mime_type: input.mimeType,
      has_alpha: metadata.hasAlpha,
      has_transparency: metadata.hasTransparency,
      upscale_factor: input.upscaleFactor ?? null,
      background_color: input.backgroundColor ?? null,
      print_file: input.operation === "PRINT_FILE_300_DPI",
      raster_source_upscaled: input.rasterSourceUpscaled ?? null,
      job_id: input.jobId,
      created_at: now,
    },
  };
  let finalAssetId = assetId;
  if (!existing.data) {
    const uploaded = await admin.storage.from(LIBRARY_BUCKET).upload(path, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message)) throw uploaded.error;
    const inserted = await admin.from("xeriano_library_assets").insert(assetPayload).select("id").single();
    if (inserted.error) {
      const raced = await admin.from("xeriano_library_assets")
        .select("id")
        .eq("account_id", input.context.accountId)
        .eq("source_studio", "ARTWORK_PREP_STUDIO")
        .eq("source_job_id", input.jobId)
        .eq("source_result_id", input.resultId)
        .maybeSingle();
      if (!raced.data) {
        await admin.storage.from(LIBRARY_BUCKET).remove([path]);
        throw inserted.error;
      }
      finalAssetId = raced.data.id;
    }
  }
  const creation = await admin.from("xeriano_creations")
    .select("id")
    .eq("account_id", input.context.accountId)
    .eq("source_studio", "ARTWORK_PREP_STUDIO")
    .eq("source_job_id", input.jobId)
    .eq("source_result_id", input.resultId)
    .maybeSingle();
  if (creation.error) throw creation.error;
  let creationId = creation.data?.id as string | undefined;
  if (!creationId) {
    creationId = randomUUID();
    const created = await admin.from("xeriano_creations").insert({
      id: creationId,
      account_id: input.context.accountId,
      actor_user_id: input.context.userId,
      library_asset_id: finalAssetId,
      creation_type: "IMAGE",
      source_studio: "ARTWORK_PREP_STUDIO",
      source_job_id: input.jobId,
      source_result_id: input.resultId,
      original_prompt: "Artwork für den Druck vorbereitet",
      provider_prompt: null,
      model_id: input.operation === "BACKGROUND_REMOVE"
        ? "design-background-remove"
        : input.operation === "UPSCALE"
          ? "design-upscale"
          : "artwork-prep-local",
      settings: assetPayload.provenance,
      credit_cost: 0,
      credit_pricing_version: ARTWORK_PREP_CONTRACT_VERSION,
      favorite: false,
      status: "SUCCEEDED",
      created_at: now,
    });
    if (created.error) {
      if (!/duplicate|unique/i.test(created.error.message)) throw created.error;
      const raced = await admin.from("xeriano_creations").select("id")
        .eq("account_id", input.context.accountId)
        .eq("source_studio", "ARTWORK_PREP_STUDIO")
        .eq("source_job_id", input.jobId)
        .eq("source_result_id", input.resultId)
        .maybeSingle();
      if (!raced.data) throw created.error;
      creationId = raced.data.id;
    }
  }
  if (!creationId) throw new Error("ARTWORK_PREP_CREATION_MISSING");
  return { asset: await readOwnedArtworkPrepAsset(input.context, finalAssetId), creationId };
}

export async function importArtworkPrepTempSource(input: {
  context: XerianoAccountContext;
  projectId: string;
  tempReferenceId: string;
  title: string;
}) {
  const authority = await createAdminClient().from("xeriano_temp_references")
    .select("studio,kind,upload_state,bound_job_id")
    .eq("id", input.tempReferenceId)
    .eq("account_id", input.context.accountId)
    .eq("actor_user_id", input.context.userId)
    .maybeSingle();
  if (authority.error || !authority.data
    || authority.data.studio !== "ARTWORK_PREP_STUDIO"
    || authority.data.kind !== "IMAGE"
    || !["READY", "BOUND"].includes(authority.data.upload_state)
    || (authority.data.upload_state === "BOUND" && authority.data.bound_job_id !== input.projectId)) {
    throw new ArtworkPrepAssetError("ARTWORK_SOURCE_FORBIDDEN", "Dieses Artwork gehört nicht zum aktiven Projekt.", 403);
  }
  const [source] = await resolveTempReferences({
    context: input.context,
    studio: "ARTWORK_PREP_STUDIO",
    jobId: input.projectId,
    entries: [{ referenceId: input.projectId, tempReferenceId: input.tempReferenceId }],
  });
  if (!source || source.kind !== "IMAGE") {
    throw new ArtworkPrepAssetError("ARTWORK_SOURCE_INVALID", "Das Artwork konnte nicht sicher zugeordnet werden.", 400);
  }
  try {
    const projected = await persistArtworkPrepAsset({
      context: input.context,
      projectId: input.projectId,
      jobId: input.projectId,
      resultId: "original",
      title: input.title,
      bytes: source.bytes,
      mimeType: source.mimeType,
      operation: "ARTWORK_ORIGINAL",
    });
    await bindTempReferences({
      context: input.context,
      referenceIds: [input.tempReferenceId],
      jobId: input.projectId,
    });
    return projected.asset;
  } catch (error) {
    if (error instanceof ArtworkPrepImageError) throw error;
    throw error;
  }
}
