/** Brain Core V5 — mission intelligence layer (builds on V4 living network). */

import type { BrainCoreFeedItem } from "@/lib/facility/brain-core-types";
import type { AgentNodeId, CascadeBeat } from "@/lib/facility/brain-core-living";

export type MissionVerdict = "APPROVED" | "REVIEW" | "DECLINED";

export interface MissionDefinition {
  id: string;
  title: string;
  recommendation: MissionVerdict;
}

export interface MissionDecisionRecord {
  id: string;
  verdict: MissionVerdict;
  missionTitle: string;
  confidence: number;
  timestamp: string;
}

export interface CeoMissionReview {
  missionTitle: string;
  confidence: number;
  supportingAgents: number;
  recommendation: MissionVerdict;
  decision: MissionVerdict;
}

export interface EmergencyEvent {
  id: string;
  message: string;
  alertLinkId: string;
  feedKind: BrainCoreFeedItem["kind"];
}

export interface ActiveMission {
  definition: MissionDefinition;
  workflowId: WorkflowId;
  workflowAgents: AgentNodeId[];
  stageIndex: number;
  totalStages: number;
  confidence: number;
  statusLabel: string;
  currentAgentId: AgentNodeId;
  currentAgentLabel: string;
  estimatedSecondsRemaining: number;
  startedAt: number;
}

export interface MissionIntelligenceState {
  activeMission: ActiveMission | null;
  ceoReview: CeoMissionReview | null;
  displayedReview: CeoMissionReview | null;
  reviewCardVisible: boolean;
  decisionHistory: MissionDecisionRecord[];
  emergency: EmergencyEvent | null;
  missionOwnerId: AgentNodeId | null;
}

const AGENT_LABELS: Record<AgentNodeId, string> = {
  ceo: "CEO Command",
  research: "Research HQ",
  commerce: "Commerce Lab",
  designer: "Design Studio",
  marketing: "Marketing Center",
  content: "Content Studio",
  image: "Image Studio",
  shopify: "Shopify Operations",
};

const MISSION_WORKFLOW: AgentNodeId[] = [
  "research",
  "commerce",
  "designer",
  "content",
  "marketing",
  "ceo",
];

export type WorkflowId = "full-pipeline" | "commerce-ops" | "creative-pipeline";

const WORKFLOW_ROTATION: WorkflowId[] = [
  "full-pipeline",
  "commerce-ops",
  "creative-pipeline",
];

let workflowCycleIndex = 0;

const WORKFLOW_AGENTS: Record<WorkflowId, AgentNodeId[]> = {
  "full-pipeline": ["research", "commerce", "designer", "content", "marketing", "ceo"],
  "commerce-ops": ["commerce", "shopify", "ceo"],
  "creative-pipeline": ["designer", "image", "content", "marketing"],
};

const WORKFLOW_TITLES: Record<WorkflowId, string> = {
  "full-pipeline": "Full Intelligence Pipeline",
  "commerce-ops": "Commerce Operations Sync",
  "creative-pipeline": "Creative Production Run",
};

const CONFIDENCE_BY_STAGE = [65, 72, 81, 91, 91] as const;

const STAGE_COMPLETE_LABELS: Record<AgentNodeId, string> = {
  research: "Research Complete",
  commerce: "Commerce Validated",
  designer: "Design Complete",
  marketing: "Campaign Prepared",
  ceo: "Mission Review",
  content: "Content Ready",
  image: "Assets Rendered",
  shopify: "Store Synced",
};

const AGENT_CONVERSATIONS: Record<AgentNodeId, string> = {
  research: "Trend opportunity detected.",
  commerce: "Revenue confirms demand.",
  designer: "Concept ready.",
  marketing: "Launch strategy prepared.",
  ceo: "Mission approved.",
  content: "Narrative aligned.",
  image: "Visual assets ready.",
  shopify: "Store metrics synced.",
};

const AGENT_OUTCOMES: Record<AgentNodeId, string> = {
  research: "Trend detected.",
  commerce: "Revenue validated.",
  designer: "Concept generated.",
  marketing: "Campaign prepared.",
  ceo: "Final approval.",
  content: "Content drafted.",
  image: "Assets rendered.",
  shopify: "Store optimized.",
};

