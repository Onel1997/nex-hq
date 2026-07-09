import { getBrainClient } from "@/brain/client";
import { slugify } from "@/brain/client/utils";
import type { BrainTaskContent } from "@/brain/domains/tasks";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { BrainActor, BrainRecord } from "@/brain/types";
import { brainTaskRecordToTask } from "@/lib/tasks/from-brain";
import type {
  CreateTaskInput,
  Task,
  TaskListItem,
  TaskStatus,
  UpdateTaskInput,
} from "@/tasks/types";

export type TaskEventType =
  | "task.created"
  | "task.updated"
  | "task.assigned"
  | "task.status_changed"
  | "task.completed"
  | "task.deleted";

export class TaskServiceError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "VALIDATION" | "CONFIG",
  ) {
    super(message);
    this.name = "TaskServiceError";
  }
}

const HUMAN_OPERATOR: BrainActor = {
  type: "human",
  id: "workspace-user",
};

function resolveActor(actor?: BrainActor): BrainActor {
  return actor ?? HUMAN_OPERATOR;
}

function buildTaskTags(content: BrainTaskContent): string[] {
  const tags = ["task"];
  if (content.assigneeAgentId) {
    tags.push(`assignee:${content.assigneeAgentId}`);
  }
  tags.push(`status:${content.status}`);
  return tags;
}

function resolveInitialStatus(
  input: CreateTaskInput,
): TaskStatus {
  if (input.status) {
    return input.status;
  }
  if (input.assigneeAgentId) {
    return "assigned";
  }
  return "pending";
}

function applyAssigneeStatusRules(
  currentStatus: TaskStatus,
  assigneeAgentId: TaskListItem["assigneeAgentId"],
  explicitStatus?: TaskStatus,
): TaskStatus {
  if (explicitStatus) {
    return explicitStatus;
  }
  if (assigneeAgentId && currentStatus === "pending") {
    return "assigned";
  }
  if (!assigneeAgentId && currentStatus === "assigned") {
    return "pending";
  }
  return currentStatus;
}

function resolveCompletedAt(
  status: TaskStatus,
  previousCompletedAt: string | null,
): string | null {
  if (status === "completed") {
    return previousCompletedAt ?? new Date().toISOString();
  }
  if (status === "failed") {
    return previousCompletedAt;
  }
  return null;
}

async function emitTaskEvents(params: {
  workspaceId: string;
  recordId: string;
  actor: BrainActor;
  events: TaskEventType[];
  payload: Record<string, unknown>;
}): Promise<string[]> {
  const brain = getBrainClient();
  const eventIds: string[] = [];

  for (const eventType of params.events) {
    const eventId = await brain.logTaskEvent({
      workspaceId: params.workspaceId,
      recordId: params.recordId,
      actor: params.actor,
      eventType,
      payload: params.payload,
    });
    eventIds.push(eventId);
  }

  return eventIds;
}

function collectUpdateEvents(
  previous: BrainTaskContent,
  next: BrainTaskContent,
  patch: UpdateTaskInput,
): TaskEventType[] {
  const events = new Set<TaskEventType>();

  if (
    patch.assigneeAgentId !== undefined &&
    patch.assigneeAgentId !== previous.assigneeAgentId
  ) {
    events.add("task.assigned");
  }

  if (patch.status !== undefined && patch.status !== previous.status) {
    events.add("task.status_changed");
    if (patch.status === "completed") {
      events.add("task.completed");
    }
  }

  const generalFieldsChanged =
    patch.title !== undefined ||
    patch.description !== undefined ||
    patch.priority !== undefined ||
    patch.parentTaskId !== undefined ||
    patch.payload !== undefined;

  if (generalFieldsChanged) {
    events.add("task.updated");
  }

  if (events.size === 0) {
    events.add("task.updated");
  }

  return [...events];
}

async function getTaskRecord(
  brainRecordId: string,
  workspaceId: string,
): Promise<BrainRecord<"tasks">> {
  const brain = getBrainClient();
  const record = await brain.getRecord("tasks", brainRecordId);

  if (!record || record.workspaceId !== workspaceId) {
    throw new TaskServiceError("Task not found", "NOT_FOUND");
  }

  if (record.status === "archived") {
    throw new TaskServiceError("Task not found", "NOT_FOUND");
  }

  return record;
}

export async function listTasks(): Promise<{
  tasks: TaskListItem[];
  workspaceId: string;
  workspaceName: string;
}> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();

  const result = await brain.searchRecords({
    workspaceId: workspace.id,
    domains: ["tasks"],
    status: ["approved"],
    limit: 200,
  });

  return {
    tasks: result.records
      .map((record) => brainTaskRecordToTask(record as BrainRecord<"tasks">))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    workspaceId: workspace.id,
    workspaceName: workspace.name,
  };
}

export async function getTask(brainRecordId: string): Promise<Task> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const record = await getTaskRecord(brainRecordId, workspace.id);
  return brainTaskRecordToTask(record);
}

export async function getTaskByTaskId(taskId: string): Promise<Task | null> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();

  const result = await brain.searchRecords({
    workspaceId: workspace.id,
    domains: ["tasks"],
    status: ["approved"],
    limit: 200,
  });

  const match = result.records.find((record) => {
    const content = record.content as BrainTaskContent;
    return content.taskId === taskId;
  });

  return match
    ? brainTaskRecordToTask(match as BrainRecord<"tasks">)
    : null;
}

