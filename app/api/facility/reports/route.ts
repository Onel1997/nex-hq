import { NextResponse } from "next/server";
import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { BrainRecord } from "@/brain/types";
import { getFacilitySnapshot } from "@/lib/facility/aggregate";
import { buildReportsCenterPayload } from "@/lib/facility/reports-center-intelligence";
import { brainReportRecordsToListItems } from "@/lib/reports/from-brain";
import { listTasks } from "@/lib/tasks/task-service";

export async function GET() {
  try {
    const [{ tasks }, snapshot, { workspace }] = await Promise.all([
      listTasks().catch(() => ({ tasks: [], workspaceId: "", workspaceName: "" })),
      getFacilitySnapshot(),
      ensureWorkspaceBrainSeeded(),
    ]);

    const brain = getBrainClient();
    const reportResult = await brain.searchRecords({
      workspaceId: workspace.id,
      domains: ["reports"],
      limit: 200,
    });

    const brainReports = brainReportRecordsToListItems(
      reportResult.records as BrainRecord<"reports">[],
    );

    const payload = await buildReportsCenterPayload(snapshot, tasks, brainReports);

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Reports Center";

    console.error("[Reports Center]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
