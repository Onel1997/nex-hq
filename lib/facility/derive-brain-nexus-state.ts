import type { AgentId } from "@/lib/constants/agents";
import { FACILITY_CONDUIT_NODES } from "@/lib/facility/graph";
import type { SynapseNodeId } from "@/lib/facility/graph";
import { PLACEHOLDER_LABS } from "@/lib/facility/placeholder-labs";
import type {
  BrainPulseKind,
  FacilityLabId,
  LabOpsState,
  LabSnapshot,
  NetworkSurgeMode,
} from "@/lib/facility/types";

export type BrainNexusState =
  | "idle"
  | "processing"
  | "learning"
  | "decision"
  | "alert"
  | "synthesizing";

export type BrainStatusLabel =
  | "ACTIVE"
  | "THINKING"
  | "LEARNING"
  | "PROCESSING"
  | "SYNTHESIZING";

export interface BrainNexusContext {
  pulse: BrainPulseKind;
  activeExecutions: number;
  failedTasks: number;
  ceoOpsState: LabOpsState;
  labs: Record<FacilityLabId, LabSnapshot>;
  networkSurge?: NetworkSurgeMode;
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
    ctx.networkSurge === "final-report" ||
    ctx.labs.ceo.presence.thinkingState === "synthesizing"
  ) {
    return "synthesizing";
  }

  if (
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

export function deriveBrainStatusLabel(ctx: BrainNexusContext): BrainStatusLabel {
  const nexusState = deriveBrainNexusState(ctx);

  if (nexusState === "synthesizing") return "SYNTHESIZING";
  if (nexusState === "processing" || ctx.pulse === "task-started") {
    return "PROCESSING";
  }
  if (nexusState === "learning") return "LEARNING";

  const anyReview = Object.values(ctx.labs).some(
    (lab) => lab.opsState === "review",
  );
  if (
    anyReview ||
    ctx.pulse === "delegation" ||
    ctx.ceoOpsState === "review"
  ) {
    return "THINKING";
  }

  if (ctx.activeExecutions > 0 || ctx.pulse !== "none") return "PROCESSING";

  return "ACTIVE";
}

/** Facility activity level 0–1 for ambient motion scaling. */
export function deriveBrainActivityLevel(
  labs: Record<FacilityLabId, LabSnapshot>,
  activeExecutions: number,
): number {
  const executingCount = Object.values(labs).filter(
    (lab) => lab.opsState === "executing" || lab.opsState === "review",
  ).length;
  const queuedCount = Object.values(labs).filter(
    (lab) => lab.opsState === "queued",
  ).length;
  const placeholderActive = Object.values(PLACEHOLDER_LABS).filter(
    (lab) => lab.opsState === "executing" || lab.opsState === "review",
  ).length;

  return Math.min(
    1,
    0.12 +
      activeExecutions * 0.18 +
      executingCount * 0.14 +
      queuedCount * 0.06 +
      placeholderActive * 0.08,
  );
}

export function derivePortIntensity(
  labs: Record<FacilityLabId, LabSnapshot>,
  pulse: BrainPulseKind,
  pulseAgentId?: FacilityLabId | null,
): Record<SynapseNodeId, number> {
  const intensity: Partial<Record<SynapseNodeId, number>> = {};

  for (const nodeId of FACILITY_CONDUIT_NODES) {
    const placeholder = PLACEHOLDER_LABS[nodeId as keyof typeof PLACEHOLDER_LABS];
    const lab = labs[nodeId as FacilityLabId];
    const ops: LabOpsState = lab?.opsState ?? placeholder?.opsState ?? "idle";

    let base =
      ops === "executing"
        ? 1
        : ops === "review"
          ? 0.8
          : ops === "queued"
            ? 0.5
            : ops === "approved"
              ? 0.65
              : ops === "error"
                ? 0.85
                : 0.18;

    if (pulse === "report-approved" && pulseAgentId === nodeId) {
      base = Math.max(base, 1);
    }
    if (pulse === "delegation" && pulseAgentId === nodeId) {
      base = Math.max(base, 0.95);
    }
    if (pulse === "task-started" && pulseAgentId === nodeId) {
      base = Math.max(base, 0.85);
    }
    if (pulse === "final-report") {
      base = Math.max(base, 0.7);
    }

    intensity[nodeId] = base;
  }

  return intensity as Record<SynapseNodeId, number>;
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
