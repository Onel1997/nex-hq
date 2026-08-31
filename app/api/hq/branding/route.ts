import { NextResponse } from "next/server";
import { isXeriamoBrandingRole } from "@/lib/xeriano/branding/contracts";
import {
  listOwnerBrandingAssets,
  requireXeriamoBrandingMutationRequest,
  uploadBrandingAsset,
  XeriamoBrandingError,
} from "@/lib/xeriano/branding/server";
import { BrandingValidationError } from "@/lib/xeriano/branding/validation";

export const runtime = "nodejs";
const MAX_REQUEST_BYTES = 5 * 1024 * 1024 + 64 * 1024;

function errorResponse(error: unknown) {
  if (error instanceof BrandingValidationError) {
    const message = error.code === "FILE_TOO_LARGE"
      ? "Die Datei ist für diesen Branding-Typ zu groß."
      : error.code === "UNSAFE_SVG"
        ? "Diese SVG-Datei enthält nicht erlaubte Inhalte."
        : "Diese Datei kann nicht als Branding verwendet werden.";
    return NextResponse.json({ success: false, error: message, code: error.code }, { status: 400 });
  }
  if (error instanceof XeriamoBrandingError) {
    return NextResponse.json(
      { success: false, error: error.code === "OWNER_REQUIRED" || error.code === "MUTATION_ORIGIN_REQUIRED" ? "Keine Berechtigung für diese Aktion." : "Branding ist gerade nicht verfügbar." },
      { status: error.status },
    );
  }
  return NextResponse.json({ success: false, error: "Branding ist gerade nicht verfügbar." }, { status: 503 });
}

export async function GET() {
  try {
    return NextResponse.json({ assets: await listOwnerBrandingAssets() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await requireXeriamoBrandingMutationRequest(request);
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
      return NextResponse.json({ success: false, error: "Die Datei ist zu groß." }, { status: 413 });
    }
    const form = await request.formData();
    const role = form.get("role");
    const file = form.get("file");
    if (!isXeriamoBrandingRole(role) || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Ungültige Branding-Datei." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const assetId = await uploadBrandingAsset({
      role,
      bytes,
      declaredMimeType: file.type,
      originalFilename: file.name,
    });
    return NextResponse.json({ success: true, assetId }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
