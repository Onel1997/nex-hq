import { NextResponse } from "next/server";
import { loadLatestDesignBrief } from "@/lib/research/design-brief";

/** Latest Research HQ design brief for Design Studio prefill. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("reportId") ?? undefined;

    const result = await loadLatestDesignBrief(reportId);
    return NextResponse.json({
      ok: true,
      brief: result.brief,
      prefill: result.prefill,
      source: result.source,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load design brief";
    console.error("[Research Design Brief]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
