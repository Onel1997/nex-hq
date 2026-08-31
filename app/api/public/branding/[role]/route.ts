import { NextResponse } from "next/server";
import { brandingRoleFromSlug } from "@/lib/xeriano/branding/contracts";
import { loadPublicBrandingBytes } from "@/lib/xeriano/branding/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ role: string }> },
) {
  const role = brandingRoleFromSlug((await params).role);
  if (!role) return new NextResponse(null, { status: 404 });
  const asset = await loadPublicBrandingBytes(role);
  if (!asset) return new NextResponse(null, { status: 404 });
  const etag = `"${asset.checksum}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "public, max-age=0, must-revalidate" },
    });
  }
  return new NextResponse(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.bytes.length),
      "Cache-Control": "public, max-age=0, must-revalidate",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
