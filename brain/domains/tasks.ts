/**
 * Tasks — work unit memory, delegation history, context snapshots.
 * Bridges Brain memory to the tasks module.
 */

import type { AgentId } from "@/lib/constants/agents";
import type { TaskPriority, TaskStatus } from "@/tasks/types";

/** Snapshot of a task stored in Brain for orchestration context. */
export interface BrainTaskContent {
  kind: "tasks";
  taskId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeAgentId: AgentId | null;
  createdByAgentId: AgentId | "human";
  parentTaskId: string | null;
  payload: Record<string, unknown>;
  /** Brain record IDs loaded when the task was created or last updated. */
  contextRecordIds?: string[];
  completedAt?: string | null;
}
