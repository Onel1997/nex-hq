import { NextResponse } from "next/server";
import { deleteBrandingAsset, requireXeriamoBrandingMutationRequest, XeriamoBrandingError } from "@/lib/xeriano/branding/server";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    await requireXeriamoBrandingMutationRequest(request);
    await deleteBrandingAsset((await params).assetId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof XeriamoBrandingError) {
      const message = error.code === "ACTIVE_ASSET" ? "Aktive Assets können nicht gelöscht werden." : error.code === "OWNER_REQUIRED" || error.code === "MUTATION_ORIGIN_REQUIRED" ? "Keine Berechtigung für diese Aktion." : "Asset konnte nicht gelöscht werden.";
      return NextResponse.json({ success: false, error: message }, { status: error.status });
    }
    return NextResponse.json({ success: false, error: "Asset konnte nicht gelöscht werden." }, { status: 503 });
  }
}
