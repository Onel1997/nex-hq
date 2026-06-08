import type { AgentId } from "@/lib/constants/agents";

export type TaskStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
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

export interface CreateTaskInput {
  title: string;
  description: string;
  priority?: TaskPriority;
  assigneeAgentId?: AgentId;
  parentTaskId?: string;
  payload?: Record<string, unknown>;
  createdByAgentId: AgentId | "human";
}
