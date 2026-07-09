"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAgentCatalog,
  getTaskStatusLabels,
  TASK_STATUS_ORDER,
} from "@/lib/i18n/data";
import type { TaskListItem, TaskStatus } from "@/tasks/types";
import { useDictionary, useLocale, useT, useWorkspace } from "@/lib/i18n";
import { TaskDeleteDialog } from "@/components/tasks/task-delete-dialog";
import {
  TaskFormSheet,
  type TaskFormValues,
} from "@/components/tasks/task-form-sheet";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

const STATUS_COLUMN_STYLES: Record<TaskStatus, string> = {
  pending: "border-t-muted-foreground/30",
  assigned: "border-t-sky-500/40",
  in_progress: "border-t-primary/50",
  review: "border-t-amber-300/50",
  completed: "border-t-emerald-500/40",
  failed: "border-t-destructive/40",
};

const PRIORITY_DOT: Record<TaskListItem["priority"], string> = {
  low: "bg-muted-foreground/50",
  medium: "bg-foreground/40",
  high: "bg-amber-300/80",
  urgent: "bg-red-400/80",
};

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function TaskCard({
  task,
  assigneeName,
  statusLabels,
  priorityLabel,
  boardCopy,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: TaskListItem;
  assigneeName: string | null;
  statusLabels: Record<TaskStatus, string>;
  priorityLabel: string;
  boardCopy: {
    createdAt: string;
    updatedAt: string;
    assigneeLabel: string;
    unassigned: string;
    edit: string;
    delete: string;
    statusLabel: string;
    priorityLabel: string;
  };
  onEdit: (task: TaskListItem) => void;
  onDelete: (task: TaskListItem) => void;
  onStatusChange: (task: TaskListItem, status: TaskStatus) => void;
}) {
  return (
    <div className="luxury-surface rounded-2xl p-5 transition-colors hover:border-primary/15">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h4 className="text-base font-medium leading-snug">{task.title}</h4>
        <span
          className={cn(
            "mt-2 size-2 shrink-0 rounded-full",
            PRIORITY_DOT[task.priority],
          )}
          title={priorityLabel}
        />
      </div>

      <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {task.description}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-muted/50 text-xs font-normal">
          {statusLabels[task.status]}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal">
          {assigneeName ?? boardCopy.unassigned}
        </Badge>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          {boardCopy.createdAt}: {formatDate(task.createdAt, "de-DE")}
        </p>
        <p>
          {boardCopy.updatedAt}: {formatDate(task.updatedAt, "de-DE")}
        </p>
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">
            {boardCopy.statusLabel}
          </span>
          <select
            value={task.status}
            onChange={(event) =>
              onStatusChange(task, event.target.value as TaskStatus)
            }
            className={cn(
              "w-full rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            )}
          >
            {TASK_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => onEdit(task)}
          >
            <Pencil className="size-3.5" />
            {boardCopy.edit}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="gap-1.5"
            onClick={() => onDelete(task)}
          >
            <Trash2 className="size-3.5" />
            {boardCopy.delete}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskColumn({
  status,
  tasks,
  statusLabel,
  noTasksLabel,
  assigneeNames,
  statusLabels,
  priorityLabels,
  boardCopy,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  status: TaskStatus;
  tasks: TaskListItem[];
  statusLabel: string;
  noTasksLabel: string;
  assigneeNames: Map<string, string>;
  statusLabels: Record<TaskStatus, string>;
  priorityLabels: Record<TaskListItem["priority"], string>;
  boardCopy: {
    createdAt: string;
    updatedAt: string;
    assigneeLabel: string;
    unassigned: string;
    edit: string;
    delete: string;
    statusLabel: string;
    priorityLabel: string;
  };
  onEdit: (task: TaskListItem) => void;
  onDelete: (task: TaskListItem) => void;
  onStatusChange: (task: TaskListItem, status: TaskStatus) => void;
}) {
  return (
    <div
      className={cn("space-y-4 border-t-2 pt-6", STATUS_COLUMN_STYLES[status])}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-medium">{statusLabel}</h3>
        <span className="text-base tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {noTasksLabel}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.brainRecordId}
              task={task}
              assigneeName={
                task.assigneeAgentId
                  ? assigneeNames.get(task.assigneeAgentId) ?? null
                  : null
              }
              statusLabels={statusLabels}
              priorityLabel={priorityLabels[task.priority]}
              boardCopy={boardCopy}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
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
  const workspace = useWorkspace();
  const { tasks: tasksCopy, common } = useDictionary();
  const boardCopy = tasksCopy.board;
  const statusLabels = getTaskStatusLabels(locale);
  const agentCatalog = getAgentCatalog(locale);
  const assigneeNames = new Map(
    Object.values(agentCatalog).map((agent) => [agent.id, agent.name]),
  );

  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [selectedTask, setSelectedTask] = useState<TaskListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? boardCopy.loadError);
      }

      setTasks(data.tasks ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : boardCopy.loadError,
      );
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [boardCopy.loadError]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks, workspace.slug]);

  const openCreateSheet = () => {
    setSheetMode("create");
    setSelectedTask(null);
    setSheetOpen(true);
  };

  const openEditSheet = (task: TaskListItem) => {
    setSheetMode("edit");
    setSelectedTask(task);
    setSheetOpen(true);
  };

  const handleCreateOrUpdate = async (values: TaskFormValues) => {
    if (sheetMode === "create") {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          createdByAgentId: "human",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? boardCopy.loadError);
      }
    } else if (selectedTask) {
      const res = await fetch(`/api/tasks/${selectedTask.brainRecordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? boardCopy.loadError);
      }
    }

    await loadTasks();
  };

  const handleStatusChange = async (task: TaskListItem, status: TaskStatus) => {
    const res = await fetch(`/api/tasks/${task.brainRecordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? boardCopy.loadError);
      return;
    }
    await loadTasks();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${deleteTarget.brainRecordId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? boardCopy.loadError);
      }
      setDeleteTarget(null);
      await loadTasks();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : boardCopy.loadError,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = TASK_STATUS_ORDER.map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status),
  }));

  return (
    <div className="space-y-10">
      <SectionHeading
        label={boardCopy.label}
        title={boardCopy.title}
        description={boardCopy.description}
        action={
          <Button size="lg" className="gap-2" onClick={openCreateSheet}>
            <Plus className="size-4" />
            {boardCopy.createTask}
          </Button>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-base">{t("research.interface.running")}</span>
        </div>
      )}

      {error && !isLoading && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!isLoading && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {columns.map(({ status, tasks: columnTasks }) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={columnTasks}
              statusLabel={statusLabels[status]}
              noTasksLabel={boardCopy.noTasks}
              assigneeNames={assigneeNames}
              statusLabels={statusLabels}
              priorityLabels={common.priority}
              boardCopy={boardCopy}
              onEdit={openEditSheet}
              onDelete={setDeleteTarget}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      <TaskFormSheet
        open={sheetOpen}
        mode={sheetMode}
        task={selectedTask}
        agentNames={Object.fromEntries(assigneeNames)}
        onOpenChange={setSheetOpen}
        onSubmit={handleCreateOrUpdate}
      />

      <TaskDeleteDialog
        open={deleteTarget !== null}
        title={boardCopy.confirmDeleteTitle}
        description={boardCopy.confirmDeleteDescription}
        confirmLabel={boardCopy.confirmDelete}
        cancelLabel={boardCopy.cancel}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
        isSubmitting={isDeleting}
      />
    </div>
  );
}
