import { getBrainClient } from "@/brain/client";
import { slugify } from "@/brain/client/utils";
import type {
  BrainCeoFinalReportRef,
  BrainCeoFinalSections,
  BrainReportContent,
} from "@/brain/domains/reports";
import { CEO_FINAL_REPORT_TYPE } from "@/brain/domains/reports";
import { resolveReportTaskIds } from "@/lib/reports/task-link";
import type { SynthesisReportSnapshot } from "@/lib/reports/goal-synthesis";
import type { CeoFinalOutput } from "./final-report-types";

export interface SaveCeoFinalReportInput {
  workspaceId: string;
  output: CeoFinalOutput;
  parentGoalTaskId: string;
  founderGoal: string;
  completionScore: number;
  childTaskIds: string[];
  researchReports: SynthesisReportSnapshot[];
  designReports: SynthesisReportSnapshot[];
  marketingReports: SynthesisReportSnapshot[];
}

export interface SaveCeoFinalReportResult {
  reportId: string;
  reportRecordId: string;
}

function toReportRef(
  snapshot: SynthesisReportSnapshot,
): BrainCeoFinalReportRef {
  return {
    reportId: snapshot.reportId,
    brainRecordId: snapshot.brainRecordId,
    title: snapshot.title,
    taskId: snapshot.taskId,
    agentId: snapshot.agentId,
  };
}

function buildCeoFinalSections(
  input: SaveCeoFinalReportInput,
): BrainCeoFinalSections {
  return {
    executiveSummary: input.output.executiveSummary,
    keyFindings: input.output.keyFindings,
    opportunities: input.output.opportunities,
    risks: input.output.risks,
    recommendedActions: input.output.recommendedActions,
    launchStrategy: input.output.launchStrategy,
    nextMilestones: input.output.nextMilestones,
    ceoVerdict: input.output.ceoVerdict,
    founderGoal: input.founderGoal,
    completionScore: input.completionScore,
    parentGoalTaskId: input.parentGoalTaskId,
    sourceTaskIds: input.childTaskIds,
    researchReports: input.researchReports.map(toReportRef),
    designReports: input.designReports.map(toReportRef),
    marketingReports: input.marketingReports.map(toReportRef),
  };
}

export async function saveCeoFinalReportToBrain(
  input: SaveCeoFinalReportInput,
): Promise<SaveCeoFinalReportResult> {
  const brain = getBrainClient();
  const reportId = crypto.randomUUID();
  const { taskId, originTaskId } = resolveReportTaskIds(
    input.parentGoalTaskId,
    reportId,
    "ceo-final",
  );
  const baseSlug = slugify(input.output.title).slice(0, 48) || "ceo-final";
  const slugSuffix = reportId.slice(0, 8);
  const ceoFinalSections = buildCeoFinalSections(input);

  const reportContent: BrainReportContent = {
    kind: "reports",
    reportId,
    taskId,
    originTaskId,
    agentId: "ceo",
    status: "submitted",
    summary: input.output.executiveSummary,
    confidence: input.output.confidence,
    reportType: CEO_FINAL_REPORT_TYPE,
    ceoFinalSections,
    notes: `Gründer-Ziel: ${input.founderGoal}`,
    artifacts: [
      {
        id: `${reportId}-briefing`,
        type: "markdown",
        label: "Executive Final Briefing",
        content: input.output.fullBriefing,
      },
    ],
  };

  const reportWrite = await brain.createRecord({
    workspaceId: input.workspaceId,
    domain: "reports",
    slug: `ceo-final-${baseSlug}-${slugSuffix}`,
    title: input.output.title,
    summary: input.output.executiveSummary,
    content: reportContent,
    status: "pending_review",
    tags: [
      "ceo-final-report",
      "ceo",
      "agent-generated",
      "executive-synthesis",
    ],
    provenance: {
      createdBy: { type: "agent", id: "ceo" },
      sourceTaskId: input.parentGoalTaskId,
      confidence: input.output.confidence,
    },
  });

  return {
    reportId,
    reportRecordId: reportWrite.record.id,
  };
}
