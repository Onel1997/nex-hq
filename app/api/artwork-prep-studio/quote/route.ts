import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { artworkPrepQuoteRequestSchema } from "@/lib/artwork-prep-studio/contracts";
import { requireArtworkPrepOwner, ArtworkPrepAuthorizationError } from "@/lib/artwork-prep-studio/authority";
import { artworkPrepOwnerEstimate } from "@/lib/artwork-prep-studio/economics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireArtworkPrepOwner(request);
    const input = artworkPrepQuoteRequestSchema.parse(await request.json());
    if (input.operation === "UPSCALE" && !input.factor) return NextResponse.json({ success: false, error: "Upscale-Faktor fehlt." }, { status: 400 });
    return NextResponse.json({ success: true, quote: artworkPrepOwnerEstimate(input) });
  } catch (error) {
    if (error instanceof ArtworkPrepAuthorizationError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "Kosten konnten nicht ermittelt werden." }, { status: 400 });
    return NextResponse.json({ success: false, code: "QUOTE_FAILED", error: "Kosten konnten nicht ermittelt werden." }, { status: 503 });
  }
}
