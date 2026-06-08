import { getBrainClient } from "@/brain/client";
import type { BrainReportContent } from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { brainReportRecordToListItem } from "@/lib/reports/from-brain";
import type { ReportListItem } from "@/lib/mock/reports";

export interface TaskLinkedReport {
  id: string;
  reportId: string;
  title: string;
  agentId: string;
  status: ReportListItem["status"];
  summary: string;
  originTaskId?: string;
}

/**
 * Find Brain reports linked to a task via originTaskId.
 */
export async function getReportsForTask(
  taskId: string,
): Promise<TaskLinkedReport[]> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();

  const result = await brain.searchRecords({
    workspaceId: workspace.id,
    domains: ["reports"],
    status: ["approved", "pending_review", "draft", "revision_requested"],
    limit: 200,
  });

  return result.records
    .filter((record) => {
      const content = record.content as BrainReportContent;
      return content.originTaskId === taskId || content.taskId === taskId;
    })
    .map((record) => {
      const item = brainReportRecordToListItem(record as BrainRecord<"reports">);
      return {
        id: item.brainRecordId ?? item.id,
        reportId: item.id,
        title: item.title,
        agentId: item.agentId,
        status: item.status,
        summary: item.summary,
        originTaskId: item.originTaskId,
      };
    });
}

/**
 * Batch-resolve reports for multiple task IDs.
 */
export async function getReportsForTasks(
  taskIds: string[],
): Promise<Map<string, TaskLinkedReport[]>> {
  if (taskIds.length === 0) {
    return new Map();
  }

  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();
  const taskIdSet = new Set(taskIds);

  const result = await brain.searchRecords({
    workspaceId: workspace.id,
    domains: ["reports"],
    status: ["approved", "pending_review", "draft", "revision_requested"],
    limit: 200,
  });

  const map = new Map<string, TaskLinkedReport[]>();

  for (const record of result.records) {
    const content = record.content as BrainReportContent;
    const linkedTaskId =
      content.originTaskId && taskIdSet.has(content.originTaskId)
        ? content.originTaskId
        : taskIdSet.has(content.taskId)
          ? content.taskId
          : null;

    if (!linkedTaskId) continue;

    const item = brainReportRecordToListItem(record as BrainRecord<"reports">);
    const report: TaskLinkedReport = {
      id: item.brainRecordId ?? item.id,
      reportId: item.id,
      title: item.title,
      agentId: item.agentId,
      status: item.status,
      summary: item.summary,
      originTaskId: item.originTaskId,
    };

    const existing = map.get(linkedTaskId) ?? [];
    existing.push(report);
    map.set(linkedTaskId, existing);
  }

  return map;
}
