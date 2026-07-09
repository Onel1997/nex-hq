/** Client-side living network simulation for Brain Core V4. */

import type { BrainCoreFeedItem, BrainCorePayload } from "@/lib/facility/brain-core-types";

export type LiveAgentState =
  | "idle"
  | "thinking"
  | "processing"
  | "analyzing"
  | "waiting"
  | "reporting"
  | "executing";

export type AgentNodeId =
  | "ceo"
  | "research"
  | "commerce"
  | "designer"
  | "marketing"
  | "content"
  | "image"
  | "shopify";

export type ChamberMode = "standby" | "cascade" | "ceo-event" | "ambient";

export interface LiveAgentNode {
  id: AgentNodeId;
  label: string;
  angle: number;
  liveState: LiveAgentState;
  statusLabel: string;
  isLiveActive: boolean;
}

export interface LivePacket {
  id: string;
  linkId: string;
  path: string;
  fromId: AgentNodeId;
  type: "intelligence" | "feedback" | "command";
  duration: number;
  size: number;
}

export interface LivingNetworkState {
  nodes: LiveAgentNode[];
  feed: BrainCoreFeedItem[];
  packets: LivePacket[];
  activeLinkIds: Set<string>;
  chamberMode: ChamberMode;
  ceoEventPhase: number;
  motionScale: number;
  previousActiveId: AgentNodeId | null;
}

const CEO_STATUS_POOL = [
  "Evaluating objective",
  "Approving mission",
  "Assigning specialists",
  "Final verdict ready",
];

const AGENT_STATUS_POOL: Record<AgentNodeId, string[]> = {
  ceo: ["Assigning specialists...", "Reviewing directives...", "Synchronizing command..."],
  research: [
    "Analyzing trend report...",
    "Scanning market signals...",
    "Evaluating research data...",
  ],
  commerce: [
    "Reviewing sales anomalies...",
    "Processing revenue streams...",
    "Auditing product mix...",
  ],
  designer: ["Generating concepts...", "Refining visual direction...", "Building mood boards..."],
  marketing: [
    "Preparing campaign...",
    "Optimizing audience targets...",
    "Drafting launch sequence...",
  ],
  content: ["Writing copy...", "Drafting narratives...", "Aligning brand voice..."],
  image: ["Rendering assets...", "Generating visuals...", "Upscaling images..."],
  shopify: ["Monitoring inventory...", "Syncing storefront...", "Processing orders..."],
};

const FEED_TEMPLATES: Array<Omit<BrainCoreFeedItem, "id" | "timestamp">> = [
  { message: "Research signal detected.", kind: "research" },
  { message: "Commerce anomaly detected.", kind: "commerce" },
  { message: "Design review completed.", kind: "design" },
  { message: "Content Studio: Narrative draft ready.", kind: "design" },
  { message: "Image Studio: Visual assets rendered.", kind: "design" },
  { message: "Shopify Operations: Storefront sync complete.", kind: "commerce" },
  { message: "Campaign launched.", kind: "marketing" },
  { message: "CEO decision issued.", kind: "ceo" },
  { message: "Revenue stream validated.", kind: "commerce" },
  { message: "Brand voice aligned.", kind: "design" },
  { message: "Launch sequence prepared.", kind: "marketing" },
  { message: "Inventory threshold updated.", kind: "commerce" },
];

export interface CascadeBeat {
  activate: AgentNodeId[];
  deactivate?: AgentNodeId[];
  state: LiveAgentState;
  labels: Partial<Record<AgentNodeId, string>>;
  packet?: { from: AgentNodeId; to: AgentNodeId };
  holdMs: number;
  feed?: Omit<BrainCoreFeedItem, "id" | "timestamp">;
}

