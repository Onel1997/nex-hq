import type { ReportListItem } from "@/lib/mock/reports";
import type {
  GoalCheckpoint,
  GoalCheckpointStatus,
  GoalProgress,
} from "@/lib/facility/types";
import type { TaskListItem } from "@/tasks/types";

const GOAL_CHECKPOINT_AGENTS = [
  "research",
  "designer",
  "marketing",
  "content",
  "shopify",
] as const;

function isParentGoalTask(task: TaskListItem): boolean {
  return (
    task.createdByAgentId === "ceo" &&
    !task.parentTaskId &&
    task.payload.kind === "ceo-goal"
  );
}

function resolveCheckpointStatus(
  agentId: (typeof GOAL_CHECKPOINT_AGENTS)[number],
  childTasks: TaskListItem[],
  reports: ReportListItem[],
): GoalCheckpointStatus {
  const agentTasks = childTasks.filter((t) => t.assigneeAgentId === agentId);
  const agentReports = reports.filter((r) => r.agentId === agentId);

  const hasApprovedReport = agentReports.some((r) => r.status === "approved");
  const hasCompletedTask = agentTasks.some((t) => t.status === "completed");

  if (hasApprovedReport || hasCompletedTask) return "complete";

  const isActive = agentTasks.some((t) =>
    ["in_progress", "review", "assigned", "pending"].includes(t.status),
  );
  if (isActive) return "active";

  return "pending";
}

/** Derive founder goal progress from live ceo-goal tasks and child work. */
export function deriveGoalProgress(
  tasks: TaskListItem[],
  reports: ReportListItem[],
): GoalProgress | null {
  const parentGoals = tasks
    .filter(isParentGoalTask)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

  if (parentGoals.length === 0) return null;

  const goal = parentGoals[0];
  const childTasks = tasks.filter(
    (t) =>
      t.parentTaskId === goal.id ||
      t.payload.goalRef === goal.id,
  );

  const checkpoints = {} as Record<(typeof GOAL_CHECKPOINT_AGENTS)[number], GoalCheckpoint>;

  for (const agentId of GOAL_CHECKPOINT_AGENTS) {
    checkpoints[agentId] = {
      agentId,
      status: resolveCheckpointStatus(agentId, childTasks, reports),
    };
  }

  const completeCount = GOAL_CHECKPOINT_AGENTS.filter(
    (id) => checkpoints[id].status === "complete",
  ).length;
  const progressPct = Math.round(
    (completeCount / GOAL_CHECKPOINT_AGENTS.length) * 100,
  );

  const founderGoal =
    (typeof goal.payload.goal === "string" ? goal.payload.goal : null) ??
    goal.title;

  return {
    parentGoalTaskId: goal.id,
    founderGoal,
    progressPct,
    checkpoints,
  };
}
