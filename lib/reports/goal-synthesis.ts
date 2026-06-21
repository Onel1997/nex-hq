import { getBrainClient } from "@/brain/client";
import type {
  BrainCeoFinalSections,
  BrainReportContent,
} from "@/brain/domains/reports";
import { CEO_FINAL_REPORT_TYPE } from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { AgentId } from "@/lib/constants/agents";
import { listTasks } from "@/lib/tasks/task-service";
import type { TaskListItem } from "@/tasks/types";

/** Required specialist approvals before CEO final synthesis. */
export const REQUIRED_SYNTHESIS_AGENTS: AgentId[] = [
  "research",
  "designer",
  "marketing",
];

export interface SynthesisReportSnapshot {
  reportId: string;
  brainRecordId: string;
  title: string;
  taskId: string;
  agentId: AgentId;
  summary: string;
  executiveSummary: string;
  keyFindings: string[];
  opportunities: string[];
  risks: string[];
  recommendations: string[];
}

export interface GoalSynthesisContext {
  parentGoalTask: TaskListItem;
  founderGoal: string;
  childTasks: TaskListItem[];
  researchReports: SynthesisReportSnapshot[];
  designReports: SynthesisReportSnapshot[];
  marketingReports: SynthesisReportSnapshot[];
  childTaskIds: string[];
  completionScore: number;
}

function isParentGoalTask(task: TaskListItem): boolean {
  return (
    task.createdByAgentId === "ceo" &&
    !task.parentTaskId &&
    task.payload.kind === "ceo-goal"
  );
}

function extractReportSnapshot(
  record: BrainRecord<"reports">,
): SynthesisReportSnapshot {
  const content = record.content as BrainReportContent;
  const research = content.researchSections;
  const design = content.designSections;
  const marketing = content.marketingSections;
  const ceo = content.ceoSections;

  const keyFindings =
    research?.keyFindings ??
    design?.silhouettes ??
    marketing?.contentPillars ??
    ceo?.keyInsights ??
    content.keyFindings ??
    [];

  const opportunities =
    research?.opportunities ??
    design?.launchRecommendations ??
    marketing?.contentPillars ??
    ceo?.strategicOpportunities ??
    [];

  const risks =
    research?.risks ?? ceo?.risks ?? [];

  const recommendations =
    research?.recommendations ??
    design?.launchRecommendations ??
    marketing?.contentPillars ??
    [];

  const executiveSummary =
    research?.executiveSummary ??
    design?.story ??
    design?.collectionStory ??
    marketing?.launchStrategy ??
    ceo?.executiveSummary ??
    content.summary;

  return {
    reportId: content.reportId,
    brainRecordId: record.id,
    title: record.title,
    taskId: content.originTaskId ?? content.taskId,
    agentId: content.agentId,
    summary: content.summary,
    executiveSummary,
    keyFindings,
    opportunities,
    risks,
    recommendations,
  };
}

export async function resolveParentGoalFromTaskId(
  taskId: string,
): Promise<TaskListItem | null> {
  const { tasks } = await listTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  if (isParentGoalTask(task)) {
    return task;
  }

  if (task.parentTaskId) {
    return tasks.find((t) => t.id === task.parentTaskId) ?? null;
  }

  const goalRef = task.payload.goalRef;
  if (typeof goalRef === "string") {
    return tasks.find((t) => t.id === goalRef) ?? null;
  }

  return null;
}

export async function getChildTasksForGoal(
  parentGoalTaskId: string,
): Promise<TaskListItem[]> {
  const { tasks } = await listTasks();
  return tasks.filter(
    (task) =>
      task.parentTaskId === parentGoalTaskId ||
      task.payload.goalRef === parentGoalTaskId,
  );
}

async function loadApprovedReportsForTasks(
  taskIds: string[],
): Promise<Map<string, SynthesisReportSnapshot[]>> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();
  const taskIdSet = new Set(taskIds);

  const result = await brain.searchRecords({
    workspaceId: workspace.id,
    domains: ["reports"],
    status: ["approved"],
    limit: 200,
  });

  const map = new Map<string, SynthesisReportSnapshot[]>();

  for (const record of result.records) {
    const content = record.content as BrainReportContent;
    if (content.reportType === CEO_FINAL_REPORT_TYPE) continue;

    const linkedTaskId =
      content.originTaskId && taskIdSet.has(content.originTaskId)
        ? content.originTaskId
        : taskIdSet.has(content.taskId)
          ? content.taskId
          : null;

    if (!linkedTaskId) continue;

    const snapshot = extractReportSnapshot(record as BrainRecord<"reports">);
    const existing = map.get(linkedTaskId) ?? [];
    existing.push(snapshot);
    map.set(linkedTaskId, existing);
  }

  return map;
}