export async function createTask(
  input: CreateTaskInput,
  actor?: BrainActor,
): Promise<{ task: TaskListItem; eventIds: string[] }> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();
  const resolvedActor = resolveActor(actor);
  const taskId = crypto.randomUUID();
  const status = resolveInitialStatus(input);
  const slugSuffix = taskId.slice(0, 8);

  const content: BrainTaskContent = {
    kind: "tasks",
    taskId,
    title: input.title.trim(),
    description: input.description.trim(),
    status,
    priority: input.priority ?? "medium",
    assigneeAgentId: input.assigneeAgentId ?? null,
    createdByAgentId: input.createdByAgentId,
    parentTaskId: input.parentTaskId ?? null,
    payload: input.payload ?? {},
    completedAt: status === "completed" ? new Date().toISOString() : null,
  };

  const { record } = await brain.createRecord({
    workspaceId: workspace.id,
    domain: "tasks",
    slug: `task-${slugify(input.title).slice(0, 40)}-${slugSuffix}`,
    title: content.title,
    summary: content.description.slice(0, 280),
    content,
    status: "approved",
    tags: buildTaskTags(content),
    provenance: {
      createdBy: resolvedActor,
      ...(input.parentTaskId ? { sourceTaskId: input.parentTaskId } : {}),
    },
  });

  const eventIds = await emitTaskEvents({
    workspaceId: workspace.id,
    recordId: record.id,
    actor: resolvedActor,
    events: ["task.created"],
    payload: {
      taskId,
      status: content.status,
      assigneeAgentId: content.assigneeAgentId,
      priority: content.priority,
      createdByAgentId: content.createdByAgentId,
    },
  });

  return {
    task: brainTaskRecordToTask(record),
    eventIds,
  };
}

export async function updateTask(
  brainRecordId: string,
  patch: UpdateTaskInput,
  actor?: BrainActor,
): Promise<{ task: TaskListItem; eventIds: string[] }> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();
  const resolvedActor = resolveActor(actor);
  const existing = await getTaskRecord(brainRecordId, workspace.id);
  const previous = existing.content as BrainTaskContent;

  const nextAssignee =
    patch.assigneeAgentId !== undefined
      ? patch.assigneeAgentId
      : previous.assigneeAgentId;

  const nextStatus = applyAssigneeStatusRules(
    previous.status,
    nextAssignee,
    patch.status,
  );

  const nextContent: BrainTaskContent = {
    ...previous,
    title: patch.title?.trim() ?? previous.title,
    description: patch.description?.trim() ?? previous.description,
    status: nextStatus,
    priority: patch.priority ?? previous.priority,
    assigneeAgentId: nextAssignee,
    parentTaskId:
      patch.parentTaskId !== undefined
        ? patch.parentTaskId
        : previous.parentTaskId,
    payload: patch.payload ?? previous.payload,
    completedAt: resolveCompletedAt(
      nextStatus,
      previous.completedAt ?? null,
    ),
  };

  const events = collectUpdateEvents(previous, nextContent, patch);

  const { record } = await brain.updateRecord(
    "tasks",
    brainRecordId,
    {
      title: nextContent.title,
      summary: nextContent.description.slice(0, 280),
      content: nextContent,
      tags: buildTaskTags(nextContent),
    },
    resolvedActor,
  );

  const eventIds = await emitTaskEvents({
    workspaceId: workspace.id,
    recordId: brainRecordId,
    actor: resolvedActor,
    events,
    payload: {
      taskId: nextContent.taskId,
      previousStatus: previous.status,
      newStatus: nextContent.status,
      previousAssigneeAgentId: previous.assigneeAgentId,
      newAssigneeAgentId: nextContent.assigneeAgentId,
      changedFields: Object.keys(patch),
    },
  });

  return {
    task: brainTaskRecordToTask(record),
    eventIds,
  };
}

export async function assignTask(
  brainRecordId: string,
  assigneeAgentId: TaskListItem["assigneeAgentId"],
  actor?: BrainActor,
): Promise<{ task: TaskListItem; eventIds: string[] }> {
  return updateTask(
    brainRecordId,
    { assigneeAgentId, status: assigneeAgentId ? "assigned" : "pending" },
    actor,
  );
}

export async function deleteTask(
  brainRecordId: string,
  actor?: BrainActor,
): Promise<{ success: true; eventId: string }> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();
  const resolvedActor = resolveActor(actor);
  const existing = await getTaskRecord(brainRecordId, workspace.id);
  const content = existing.content as BrainTaskContent;

  await brain.archiveRecord("tasks", brainRecordId, resolvedActor);

  const [eventId] = await emitTaskEvents({
    workspaceId: workspace.id,
    recordId: brainRecordId,
    actor: resolvedActor,
    events: ["task.deleted"],
    payload: {
      taskId: content.taskId,
      status: content.status,
      assigneeAgentId: content.assigneeAgentId,
    },
  });

  return { success: true, eventId };
}

export async function assertTaskExists(taskId: string): Promise<Task> {
  const task = await getTaskByTaskId(taskId);
  if (!task) {
    throw new TaskServiceError("Origin task not found", "NOT_FOUND");
  }
  return task;
}
