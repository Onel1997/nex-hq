import type { AgentId } from "@/lib/constants/agents";
import type { BrainActor } from "@/brain/types";
import {
  assignTask,
  createTask,
  getTask,
  getTaskByTaskId,
  listTasks,
  updateTask,
  type TaskServiceError,
} from "@/lib/tasks/task-service";
import type {
  CreateTaskInput,
  Task,
  TaskListItem,
  TaskPriority,
  TaskStatus,
} from "@/tasks/types";

export { TaskServiceError };

const CEO_ACTOR: BrainActor = {
  type: "agent",
  id: "ceo",
};

export interface CeoCreateTaskInput {
  title: string;
  description: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigneeAgentId?: AgentId | null;
  parentTaskId?: string | null;
  payload?: Record<string, unknown>;
}

/** CEO Agent — create a delegated task. */
export async function ceoCreateTask(
  input: CeoCreateTaskInput,
): Promise<{ task: TaskListItem; eventIds: string[] }> {
  const createInput: CreateTaskInput = {
    ...input,
    createdByAgentId: "ceo",
  };
  return createTask(createInput, CEO_ACTOR);
}

/** CEO Agent — assign an existing task to a specialist. */
export async function ceoAssignTask(
  brainRecordId: string,
  assigneeAgentId: AgentId,
): Promise<{ task: TaskListItem; eventIds: string[] }> {
  return assignTask(brainRecordId, assigneeAgentId, CEO_ACTOR);
}

/** CEO Agent — update task status while tracking operational progress. */
export async function ceoUpdateTaskStatus(
  brainRecordId: string,
  status: TaskStatus,
): Promise<{ task: TaskListItem; eventIds: string[] }> {
  return updateTask(brainRecordId, { status }, CEO_ACTOR);
}

/** CEO Agent — fetch a single task for orchestration context. */
export async function ceoGetTask(brainRecordId: string): Promise<Task> {
  return getTask(brainRecordId);
}

/** CEO Agent — list tasks assigned to a specialist for workload tracking. */
export async function ceoListTasksForAssignee(
  assigneeAgentId: AgentId,
): Promise<TaskListItem[]> {
  const { tasks } = await listTasks();
  return tasks.filter((task) => task.assigneeAgentId === assigneeAgentId);
}

/** CEO Agent — resolve a task by public task ID (content.taskId). */
export async function ceoGetTaskByTaskId(taskId: string): Promise<Task | null> {
  return getTaskByTaskId(taskId);
}
