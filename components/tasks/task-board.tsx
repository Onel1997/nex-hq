"use client";

import { AGENT_CATALOG } from "@/lib/constants/agents";
import {
  MOCK_TASKS,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type TaskListItem,
  type TaskQueueStatus,
} from "@/lib/mock/tasks";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_COLUMN_STYLES: Record<TaskQueueStatus, string> = {
  pending: "border-t-muted-foreground/30",
  in_progress: "border-t-primary/50",
  review: "border-t-amber-300/50",
  complete: "border-t-primary/30",
};

const PRIORITY_DOT: Record<TaskListItem["priority"], string> = {
  low: "bg-muted-foreground/50",
  medium: "bg-foreground/40",
  high: "bg-amber-300/80",
  urgent: "bg-red-400/80",
};

function TaskCard({ task }: { task: TaskListItem }) {
  const assignee = task.assigneeAgentId
    ? AGENT_CATALOG[task.assigneeAgentId]
    : null;

  return (
    <div className="luxury-surface rounded-2xl p-5 transition-colors hover:border-primary/15">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h4 className="text-base font-medium leading-snug">{task.title}</h4>
        <span
          className={cn("mt-2 size-2 shrink-0 rounded-full", PRIORITY_DOT[task.priority])}
        />
      </div>
      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {task.description}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {task.drop && (
          <Badge variant="secondary" className="bg-muted/50 text-sm font-normal">
            {task.drop}
          </Badge>
        )}
        {assignee && (
          <span className="text-sm text-muted-foreground">{assignee.name}</span>
        )}
      </div>
      {task.dueDate && (
        <p className="mt-3 text-sm text-muted-foreground">Due {task.dueDate}</p>
      )}
    </div>
  );
}

function TaskColumn({
  status,
  tasks,
}: {
  status: TaskQueueStatus;
  tasks: TaskListItem[];
}) {
  return (
    <div className={cn("space-y-4 border-t-2 pt-6", STATUS_COLUMN_STYLES[status])}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-medium">
          {TASK_STATUS_LABELS[status]}
        </h3>
        <span className="text-base tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-base text-muted-foreground">
            No tasks
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}

export function TaskBoard() {
  const columns = TASK_STATUS_ORDER.map((status) => ({
    status,
    tasks: MOCK_TASKS.filter((t) => t.status === status),
  }));

  return (
    <div className="space-y-12">
      <SectionHeading
        label="Operations"
        title="Task queue"
        description="Work flowing through your brand — from idea to execution."
      />

      <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
        {columns.map(({ status, tasks }) => (
          <TaskColumn key={status} status={status} tasks={tasks} />
        ))}
      </div>
    </div>
  );
}
