import { NextResponse } from "next/server";
import { loadPublicMaintenanceStatus } from "@/lib/xeriano/maintenance/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await loadPublicMaintenanceStatus();
  return NextResponse.json(
    { status },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