export const MISSION_DEFINITIONS: MissionDefinition[] = [
  { id: "summer-collection", title: "Summer Collection Strategy", recommendation: "APPROVED" },
  { id: "product-opportunity", title: "Product Opportunity Analysis", recommendation: "APPROVED" },
  { id: "campaign-launch", title: "Campaign Launch Strategy", recommendation: "APPROVED" },
  { id: "trend-investigation", title: "Trend Investigation", recommendation: "REVIEW" },
  { id: "collection-creation", title: "Collection Creation", recommendation: "APPROVED" },
  { id: "store-optimization", title: "Store Optimization", recommendation: "APPROVED" },
];

const EMERGENCY_EVENTS: Array<Omit<EmergencyEvent, "id">> = [
  {
    message: "Commerce anomaly detected.",
    alertLinkId: "fb-commerce-ceo",
    feedKind: "commerce",
  },
  {
    message: "Image Studio: Render queue backed up.",
    alertLinkId: "intel-designer-image",
    feedKind: "design",
  },
  {
    message: "Campaign underperforming.",
    alertLinkId: "fb-marketing-ceo",
    feedKind: "marketing",
  },
  {
    message: "Shopify Operations: Low inventory warning.",
    alertLinkId: "intel-commerce-shopify",
    feedKind: "commerce",
  },
  {
    message: "Content Studio: Brand voice drift detected.",
    alertLinkId: "intel-content-marketing",
    feedKind: "design",
  },
];

let decisionCounter = 0;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function feedKindForAgent(id: AgentNodeId): BrainCoreFeedItem["kind"] {
  switch (id) {
    case "research":
      return "research";
    case "commerce":
    case "shopify":
      return "commerce";
    case "designer":
    case "image":
    case "content":
      return "design";
    case "marketing":
      return "marketing";
    case "ceo":
      return "ceo";
    default:
      return "system";
  }
}

function conversationFeed(agentId: AgentNodeId): Omit<BrainCoreFeedItem, "id" | "timestamp"> {
  return {
    message: `${AGENT_LABELS[agentId]}: ${AGENT_CONVERSATIONS[agentId]}`,
    kind: feedKindForAgent(agentId),
  };
}

function statusLabelForAgent(agentId: AgentNodeId): string {
  const pool: Record<AgentNodeId, string[]> = {
    research: ["Analyzing trend report...", "Scanning market signals...", "Evaluating research data..."],
    commerce: ["Reviewing sales anomalies...", "Processing revenue streams...", "Auditing product mix..."],
    designer: ["Generating concepts...", "Refining visual direction...", "Building mood boards..."],
    marketing: ["Preparing campaign...", "Optimizing audience targets...", "Drafting launch sequence..."],
    ceo: ["Evaluating objective", "Approving mission", "Final verdict ready"],
    content: ["Writing copy...", "Drafting narratives...", "Aligning brand voice..."],
    image: ["Rendering assets...", "Generating visuals...", "Upscaling images..."],
    shopify: ["Monitoring inventory...", "Syncing storefront...", "Processing orders..."],
  };
  return pick(pool[agentId]);
}

function liveStateForAgent(agentId: AgentNodeId): CascadeBeat["state"] {
  if (agentId === "ceo") return "executing";
  if (agentId === "designer" || agentId === "image") return "executing";
  if (agentId === "marketing" || agentId === "content") return "reporting";
  if (agentId === "shopify") return "processing";
  return "analyzing";
}

function buildChainBeats(chain: AgentNodeId[]): CascadeBeat[] {
  const beats: CascadeBeat[] = [];

  for (let i = 0; i < chain.length; i += 1) {
    const agent = chain[i]!;
    const prev = i > 0 ? chain[i - 1]! : null;
    const next = i < chain.length - 1 ? chain[i + 1]! : null;
    const isCeo = agent === "ceo";

    beats.push({
      activate: [agent],
      deactivate: prev ? [prev] : undefined,
      state: liveStateForAgent(agent),
      labels: { [agent]: statusLabelForAgent(agent) },
      holdMs: isCeo ? 4200 : 2400,
      feed: conversationFeed(agent),
    });

    if (next) {
      beats.push({
        activate: [agent],
        state: "processing",
        labels: { [agent]: AGENT_OUTCOMES[agent] },
        packet: { from: agent, to: next },
        holdMs: 1300,
      });
    }
  }

  return beats;
}

