import { getNodeLayout, isFacilitySceneNodeId } from "@/lib/facility/layout";
import {
  getBrainNexusCenter,
  getProjectedBrainPortPoint,
  getProjectedPerimeterPoint,
  getSceneNodeFrame,
} from "@/lib/facility/scene-coordinates";
import { PLACEHOLDER_LABS } from "@/lib/facility/placeholder-labs";
import type {
  FacilityDepthLayer,
  FacilitySceneNodeId,
  FacilityLabId,
  LabOpsState,
} from "@/lib/facility/types";

export { getSceneNodeFrame, parseCubicPath } from "@/lib/facility/scene-coordinates";

export type SynapseNodeId = FacilitySceneNodeId;

export type SynapseFlowMode = "to-brain" | "from-brain" | "ambient" | "error";

export type SynapseEdgeKind = "context" | "pipeline" | "report-up";

export interface SynapseEdgeDef {
  id: string;
  from: SynapseNodeId;
  to: SynapseNodeId;
  kind: SynapseEdgeKind;
}

export interface SynapsePoint {
  x: number;
  y: number;
}

export interface SynapseEdgeComputed {
  id: string;
  from: SynapseNodeId;
  to: SynapseNodeId;
  kind: SynapseEdgeKind;
  path: string;
  start: SynapsePoint;
  end: SynapsePoint;
  depthLayer: FacilityDepthLayer;
  flowMode: SynapseFlowMode;
  active: boolean;
  flowTowardBrain: boolean;
}

/** Every facility node with a dedicated Brain Core data conduit. */
export const FACILITY_CONDUIT_NODES: SynapseNodeId[] = [
  "ceo",
  "research",
  "analytics",
  "image",
  "marketing",
  "shopify",
  "commerce",
  "operations",
  "content",
  "designer",
];

/**
 * Brain intake ports — each conduit feeds into the Brain glow region.
 * Angles: 0° = right, 90° = down, 180° = left, -90° = up.
 */
export const BRAIN_PORT_DEGREES: Partial<Record<SynapseNodeId, number>> = {
  research: -135,
  analytics: -98,
  ceo: -82,
  image: -45,
  marketing: 0,
  shopify: 38,
  commerce: 52,
  content: 138,
  designer: 180,
  operations: 90,
};

export interface EdgeCorridorConfig {
  spread: number;
  lane: number;
  sweep: number;
}

/** Shopify Lab — visual reference for all conduits. */
const SHOPIFY_CORRIDOR: EdgeCorridorConfig = {
  spread: 1.1,
  lane: 0,
  sweep: 1,
};

/** Per-conduit lane offsets only — prevents path crossings, same curve language. */
const CONDUIT_CORRIDORS: Partial<Record<string, EdgeCorridorConfig>> = {
  "shopify-brain": SHOPIFY_CORRIDOR,
  "research-brain": { ...SHOPIFY_CORRIDOR, lane: -0.06 },
  "analytics-brain": { ...SHOPIFY_CORRIDOR, lane: 0.05 },
  "ceo-brain": { ...SHOPIFY_CORRIDOR, lane: 0, sweep: 0.95 },
  "image-brain": { ...SHOPIFY_CORRIDOR, lane: -0.03 },
  "marketing-brain": { ...SHOPIFY_CORRIDOR, lane: 0.04 },
  "commerce-brain": { ...SHOPIFY_CORRIDOR, lane: 0.03 },
  "operations-brain": { ...SHOPIFY_CORRIDOR, lane: 0.06 },
  "content-brain": { ...SHOPIFY_CORRIDOR, lane: -0.04 },
  "designer-brain": { ...SHOPIFY_CORRIDOR, lane: -0.05 },
};

export const SYNAPSE_EDGES: SynapseEdgeDef[] = FACILITY_CONDUIT_NODES.map(
  (nodeId) => ({
    id: `${nodeId}-brain`,
    from: nodeId,
    to: "brain" as const,
    kind: nodeId === "ceo" ? ("report-up" as const) : ("context" as const),
  }),
);

export function layoutToPoint(
  id: SynapseNodeId | string,
  width: number,
  height: number,
): SynapsePoint | null {
  if (!isFacilitySceneNodeId(id)) return null;
  const layout = getNodeLayout(id);
  return {
    x: (layout.left / 100) * width,
    y: (layout.top / 100) * height,
  };
}

