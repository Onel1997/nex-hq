import { NextResponse } from "next/server";
import { loadResearchBrainIntelligence } from "@/lib/research/research-brain-intelligence";

/** Research HQ V6 — aggregated Milaene intelligence brain snapshot. */
export async function GET() {
  try {
    const snapshot = await loadResearchBrainIntelligence();
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load research intelligence";
    console.error("[Research Intelligence]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
