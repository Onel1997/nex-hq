import { runDesign } from "@/agents/design/run";
import { runMarketing } from "@/agents/marketing/run";
import { runResearch } from "@/agents/research/run";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import {
  isAutoExecutableAgent,
  isAutoExecutionEnabled,
  type AutoExecutableAgentId,
} from "@/lib/orchestration/auto-execution";
import {
  logTaskExecutionEvent,
  ORCHESTRATOR_ACTOR,
} from "@/lib/orchestration/execution-events";
import { listTasks, updateTask } from "@/lib/tasks/task-service";
import type { TaskListItem } from "@/tasks/types";

export interface TaskExecutionResult {
  taskId: string;
  brainRecordId: string;
  assigneeAgentId: string;
  outcome: "executed" | "skipped" | "failed";
  skipReason?: "auto_execution_disabled" | "manual_agent" | "invalid_status";
  reportId?: string;
  reportRecordId?: string;
  error?: string;
}

interface WorkspaceContext {
  id: string;
  name: string;
}

interface AgentRunResult {
  reportId: string;
  reportRecordId: string;
}

async function runSpecialistAgent(
  assigneeAgentId: AutoExecutableAgentId,
  input: {
    prompt: string;
    workspaceId: string;
    workspaceName: string;
    originTaskId: string;
  },
): Promise<AgentRunResult> {
  const base = {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    originTaskId: input.originTaskId,
  };

  switch (assigneeAgentId) {
    case "research": {
      const result = await runResearch({
        ...base,
        request: input.prompt,
      });
      return {
        reportId: result.reportId,
        reportRecordId: result.reportRecordId,
      };
    }
    case "designer": {
      const result = await runDesign({
        ...base,
        brief: input.prompt,
      });
      return {
        reportId: result.reportId,
        reportRecordId: result.reportRecordId,
      };
    }
    case "marketing": {
      const result = await runMarketing({
        ...base,
        brief: input.prompt,
      });
      return {
        reportId: result.reportId,
        reportRecordId: result.reportRecordId,
      };
    }
  }
}

function resolveSpecialistPrompt(task: TaskListItem): string {
  const payloadPrompt = task.payload.specialistPrompt;
  if (typeof payloadPrompt === "string" && payloadPrompt.trim()) {
    return payloadPrompt.trim();
  }
  return task.description;
}

/**
 * Execute a single assigned task: route to specialist, link report, update status.
 */
export async function executeTask(
  task: TaskListItem,
  workspace: WorkspaceContext,
): Promise<TaskExecutionResult> {
  const base = {
    taskId: task.id,
    brainRecordId: task.brainRecordId,
    assigneeAgentId: task.assigneeAgentId ?? "unknown",
  };

  if (!isAutoExecutionEnabled()) {
    console.info("[TaskExecutor] Skipped — AUTO_EXECUTION_ENABLED is false", {
      taskId: task.id,
      raw: process.env.AUTO_EXECUTION_ENABLED ?? "(unset)",
    });
    return {
      ...base,
      outcome: "skipped",
      skipReason: "auto_execution_disabled",
    };
  }

  if (task.status !== "assigned") {
    return {
      ...base,
      outcome: "skipped",
      skipReason: "invalid_status",
    };
  }

  if (!isAutoExecutableAgent(task.assigneeAgentId)) {
    return {
      ...base,
      outcome: "skipped",
      skipReason: "manual_agent",
    };
  }

  const prompt = resolveSpecialistPrompt(task);

  console.info("[TaskExecutor] Starting execution", {
    taskId: task.id,
    assignee: task.assigneeAgentId,
    title: task.title,
  });

  await logTaskExecutionEvent({
    brainRecordId: task.brainRecordId,
    eventType: "task.execution.started",
    payload: {
      taskId: task.id,
      assigneeAgentId: task.assigneeAgentId,
      title: task.title,
    },
  });

  await updateTask(
    task.brainRecordId,
    { status: "in_progress" },
    ORCHESTRATOR_ACTOR,
  );

  try {
    const result = await runSpecialistAgent(task.assigneeAgentId, {
      prompt,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      originTaskId: task.id,
    });

    await updateTask(
      task.brainRecordId,
      {
        status: "review",
        payload: {
          ...task.payload,
          linkedReportId: result.reportId,
          linkedReportRecordId: result.reportRecordId,
        },
      },
      ORCHESTRATOR_ACTOR,
    );

    await logTaskExecutionEvent({
      brainRecordId: task.brainRecordId,
      eventType: "task.execution.completed",
      payload: {
        taskId: task.id,
        assigneeAgentId: task.assigneeAgentId,
        reportId: result.reportId,
        reportRecordId: result.reportRecordId,
        originTaskId: task.id,
      },
    });

    console.info("[TaskExecutor] Execution completed", {
      taskId: task.id,
      reportId: result.reportId,
    });

    return {
      ...base,
      outcome: "executed",
      reportId: result.reportId,
      reportRecordId: result.reportRecordId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent execution failed";

    await updateTask(
      task.brainRecordId,
      { status: "failed" },
      ORCHESTRATOR_ACTOR,
    );

    await logTaskExecutionEvent({
      brainRecordId: task.brainRecordId,
      eventType: "task.execution.failed",
      payload: {
        taskId: task.id,
        assigneeAgentId: task.assigneeAgentId,
        error: message,
      },
    });

    console.error("[TaskExecutor] Execution failed", {
      taskId: task.id,
      error: message,
    });

    return {
      ...base,
      outcome: "failed",
      error: message,
    };
  }
}

/**
 * Detect assigned tasks eligible for auto-execution.
 */
export async function detectAssignedTasks(): Promise<TaskListItem[]> {
  const { tasks } = await listTasks();

  return tasks.filter(
    (task) =>
      task.status === "assigned" && isAutoExecutableAgent(task.assigneeAgentId),
  );
}

/**
 * Execute all assigned tasks sequentially (preserves delegation order).
 */
export async function executeAssignedTasks(
  tasks: TaskListItem[],
  workspace?: WorkspaceContext,
): Promise<TaskExecutionResult[]> {
  if (!isAutoExecutionEnabled()) {
    return tasks.map((task) => ({
      taskId: task.id,
      brainRecordId: task.brainRecordId,
      assigneeAgentId: task.assigneeAgentId ?? "unknown",
      outcome: "skipped",
      skipReason: "auto_execution_disabled",
    }));
  }

  const seeded = await ensureWorkspaceBrainSeeded();
  const ctx = workspace ?? {
    id: seeded.workspace.id,
    name: seeded.workspace.name,
  };
  const results: TaskExecutionResult[] = [];

  for (const task of tasks) {
    results.push(await executeTask(task, ctx));
  }

  return results;
}
