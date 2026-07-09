import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { BrainActor } from "@/brain/types";

export type TaskExecutionEventType =
  | "task.execution.started"
  | "task.execution.completed"
  | "task.execution.failed"
  | "task.review.completed";

const ORCHESTRATOR_ACTOR: BrainActor = {
  type: "agent",
  id: "ceo",
};

export async function logTaskExecutionEvent(params: {
  brainRecordId: string;
  eventType: TaskExecutionEventType;
  payload: Record<string, unknown>;
  actor?: BrainActor;
}): Promise<string> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();

  return brain.logTaskEvent({
    workspaceId: workspace.id,
    recordId: params.brainRecordId,
    actor: params.actor ?? ORCHESTRATOR_ACTOR,
    eventType: params.eventType,
    payload: params.payload,
  });
}

export { ORCHESTRATOR_ACTOR };
