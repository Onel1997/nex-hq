import type {
  TaskListItem,
  TaskQueueStatus,
} from "@/lib/mock/tasks";
import { TASK_STATUS_ORDER } from "@/lib/mock/tasks";
import type { Locale } from "../config";
import { getDictionary } from "../get-dictionary";

export { TASK_STATUS_ORDER };

export function getTaskStatusLabels(
  locale: Locale,
): Record<TaskQueueStatus, string> {
  const { common } = getDictionary(locale);
  return { ...common.taskStatus };
}

export function getMockTasks(locale: Locale): TaskListItem[] {
  const { tasks } = getDictionary(locale);

  return [
    {
      id: "task-001",
      title: tasks.items.task001.title,
      description: tasks.items.task001.description,
      status: "in_progress",
      priority: "urgent",
      assigneeAgentId: "ceo",
      drop: "SS26 Capsule",
      createdAt: "2026-06-06T09:00:00Z",
      dueDate: "2026-06-12",
    },
    {
      id: "task-002",
      title: tasks.items.task002.title,
      description: tasks.items.task002.description,
      status: "pending",
      priority: "high",
      assigneeAgentId: "research",
      drop: "SS26 Capsule",
      createdAt: "2026-06-07T10:00:00Z",
      dueDate: "2026-06-10",
    },
    {
      id: "task-003",
      title: tasks.items.task003.title,
      description: tasks.items.task003.description,
      status: "pending",
      priority: "high",
      assigneeAgentId: "designer",
      drop: "SS26 Capsule",
      createdAt: "2026-06-07T11:30:00Z",
      dueDate: "2026-06-11",
    },
    {
      id: "task-004",
      title: tasks.items.task004.title,
      description: tasks.items.task004.description,
      status: "pending",
      priority: "medium",
      assigneeAgentId: "content",
      drop: "SS26 Capsule",
      createdAt: "2026-06-08T08:00:00Z",
      dueDate: "2026-06-14",
    },
    {
      id: "task-005",
      title: tasks.items.task005.title,
      description: tasks.items.task005.description,
      status: "review",
      priority: "medium",
      assigneeAgentId: "marketing",
      drop: "SS26 Capsule",
      createdAt: "2026-06-05T14:00:00Z",
      dueDate: "2026-06-09",
    },
    {
      id: "task-006",
      title: tasks.items.task006.title,
      description: tasks.items.task006.description,
      status: "pending",
      priority: "medium",
      assigneeAgentId: "shopify",
      drop: "SS26 Capsule",
      createdAt: "2026-06-08T09:30:00Z",
      dueDate: "2026-06-15",
    },
    {
      id: "task-007",
      title: tasks.items.task007.title,
      description: tasks.items.task007.description,
      status: "complete",
      priority: "low",
      assigneeAgentId: "ceo",
      drop: "FW25 Archive",
      createdAt: "2026-05-28T10:00:00Z",
      dueDate: "2026-06-01",
    },
    {
      id: "task-008",
      title: tasks.items.task008.title,
      description: tasks.items.task008.description,
      status: "review",
      priority: "high",
      assigneeAgentId: "research",
      drop: "SS26 Capsule",
      createdAt: "2026-06-04T16:00:00Z",
      dueDate: "2026-06-08",
    },
  ];
}
