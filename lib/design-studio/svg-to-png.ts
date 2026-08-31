import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import { isSafePrivateSvg, rasterizePrivateSvg } from "@/lib/xeriano/svg-raster";

export const SVG_TO_PNG_OPERATION = "SVG_TO_PNG" as const;
export const SVG_TO_PNG_VERSION = "xeriamo-svg-to-png-v1" as const;
export const SVG_TO_PNG_LONG_EDGE = 4096 as const;
const MAX_SVG_BYTES = 50 * 1024 * 1024;

export const svgToPngRequestSchema = z.object({
  jobId: z.string().uuid(),
  sourceAssetId: z.string().uuid(),
}).strict();

export class SvgToPngError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

export async function loadOwnedDesignSvgSource(
  context: XerianoAccountContext,
  assetId: string,
) {
  const admin = createAdminClient();
  const found = await admin.from("xeriano_library_assets")
    .select("id,storage_bucket,storage_path,mime_type,byte_length")
    .eq("id", assetId)
    .eq("account_id", context.accountId)
    .eq("asset_type", "DESIGN")
    .maybeSingle();
  if (found.error || !found.data) {
    throw new SvgToPngError("SOURCE_NOT_FOUND", "Design nicht gefunden.", 404);
  }
  if (found.data.mime_type !== "image/svg+xml") {
    throw new SvgToPngError("SVG_REQUIRED", "Diese Aktion ist nur für SVG-Designs verfügbar.", 400);
  }
  const byteLength = Number(found.data.byte_length);
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0 || byteLength > MAX_SVG_BYTES) {
    throw new SvgToPngError("SOURCE_INVALID", "Dieses SVG kann nicht verwendet werden.", 400);
  }
  const downloaded = await admin.storage.from(found.data.storage_bucket).download(found.data.storage_path);
  if (downloaded.error) {
    throw new SvgToPngError("SOURCE_UNAVAILABLE", "Dieses SVG kann gerade nicht verwendet werden.", 503);
  }
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (bytes.length !== byteLength || !isSafePrivateSvg(bytes)) {
    throw new SvgToPngError("SOURCE_INVALID", "Dieses SVG kann nicht verwendet werden.", 400);
  }
  return bytes;
}

export async function renderDesignSvgPng(bytes: Buffer) {
  return rasterizePrivateSvg(bytes, { longEdge: SVG_TO_PNG_LONG_EDGE, upscale: true });
}
