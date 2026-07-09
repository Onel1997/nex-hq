import { z } from "zod";
import { AGENT_IDS } from "@/lib/constants/agents";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/tasks/types";

const assigneeSchema = z.enum(AGENT_IDS).nullable().optional();

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assigneeAgentId: assigneeSchema,
  parentTaskId: z.string().uuid().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  createdByAgentId: z.enum([...AGENT_IDS, "human"] as const).optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeAgentId: assigneeSchema,
    parentTaskId: z.string().uuid().nullable().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field must be provided",
  );

export type CreateTaskBody = z.infer<typeof createTaskSchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskSchema>;
