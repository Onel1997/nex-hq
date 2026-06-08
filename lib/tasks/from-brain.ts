import type { BrainTaskContent } from "@/brain/domains/tasks";
import type { BrainRecord } from "@/brain/types";
import type { TaskListItem } from "@/tasks/types";

export function brainTaskRecordToTask(record: BrainRecord<"tasks">): TaskListItem {
  const content = record.content as BrainTaskContent;

  return {
    id: content.taskId,
    brainRecordId: record.id,
    title: content.title,
    description: content.description,
    status: content.status,
    priority: content.priority,
    assigneeAgentId: content.assigneeAgentId,
    createdByAgentId: content.createdByAgentId,
    parentTaskId: content.parentTaskId,
    payload: content.payload ?? {},
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: content.completedAt ?? null,
  };
}

export function brainTaskRecordsToListItems(
  records: BrainRecord<"tasks">[],
): TaskListItem[] {
  return records.map(brainTaskRecordToTask);
}
