import { AGENT_CATALOG, AGENT_IDS, type AgentId } from "@/lib/constants/agents";
import type { ReportListItem } from "@/lib/mock/reports";
import type {
  LabOpsState,
  LabReportSnapshot,
  LabSnapshot,
  LabTaskSnapshot,
} from "@/lib/facility/types";
import type { TaskListItem, TaskPriority, TaskStatus } from "@/tasks/types";

const ACTIVE_STATUSES: TaskStatus[] = [
  "pending",
  "assigned",
  "in_progress",
  "review",
];

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function taskWeight(task: TaskListItem): number {
  const statusWeight: Record<TaskStatus, number> = {
    in_progress: 50,
    review: 40,
    assigned: 30,
    pending: 20,
    completed: 10,
    failed: 5,
  };
  return statusWeight[task.status] + PRIORITY_WEIGHT[task.priority];
}

function toTaskSnapshot(task: TaskListItem): LabTaskSnapshot {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    updatedAt: task.updatedAt,
  };
}

function toReportSnapshot(report: ReportListItem): LabReportSnapshot {
  return {
    id: report.id,
    title: report.title,
    status: report.status,
    updatedAt: report.createdAt,
  };
}

export function deriveOpsState(
  task: TaskListItem | null,
  latestReport: ReportListItem | null,
): LabOpsState {
  if (task?.status === "failed") return "error";
  if (task?.status === "in_progress") return "executing";
  if (task?.status === "review") return "review";
  if (task?.status === "completed") return "approved";
  if (task?.status === "assigned" || task?.status === "pending") {
    return "queued";
  }
  if (latestReport?.status === "pending_review") return "review";
  return "idle";
}

function pickActiveTask(tasks: TaskListItem[]): TaskListItem | null {
  const candidates = tasks.filter((task) => ACTIVE_STATUSES.includes(task.status));
  if (candidates.length === 0) {
    return tasks[0] ?? null;
  }
  return [...candidates].sort((a, b) => taskWeight(b) - taskWeight(a))[0];
}

function pickLatestReport(reports: ReportListItem[]): ReportListItem | null {
  if (reports.length === 0) return null;
  return [...reports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

export function deriveLabSnapshots(
  tasks: TaskListItem[],
  reports: ReportListItem[],
): Record<AgentId, LabSnapshot> {
  const tasksByAgent = new Map<AgentId, TaskListItem[]>();
  const reportsByAgent = new Map<AgentId, ReportListItem[]>();

  for (const agentId of AGENT_IDS) {
    tasksByAgent.set(agentId, []);
    reportsByAgent.set(agentId, []);
  }

  for (const task of tasks) {
    if (task.assigneeAgentId) {
      tasksByAgent.get(task.assigneeAgentId)?.push(task);
    }
    if (task.createdByAgentId !== "human" && task.createdByAgentId !== task.assigneeAgentId) {
      tasksByAgent.get(task.createdByAgentId)?.push(task);
    }
  }

  for (const report of reports) {
    reportsByAgent.get(report.agentId)?.push(report);
  }

  const labs = {} as Record<AgentId, LabSnapshot>;

  for (const agentId of AGENT_IDS) {
    const agentTasks = tasksByAgent.get(agentId) ?? [];
    const agentReports = reportsByAgent.get(agentId) ?? [];
    const activeTask = pickActiveTask(agentTasks);
    const latestReport = pickLatestReport(agentReports);

    labs[agentId] = {
      agentId,
      label: AGENT_CATALOG[agentId].name,
      opsState: deriveOpsState(activeTask, latestReport),
      activeTask: activeTask ? toTaskSnapshot(activeTask) : null,
      latestReport: latestReport ? toReportSnapshot(latestReport) : null,
    };
  }

  return labs;
}
