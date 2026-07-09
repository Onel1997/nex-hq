import { SPECIALIST_AGENT_IDS } from "@/lib/constants/agents";
import { z } from "zod";

const detailedString = (min: number) => z.string().min(min);
const bulletList = (min: number, max: number) =>
  z.array(z.string().min(10)).min(min).max(max);

export const DELEGATION_ASSIGNEE_IDS = SPECIALIST_AGENT_IDS;

export const ceoDelegatedTaskSchema = z.object({
  title: detailedString(5),
  description: detailedString(20),
  assigneeAgentId: z.enum(DELEGATION_ASSIGNEE_IDS),
  priority: z.enum(["high", "medium", "low"]),
  domain: z.string().min(3).optional(),
});

export const ceoDelegationOutputSchema = z.object({
  title: z.string().min(1),
  objective: detailedString(40),
  milestones: bulletList(2, 8),
  taskPlan: z.array(ceoDelegatedTaskSchema).min(3).max(20),
  confidence: z.number().min(0).max(1),
  sourceReportTitles: z.array(z.string()).min(0),
  rationale: z.string().min(40).optional(),
});

export type CeoDelegationOutput = z.infer<typeof ceoDelegationOutputSchema>;
export type CeoDelegatedTask = z.infer<typeof ceoDelegatedTaskSchema>;

export interface CeoDelegationInput {
  goal: string;
  workspaceId: string;
  workspaceName: string;
}

export interface CeoDelegatedTaskResult {
  id: string;
  brainRecordId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeAgentId: string;
  parentTaskId: string;
  linkedReportId?: string;
}

export interface CeoDelegationExecutionResult {
  taskId: string;
  assigneeAgentId: string;
  outcome: "executed" | "skipped" | "failed";
  skipReason?: string;
  reportId?: string;
  error?: string;
}

export interface CeoDelegationResult {
  parentTaskId: string;
  parentBrainRecordId: string;
  title: string;
  objective: string;
  milestones: string[];
  tasks: CeoDelegatedTaskResult[];
  confidence: number;
  contextRecordCount: number;
  autoExecutionEnabled: boolean;
  executions: CeoDelegationExecutionResult[];
}