export function getBrainCenter(width: number, height: number): SynapsePoint {
  return getBrainNexusCenter(width, height);
}

/** Outer port on the Brain Nexus perimeter — corridor direction only. */
export function getBrainPortPoint(
  connectingNodeId: SynapseNodeId | string,
  width: number,
  height: number,
): SynapsePoint {
  return getProjectedBrainPortPoint(
    connectingNodeId as FacilitySceneNodeId,
    width,
    height,
    BRAIN_PORT_DEGREES,
  );
}

/**
 * Intake inside the Brain Core glow — feeds into the Nexus, not the outer halo.
 */
export function getBrainIntakePoint(
  connectingNodeId: SynapseNodeId | string,
  width: number,
  height: number,
): SynapsePoint {
  const nexus = getBrainNexusCenter(width, height);
  const port = getBrainPortPoint(connectingNodeId, width, height);
  const depth = 0.82;
  return {
    x: nexus.x + (port.x - nexus.x) * depth,
    y: nexus.y + (port.y - nexus.y) * depth,
  };
}

/** Lab egress — projected node perimeter facing the Brain Nexus. */
export function getLabAnchoredPoint(
  nodeId: SynapseNodeId,
  width: number,
  height: number,
): SynapsePoint {
  const brain = getBrainNexusCenter(width, height);
  return getProjectedPerimeterPoint(
    nodeId as FacilitySceneNodeId,
    brain,
    width,
    height,
  );
}

