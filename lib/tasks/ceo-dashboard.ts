import type { AgentId } from "@/lib/constants/agents";
import {
  loadCeoCommandIntelligence,
  type CeoCommandIntelligence,
} from "@/lib/ceo/ceo-command-intelligence";
import { listTasks } from "@/lib/tasks/task-service";
import { getReportsForTasks, type TaskLinkedReport } from "@/lib/tasks/task-reports";
import { getLatestCeoFinalReport } from "@/lib/reports/goal-synthesis";
import type { TaskListItem, TaskStatus } from "@/tasks/types";

export interface CeoFinalReportSummary {
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
}

export interface CeoTaskWithReports extends TaskListItem {
  linkedReports: TaskLinkedReport[];
}

export interface CeoDashboardExecutionSummary {
  activeExecutions: number;
  pendingReview: number;
  completedToday: number;
  failedTasks: number;
}

export interface CeoDashboardSummary {
  active: number;
  completed: number;
  blocked: number;
  total: number;
  ceoCreated: number;
  execution: CeoDashboardExecutionSummary;
}

export interface CeoDashboardData {
  summary: CeoDashboardSummary;
  byStatus: Record<TaskStatus, TaskListItem[]>;
  byAgent: Record<AgentId, TaskListItem[]>;
  activeTasks: TaskListItem[];
  completedTasks: TaskListItem[];
  blockedTasks: TaskListItem[];
  ceoTasks: CeoTaskWithReports[];
  latestFinalReport: CeoFinalReportSummary | null;
  intelligence: CeoCommandIntelligence;
  workspaceId: string;
  workspaceName: string;
}

const ACTIVE_STATUSES: TaskStatus[] = [
  "pending",
  "assigned",
  "in_progress",
  "review",
];

function emptyByStatus(): Record<TaskStatus, TaskListItem[]> {
  return {
    pending: [],
    assigned: [],
    in_progress: [],
    review: [],
    completed: [],
    failed: [],
  };
}

function emptyByAgent(): Record<AgentId, TaskListItem[]> {
  return {
    ceo: [],
    research: [],
    designer: [],
    content: [],
    image: [],
    marketing: [],
    shopify: [],
  };
}

function isCompletedToday(completedAt: string | null): boolean {
  if (!completedAt) return false;
  const completed = new Date(completedAt);
  const now = new Date();
  return (
    completed.getFullYear() === now.getFullYear() &&
    completed.getMonth() === now.getMonth() &&
    completed.getDate() === now.getDate()
  );
}

/** Aggregate task data for the CEO operations dashboard. */
export async function getCeoDashboardData(): Promise<CeoDashboardData> {
  const { tasks, workspaceId, workspaceName } = await listTasks();

  const byStatus = emptyByStatus();
  const byAgent = emptyByAgent();

  const activeTasks: TaskListItem[] = [];
  const completedTasks: TaskListItem[] = [];
  const blockedTasks: TaskListItem[] = [];
  const ceoCreatedTasks: TaskListItem[] = [];

  let activeExecutions = 0;
  let pendingReview = 0;
  let completedToday = 0;
  let failedTasks = 0;

  for (const task of tasks) {
    byStatus[task.status].push(task);

    if (task.assigneeAgentId && byAgent[task.assigneeAgentId]) {
      byAgent[task.assigneeAgentId].push(task);
    }

    if (ACTIVE_STATUSES.includes(task.status)) {
      activeTasks.push(task);
    }
    if (task.status === "completed") {
      completedTasks.push(task);
      if (isCompletedToday(task.completedAt)) {
        completedToday += 1;
      }
    }
    if (task.status === "failed") {
      blockedTasks.push(task);
      failedTasks += 1;
    }
    if (task.status === "in_progress") {
      activeExecutions += 1;
    }
    if (task.status === "review") {
      pendingReview += 1;
    }
    if (task.createdByAgentId === "ceo") {
      ceoCreatedTasks.push(task);
    }
  }

  const taskIds = ceoCreatedTasks.map((t) => t.id);
  const reportsMap = await getReportsForTasks(taskIds);

  const ceoTasks: CeoTaskWithReports[] = ceoCreatedTasks.map((task) => ({
    ...task,
    linkedReports: reportsMap.get(task.id) ?? [],
  }));

  const latest = await getLatestCeoFinalReport();
  const latestFinalReport: CeoFinalReportSummary | null = latest
    ? {
        reportId: latest.reportId,
        brainRecordId: latest.brainRecordId,
        title: latest.title,
        executiveSummary: latest.executiveSummary,
        completionScore: latest.completionScore,
        founderGoal: latest.founderGoal,
        parentGoalTaskId: latest.parentGoalTaskId,
        createdAt: latest.createdAt,
        status: latest.status,
        ceoVerdict: latest.ceoVerdict,
      }
    : null;

  const intelligence = await loadCeoCommandIntelligence({
    byAgent,
    ceoTasks: ceoCreatedTasks,
  });

  return {
    summary: {
      active: activeTasks.length,
      completed: completedTasks.length,
      blocked: blockedTasks.length,
      total: tasks.length,
      ceoCreated: ceoCreatedTasks.length,
      execution: {
        activeExecutions,
        pendingReview,
        completedToday,
        failedTasks,
      },
    },
    byStatus,
    byAgent,
    activeTasks,
    completedTasks,
    blockedTasks,
    ceoTasks,
    latestFinalReport,
    intelligence,
    workspaceId,
    workspaceName,
  };
}