const DECISION_CASCADE: CascadeBeat[] = [
  {
    activate: ["research"],
    state: "analyzing",
    labels: { research: "Analyzing trend report..." },
    holdMs: 2400,
    feed: { message: "Research signal detected.", kind: "research" },
  },
  {
    activate: ["research"],
    state: "processing",
    labels: { research: "Trend detected." },
    packet: { from: "research", to: "commerce" },
    holdMs: 1300,
  },
  {
    activate: ["commerce"],
    deactivate: ["research"],
    state: "analyzing",
    labels: { commerce: "Reviewing sales anomalies..." },
    holdMs: 2400,
    feed: { message: "Commerce anomaly detected.", kind: "commerce" },
  },
  {
    activate: ["commerce"],
    state: "processing",
    labels: { commerce: "Revenue validated." },
    packet: { from: "commerce", to: "designer" },
    holdMs: 1300,
  },
  {
    activate: ["designer"],
    deactivate: ["commerce"],
    state: "executing",
    labels: { designer: "Generating concepts..." },
    holdMs: 2400,
    feed: { message: "Design review completed.", kind: "design" },
  },
  {
    activate: ["designer"],
    state: "processing",
    labels: { designer: "Concept generated." },
    packet: { from: "designer", to: "content" },
    holdMs: 1300,
  },
  {
    activate: ["content"],
    deactivate: ["designer"],
    state: "reporting",
    labels: { content: "Writing copy..." },
    holdMs: 2400,
    feed: { message: "Content Studio: Narrative draft ready.", kind: "design" },
  },
  {
    activate: ["content"],
    state: "processing",
    labels: { content: "Content drafted." },
    packet: { from: "content", to: "marketing" },
    holdMs: 1300,
  },
  {
    activate: ["marketing"],
    deactivate: ["content"],
    state: "reporting",
    labels: { marketing: "Preparing campaign..." },
    holdMs: 2400,
    feed: { message: "Campaign launched.", kind: "marketing" },
  },
  {
    activate: ["marketing"],
    state: "processing",
    labels: { marketing: "Campaign prepared." },
    packet: { from: "marketing", to: "ceo" },
    holdMs: 1300,
  },
  {
    activate: ["ceo"],
    deactivate: ["marketing"],
    state: "executing",
    labels: { ceo: "Final verdict ready" },
    holdMs: 4200,
    feed: { message: "CEO decision issued.", kind: "ceo" },
  },
];

const LINK_LOOKUP: Array<{ from: AgentNodeId; to: AgentNodeId; id: string; type: LivePacket["type"] }> = [
  { from: "ceo", to: "research", id: "intel-ceo-research", type: "intelligence" },
  { from: "research", to: "commerce", id: "intel-research-commerce", type: "intelligence" },
  { from: "commerce", to: "designer", id: "intel-commerce-designer", type: "intelligence" },
  { from: "commerce", to: "shopify", id: "intel-commerce-shopify", type: "intelligence" },
  { from: "designer", to: "content", id: "intel-designer-content", type: "intelligence" },
  { from: "designer", to: "image", id: "intel-designer-image", type: "intelligence" },
  { from: "image", to: "content", id: "intel-image-content", type: "intelligence" },
  { from: "content", to: "marketing", id: "intel-content-marketing", type: "intelligence" },
  { from: "content", to: "image", id: "intel-content-image", type: "intelligence" },
  { from: "shopify", to: "research", id: "intel-shopify-research", type: "intelligence" },
  { from: "research", to: "ceo", id: "fb-research-ceo", type: "feedback" },
  { from: "commerce", to: "ceo", id: "fb-commerce-ceo", type: "feedback" },
  { from: "marketing", to: "ceo", id: "fb-marketing-ceo", type: "feedback" },
  { from: "shopify", to: "ceo", id: "fb-shopify-ceo", type: "feedback" },
];

const UNDERUSED_ROUTE_IDS = new Set([
  "intel-designer-content",
  "intel-designer-image",
  "intel-image-content",
  "intel-content-marketing",
  "intel-commerce-shopify",
  "intel-content-image",
  "intel-shopify-research",
  "fb-shopify-ceo",
  "fb-marketing-ceo",
]);

const SPECIALIST_SIGNAL_ROUTE_IDS = new Set([
  "intel-commerce-shopify",
  "intel-designer-image",
  "intel-designer-content",
  "intel-image-content",
  "intel-content-marketing",
  "intel-content-image",
  "intel-shopify-research",
  "fb-shopify-ceo",
  "fb-marketing-ceo",
]);

const SPECIALIST_SIGNAL_AGENTS = new Set<AgentNodeId>([
  "shopify",
  "image",
  "content",
  "designer",
  "marketing",
]);

let feedCounter = 0;
let packetCounter = 0;
let idleRotateIndex = 0;
let specialistSignalIndex = 0;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function idleLabel(id: AgentNodeId): string {
  return pick(AGENT_STATUS_POOL[id]);
}

