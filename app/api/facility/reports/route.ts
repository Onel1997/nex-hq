import { NextResponse } from "next/server";
import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { BrainRecord } from "@/brain/types";
import { getFacilitySnapshot } from "@/lib/facility/aggregate";
import {
  buildReportsCenterPayload,
  type BuildReportsCenterOptions,
} from "@/lib/facility/reports-center-intelligence";
import type {
  ReportsCenterAgentTab,
  ReportsCenterSource,
} from "@/lib/facility/reports-center-types";
import { brainReportRecordsToListItems } from "@/lib/reports/from-brain";
import { listTasks } from "@/lib/tasks/task-service";

const AGENT_TABS: ReportsCenterAgentTab[] = [
  "research",
  "design",
  "marketing",
  "commerce",
  "ceo",
];

const SOURCES: ReportsCenterSource[] = ["live", "seed", "demo", "legacy"];

function parseSource(value: string | null): BuildReportsCenterOptions["source"] {
  if (!value || value === "all") return "live";
  return SOURCES.includes(value as ReportsCenterSource)
    ? (value as ReportsCenterSource)
    : "live";
}

function parseAgentTab(value: string | null): BuildReportsCenterOptions["agentTab"] {
  if (!value || value === "all") return "all";
  return AGENT_TABS.includes(value as ReportsCenterAgentTab)
    ? (value as ReportsCenterAgentTab)
    : "all";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const options: BuildReportsCenterOptions = {
      source: parseSource(searchParams.get("source")),
      agentTab: parseAgentTab(searchParams.get("agent")),
    };

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

    const payload = await buildReportsCenterPayload(
      snapshot,
      tasks,
      brainReports,
      options,
    );

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load Reports Center";

    console.error("[Reports Center]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
