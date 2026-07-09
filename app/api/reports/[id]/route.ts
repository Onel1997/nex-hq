import { NextResponse } from "next/server";
import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { BrainReportContent } from "@/brain/domains/reports";
import { brainReportRecordToListItem } from "@/lib/reports/from-brain";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.research.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const { id } = await context.params;
    const { workspace } = await ensureWorkspaceBrainSeeded();
    const brain = getBrainClient();
    const record = await brain.getRecord("reports", id);

    if (!record || record.workspaceId !== workspace.id) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const report = brainReportRecordToListItem(record);
    const content = record.content as BrainReportContent;

    return NextResponse.json({
      report,
      brainRecordId: record.id,
      content,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.research.errors.unexpected;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.research.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const { id } = await context.params;
    const { workspace } = await ensureWorkspaceBrainSeeded();
    const brain = getBrainClient();
    const record = await brain.getRecord("reports", id);

    if (!record || record.workspaceId !== workspace.id) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    await brain.updateRecord(
      "reports",
      id,
      { status: "archived" },
      { type: "human", id: "workspace-user" },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.research.errors.unexpected;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