export function pickNextWorkflow(): WorkflowId {
  const workflowId = WORKFLOW_ROTATION[workflowCycleIndex % WORKFLOW_ROTATION.length]!;
  workflowCycleIndex += 1;
  return workflowId;
}

export function getWorkflowAgents(workflowId: WorkflowId): AgentNodeId[] {
  return WORKFLOW_AGENTS[workflowId];
}

/** Build workflow-specific cascade beats — each workflow activates every agent in its chain. */
export function buildWorkflowCascade(
  workflowId: WorkflowId,
  _mission: MissionDefinition,
): CascadeBeat[] {
  switch (workflowId) {
    case "full-pipeline":
      return buildChainBeats(["research", "commerce", "designer", "content", "marketing", "ceo"]);
    case "commerce-ops":
      return buildChainBeats(["commerce", "shopify", "ceo"]);
    case "creative-pipeline":
      return buildChainBeats(["designer", "image", "content", "marketing"]);
    default:
      return buildChainBeats(["research", "commerce", "designer", "content", "marketing", "ceo"]);
  }
}

/** @deprecated Use buildWorkflowCascade */
export function buildMissionCascade(mission: MissionDefinition): CascadeBeat[] {
  return buildWorkflowCascade("full-pipeline", mission);
}

export function createInitialMissionState(): MissionIntelligenceState {
  workflowCycleIndex = 0;
  return {
    activeMission: null,
    ceoReview: null,
    displayedReview: null,
    reviewCardVisible: false,
    decisionHistory: seedDecisionHistory(),
    emergency: null,
    missionOwnerId: null,
  };
}

function seedDecisionHistory(): MissionDecisionRecord[] {
  const now = Date.now();
  return [
    {
      id: "seed-1",
      verdict: "APPROVED",
      missionTitle: "Summer Collection Launch",
      confidence: 91,
      timestamp: new Date(now - 3600000 * 26).toISOString(),
    },
    {
      id: "seed-2",
      verdict: "APPROVED",
      missionTitle: "Oversized Product Expansion",
      confidence: 88,
      timestamp: new Date(now - 3600000 * 52).toISOString(),
    },
    {
      id: "seed-3",
      verdict: "REVIEW",
      missionTitle: "Category Performance",
      confidence: 74,
      timestamp: new Date(now - 3600000 * 80).toISOString(),
    },
    {
      id: "seed-4",
      verdict: "DECLINED",
      missionTitle: "Winter Capsule Project",
      confidence: 62,
      timestamp: new Date(now - 3600000 * 110).toISOString(),
    },
  ];
}

export function pickNextMission(): MissionDefinition {
  return pick(MISSION_DEFINITIONS);
}

export function startMission(
  definition: MissionDefinition,
  workflowId: WorkflowId,
  previous: MissionIntelligenceState,
): MissionIntelligenceState {
  const beats = buildWorkflowCascade(workflowId, definition);
  const workflowAgents = getWorkflowAgents(workflowId);
  const estimatedSecondsRemaining = Math.round(
    beats.reduce((sum, b) => sum + b.holdMs, 0) / 1000,
  );

  return {
    activeMission: {
      definition,
      workflowId,
      workflowAgents,
      stageIndex: 1,
      totalStages: workflowAgents.length,
      confidence: CONFIDENCE_BY_STAGE[0],
      statusLabel: WORKFLOW_TITLES[workflowId],
      currentAgentId: workflowAgents[0]!,
      currentAgentLabel: AGENT_LABELS[workflowAgents[0]!],
      estimatedSecondsRemaining,
      startedAt: Date.now(),
    },
    ceoReview: null,
    displayedReview: null,
    reviewCardVisible: false,
    decisionHistory: previous.decisionHistory,
    emergency: null,
    missionOwnerId: workflowAgents[0]!,
  };
}

function stageFromBeatIndex(beatIndex: number, workflowAgents: AgentNodeId[]): number {
  const agentIndex = Math.floor(beatIndex / 2);
  return Math.min(agentIndex, workflowAgents.length - 1);
}

