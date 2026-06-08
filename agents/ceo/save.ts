import type { BrainCeoSections, BrainReportContent } from "@/brain/domains/reports";
import { getBrainClient } from "@/brain/client";
import { slugify } from "@/brain/client/utils";
import { resolveReportTaskIds } from "@/lib/reports/task-link";
import type { CeoOutput } from "./types";

export interface SaveCeoInput {
  workspaceId: string;
  question: string;
  output: CeoOutput;
  originTaskId?: string;
}

export interface SaveCeoResult {
  reportId: string;
  reportRecordId: string;
}

function buildCeoSections(output: CeoOutput): BrainCeoSections {
  return {
    executiveSummary: output.executiveSummary,
    keyInsights: output.keyInsights,
    strategicOpportunities: output.strategicOpportunities,
    risks: output.risks,
    nextSteps: output.nextSteps,
    sourceReportTitles: output.sourceReportTitles,
  };
}

export async function saveCeoToBrain(
  input: SaveCeoInput,
): Promise<SaveCeoResult> {
  const brain = getBrainClient();
  const reportId = crypto.randomUUID();
  const { taskId, originTaskId } = resolveReportTaskIds(
    input.originTaskId,
    reportId,
    "ceo",
  );
  const baseSlug = slugify(input.output.title).slice(0, 48) || "ceo";
  const slugSuffix = reportId.slice(0, 8);
  const ceoSections = buildCeoSections(input.output);

  const reportContent: BrainReportContent = {
    kind: "reports",
    reportId,
    taskId,
    ...(originTaskId ? { originTaskId } : {}),
    agentId: "ceo",
    status: "submitted",
    summary: input.output.executiveSummary,
    confidence: input.output.confidence,
    reportType: "ceo-report",
    ceoSections,
    notes: `Strategische Frage: ${input.question}`,
    artifacts: [
      {
        id: `${reportId}-briefing`,
        type: "markdown",
        label: "Strategisches Briefing",
        content: input.output.fullBriefing,
      },
    ],
  };

  const reportWrite = await brain.createRecord({
    workspaceId: input.workspaceId,
    domain: "reports",
    slug: `ceo-${baseSlug}-${slugSuffix}`,
    title: input.output.title,
    summary: input.output.executiveSummary,
    content: reportContent,
    status: "pending_review",
    tags: ["ceo-report", "ceo", "agent-generated", "strategic"],
    provenance: {
      createdBy: { type: "agent", id: "ceo" },
      sourceTaskId: taskId,
      confidence: input.output.confidence,
    },
  });

  return {
    reportId,
    reportRecordId: reportWrite.record.id,
  };
}
