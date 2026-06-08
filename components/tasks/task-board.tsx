"use client";

import {
  getAgentCatalog,
  getMockTasks,
  getTaskStatusLabels,
  TASK_STATUS_ORDER,
} from "@/lib/i18n/data";
import type { TaskListItem, TaskQueueStatus } from "@/lib/mock/tasks";
import { useDictionary, useLocale, useT } from "@/lib/i18n";
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

function TaskCard({
  task,
  assigneeName,
  dueLabel,
}: {
  task: TaskListItem;
  assigneeName: string | null;
  dueLabel: string;
}) {
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
        {assigneeName && (
          <span className="text-sm text-muted-foreground">{assigneeName}</span>
        )}
      </div>
      {task.dueDate && (
        <p className="mt-3 text-sm text-muted-foreground">
          {dueLabel} {task.dueDate}
        </p>
      )}
    </div>
  );
}

function TaskColumn({
  status,
  tasks,
  statusLabel,
  noTasksLabel,
  assigneeNames,
  dueLabel,
}: {
  status: TaskQueueStatus;
  tasks: TaskListItem[];
  statusLabel: string;
  noTasksLabel: string;
  assigneeNames: Map<string, string>;
  dueLabel: string;
}) {
  return (
    <div className={cn("space-y-4 border-t-2 pt-6", STATUS_COLUMN_STYLES[status])}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-medium">{statusLabel}</h3>
        <span className="text-base tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-base text-muted-foreground">
            {noTasksLabel}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              dueLabel={dueLabel}
              assigneeName={
                task.assigneeAgentId
                  ? assigneeNames.get(task.assigneeAgentId) ?? null
                  : null
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

export function TaskBoard() {
  const locale = useLocale();
  const t = useT();
  const { tasks: tasksCopy } = useDictionary();
  const statusLabels = getTaskStatusLabels(locale);
  const mockTasks = getMockTasks(locale);
  const agentCatalog = getAgentCatalog(locale);
  const assigneeNames = new Map(
    Object.values(agentCatalog).map((a) => [a.id, a.name]),
  );

  const columns = TASK_STATUS_ORDER.map((status) => ({
    status,
    tasks: mockTasks.filter((task) => task.status === status),
  }));

  return (
    <div className="space-y-12">
      <SectionHeading
        label={tasksCopy.board.label}
        title={tasksCopy.board.title}
        description={tasksCopy.board.description}
      />

      <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
        {columns.map(({ status, tasks }) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={tasks}
            statusLabel={statusLabels[status]}
            noTasksLabel={tasksCopy.board.noTasks}
            assigneeNames={assigneeNames}
            dueLabel={t("common.due")}
          />
        ))}
      </div>
    </div>
  );
}