function remainingSeconds(beats: CascadeBeat[], fromIndex: number): number {
  return Math.round(
    beats.slice(fromIndex).reduce((sum, b) => sum + b.holdMs, 0) / 1000,
  );
}

export function advanceMissionBeat(
  state: MissionIntelligenceState,
  beatIndex: number,
  beat: CascadeBeat,
): MissionIntelligenceState {
  if (!state.activeMission) return state;

  const beats = buildWorkflowCascade(
    state.activeMission.workflowId,
    state.activeMission.definition,
  );
  const { workflowAgents } = state.activeMission;
  const stage = stageFromBeatIndex(beatIndex, workflowAgents);
  const owner = beat.activate[0] as AgentNodeId;
  const confidence = CONFIDENCE_BY_STAGE[Math.min(stage, CONFIDENCE_BY_STAGE.length - 1)] ?? 91;
  const isCeoBeat = owner === "ceo";

  const completedAgent = stage > 0 ? workflowAgents[stage - 1] : null;
  const statusLabel =
    completedAgent && beatIndex > 0 && beatIndex % 2 === 0
      ? STAGE_COMPLETE_LABELS[completedAgent]
      : isCeoBeat
        ? "Mission Review"
        : STAGE_COMPLETE_LABELS[owner] ?? "In progress";

  const activeMission: ActiveMission = {
    ...state.activeMission,
    stageIndex: stage + 1,
    confidence,
    statusLabel,
    currentAgentId: owner,
    currentAgentLabel: AGENT_LABELS[owner],
    estimatedSecondsRemaining: remainingSeconds(beats, beatIndex + 1),
  };

  const ceoReview: CeoMissionReview | null = isCeoBeat
    ? {
        missionTitle: state.activeMission.definition.title,
        confidence,
        supportingAgents: workflowAgents.filter((id) => id !== "ceo").length,
        recommendation: state.activeMission.definition.recommendation,
        decision: state.activeMission.definition.recommendation,
      }
    : state.ceoReview;

  return {
    ...state,
    activeMission,
    ceoReview,
    missionOwnerId: owner,
  };
}

export function completeMission(state: MissionIntelligenceState): MissionIntelligenceState {
  if (!state.activeMission) return state;

  const verdict = state.ceoReview?.decision ?? state.activeMission.definition.recommendation;
  decisionCounter += 1;

  const displayedReview: CeoMissionReview =
    state.ceoReview ?? {
      missionTitle: state.activeMission.definition.title,
      confidence: state.activeMission.confidence,
      supportingAgents: state.activeMission.workflowAgents.filter((id) => id !== "ceo").length,
      recommendation: state.activeMission.definition.recommendation,
      decision: verdict,
    };

  const record: MissionDecisionRecord = {
    id: `mission-decision-${decisionCounter}-${Date.now()}`,
    verdict,
    missionTitle: state.activeMission.definition.title,
    confidence: state.activeMission.confidence,
    timestamp: new Date().toISOString(),
  };

  return {
    activeMission: null,
    ceoReview: null,
    displayedReview,
    reviewCardVisible: false,
    decisionHistory: [record, ...state.decisionHistory].slice(0, 5),
    emergency: null,
    missionOwnerId: null,
  };
}

export function revealMissionReview(
  state: MissionIntelligenceState,
): MissionIntelligenceState {
  if (!state.displayedReview) return state;
  return {
    ...state,
    reviewCardVisible: true,
  };
}

export function maybeTriggerEmergency(
  state: MissionIntelligenceState,
): MissionIntelligenceState {
  if (state.activeMission) return state;
  if (Math.random() > 0.12) return state;

  const template = pick(EMERGENCY_EVENTS);
  return {
    ...state,
    emergency: {
      id: `emergency-${Date.now()}`,
      ...template,
    },
    missionOwnerId: "ceo",
  };
}

export function clearEmergency(state: MissionIntelligenceState): MissionIntelligenceState {
  if (!state.emergency) return state;
  return {
    ...state,
    emergency: null,
    missionOwnerId: state.activeMission ? state.missionOwnerId : null,
  };
}

export function formatEta(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export { AGENT_LABELS, MISSION_WORKFLOW, WORKFLOW_ROTATION };
