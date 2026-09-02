import { NextResponse } from "next/server";

import { buildUgcVideoAssetResponse } from "@/lib/ugc-video-studio/result-delivery";
import { SupabaseUgcVideoJobStore } from "@/lib/ugc-video-studio/server-storage";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";

export const runtime = "nodejs";

async function serve(
  request: Request,
  context: { params: Promise<{ jobId: string; resultId: string }> },
  head: boolean,
) {
  const access = await resolveXerianoAccess();
  if (access.status === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  if (access.status !== "AUTHENTICATED") {
    return NextResponse.json({ error: "Xeriamo-Konto nicht verfügbar." }, { status: 503 });
  }
  const { jobId, resultId } = await context.params;
  const store = new SupabaseUgcVideoJobStore();
  const asset = await store.readResult({
    scope: {
      workspaceId: access.context.workspaceKey,
      actorId: access.context.userId,
    },
    jobId,
    resultId,
  });
  if (!asset) {
    return NextResponse.json({ error: "Video nicht gefunden." }, { status: 404 });
  }
  const download = new URL(request.url).searchParams.get("download") === "1";
  return buildUgcVideoAssetResponse({
    request,
    asset,
    resultId,
    download,
    head,
  });
}

export function GET(
  request: Request,
  context: { params: Promise<{ jobId: string; resultId: string }> },
) {
  return serve(request, context, false);
}

export function HEAD(
  request: Request,
  context: { params: Promise<{ jobId: string; resultId: string }> },
) {
  return serve(request, context, true);
}
