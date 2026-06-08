import type { AgentId } from "@/lib/constants/agents";

export type TaskQueueStatus =
  | "pending"
  | "in_progress"
  | "review"
  | "complete";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskListItem {
  id: string;
  title: string;
  description: string;
  status: TaskQueueStatus;
  priority: TaskPriority;
  assigneeAgentId: AgentId | null;
  drop?: string;
  createdAt: string;
  dueDate?: string;
}

export const TASK_STATUS_LABELS: Record<TaskQueueStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  review: "Review",
  complete: "Complete",
};

export const TASK_STATUS_ORDER: TaskQueueStatus[] = [
  "pending",
  "in_progress",
  "review",
  "complete",
];

export const MOCK_TASKS: TaskListItem[] = [
  {
    id: "task-001",
    title: "SS26 Capsule Drop Strategy",
    description:
      "Map full drop workflow — research, design, content, and Shopify publish sequence for summer capsule.",
    status: "in_progress",
    priority: "urgent",
    assigneeAgentId: "ceo",
    drop: "SS26 Capsule",
    createdAt: "2026-06-06T09:00:00Z",
    dueDate: "2026-06-12",
  },
  {
    id: "task-002",
    title: "Competitor Drop Analysis — Q2",
    description:
      "Analyze Corteiz, Represent, and Palace Q2 drops for pricing, timing, and sell-through patterns.",
    status: "pending",
    priority: "high",
    assigneeAgentId: "research",
    drop: "SS26 Capsule",
    createdAt: "2026-06-07T10:00:00Z",
    dueDate: "2026-06-10",
  },
  {
    id: "task-003",
    title: "Oversized Hoodie — Hero Graphic Concepts",
    description:
      "3 mood board directions for the flagship hoodie graphic. Must follow obsidian + signal green palette.",
    status: "pending",
    priority: "high",
    assigneeAgentId: "designer",
    drop: "SS26 Capsule",
    createdAt: "2026-06-07T11:30:00Z",
    dueDate: "2026-06-11",
  },
  {
    id: "task-004",
    title: "Drop Announcement Copy — IG + Email",
    description:
      "Write tease, reveal, and countdown copy for summer capsule across Instagram and VIP email.",
    status: "pending",
    priority: "medium",
    assigneeAgentId: "content",
    drop: "SS26 Capsule",
    createdAt: "2026-06-08T08:00:00Z",
    dueDate: "2026-06-14",
  },
  {
    id: "task-005",
    title: "Summer Drop Campaign Calendar",
    description:
      "Build 3-week campaign timeline — organic, paid retargeting, and VIP early access windows.",
    status: "review",
    priority: "medium",
    assigneeAgentId: "marketing",
    drop: "SS26 Capsule",
    createdAt: "2026-06-05T14:00:00Z",
    dueDate: "2026-06-09",
  },
  {
    id: "task-006",
    title: "Shopify Collection Setup — SS26",
    description:
      "Draft product listings, collection hierarchy, and inventory fields for 6-piece summer capsule.",
    status: "pending",
    priority: "medium",
    assigneeAgentId: "shopify",
    drop: "SS26 Capsule",
    createdAt: "2026-06-08T09:30:00Z",
    dueDate: "2026-06-15",
  },
  {
    id: "task-007",
    title: "Archive FW25 Sell-Through Data",
    description:
      "Compile FW25 drop performance and sync insights to Brain for SS26 planning.",
    status: "complete",
    priority: "low",
    assigneeAgentId: "ceo",
    drop: "FW25 Archive",
    createdAt: "2026-05-28T10:00:00Z",
    dueDate: "2026-06-01",
  },
  {
    id: "task-008",
    title: "Y2K Revival Trend Brief",
    description:
      "Research Y2K streetwear resurgence signals and recommend capsule positioning angle.",
    status: "review",
    priority: "high",
    assigneeAgentId: "research",
    drop: "SS26 Capsule",
    createdAt: "2026-06-04T16:00:00Z",
    dueDate: "2026-06-08",
  },
];
