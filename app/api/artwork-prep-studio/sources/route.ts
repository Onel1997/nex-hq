import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { artworkPrepSourceRequestSchema } from "@/lib/artwork-prep-studio/contracts";
import { ArtworkPrepAssetError, importArtworkPrepTempSource, selectOwnedArtworkPrepSource } from "@/lib/artwork-prep-studio/assets";
import { ArtworkPrepAuthorizationError, requireArtworkPrepOwner } from "@/lib/artwork-prep-studio/authority";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const context = await requireArtworkPrepOwner(request);
    const input = artworkPrepSourceRequestSchema.parse(await request.json());
    const asset = "tempReferenceId" in input
      ? await importArtworkPrepTempSource({ context, ...input })
      : await selectOwnedArtworkPrepSource(context, input.libraryAssetId);
    return NextResponse.json({ success: true, asset });
  } catch (error) {
    if (error instanceof ArtworkPrepAuthorizationError || error instanceof ArtworkPrepAssetError || error instanceof ZodError) {
      const status = error instanceof ZodError ? 400 : error.status;
      return NextResponse.json({ success: false, code: error instanceof ZodError ? "INVALID_REQUEST" : error.code, error: error instanceof ZodError ? "Das Artwork konnte nicht sicher übernommen werden." : error.message }, { status });
    }
    return NextResponse.json({ success: false, code: "ARTWORK_IMPORT_FAILED", error: "Das Artwork konnte nicht gespeichert werden." }, { status: 503 });
  }
}
