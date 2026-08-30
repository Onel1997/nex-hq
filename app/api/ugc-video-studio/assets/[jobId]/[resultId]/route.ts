import { NextResponse } from "next/server";

import { SupabaseUgcVideoJobStore } from "@/lib/ugc-video-studio/server-storage";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string; resultId: string }> },
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
  return new NextResponse(new Blob([Uint8Array.from(asset.bytes)]), {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.bytes.byteLength),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="ugc-video-${resultId}.mp4"`,
          }
        : {}),
    },
  });
}
