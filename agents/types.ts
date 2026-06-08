import type { AgentId } from "@/lib/constants/agents";
import type { AgentReport } from "@/reports/types";
import type { Task } from "@/tasks/types";

/**
 * Base contract for all Milaene HQ agents.
 * Implementation deferred — types define the future interface.
 */
export interface AgentContext {
  task: Task;
  brainContext: Record<string, unknown>;
}

export interface AgentResult {
  report: Omit<AgentReport, "id" | "createdAt" | "updatedAt" | "status">;
}

export interface Agent {
  id: AgentId;
  name: string;
  /** Execute a delegated task. Not implemented yet. */
  run(context: AgentContext): Promise<AgentResult>;
}
