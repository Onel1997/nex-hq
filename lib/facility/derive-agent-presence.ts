import type { AgentId } from "@/lib/constants/agents";
import type {
  AgentPresence,
  LabOpsState,
  LabReportSnapshot,
  LabTaskSnapshot,
  ThinkingState,
} from "@/lib/facility/types";

const ACTIVITY_TEMPLATES: Record<AgentId, string[]> = {
  ceo: [
    "Analyzing Objective...",
    "Decomposing Founder Goal...",
    "Assigning Specialists...",
    "Reviewing Reports...",
    "Synthesizing Strategy...",
    "Final Verdict Ready...",
  ],
  research: [
    "Analyzing Trends...",
    "Scanning Competitors...",
    "Processing Streetwear Data...",
    "Mapping Market Signals...",
  ],
  designer: [
    "Generating Collection Concepts...",
    "Refining Silhouettes...",
    "Creating Moodboards...",
    "Iterating Colorways...",
  ],
  marketing: [
    "Building Launch Campaign...",
    "Generating TikTok Hooks...",
    "Planning Influencer Strategy...",
    "Calibrating Ad Angles...",
  ],
  content: [
    "Writing Content Assets...",
    "Building Launch Emails...",
    "Drafting Product Copy...",
    "Sequencing Content Drops...",
  ],
  image: [
    "Generating Creative Assets...",
    "Creating Campaign Visuals...",
    "Rendering Product Shots...",
    "Compositing Hero Imagery...",
  ],
  shopify: [
    "Building Storefront...",
    "Optimizing Product Pages...",
    "Syncing Catalog Data...",
    "Configuring Checkout Flow...",
  ],
};

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickTemplate(agentId: AgentId, seed: number): string {
  const templates = ACTIVITY_TEMPLATES[agentId];
  return templates[seed % templates.length];
}

function deriveThinkingState(opsState: LabOpsState): ThinkingState {
  switch (opsState) {
    case "executing":
    case "queued":
      return "thinking";
    case "review":
      return "reviewing";
    case "approved":
      return "transmitting";
    case "error":
      return "thinking";
    default:
      return "idle";
  }
}

function estimateProgress(
  task: LabTaskSnapshot | null,
  opsState: LabOpsState,
): { progress: number | null; progressLabel: string | null } {
  if (opsState === "idle") {
    return { progress: null, progressLabel: null };
  }

  if (opsState === "review") {
    return { progress: null, progressLabel: "Awaiting review" };
  }

  if (opsState === "approved") {
    return { progress: 100, progressLabel: "Complete" };
  }

  if (opsState === "error") {
    return { progress: null, progressLabel: "Failed" };
  }

  if (!task) {
    return { progress: 12, progressLabel: null };
  }

  const seed = hashSeed(task.id);
  const elapsed = Date.now() - new Date(task.updatedAt).getTime();
  const minutes = Math.max(0, elapsed / 60_000);
  const base = 18 + (seed % 35);
  const creep = Math.min(72, base + minutes * 4.5);
  const progress = Math.round(Math.min(94, creep));

  if (task.title.toLowerCase().includes("competitor")) {
    const total = 20;
    const current = Math.min(total, Math.floor((progress / 100) * total));
    return { progress, progressLabel: `${current}/${total}` };
  }

  return { progress, progressLabel: `${progress}%` };
}

function deriveActivity(
  agentId: AgentId,
  opsState: LabOpsState,
  task: LabTaskSnapshot | null,
): string {
  if (opsState === "idle") return "Standing by";
  if (opsState === "error") return "Execution halted";
  if (opsState === "review") return "Awaiting human review";
  if (opsState === "approved") return "Output delivered";

  const minuteBucket = Math.floor(Date.now() / 45_000);
  const seed = hashSeed(`${agentId}-${task?.id ?? "none"}-${minuteBucket}`);

  if (task?.title && task.title.length > 8 && !task.title.startsWith("Task ")) {
    const template = pickTemplate(agentId, seed);
    if (opsState === "executing") {
      return template;
    }
    return task.title.length > 42 ? `${task.title.slice(0, 40)}…` : task.title;
  }

  return pickTemplate(agentId, seed);
}

function estimateConfidence(
  opsState: LabOpsState,
  activeTask: LabTaskSnapshot | null,
  latestReport: LabReportSnapshot | null,
): number | null {
  if (latestReport?.confidence) {
    const c = latestReport.confidence;
    return Math.round(c <= 1 ? c * 100 : c);
  }

  if (opsState === "idle") return null;
  if (opsState === "approved") return 96;
  if (!activeTask) return 72;

  const seed = hashSeed(activeTask.id);
  return Math.min(94, 58 + (seed % 36));
}

export function deriveAgentPresence(
  agentId: AgentId,
  opsState: LabOpsState,
  activeTask: LabTaskSnapshot | null,
  latestReport: LabReportSnapshot | null = null,
): AgentPresence {
  const thinkingState =
    agentId === "ceo" && opsState === "executing"
      ? "synthesizing"
      : deriveThinkingState(opsState);

  const { progress, progressLabel } = estimateProgress(activeTask, opsState);

  return {
    currentActivity: deriveActivity(agentId, opsState, activeTask),
    progress,
    progressLabel,
    confidence: estimateConfidence(opsState, activeTask, latestReport),
    thinkingState,
  };
}
