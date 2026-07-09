import { NextResponse } from "next/server";
import { loadResearchStudioReport } from "@/lib/research-intelligence/report/load-report";

export const dynamic = "force-dynamic";

/** GET deterministic fusion intelligence report for Research Studio V3. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("refresh") === "1";
    const title = searchParams.get("title") ?? undefined;

    const report = await loadResearchStudioReport({ force, title });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build fusion report";
    console.error("[Research Fusion Report]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
