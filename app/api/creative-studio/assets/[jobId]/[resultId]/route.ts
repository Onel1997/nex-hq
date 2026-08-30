import { NextResponse } from "next/server";

import { SupabaseCreativeJobStore } from "@/lib/creative-studio/server-storage";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";
import { resolveCreativeAccountJobScope } from "@/lib/creative-studio/account-history";

export const runtime = "nodejs";

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

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
  const scope = await resolveCreativeAccountJobScope({
    context: access.context,
    jobId,
  });
  if (!scope) {
    return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
  }
  const store = new SupabaseCreativeJobStore();
  const asset = await store.readResult({
    scope,
    jobId,
    resultId,
  });
  if (!asset) {
    return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
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
            "Content-Disposition": `attachment; filename="creative-studio-${resultId}.${extensionForMime(asset.mimeType)}"`,
          }
        : {}),
    },
  });
}
