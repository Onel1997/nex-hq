import { NextResponse } from "next/server";
import { artworkPrepJobKindSchema } from "@/lib/artwork-prep-studio/contracts";
import { requireArtworkPrepOwner, ArtworkPrepAuthorizationError } from "@/lib/artwork-prep-studio/authority";
import { recoverArtworkPrepUtility } from "@/lib/artwork-prep-studio/service";
import { SupabaseArtworkPrepLocalStore, SupabaseArtworkPrepPrintStore } from "@/lib/artwork-prep-studio/storage";
import { loadOwnedArtworkPrepAsset } from "@/lib/artwork-prep-studio/assets";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const context = await requireArtworkPrepOwner(request);
    const { jobId } = await params;
    const url = new URL(request.url);
    const kind = artworkPrepJobKindSchema.parse(url.searchParams.get("kind"));
    const projectId = url.searchParams.get("projectId") ?? jobId;
    if (!/^[0-9a-f-]{36}$/i.test(jobId) || !/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ success: false, error: "Aktion nicht gefunden." }, { status: 404 });
    if (kind === "UTILITY") {
      const result = await recoverArtworkPrepUtility({ context, projectId, jobId });
      return NextResponse.json({ success: result.status === "SUCCEEDED", ...result });
    }
    const scope = { workspaceId: context.workspaceKey, actorId: context.userId };
    const manifest = kind === "PRINT"
      ? await new SupabaseArtworkPrepPrintStore(projectId).read(scope, jobId)
      : await new SupabaseArtworkPrepLocalStore().read(scope, jobId);
    if (!manifest) return NextResponse.json({ success: false, error: "Aktion nicht gefunden." }, { status: 404 });
    const asset = manifest.resultAssetId
      ? await loadOwnedArtworkPrepAsset(context, manifest.resultAssetId).then((value) => value.asset)
      : null;
    return NextResponse.json({ success: manifest.status === "SUCCEEDED", status: manifest.status, asset });
  } catch (error) {
    if (error instanceof ArtworkPrepAuthorizationError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
    return NextResponse.json({ success: false, code: "ARTWORK_JOB_FAILED", error: "Die Aktion konnte nicht geladen werden." }, { status: 503 });
  }
}
