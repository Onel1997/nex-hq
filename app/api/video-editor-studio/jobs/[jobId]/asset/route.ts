import { NextResponse } from "next/server";

import { requireVideoEditorOwner, VideoEditorAuthorizationError } from "@/lib/video-editor-studio/authority";
import { videoEditorStorageRedirect } from "@/lib/video-editor-studio/delivery";
import { videoEditorScope } from "@/lib/video-editor-studio/scope";
import { SupabaseVideoEditorJobStore } from "@/lib/video-editor-studio/storage";

export const runtime = "nodejs";

async function serve(request: Request, params: Promise<{ jobId: string }>, head: boolean) {
  try {
    const context = await requireVideoEditorOwner(request);
    const { jobId } = await params;
    const download = new URL(request.url).searchParams.get("download") === "1";
    const fileName = `xeriamo-fashion-reel-${jobId}.mp4`;
    const asset = await new SupabaseVideoEditorJobStore().createResultSignedUrl(videoEditorScope(context), jobId, context.accountId, download ? fileName : undefined);
    if (!asset) return NextResponse.json({ error: "Video nicht gefunden." }, { status: 404 });
    void head;
    return videoEditorStorageRedirect(asset.signedUrl);
  } catch (error) {
    if (error instanceof VideoEditorAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Video konnte nicht geladen werden." }, { status: 503 });
  }
}

export function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  return serve(request, params, false);
}

export function HEAD(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  return serve(request, params, true);
}
