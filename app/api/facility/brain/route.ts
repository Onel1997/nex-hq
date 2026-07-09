import { NextResponse } from "next/server";
import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { BrainRecord } from "@/brain/types";
import { getFacilitySnapshot } from "@/lib/facility/aggregate";
import { buildBrainCorePayload } from "@/lib/facility/brain-core-intelligence";
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

    const payload = await buildBrainCorePayload(snapshot, brainReports, tasks);

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Brain Core";

    console.error("[Brain Core]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
