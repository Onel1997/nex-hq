import { NextResponse } from "next/server";
import { loadResearchStudioReport } from "@/lib/research-intelligence/report/load-report";
import {
  estimateProviderCost,
  parseProviderMode,
  parseResearchMode,
} from "@/lib/research-intelligence/creative-research";

export const dynamic = "force-dynamic";

/** GET creative research / fusion intelligence report for Research Studio V3. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("refresh") === "1";
    const title = searchParams.get("title") ?? undefined;
    const researchMode = parseResearchMode(
      searchParams.get("mode") ?? searchParams.get("researchMode"),
    );
    const providerMode = parseProviderMode(
      searchParams.get("providerMode") ?? "creative_only",
    );
    const estimateOnly = searchParams.get("estimate") === "1";

    if (estimateOnly) {
      return NextResponse.json({
        ok: true,
        estimate: estimateProviderCost(providerMode),
      });
    }

    const report = await loadResearchStudioReport({
      force,
      title,
      researchMode,
      providerMode,
    });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build fusion report";
    console.error("[Research Fusion Report]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
