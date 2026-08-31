import { NextResponse } from "next/server";
import { SupabaseDesignJobStore } from "@/lib/design-studio/server-storage";
import { hasXerianoAccountMembership, resolveXerianoAccess } from "@/lib/xeriano/auth";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string; resultId: string }> }) {
  const access = await resolveXerianoAccess();
  if (access.status !== "AUTHENTICATED" || !hasXerianoAccountMembership(access.context)) return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  const { jobId, resultId } = await params; const scope = { workspaceId: access.context.workspaceKey, actorId: access.context.userId };
  const store = new SupabaseDesignJobStore(); const manifest = await store.readManifest(scope, jobId);
  const result = manifest?.results.find((item) => item.publicView.id === resultId);
  if (!result) return NextResponse.json({ error: "Design nicht gefunden." }, { status: 404 });
  const asset = await store.readResult({ scope, jobId, storagePath: result.storagePath });
  if (!asset) return NextResponse.json({ error: "Design nicht gefunden." }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const extension = result.publicView.mimeType === "image/svg+xml" ? "svg" : result.publicView.mimeType === "image/jpeg" ? "jpg" : result.publicView.mimeType === "image/webp" ? "webp" : "png";
  return new NextResponse(Uint8Array.from(asset.bytes), { headers: {
    "Content-Type": result.publicView.mimeType, "Content-Length": String(asset.bytes.length), "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300",
    ...(result.publicView.mimeType === "image/svg+xml" ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } : {}),
    ...(download ? { "Content-Disposition": `attachment; filename=\"xeriamo-design-${resultId.slice(0, 8)}.${extension}\"` } : {}),
  } });
}
