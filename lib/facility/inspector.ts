import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { BrainRecord } from "@/brain/types";
import { AGENT_CATALOG, type AgentId } from "@/lib/constants/agents";
import { deriveLabSnapshots } from "@/lib/facility/derive-lab-state";
import { getAgentEvents } from "@/lib/facility/events";
import type {
  LabInspectorData,
  LabReportDetail,
  LabTaskSnapshot,
  KnowledgeRef,
  TimelineItem,
} from "@/lib/facility/types";
import { buildLabMetrics } from "@/lib/facility/lab-intelligence";
import { brainReportRecordsToListItems } from "@/lib/reports/from-brain";
import { listTasks } from "@/lib/tasks/task-service";
import type { TaskListItem, TaskPriority, TaskStatus } from "@/tasks/types";

function toTaskSnapshot(task: TaskListItem): LabTaskSnapshot {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    updatedAt: task.updatedAt,
  };
}

function taskWeight(task: TaskListItem): number {
  const statusWeight: Record<TaskStatus, number> = {
    in_progress: 50,
    review: 40,
    assigned: 30,
    pending: 20,
    completed: 10,
    failed: 5,
  };
  const priorityWeight: Record<TaskPriority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return statusWeight[task.status] + priorityWeight[task.priority];
}

function formatTimelineLabel(
  type: string,
  agentName: string,
  summary: string,
): string {
  switch (type) {
    case "task.assigned":
      return "Task assigned";
    case "task.execution.started":
      return `${agentName} started`;
    case "task.execution.completed":
      return `${agentName} completed execution`;
    case "task.execution.failed":
      return "Execution failed";
    case "task.completed":
      return "Task completed";
    case "task.status_changed":
      return "Task status updated";
    case "task.created":
      return "Task created";
    case "record.created":
      return "Report generated";
    case "record.updated":
      return "Report updated";
    case "report.approved":
      return "Report approved";
    case "report.rejected":
      return "Report rejected";
    case "report.revision_requested":
      return "Submitted for review";
    case "task.review.completed":
      return "Review completed";
    default:
      return summary;
  }
}

function buildTimeline(
  events: Awaited<ReturnType<typeof getAgentEvents>>,
  agentName: string,
): TimelineItem[] {
  return events.map((event) => ({
    id: event.id,
    timestamp: event.timestamp,
    time: new Date(event.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    type: event.type,
    label: formatTimelineLabel(event.type, agentName, event.summary),
  }));
}

function buildKnowledgeRefs(
  reports: ReturnType<typeof brainReportRecordsToListItems>,
  tasks: TaskListItem[],
): KnowledgeRef[] {
  const refs: KnowledgeRef[] = [
    ...reports.map((report) => ({
      id: report.id,
      title: report.title,
      domain: "reports" as const,
      updatedAt: report.createdAt,
    })),
    ...tasks.map((task) => ({
      id: task.id,
      title: task.title,
      domain: "tasks" as const,
      updatedAt: task.updatedAt,
    })),
  ];

  return refs
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 10);
}

/** Aggregate live inspector data for a single lab agent. */
export async function getLabInspectorData(
  agentId: AgentId,
): Promise<LabInspectorData> {
  const { tasks } = await listTasks();
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();

  const reportResult = await brain.searchRecords({
    workspaceId: workspace.id,
    domains: ["reports"],
    limit: 200,
  });

  const allReports = brainReportRecordsToListItems(
    reportResult.records as BrainRecord<"reports">[],
  );
  const agentReports = allReports
    .filter((report) => report.agentId === agentId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const agentTasks = tasks
    .filter(
      (task) =>
        task.assigneeAgentId === agentId ||
        task.createdByAgentId === agentId,
    )
    .sort((a, b) => taskWeight(b) - taskWeight(a));

  const labs = deriveLabSnapshots(tasks, allReports);
  const lab = labs[agentId];
  const catalog = AGENT_CATALOG[agentId];

  const reportDetails: LabReportDetail[] = agentReports.slice(0, 8).map(
    (report) => ({
      id: report.id,
      title: report.title,
      status: report.status,
      confidence: report.confidence,
      createdAt: report.createdAt,
      summary: report.summary,
    }),
  );

  const latestReport = agentReports[0] ?? null;
  const agentEvents = await getAgentEvents(agentId, 30);

  const taskSnapshots = agentTasks.map(toTaskSnapshot);

  return {
    agentId,
    agentName: catalog.name,
    role: catalog.role,
    opsState: lab.opsState,
    confidence: latestReport?.confidence ?? null,
    currentTask: lab.activeTask,
    taskQueue: taskSnapshots,
    reports: reportDetails,
    fullReports: agentReports,
    metrics: buildLabMetrics(agentReports, taskSnapshots),
    recentEvents: agentEvents,
    timeline: buildTimeline(agentEvents, catalog.name),
    knowledgeRefs: buildKnowledgeRefs(agentReports, agentTasks),
  };
}
