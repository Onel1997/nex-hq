import { NextResponse } from "next/server";
import { readOwnedArtworkPrepAsset } from "@/lib/artwork-prep-studio/assets";
import { ArtworkPrepAuthorizationError, requireArtworkPrepOwner } from "@/lib/artwork-prep-studio/authority";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const context = await requireArtworkPrepOwner(request);
    const { assetId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(assetId)) return NextResponse.json({ success: false, error: "Artwork nicht gefunden." }, { status: 404 });
    return NextResponse.json({ success: true, asset: await readOwnedArtworkPrepAsset(context, assetId) });
  } catch (error) {
    if (error instanceof ArtworkPrepAuthorizationError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    return NextResponse.json({ success: false, error: "Artwork nicht gefunden." }, { status: 404 });
  }
}
