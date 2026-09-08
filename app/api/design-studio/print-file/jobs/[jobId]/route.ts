import { NextResponse } from "next/server";

import { SupabaseDesignPrintFileStore } from "@/lib/design-studio/print-file-storage";
import { hasXerianoAccountMembership, resolveXerianoAccess } from "@/lib/xeriano/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const access = await resolveXerianoAccess();
  if (access.status !== "AUTHENTICATED" || !hasXerianoAccountMembership(access.context)) {
    return NextResponse.json({ success: false, error: "Kein Zugriff." }, { status: 403 });
  }
  const { jobId } = await params;
  try {
    const manifest = await new SupabaseDesignPrintFileStore().read({
      workspaceId: access.context.workspaceKey,
      actorId: access.context.userId,
    }, jobId);
    if (!manifest) {
      return NextResponse.json({ success: false, error: "Druckdatei nicht gefunden.", code: "PRINT_FILE_NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({
      success: manifest.status === "SUCCEEDED",
      status: manifest.status,
      result: manifest.resultAssetId ? {
        assetId: manifest.resultAssetId,
        creationId: manifest.resultCreationId,
        width: manifest.width,
        height: manifest.height,
      } : null,
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: "Druckdatei konnte nicht geladen werden.",
      code: "PRINT_FILE_READ_FAILED",
    }, { status: 503 });
  }
}
