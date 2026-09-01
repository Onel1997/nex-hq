import { NextResponse } from "next/server";
import { loadPublicBrandingSnapshot } from "@/lib/xeriano/branding/server";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = await loadPublicBrandingSnapshot();
  return NextResponse.json(
    snapshot,
    {
      status: snapshot.resolved ? 200 : 503,
      headers: { "Cache-Control": "public, max-age=0, must-revalidate" },
    },
  );
}
