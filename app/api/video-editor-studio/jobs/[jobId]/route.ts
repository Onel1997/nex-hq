import { NextResponse } from "next/server";

import { requireVideoEditorOwner, VideoEditorAuthorizationError } from "@/lib/video-editor-studio/authority";
import { publicVideoEditorJob } from "@/lib/video-editor-studio/contracts";
import { reconcileStaleVideoEditorJob } from "@/lib/video-editor-studio/recovery";
import { videoEditorScope } from "@/lib/video-editor-studio/scope";
import { SupabaseVideoEditorJobStore } from "@/lib/video-editor-studio/storage";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const context = await requireVideoEditorOwner(request);
    const { jobId } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) {
      return NextResponse.json({ success: false, code: "JOB_NOT_FOUND", error: "Export nicht gefunden." }, { status: 404 });
    }
    const store = new SupabaseVideoEditorJobStore();
    let manifest = await store.readManifest(videoEditorScope(context), jobId);
    if (!manifest || manifest.accountId !== context.accountId) {
      return NextResponse.json({ success: false, code: "JOB_NOT_FOUND", error: "Export nicht gefunden." }, { status: 404 });
    }
    manifest = await reconcileStaleVideoEditorJob({ context, manifest, store });
    return NextResponse.json({ success: true, job: publicVideoEditorJob(manifest) });
  } catch (error) {
    if (error instanceof VideoEditorAuthorizationError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ success: false, code: "JOB_READ_FAILED", error: "Der Exportstatus konnte nicht geladen werden." }, { status: 503 });
  }
}
