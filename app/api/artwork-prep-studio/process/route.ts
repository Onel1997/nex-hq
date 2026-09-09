import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { artworkPrepProcessRequestSchema } from "@/lib/artwork-prep-studio/contracts";
import { requireArtworkPrepOwner, ArtworkPrepAuthorizationError } from "@/lib/artwork-prep-studio/authority";
import { createArtworkBackgroundVariant, createArtworkPrintFile, normalizeArtworkPrepError, startArtworkPrepUtility } from "@/lib/artwork-prep-studio/service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const context = await requireArtworkPrepOwner(request);
    const input = artworkPrepProcessRequestSchema.parse(await request.json());
    const result = input.operation === "BACKGROUND_COLOR"
      ? await createArtworkBackgroundVariant({ context, ...input })
      : input.operation === "PRINT_FILE"
        ? await createArtworkPrintFile({ context, ...input })
        : await startArtworkPrepUtility({ context, ...input });
    return NextResponse.json({ success: result.status === "SUCCEEDED", ...result }, { status: result.status === "SUCCEEDED" ? 200 : 202 });
  } catch (error) {
    if (error instanceof ArtworkPrepAuthorizationError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "Diese Aktion ist ungültig." }, { status: 400 });
    const failure = normalizeArtworkPrepError(error);
    return NextResponse.json({ success: false, code: failure.code, error: failure.error }, { status: failure.status });
  }
}
