import { NextResponse } from "next/server";
import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { brainReportRecordsToListItems } from "@/lib/reports/from-brain";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.research.errors.supabaseNotConfigured, reports: [] },
        { status: 503 },
      );
    }

    const { workspace } = await ensureWorkspaceBrainSeeded();
    const brain = getBrainClient();

    const result = await brain.searchRecords({
      workspaceId: workspace.id,
      domains: ["reports"],
      limit: 100,
    });

    const reports = brainReportRecordsToListItems(result.records);

    return NextResponse.json({
      reports,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      total: reports.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.research.errors.unexpected;

    console.error("[Reports List]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