export function getNodePerimeterPoint(
  nodeId: SynapseNodeId,
  toward: SynapsePoint,
  width: number,
  height: number,
): SynapsePoint {
  const layout = getNodeLayout(nodeId);
  const cx = (layout.left / 100) * width;
  const cy = (layout.top / 100) * height;
  const r = layout.size * 0.44;
  const angle = Math.atan2(toward.y - cy, toward.x - cx);
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

export function getConduitCorridorConfig(edgeId?: string): EdgeCorridorConfig {
  if (edgeId && CONDUIT_CORRIDORS[edgeId]) {
    return CONDUIT_CORRIDORS[edgeId]!;
  }
  return SHOPIFY_CORRIDOR;
}

/** True conduit endpoints — lab node → Brain Core intake. */
export function resolveConduitEndpoints(
  agentId: SynapseNodeId,
  width: number,
  height: number,
): { from: SynapsePoint; to: SynapsePoint } | null {
  if (width <= 0 || height <= 0) return null;
  return {
    from: getLabAnchoredPoint(agentId, width, height),
    to: getBrainIntakePoint(agentId, width, height),
  };
}

/**
 * Orbital conduit spline — Shopify-style curved trajectory.
 * Lab-anchored start, Brain intake end, elegant orbital bow.
 */
export function computeOrbitalConduitPath(
  from: SynapsePoint,
  to: SynapsePoint,
  approachAngleDeg: number,
  config: EdgeCorridorConfig = SHOPIFY_CORRIDOR,
): string {
  const { spread, lane, sweep } = config;
  const angle = (approachAngleDeg * Math.PI) / 180;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const laneShift = lane * dist * 0.13;
  const orbit = spread * 0.26 * sweep;

  const c1x =
    from.x +
    dx * 0.22 +
    perpX * (orbit + laneShift) +
    Math.cos(angle) * dist * 0.04;
  const c1y =
    from.y +
    dy * 0.22 +
    perpY * (orbit + laneShift) +
    Math.sin(angle) * dist * 0.04;

  const c2x =
    to.x -
    dx * 0.14 -
    perpX * orbit * 0.38 +
    Math.cos(angle) * dist * 0.03;
  const c2y =
    to.y -
    dy * 0.14 -
    perpY * orbit * 0.38 +
    Math.sin(angle) * dist * 0.03;

  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

export function computeConnectionPath(
  fromId: SynapseNodeId,
  toId: SynapseNodeId,
  width: number,
  height: number,
  edgeId?: string,
): string | null {
  const agentId =
    toId === "brain" ? fromId : fromId === "brain" ? toId : null;
  if (!agentId || agentId === "brain") return null;

  const endpoints = resolveConduitEndpoints(agentId, width, height);
  if (!endpoints) return null;

  const approachDeg = BRAIN_PORT_DEGREES[agentId] ?? -90;
  const corridor = getConduitCorridorConfig(edgeId ?? `${agentId}-brain`);

  return computeOrbitalConduitPath(
    endpoints.from,
    endpoints.to,
    approachDeg,
    corridor,
  );
}

/** @deprecated Use computeOrbitalConduitPath. */
export function computeNeuralSplinePath(
  from: SynapsePoint,
  to: SynapsePoint,
  approachAngleDeg: number,
  config?: EdgeCorridorConfig,
): string {
  return computeOrbitalConduitPath(from, to, approachAngleDeg, config);
}

/** @deprecated Use resolveConduitEndpoints. */
export function resolveConnectionPoints(
  fromId: SynapseNodeId,
  toId: SynapseNodeId,
  width: number,
  height: number,
): { from: SynapsePoint; to: SynapsePoint; approachId?: SynapseNodeId } | null {
  const agentId =
    toId === "brain" ? fromId : fromId === "brain" ? toId : null;
  if (!agentId || agentId === "brain") return null;
  const endpoints = resolveConduitEndpoints(agentId, width, height);
  if (!endpoints) return null;
  return { ...endpoints, approachId: agentId };
}

/** @deprecated */
export function getBrainEmergenceMask(
  width: number,
  height: number,
): { cx: number; cy: number; rx: number; ry: number } {
  const center = getBrainCenter(width, height);
  const layout = getNodeLayout("brain");
  return {
    cx: center.x,
    cy: center.y,
    rx: layout.size * 0.32,
    ry: layout.size * 0.28,
  };
}

/** @deprecated */
export function getBrainHiddenHub(width: number, height: number): SynapsePoint {
  return getBrainCenter(width, height);
}

function deriveLabFlowMode(opsState: LabOpsState): SynapseFlowMode {
  if (opsState === "error") return "error";
  if (opsState === "executing") return "to-brain";
  if (opsState === "approved") return "from-brain";
  return "ambient";
}

function deriveEdgeFlowMode(
  edge: SynapseEdgeDef,
  labStates: Record<SynapseNodeId, LabOpsState | undefined>,
): SynapseFlowMode {
  if (edge.kind === "context") {
    return deriveLabFlowMode(labStates[edge.from] ?? "idle");
  }

  const fromState = labStates[edge.from] ?? "idle";
  const toState = labStates[edge.to] ?? "idle";
  if (fromState === "error" || toState === "error") return "error";
  if (fromState === "executing" || toState === "executing") return "to-brain";
  if (fromState === "approved" || toState === "approved") return "from-brain";
  return "ambient";
}

export function computeSynapseEdges(
  width: number,
  height: number,
  labStates: Record<SynapseNodeId, LabOpsState | undefined>,
): SynapseEdgeComputed[] {
  if (width <= 0 || height <= 0) return [];

  const edges: SynapseEdgeComputed[] = [];

  for (const edge of SYNAPSE_EDGES) {
    const endpoints = resolveConduitEndpoints(edge.from, width, height);
    if (!endpoints) continue;

    const approachDeg = BRAIN_PORT_DEGREES[edge.from] ?? -90;
    const corridor = getConduitCorridorConfig(edge.id);
    const path = computeOrbitalConduitPath(
      endpoints.from,
      endpoints.to,
      approachDeg,
      corridor,
    );

    const flowMode = deriveEdgeFlowMode(edge, labStates);

    edges.push({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      path,
      start: endpoints.from,
      end: endpoints.to,
      depthLayer: getNodeLayout(edge.from).depth,
      flowMode,
      active: flowMode !== "ambient",
      flowTowardBrain: flowMode !== "from-brain",
    });
  }

  return edges;
}

export function buildLabStateMap(
  labs: Record<FacilityLabId, { opsState: LabOpsState }>,
): Record<SynapseNodeId, LabOpsState> {
  return {
    brain: "idle",
    ceo: labs.ceo.opsState,
    research: labs.research.opsState,
    designer: labs.designer.opsState,
    marketing: labs.marketing.opsState,
    content: labs.content.opsState,
    image: labs.image.opsState,
    shopify: labs.shopify.opsState,
    operations: PLACEHOLDER_LABS.operations.opsState,
    commerce: PLACEHOLDER_LABS.commerce.opsState,
    analytics: PLACEHOLDER_LABS.analytics.opsState,
  };
}
