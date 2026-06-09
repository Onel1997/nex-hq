import type { AgentId } from "@/lib/constants/agents";
import type {
  BrainPulseKind,
  FacilityLabId,
  LabOpsState,
  LabSnapshot,
} from "@/lib/facility/types";

export type BrainNexusState =
  | "idle"
  | "processing"
  | "learning"
  | "decision"
  | "alert";

export interface BrainNexusContext {
  pulse: BrainPulseKind;
  activeExecutions: number;
  failedTasks: number;
  ceoOpsState: LabOpsState;
  labs: Record<FacilityLabId, LabSnapshot>;
}

const STREAM_AGENTS: Exclude<AgentId, "ceo">[] = [
  "research",
  "designer",
  "marketing",
  "content",
  "image",
  "shopify",
];

export function deriveBrainNexusState(ctx: BrainNexusContext): BrainNexusState {
  const hasErrorLab = Object.values(ctx.labs).some(
    (lab) => lab.opsState === "error",
  );

  if (
    ctx.pulse === "report-rejected" ||
    ctx.failedTasks > 0 ||
    hasErrorLab
  ) {
    return "alert";
  }

  if (
    ctx.pulse === "final-report" ||
    ctx.pulse === "delegation" ||
    ctx.ceoOpsState === "executing" ||
    ctx.ceoOpsState === "review"
  ) {
    return "decision";
  }

  if (
    ctx.pulse === "report-approved" ||
    ctx.pulse === "task-complete"
  ) {
    return "learning";
  }

  if (ctx.activeExecutions > 0 || ctx.pulse === "task-started") {
    return "processing";
  }

  return "idle";
}

export function deriveStreamIntensity(
  labs: Record<FacilityLabId, LabSnapshot>,
): Record<Exclude<AgentId, "ceo">, number> {
  const intensity: Record<string, number> = {};

  for (const agentId of STREAM_AGENTS) {
    const ops = labs[agentId].opsState;
    intensity[agentId] =
      ops === "executing"
        ? 1
        : ops === "review"
          ? 0.75
          : ops === "queued"
            ? 0.45
            : ops === "approved"
              ? 0.6
              : ops === "error"
                ? 0.9
                : 0.2;
  }

  return intensity as Record<Exclude<AgentId, "ceo">, number>;
}
