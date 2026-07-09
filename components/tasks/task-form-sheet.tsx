"use client";

import { useEffect, useState } from "react";
import type { AgentId } from "@/lib/constants/agents";
import { AGENT_IDS } from "@/lib/constants/agents";
import type { TaskListItem, TaskPriority, TaskStatus } from "@/tasks/types";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/tasks/types";
import { useDictionary } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface TaskFormSheetProps {
  open: boolean;
  mode: "create" | "edit";
  task?: TaskListItem | null;
  agentNames: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeAgentId: AgentId | null;
}

const EMPTY_FORM: TaskFormValues = {
  title: "",
  description: "",
  status: "pending",
  priority: "medium",
  assigneeAgentId: null,
};

export function TaskFormSheet({
  open,
  mode,
  task,
  agentNames,
  onOpenChange,
  onSubmit,
}: TaskFormSheetProps) {
  const { tasks: tasksCopy, common } = useDictionary();
  const boardCopy = tasksCopy.board;
  const [values, setValues] = useState<TaskFormValues>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && task) {
      setValues({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigneeAgentId: task.assigneeAgentId,
      });
    } else {
      setValues(EMPTY_FORM);
    }
    setError(null);
  }, [open, mode, task]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : boardCopy.loadError,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {mode === "create" ? boardCopy.createTask : boardCopy.editTask}
          </SheetTitle>
          <SheetDescription>{tasksCopy.page.description}</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="task-title">{boardCopy.titleLabel}</Label>
            <input
              id="task-title"
              required
              value={values.title}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder={boardCopy.titlePlaceholder}
              className={cn(
                "w-full rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">{boardCopy.descriptionLabel}</Label>
            <textarea
              id="task-description"
              required
              rows={4}
              value={values.description}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder={boardCopy.descriptionPlaceholder}
              className={cn(
                "w-full rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-status">{boardCopy.statusLabel}</Label>
              <select
                id="task-status"
                value={values.status}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    status: event.target.value as TaskStatus,
                  }))
                }
                className={cn(
                  "w-full rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                )}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {common.taskStatus[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-priority">{boardCopy.priorityLabel}</Label>
              <select
                id="task-priority"
                value={values.priority}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    priority: event.target.value as TaskPriority,
                  }))
                }
                className={cn(
                  "w-full rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                )}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {common.priority[priority]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-assignee">{boardCopy.assigneeLabel}</Label>
            <select
              id="task-assignee"
              value={values.assigneeAgentId ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  assigneeAgentId: event.target.value
                    ? (event.target.value as AgentId)
                    : null,
                }))
              }
              className={cn(
                "w-full rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              )}
            >
              <option value="">{boardCopy.unassigned}</option>
              {AGENT_IDS.map((agentId) => (
                <option key={agentId} value={agentId}>
                  {agentNames[agentId] ?? agentId}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <SheetFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              {boardCopy.cancel}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? boardCopy.saving : boardCopy.saveTask}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
