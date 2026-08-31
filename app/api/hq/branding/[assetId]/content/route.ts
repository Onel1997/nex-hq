import { NextResponse } from "next/server";
import { loadOwnerBrandingBytes, XeriamoBrandingError } from "@/lib/xeriano/branding/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const asset = await loadOwnerBrandingBytes((await params).assetId);
    return new NextResponse(new Uint8Array(asset.bytes), {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "private, max-age=0, must-revalidate",
        ETag: `"${asset.checksum}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = error instanceof XeriamoBrandingError ? error.status : 404;
    return NextResponse.json({ error: "Asset nicht verfügbar." }, { status });
  }
}
