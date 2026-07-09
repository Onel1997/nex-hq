import { getBrainClient } from "@/brain/client";
import type { BrainReportContent } from "@/brain/domains/reports";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { logTaskExecutionEvent } from "@/lib/orchestration/execution-events";
import { getTaskByTaskId, updateTask } from "@/lib/tasks/task-service";
import type { TaskStatus } from "@/tasks/types";

export type TaskReviewOutcome = "approved" | "rejected";

export interface CompleteTaskFromApprovalResult {
  taskId: string;
  brainRecordId: string;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  eventId: string;
}

/**
 * Sync task status after human report review.
 * approve: review → completed
 * reject:  review → in_progress (ready for re-execution)
 */
export async function completeTaskFromApproval(
  reportBrainRecordId: string,
  outcome: TaskReviewOutcome,
): Promise<CompleteTaskFromApprovalResult | null> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();
  const record = await brain.getRecord("reports", reportBrainRecordId);

  if (!record || record.workspaceId !== workspace.id) {
    return null;
  }

  const content = record.content as BrainReportContent;
  const originTaskId = content.originTaskId;

  if (!originTaskId) {
    return null;
  }

  const task = await getTaskByTaskId(originTaskId);
  if (!task || task.status !== "review") {
    return null;
  }

  const newStatus: TaskStatus =
    outcome === "approved" ? "completed" : "in_progress";

  const { task: updated } = await updateTask(task.brainRecordId, {
    status: newStatus,
    payload: {
      ...task.payload,
      linkedReportId: content.reportId,
      linkedReportRecordId: reportBrainRecordId,
      lastReviewOutcome: outcome,
    },
  });

  const eventId = await logTaskExecutionEvent({
    brainRecordId: task.brainRecordId,
    eventType: "task.review.completed",
    payload: {
      taskId: task.id,
      reportId: content.reportId,
      reportBrainRecordId,
      outcome,
      previousStatus: "review",
      newStatus,
    },
  });

  return {
    taskId: task.id,
    brainRecordId: task.brainRecordId,
    previousStatus: "review",
    newStatus: updated.status,
    eventId,
  };
}
