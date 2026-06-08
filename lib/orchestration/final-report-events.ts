import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { BrainActor } from "@/brain/types";

export type CeoFinalReportEventType =
  | "ceo.final_report.started"
  | "ceo.final_report.generated"
  | "ceo.final_report.completed";

const CEO_ACTOR: BrainActor = {
  type: "agent",
  id: "ceo",
};

export async function logCeoFinalReportEvent(params: {
  recordId?: string;
  eventType: CeoFinalReportEventType;
  payload: Record<string, unknown>;
}): Promise<string> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const brain = getBrainClient();

  return brain.logCeoFinalReportEvent({
    workspaceId: workspace.id,
    recordId: params.recordId,
    actor: CEO_ACTOR,
    eventType: params.eventType,
    payload: params.payload,
  });
}
