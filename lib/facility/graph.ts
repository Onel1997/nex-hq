import { getNodeLayout, isFacilitySceneNodeId } from "@/lib/facility/layout";
import { PLACEHOLDER_LABS } from "@/lib/facility/placeholder-labs";
import type { FacilitySceneNodeId, FacilityLabId, LabOpsState } from "@/lib/facility/types";

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
  flowMode: SynapseFlowMode;
  active: boolean;
  /** Particle travel direction along the visual path. */
  flowTowardLab: boolean;
}

/**
 * Brain Core connection ports — each route terminates at a dedicated perimeter point.
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

/** Per-edge corridor spread — independent approach before convergence. */
const EDGE_APPROACH_SPREAD: Partial<Record<string, number>> = {
  "research-brain": 1.15,
  "analytics-brain": 0.85,
  "ceo-brain": 0.65,
  "image-brain": 1.05,
  "marketing-brain": 1.2,
  "shopify-brain": 1.1,
  "commerce-brain": 0.95,
  "content-brain": 1.15,
  "designer-brain": 1.25,
  "operations-brain": 0.9,
};

/** Meaningful knowledge streams only — lab↔Nexus and CEO command spine. */
export const SYNAPSE_EDGES: SynapseEdgeDef[] = [
  { id: "ceo-brain", from: "ceo", to: "brain", kind: "report-up" },
  { id: "research-brain", from: "research", to: "brain", kind: "context" },
  { id: "analytics-brain", from: "analytics", to: "brain", kind: "context" },
  { id: "designer-brain", from: "designer", to: "brain", kind: "context" },
  { id: "content-brain", from: "content", to: "brain", kind: "context" },
  { id: "marketing-brain", from: "marketing", to: "brain", kind: "context" },
  { id: "image-brain", from: "image", to: "brain", kind: "context" },
  { id: "shopify-brain", from: "shopify", to: "brain", kind: "context" },
  { id: "operations-brain", from: "operations", to: "brain", kind: "context" },
  { id: "commerce-brain", from: "commerce", to: "brain", kind: "context" },
];

export function layoutToPoint(
  id: SynapseNodeId | string,
  width: number,
  height: number,
): SynapsePoint | null {
  if (!isFacilitySceneNodeId(id)) {
    return null;
  }
  const layout = getNodeLayout(id);
  return {
    x: (layout.left / 100) * width,
    y: (layout.top / 100) * height,
  };
}

export function getBrainCenter(
  width: number,
  height: number,
): SynapsePoint {
  const layout = getNodeLayout("brain");
  return {
    x: (layout.left / 100) * width,
    y: (layout.top / 100) * height,
  };
}

/** Hidden routing hub — single convergence point behind the Brain surface. */
export function getBrainHiddenHub(
  width: number,
  height: number,
): SynapsePoint {
  return getBrainCenter(width, height);
}

/** Dedicated Brain Core port for the node that connects to it. */
export function getBrainPortPoint(
  connectingNodeId: SynapseNodeId | string,
  width: number,
  height: number,
): SynapsePoint {
  const layout = getNodeLayout("brain");
  const cx = (layout.left / 100) * width;
  const cy = (layout.top / 100) * height;
  const angleDeg = BRAIN_PORT_DEGREES[connectingNodeId as SynapseNodeId] ?? -90;
  const angle = (angleDeg * Math.PI) / 180;
  const rx = layout.size * 0.44;
  const ry = layout.size * 0.4;
  return {
    x: cx + rx * Math.cos(angle),
    y: cy + ry * Math.sin(angle),
  };
}

/** Exit/entry point on a node perimeter facing a target. */
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