export async function findExistingFinalReportForGoal(
  parentGoalTaskId: string,
): Promise<BrainRecord<"reports"> | null> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();

  const result = await brain.searchRecords({
    workspaceId: workspace.id,
    domains: ["reports"],
    status: ["approved", "pending_review", "draft", "revision_requested"],
    limit: 200,
  });

  return (
    (result.records.find((record) => {
      const content = record.content as BrainReportContent;
      return (
        content.reportType === CEO_FINAL_REPORT_TYPE &&
        content.ceoFinalSections?.parentGoalTaskId === parentGoalTaskId
      );
    }) as BrainRecord<"reports"> | undefined) ?? null
  );
}

export function computeCompletionScore(
  researchCount: number,
  designCount: number,
  marketingCount: number,
): number {
  const parts = [
    researchCount > 0 ? 1 : 0,
    designCount > 0 ? 1 : 0,
    marketingCount > 0 ? 1 : 0,
  ];
  return Math.round((parts.reduce((a, b) => a + b, 0) / 3) * 100);
}

export async function buildGoalSynthesisContext(
  parentGoalTaskId: string,
): Promise<GoalSynthesisContext | null> {
  const { tasks } = await listTasks();
  const parentGoalTask = tasks.find((t) => t.id === parentGoalTaskId);
  if (!parentGoalTask || !isParentGoalTask(parentGoalTask)) {
    return null;
  }

  const childTasks = await getChildTasksForGoal(parentGoalTaskId);
  const childTaskIds = childTasks.map((t) => t.id);
  const reportsByTask = await loadApprovedReportsForTasks(childTaskIds);

  const researchReports: SynthesisReportSnapshot[] = [];
  const designReports: SynthesisReportSnapshot[] = [];
  const marketingReports: SynthesisReportSnapshot[] = [];

  for (const child of childTasks) {
    const reports = reportsByTask.get(child.id) ?? [];
    for (const report of reports) {
      if (child.assigneeAgentId === "research") {
        researchReports.push(report);
      } else if (child.assigneeAgentId === "designer") {
        designReports.push(report);
      } else if (child.assigneeAgentId === "marketing") {
        marketingReports.push(report);
      }
    }
  }

  const founderGoal =
    (typeof parentGoalTask.payload.goal === "string"
      ? parentGoalTask.payload.goal
      : null) ?? parentGoalTask.description;

  return {
    parentGoalTask,
    founderGoal,
    childTasks,
    researchReports,
    designReports,
    marketingReports,
    childTaskIds,
    completionScore: computeCompletionScore(
      researchReports.length,
      designReports.length,
      marketingReports.length,
    ),
  };
}

export async function isGoalReadyForFinalSynthesis(
  parentGoalTaskId: string,
): Promise<boolean> {
  const existing = await findExistingFinalReportForGoal(parentGoalTaskId);
  if (existing) return false;

  const context = await buildGoalSynthesisContext(parentGoalTaskId);
  if (!context) return false;

  return (
    context.researchReports.length > 0 &&
    context.designReports.length > 0 &&
    context.marketingReports.length > 0
  );
}

export async function resolveParentGoalFromApprovedReport(
  reportBrainRecordId: string,
): Promise<string | null> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();
  const record = await brain.getRecord("reports", reportBrainRecordId);
  if (!record || record.workspaceId !== workspace.id) return null;

  const content = record.content as BrainReportContent;
  if (!content.originTaskId) return null;

  const parent = await resolveParentGoalFromTaskId(content.originTaskId);
  return parent?.id ?? null;
}

export async function getLatestCeoFinalReport(): Promise<{
  reportId: string;
  brainRecordId: string;
  title: string;
  executiveSummary: string;
  completionScore: number;
  founderGoal: string;
  parentGoalTaskId: string;
  createdAt: string;
  status: string;
  ceoVerdict: string;
  sections: BrainCeoFinalSections;
} | null> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();

  const result = await brain.searchRecords({
    workspaceId: workspace.id,
    domains: ["reports"],
    status: ["approved", "pending_review", "draft", "revision_requested"],
    limit: 200,
  });

  const finalReports = result.records
    .filter((record) => {
      const content = record.content as BrainReportContent;
      return content.reportType === CEO_FINAL_REPORT_TYPE;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const latest = finalReports[0];
  if (!latest) return null;

  const content = latest.content as BrainReportContent;
  const sections = content.ceoFinalSections;
  if (!sections) return null;

  return {
    reportId: content.reportId,
    brainRecordId: latest.id,
    title: latest.title,
    executiveSummary: sections.executiveSummary,
    completionScore: sections.completionScore,
    founderGoal: sections.founderGoal,
    parentGoalTaskId: sections.parentGoalTaskId,
    createdAt: latest.createdAt,
    status: latest.status,
    ceoVerdict: sections.ceoVerdict,
    sections,
  };
}