function buildIdleNodes(payload: BrainCorePayload): LiveAgentNode[] {
  return payload.nodes.map((node) => ({
    id: node.id as AgentNodeId,
    label: node.label,
    angle: node.angle,
    liveState: "idle" as const,
    statusLabel: idleLabel(node.id as AgentNodeId),
    isLiveActive: false,
  }));
}

function makeFeedItem(
  template: Omit<BrainCoreFeedItem, "id" | "timestamp">,
): BrainCoreFeedItem {
  feedCounter += 1;
  return {
    ...template,
    id: `live-feed-${feedCounter}-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

function resolveLink(from: AgentNodeId, to: AgentNodeId) {
  return LINK_LOOKUP.find((l) => l.from === from && l.to === to) ?? null;
}

export function createInitialLivingState(payload: BrainCorePayload): LivingNetworkState {
  idleRotateIndex = 0;
  return {
    nodes: buildIdleNodes(payload),
    feed: payload.feed.slice(0, 12),
    packets: [],
    activeLinkIds: new Set<string>(),
    chamberMode: "standby",
    ceoEventPhase: 0,
    motionScale: 0.72,
    previousActiveId: null,
  };
}

export function applyCascadeBeat(
  state: LivingNetworkState,
  beat: CascadeBeat,
  linkPaths: Map<string, string>,
): LivingNetworkState {
  const activeLinkIds = new Set(state.activeLinkIds);
  const packets = [...state.packets];
  let feed = state.feed;

  if (beat.feed) {
    feed = [makeFeedItem(beat.feed), ...feed].slice(0, 14);
  }

  if (beat.packet) {
    const link = resolveLink(beat.packet.from, beat.packet.to);
    const path = link ? linkPaths.get(link.id) : undefined;
    if (link && path) {
      activeLinkIds.add(link.id);
      packetCounter += 1;
      packets.push({
        id: `pkt-${packetCounter}-${Date.now()}`,
        linkId: link.id,
        path,
        fromId: beat.packet.from,
        type: link.type,
        duration: 2.4 + Math.random() * 2.8,
        size: 3.4 + Math.random() * 1.8,
      });
    }
  }

  const activeSet = new Set(beat.activate);
  const deactivateSet = new Set(beat.deactivate ?? []);

  let previousActiveId = state.previousActiveId;
  if (beat.deactivate?.[0]) {
    previousActiveId = beat.deactivate[0];
  } else {
    const currentActive = state.nodes.find((n) => n.isLiveActive)?.id;
    if (currentActive && !activeSet.has(currentActive)) {
      previousActiveId = currentActive;
    }
  }

  const nodes = state.nodes.map((node) => {
    if (deactivateSet.has(node.id)) {
      return {
        ...node,
        liveState: "idle" as const,
        statusLabel: idleLabel(node.id),
        isLiveActive: false,
      };
    }
    if (activeSet.has(node.id)) {
      return {
        ...node,
        liveState: beat.state,
        statusLabel: beat.labels[node.id] ?? node.statusLabel,
        isLiveActive: true,
      };
    }
    return node;
  });

  const chamberMode: ChamberMode =
    beat.activate.includes("ceo") && beat.state === "executing" ? "ceo-event" : "cascade";

  return {
    ...state,
    nodes,
    feed,
    packets: packets.slice(-8),
    activeLinkIds,
    chamberMode,
    ceoEventPhase: chamberMode === "ceo-event" ? 3 : state.ceoEventPhase,
    motionScale: 1,
    previousActiveId,
  };
}

export function finishCascade(state: LivingNetworkState): LivingNetworkState {
  const lastActive =
    state.nodes.find((n) => n.isLiveActive)?.id ?? state.previousActiveId;

  return {
    ...state,
    nodes: state.nodes.map((node) => ({
      ...node,
      liveState: "idle",
      statusLabel: idleLabel(node.id),
      isLiveActive: false,
    })),
    packets: [],
    activeLinkIds: new Set<string>(),
    chamberMode: "standby",
    ceoEventPhase: 0,
    motionScale: 0.72,
    previousActiveId: lastActive,
  };
}

/** Fade a transient glow (feed / ambient) to recent tier without killing visibility. */
export function releaseAgentGlow(
  state: LivingNetworkState,
  agentId: AgentNodeId,
): LivingNetworkState {
  if (state.chamberMode === "cascade" || state.chamberMode === "ceo-event") {
    return state;
  }

  const node = state.nodes.find((n) => n.id === agentId);
  if (!node?.isLiveActive) return state;

  return {
    ...state,
    previousActiveId: agentId,
    nodes: state.nodes.map((n) =>
      n.id === agentId
        ? {
            ...n,
            liveState: "idle" as const,
            isLiveActive: false,
            statusLabel: idleLabel(n.id),
          }
        : n,
    ),
  };
}

export function rotateIdleStatuses(state: LivingNetworkState): LivingNetworkState {
  if (state.chamberMode !== "standby") return state;
  const idleNodes = state.nodes.filter((n) => !n.isLiveActive);
  if (idleNodes.length === 0) return state;
  const rotating = idleNodes[idleRotateIndex % idleNodes.length]!.id;
  idleRotateIndex += 1;
  return {
    ...state,
    nodes: state.nodes.map((node) =>
      node.id === rotating
        ? { ...node, statusLabel: idleLabel(node.id) }
        : node,
    ),
  };
}

export function appendAmbientFeed(state: LivingNetworkState): LivingNetworkState {
  return {
    ...state,
    feed: [makeFeedItem(pick(FEED_TEMPLATES)), ...state.feed].slice(0, 14),
  };
}

export interface FeedReaction {
  agentId: AgentNodeId;
  linkId: string;
}

export function resolveFeedReaction(item: BrainCoreFeedItem): FeedReaction | null {
  const msg = item.message.toLowerCase();

  if (msg.includes("ceo") || item.kind === "ceo") {
    return { agentId: "ceo", linkId: "intel-ceo-research" };
  }
  if (
    msg.includes("shopify") ||
    msg.includes("storefront") ||
    msg.includes("inventory") ||
    msg.includes("orders")
  ) {
    return { agentId: "shopify", linkId: "intel-commerce-shopify" };
  }
  if (
    msg.includes("image studio") ||
    msg.includes("visual asset") ||
    msg.includes("rendering") ||
    msg.includes("upscaling")
  ) {
    return { agentId: "image", linkId: "intel-designer-image" };
  }
  if (
    msg.includes("content studio") ||
    msg.includes("narrative") ||
    msg.includes("brand voice") ||
    msg.includes("writing copy")
  ) {
    return { agentId: "content", linkId: "intel-content-marketing" };
  }
  if (
    msg.includes("marketing center") ||
    msg.includes("marketing") ||
    msg.includes("campaign") ||
    msg.includes("launch")
  ) {
    return { agentId: "marketing", linkId: "fb-marketing-ceo" };
  }
  if (
    msg.includes("design studio") ||
    msg.includes("design review") ||
    msg.includes("concept") ||
    msg.includes("creative")
  ) {
    return { agentId: "designer", linkId: "intel-designer-content" };
  }
  if (
    msg.includes("commerce lab") ||
    msg.includes("commerce") ||
    msg.includes("anomaly") ||
    msg.includes("revenue")
  ) {
    return { agentId: "commerce", linkId: "intel-commerce-designer" };
  }
  if (
    msg.includes("research hq") ||
    msg.includes("research signal") ||
    item.kind === "research"
  ) {
    return { agentId: "research", linkId: "intel-research-commerce" };
  }
  if (msg.includes("knowledge packet")) {
    const route = pick(LINK_LOOKUP.filter((l) => UNDERUSED_ROUTE_IDS.has(l.id)));
    return { agentId: route.from, linkId: route.id };
  }
  if (item.kind === "system") {
    const route = pick(LINK_LOOKUP.filter((l) => UNDERUSED_ROUTE_IDS.has(l.id)));
    return { agentId: route.from, linkId: route.id };
  }
  return null;
}

/** Sync visible network activity to a feed event — packet, route highlight, brief agent activation */
export function applyFeedReaction(
  state: LivingNetworkState,
  item: BrainCoreFeedItem,
  linkPaths: Map<string, string>,
): LivingNetworkState {
  const reaction = resolveFeedReaction(item);
  if (!reaction) return state;

  const path = linkPaths.get(reaction.linkId);
  if (!path) return state;

  const link = LINK_LOOKUP.find((l) => l.id === reaction.linkId);
  const activeLinkIds = new Set(state.activeLinkIds);
  activeLinkIds.add(reaction.linkId);
  packetCounter += 1;

  const currentlyActive = state.nodes.find((n) => n.isLiveActive)?.id ?? null;
  const previousActiveId =
    currentlyActive && currentlyActive !== reaction.agentId
      ? currentlyActive
      : state.previousActiveId;

  return {
    ...state,
    previousActiveId,
    nodes: state.nodes.map((node) =>
      node.id === reaction.agentId
        ? {
            ...node,
            liveState: "processing" as const,
            statusLabel: pick(AGENT_STATUS_POOL[reaction.agentId]),
            isLiveActive: true,
          }
        : node,
    ),
    activeLinkIds,
    packets: [
      ...state.packets,
      {
        id: `feed-pkt-${packetCounter}-${Date.now()}`,
        linkId: reaction.linkId,
        path,
        fromId: link?.from ?? reaction.agentId,
        type: link?.type ?? "intelligence",
        duration: 2.6 + Math.random() * 2.2,
        size: 3.2 + Math.random() * 1.6,
      },
    ].slice(-8),
    motionScale: Math.max(state.motionScale, 0.82),
    chamberMode: state.chamberMode === "standby" ? "ambient" : state.chamberMode,
  };
}

export function spawnAmbientPacket(
  state: LivingNetworkState,
  linkPaths: Map<string, string>,
): LivingNetworkState {
  if (Math.random() > 0.48) return state;

  const specialistRoutes = LINK_LOOKUP.filter(
    (route) => SPECIALIST_SIGNAL_ROUTE_IDS.has(route.id) && linkPaths.has(route.id),
  );
  const ambientRoutes = LINK_LOOKUP.filter((l) => linkPaths.has(l.id));
  const weighted = ambientRoutes.flatMap((route) =>
    UNDERUSED_ROUTE_IDS.has(route.id) ? [route, route, route] : [route],
  );

  const route =
    specialistRoutes.length > 0
      ? specialistRoutes[specialistSignalIndex++ % specialistRoutes.length]!
      : pick(weighted);
  const path = linkPaths.get(route.id);
  if (!path) return state;

  const activeLinkIds = new Set(state.activeLinkIds);
  activeLinkIds.add(route.id);
  activeLinkIds.add("command-ring");
  packetCounter += 1;

  const motionScale =
    state.chamberMode === "cascade" || state.chamberMode === "ceo-event"
      ? Math.max(state.motionScale, 0.95)
      : 0.82;

  const currentlyActive = state.nodes.find((n) => n.isLiveActive)?.id ?? null;
  const previousActiveId =
    currentlyActive && currentlyActive !== route.from
      ? currentlyActive
      : state.previousActiveId;

  const signalAgents = new Set<AgentNodeId>([route.from]);
  if (SPECIALIST_SIGNAL_AGENTS.has(route.to)) {
    signalAgents.add(route.to);
  }

  return {
    ...state,
    previousActiveId,
    activeLinkIds,
    chamberMode:
      state.chamberMode === "standby" ? "ambient" : state.chamberMode,
    motionScale,
    nodes: state.nodes.map((node) =>
      signalAgents.has(node.id)
        ? {
            ...node,
            liveState: "processing" as const,
            statusLabel: pick(AGENT_STATUS_POOL[node.id]),
            isLiveActive: true,
          }
        : node,
    ),
    packets: [
      ...state.packets,
      {
        id: `pkt-${packetCounter}-${Date.now()}`,
        linkId: route.id,
        path,
        fromId: route.from,
        type: route.type,
        duration: 3.2 + Math.random() * 3.8,
        size: 2.8 + Math.random() * 1.8,
      },
      {
        id: `pkt-trail-${packetCounter}-${Date.now()}`,
        linkId: route.id,
        path,
        fromId: route.from,
        type: route.type,
        duration: 4.4 + Math.random() * 2.6,
        size: 2.2 + Math.random() * 1.2,
      },
    ].slice(-10),
  };
}

export function prunePackets(state: LivingNetworkState): LivingNetworkState {
  if (state.packets.length === 0) return state;
  return { ...state, packets: state.packets.slice(-6) };
}

export function advanceCeoStatus(state: LivingNetworkState, phase: number): LivingNetworkState {
  if (state.chamberMode !== "ceo-event") return state;
  const label = CEO_STATUS_POOL[phase] ?? CEO_STATUS_POOL[0]!;
  return {
    ...state,
    ceoEventPhase: phase,
    nodes: state.nodes.map((node) =>
      node.id === "ceo" ? { ...node, statusLabel: label, liveState: "executing" } : node,
    ),
  };
}

export { DECISION_CASCADE, CEO_STATUS_POOL };