/** Visual endpoints — streams emerge from the hidden hub toward each node. */
export function resolveConnectionPoints(
  fromId: SynapseNodeId,
  toId: SynapseNodeId,
  width: number,
  height: number,
): { from: SynapsePoint; to: SynapsePoint; approachId?: SynapseNodeId } | null {
  if (width <= 0 || height <= 0) return null;

  const hub = getBrainHiddenHub(width, height);

  if (toId === "brain") {
    return {
      from: hub,
      to: getNodePerimeterPoint(fromId, hub, width, height),
      approachId: fromId,
    };
  }

  if (fromId === "brain") {
    return {
      from: hub,
      to: getNodePerimeterPoint(toId, hub, width, height),
      approachId: toId,
    };
  }

  const from = layoutToPoint(fromId, width, height);
  const to = layoutToPoint(toId, width, height);
  if (!from || !to) return null;
  return { from, to };
}

/**
 * Curved emergence path — independent corridors radiating from the hidden hub
 * behind the Brain toward each destination.
 */
export function computeEmergenceRoutePath(
  from: SynapsePoint,
  to: SynapsePoint,
  approachAngleDeg: number,
  spread = 1,
): string {
  const angle = (approachAngleDeg * Math.PI) / 180;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;

  const c1x = from.x + Math.cos(angle) * dist * 0.12 * spread + dx * 0.1;
  const c1y = from.y + Math.sin(angle) * dist * 0.12 * spread + dy * 0.1;

  const c2x = to.x - dx * 0.3 - Math.cos(angle) * dist * 0.08 * spread;
  const c2y = to.y - dy * 0.3 - Math.sin(angle) * dist * 0.08 * spread;

  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

/** @deprecated Alias for emergence paths. */
export function computeConvergenceRoutePath(
  from: SynapsePoint,
  to: SynapsePoint,
  approachAngleDeg: number,
  spread = 1,
): string {
  return computeEmergenceRoutePath(from, to, approachAngleDeg, spread);
}

/** Quadratic fallback for non-brain connections. */
export function computeFacilityRoutePath(
  from: SynapsePoint,
  to: SynapsePoint,
  _brainCenter?: SynapsePoint,
  curvature = 0.1,
): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const cx = mx - dy * curvature;
  const cy = my + dx * curvature;
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

/** @deprecated Use computeFacilityRoutePath for brain connections. */
export function computeCurvedPath(
  from: SynapsePoint,
  to: SynapsePoint,
  curvature = 0.22,
): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const cx = mx - dy * curvature;
  const cy = my + dx * curvature;
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

export function computeConnectionPath(
  fromId: SynapseNodeId,
  toId: SynapseNodeId,
  width: number,
  height: number,
  edgeId?: string,
): string | null {
  const endpoints = resolveConnectionPoints(fromId, toId, width, height);
  if (!endpoints) return null;

  const involvesBrain = fromId === "brain" || toId === "brain";
  if (involvesBrain && endpoints.approachId) {
    const approachDeg =
      BRAIN_PORT_DEGREES[endpoints.approachId] ?? -90;
    const spread =
      (edgeId ? EDGE_APPROACH_SPREAD[edgeId] : undefined) ?? 1;
    return computeEmergenceRoutePath(
      endpoints.from,
      endpoints.to,
      approachDeg,
      spread,
    );
  }

  return computeFacilityRoutePath(
    endpoints.from,
    endpoints.to,
    undefined,
    0.18,
  );
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

  if (edge.kind === "report-up") {
    const fromState = labStates[edge.from] ?? "idle";
    const toState = labStates[edge.to] ?? "idle";
    if (fromState === "error" || toState === "error") return "error";
    if (fromState === "executing" || toState === "executing") return "to-brain";
    if (fromState === "approved" || toState === "approved") return "from-brain";
    return "ambient";
  }

  const upstream = labStates[edge.from] ?? "idle";
  if (upstream === "error") return "error";
  if (upstream === "executing") return "to-brain";
  if (upstream === "approved") return "from-brain";
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
    const path = computeConnectionPath(edge.from, edge.to, width, height, edge.id);
    if (!path) continue;

    const flowMode = deriveEdgeFlowMode(edge, labStates);
    const flowTowardLab =
      flowMode === "ambient" || flowMode === "from-brain";

    edges.push({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      path,
      flowMode,
      active: flowMode !== "ambient",
      flowTowardLab,
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
