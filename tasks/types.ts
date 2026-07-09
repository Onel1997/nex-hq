import type { AgentId } from "@/lib/constants/agents";

export const TASK_STATUSES = [
  "pending",
  "assigned",
  "in_progress",
  "review",
  "completed",
  "failed",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "pending",
  "assigned",
  "in_progress",
  "review",
  "completed",
  "failed",
];

export interface Task {
  id: string;
  brainRecordId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeAgentId: AgentId | null;
  createdByAgentId: AgentId | "human";
  parentTaskId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/** UI list view model for the task board. */
export type TaskListItem = Task;

export interface CreateTaskInput {
  title: string;
  description: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigneeAgentId?: AgentId | null;
  parentTaskId?: string | null;
  payload?: Record<string, unknown>;
  createdByAgentId: AgentId | "human";
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeAgentId?: AgentId | null;
  parentTaskId?: string | null;
  payload?: Record<string, unknown>;
}
