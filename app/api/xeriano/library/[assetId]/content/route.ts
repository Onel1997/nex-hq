import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireXerianoAccount, XerianoAuthorizationError } from "@/lib/xeriano/server";
import { rasterizePrivateSvg } from "@/lib/xeriano/svg-raster";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const context = await requireXerianoAccount();
    const { assetId } = await params;
    const admin = createAdminClient();
    const found = await admin.from("xeriano_library_assets")
      .select("storage_bucket,storage_path,mime_type,byte_length,title")
      .eq("id", assetId).eq("account_id", context.accountId).maybeSingle();
    if (found.error || !found.data) return NextResponse.json({ error: "Asset nicht gefunden." }, { status: 404 });
    const downloaded = await admin.storage.from(found.data.storage_bucket).download(found.data.storage_path);
    if (downloaded.error) throw downloaded.error;
    const originalBytes = Buffer.from(await downloaded.data.arrayBuffer());
    let bytes = Uint8Array.from(originalBytes);
    const url = new URL(request.url);
    const download = url.searchParams.get("download") === "1";
    const svg = found.data.mime_type === "image/svg+xml";
    const raster = svg && url.searchParams.get("format") === "png";
    if (raster) bytes = Uint8Array.from(await rasterizePrivateSvg(originalBytes));
    const mimeType = raster ? "image/png" : found.data.mime_type;
    const extension = mimeType === "image/svg+xml" ? "svg" : mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
    return new NextResponse(bytes, { headers: {
      "Content-Type": mimeType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      ...(svg && !raster ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
      ...(download ? { "Content-Disposition": `attachment; filename=\"xeriamo-design-${assetId.slice(0, 8)}.${extension}\"` } : {}),
    } });
  } catch (error) {
    if (error instanceof XerianoAuthorizationError) return NextResponse.json({ error: "Kein Zugriff." }, { status: error.status });
    return NextResponse.json({ error: "Asset konnte nicht geladen werden." }, { status: 503 });
  }
}
