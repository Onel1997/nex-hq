import { NextResponse } from "next/server";
import { isXeriamoBrandingRole } from "@/lib/xeriano/branding/contracts";
import { activateBrandingAsset, requireXeriamoBrandingMutationRequest, XeriamoBrandingError } from "@/lib/xeriano/branding/server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    await requireXeriamoBrandingMutationRequest(request);
    const body = await request.json().catch(() => null) as { role?: unknown } | null;
    if (!isXeriamoBrandingRole(body?.role)) return NextResponse.json({ success: false, error: "Ungültige Anfrage." }, { status: 400 });
    await activateBrandingAsset((await params).assetId, body.role);
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof XeriamoBrandingError ? error.status : 503;
    return NextResponse.json({ success: false, error: status === 403 ? "Keine Berechtigung für diese Aktion." : "Branding konnte nicht aktiviert werden." }, { status });
  }
}
