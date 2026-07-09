import type {
  BrainMarketingSections,
  BrainReportContent,
} from "@/brain/domains/reports";
import { getBrainClient } from "@/brain/client";
import { slugify } from "@/brain/client/utils";
import { resolveReportTaskIds } from "@/lib/reports/task-link";
import type { MarketingOutput } from "./types";

export interface SaveMarketingInput {
  workspaceId: string;
  brief: string;
  output: MarketingOutput;
  originTaskId?: string;
}

export interface SaveMarketingResult {
  reportId: string;
  reportRecordId: string;
}

function buildMarketingSections(
  output: MarketingOutput,
): BrainMarketingSections {
  return {
    launchStrategy: output.launchStrategy,
    contentPillars: output.contentPillars,
    tiktokIdeas: output.tiktokIdeas,
    instagramIdeas: output.instagramIdeas,
    influencerStrategy: output.influencerStrategy,
    emailCampaignPlan: output.emailCampaignPlan,
    communityBuildingPlan: output.communityBuildingPlan,
    contentCalendar30Day: output.contentCalendar30Day,
    launchKpis: output.launchKpis,
    budgetAllocation: output.budgetAllocation,
    sourceReportTitles: output.sourceReportTitles,
  };
}

export async function saveMarketingToBrain(
  input: SaveMarketingInput,
): Promise<SaveMarketingResult> {
  const brain = getBrainClient();
  const reportId = crypto.randomUUID();
  const { taskId, originTaskId } = resolveReportTaskIds(
    input.originTaskId,
    reportId,
    "marketing",
  );
  const baseSlug = slugify(input.output.title).slice(0, 48) || "marketing";
  const slugSuffix = reportId.slice(0, 8);
  const marketingSections = buildMarketingSections(input.output);

  const reportContent: BrainReportContent = {
    kind: "reports",
    reportId,
    taskId,
    ...(originTaskId ? { originTaskId } : {}),
    agentId: "marketing",
    status: "submitted",
    summary: input.output.launchStrategy.slice(0, 500),
    confidence: input.output.confidence,
    reportType: "marketing-report",
    marketingSections,
    notes: `Marketing-Briefing: ${input.brief}`,
    artifacts: [
      {
        id: `${reportId}-plan`,
        type: "markdown",
        label: "Vollständiger Marketing-Plan",
        content: input.output.fullPlan,
      },
    ],
  };

  const reportWrite = await brain.createRecord({
    workspaceId: input.workspaceId,
    domain: "reports",
    slug: `marketing-${baseSlug}-${slugSuffix}`,
    title: input.output.title,
    summary: input.output.launchStrategy.slice(0, 500),
    content: reportContent,
    status: "pending_review",
    tags: ["marketing-report", "marketing", "agent-generated", "campaign"],
    provenance: {
      createdBy: { type: "agent", id: "marketing" },
      sourceTaskId: taskId,
      confidence: input.output.confidence,
    },
  });

  return {
    reportId,
    reportRecordId: reportWrite.record.id,
  };
}
