import { NextResponse } from "next/server";
import { loadPublicBranding } from "@/lib/xeriano/branding/server";

export const runtime = "nodejs";

export async function GET() {
  const branding = await loadPublicBranding();
  return NextResponse.json(
    { branding },
    { headers: { "Cache-Control": "public, max-age=0, must-revalidate" } },
  );
}
