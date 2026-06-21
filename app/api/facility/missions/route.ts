import { NextResponse } from "next/server";
import { getFacilitySnapshot } from "@/lib/facility/aggregate";
import { buildMissionControlPayload } from "@/lib/facility/mission-control-intelligence";
import { listTasks } from "@/lib/tasks/task-service";

export async function GET() {
  try {
    const [{ tasks }, snapshot] = await Promise.all([
      listTasks().catch(() => ({ tasks: [], workspaceId: "", workspaceName: "" })),
      getFacilitySnapshot(),
    ]);

    const payload = buildMissionControlPayload(snapshot, tasks);

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Mission Control";

    console.error("[Mission Control]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
