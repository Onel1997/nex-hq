import { getNodeLayout } from "@/lib/facility/layout";
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
}

/** Curved synapse connections — no straight lines. */
export const SYNAPSE_EDGES: SynapseEdgeDef[] = [
  { id: "ceo-brain", from: "ceo", to: "brain", kind: "report-up" },
  { id: "research-brain", from: "research", to: "brain", kind: "context" },
  { id: "designer-brain", from: "designer", to: "brain", kind: "context" },
  { id: "marketing-brain", from: "marketing", to: "brain", kind: "context" },
  { id: "content-brain", from: "content", to: "brain", kind: "context" },
  { id: "image-brain", from: "image", to: "brain", kind: "context" },
  { id: "shopify-brain", from: "shopify", to: "brain", kind: "context" },
  { id: "ceo-research", from: "ceo", to: "research", kind: "report-up" },
  { id: "ceo-designer", from: "ceo", to: "designer", kind: "report-up" },
  { id: "ceo-marketing", from: "ceo", to: "marketing", kind: "report-up" },
  { id: "ceo-content", from: "ceo", to: "content", kind: "report-up" },
  { id: "ceo-image", from: "ceo", to: "image", kind: "report-up" },
  { id: "ceo-shopify", from: "ceo", to: "shopify", kind: "report-up" },
  { id: "research-designer", from: "research", to: "designer", kind: "pipeline" },
  { id: "designer-marketing", from: "designer", to: "marketing", kind: "pipeline" },
  { id: "marketing-content", from: "marketing", to: "content", kind: "pipeline" },
  { id: "content-image", from: "content", to: "image", kind: "pipeline" },
  { id: "operations-brain", from: "operations", to: "brain", kind: "context" },
  { id: "commerce-brain", from: "commerce", to: "brain", kind: "context" },
  { id: "analytics-brain", from: "analytics", to: "brain", kind: "context" },
  { id: "ceo-operations", from: "ceo", to: "operations", kind: "report-up" },
  { id: "ceo-commerce", from: "ceo", to: "commerce", kind: "report-up" },
  { id: "ceo-analytics", from: "ceo", to: "analytics", kind: "report-up" },
  { id: "shopify-commerce", from: "shopify", to: "commerce", kind: "pipeline" },
  { id: "research-analytics", from: "research", to: "analytics", kind: "pipeline" },
];

export function layoutToPoint(
  id: SynapseNodeId,
  width: number,
  height: number,
): SynapsePoint {
  const layout = getNodeLayout(id);
  return {
    x: (layout.left / 100) * width,
    y: (layout.top / 100) * height,
  };
}

/** Quadratic bezier with perpendicular control offset for curved synapses. */
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

  // pipeline
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

  return SYNAPSE_EDGES.map((edge) => {
    const from = layoutToPoint(edge.from, width, height);
    const to = layoutToPoint(edge.to, width, height);
    const flowMode = deriveEdgeFlowMode(edge, labStates);
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      path: computeCurvedPath(from, to),
      flowMode,
      active: flowMode !== "ambient",
    };
  });
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
