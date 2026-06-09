import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { BrainRecord } from "@/brain/types";
import { deriveGoalProgress } from "@/lib/facility/derive-goals";
import { deriveLabSnapshots } from "@/lib/facility/derive-lab-state";
import { getFacilityEvents } from "@/lib/facility/events";
import type {
  FacilitySnapshot,
  ReviewQueueItem,
} from "@/lib/facility/types";
import { brainReportRecordsToListItems } from "@/lib/reports/from-brain";
import { listTasks } from "@/lib/tasks/task-service";
import type { TaskListItem } from "@/tasks/types";

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

function buildReviewQueue(
  reports: ReturnType<typeof brainReportRecordsToListItems>,
): ReviewQueueItem[] {
  return reports
    .filter((report) => report.status === "pending_review")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((report) => ({
      reportId: report.id,
      brainRecordId: report.brainRecordId ?? report.id,
      title: report.title,
      agentId: report.agentId,
      taskId: report.originTaskId,
      submittedAt: report.createdAt,
    }));
}

function computeTelemetry(tasks: TaskListItem[]) {
  let activeExecutions = 0;
  let pendingReview = 0;
  let completedToday = 0;
  let failedTasks = 0;

  for (const task of tasks) {
    if (task.status === "in_progress") activeExecutions += 1;
    if (task.status === "review") pendingReview += 1;
    if (task.status === "completed" && isCompletedToday(task.completedAt)) {
      completedToday += 1;
    }
    if (task.status === "failed") failedTasks += 1;
  }

  return {
    live: activeExecutions > 0,
    activeExecutions,
    pendingReview,
    completedToday,
    failedTasks,
  };
}

function computeBrainStats(
  tasks: TaskListItem[],
  totalReports: number,
  activeExecutions: number,
) {
  const completed = tasks.filter((task) => task.status === "completed").length;
  const totalTasks = tasks.length;
  const completionPct =
    totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

  return {
    totalTasks,
    totalReports,
    activeExecutions,
    completionPct,
  };
}

/** Aggregate live facility data from tasks, reports, and Brain events. */
export async function getFacilitySnapshot(): Promise<FacilitySnapshot> {
  const { tasks, workspaceId, workspaceName } = await listTasks();
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();

  const reportResult = await brain.searchRecords({
    workspaceId: workspace.id,
    domains: ["reports"],
    limit: 200,
  });

  const reports = brainReportRecordsToListItems(
    reportResult.records as BrainRecord<"reports">[],
  );

  const telemetry = computeTelemetry(tasks);
  const labs = deriveLabSnapshots(tasks, reports);
  const reviewQueue = buildReviewQueue(reports);
  const events = await getFacilityEvents(20);
  const goal = deriveGoalProgress(tasks, reports);

  return {
    workspace: { id: workspaceId, name: workspaceName },
    telemetry: {
      ...telemetry,
      pendingReview: Math.max(telemetry.pendingReview, reviewQueue.length),
    },
    brain: computeBrainStats(
      tasks,
      reports.length,
      telemetry.activeExecutions,
    ),
    labs,
    reviewQueue,
    events,
    goal,
    refreshedAt: new Date().toISOString(),
  };
}
