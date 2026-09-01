import { createXeriamoRootFaviconResponse } from "@/lib/xeriano/branding/delivery";
import { loadPublicBrandingBytes } from "@/lib/xeriano/branding/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return createXeriamoRootFaviconResponse(await loadPublicBrandingBytes("FAVICON"));
}
