import { NextResponse } from "next/server";

import { requireVideoEditorOwner, VideoEditorAuthorizationError } from "@/lib/video-editor-studio/authority";
import { videoEditorStorageRedirect } from "@/lib/video-editor-studio/delivery";
import { createVideoEditorSourceSignedUrl, resolveVideoEditorSourceMetadata } from "@/lib/video-editor-studio/sources";

export const runtime = "nodejs";

async function serve(
  request: Request,
  params: Promise<{ kind: string; sourceId: string }>,
  head: boolean,
) {
  try {
    const context = await requireVideoEditorOwner(request);
    const { kind, sourceId } = await params;
    const source = kind === "temp"
      ? { kind: "TEMP_REFERENCE" as const, id: sourceId }
      : kind === "library"
        ? { kind: "LIBRARY_ASSET" as const, id: sourceId }
        : null;
    if (!source || !/^[0-9a-f-]{36}$/i.test(sourceId)) {
      return NextResponse.json({ error: "Medium nicht gefunden." }, { status: 404 });
    }
    const asset = await resolveVideoEditorSourceMetadata({ context, source, expected: "VIDEO" });
    void head;
    return videoEditorStorageRedirect(await createVideoEditorSourceSignedUrl(asset));
  } catch (error) {
    if (error instanceof VideoEditorAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Medium konnte nicht geladen werden." }, { status: 404 });
  }
}

export function GET(request: Request, { params }: { params: Promise<{ kind: string; sourceId: string }> }) {
  return serve(request, params, false);
}

export function HEAD(request: Request, { params }: { params: Promise<{ kind: string; sourceId: string }> }) {
  return serve(request, params, true);
}
