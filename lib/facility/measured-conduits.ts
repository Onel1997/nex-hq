import {
  BRAIN_PORT_DEGREES,
  computeOrbitalConduitPath,
  getConduitCorridorConfig,
  SYNAPSE_EDGES,
  type SynapseEdgeComputed,
  type SynapsePoint,
} from "@/lib/facility/graph";
import { getNodeLayout } from "@/lib/facility/layout";
import type { FacilitySceneNodeId, LabOpsState } from "@/lib/facility/types";
import type { SynapseNodeId } from "@/lib/facility/graph";

export interface MeasuredNodeFrame {
  id: FacilitySceneNodeId;
  center: SynapsePoint;
  radius: number;
}

export interface MeasuredSceneGeometry {
  brainNexus: MeasuredNodeFrame;
  nodes: Partial<Record<SynapseNodeId, MeasuredNodeFrame>>;
  ready: boolean;
}

export function rectToSvgFrame(
  id: FacilitySceneNodeId,
  rect: DOMRect,
  canvasRect: DOMRect,
): MeasuredNodeFrame {
  return {
    id,
    center: {
      x: rect.left + rect.width / 2 - canvasRect.left,
      y: rect.top + rect.height / 2 - canvasRect.top,
    },
    radius: Math.min(rect.width, rect.height) * 0.44,
  };
}

export function perimeterToward(
  center: SynapsePoint,
  radius: number,
  target: SynapsePoint,
): SynapsePoint {
  const angle = Math.atan2(target.y - center.y, target.x - center.x);
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  };
}

/** Intake inside the rendered Brain Nexus glow. */
export function brainIntakeFromMeasured(
  nexus: MeasuredNodeFrame,
  agentId: SynapseNodeId,
): SynapsePoint {
  const angleDeg = BRAIN_PORT_DEGREES[agentId] ?? -90;
  const angle = (angleDeg * Math.PI) / 180;
  const portR = nexus.radius * 0.92;
  const portX = nexus.center.x + portR * Math.cos(angle);
  const portY = nexus.center.y + portR * Math.sin(angle);
  const depth = 0.84;
  return {
    x: nexus.center.x + (portX - nexus.center.x) * depth,
    y: nexus.center.y + (portY - nexus.center.y) * depth,
  };
}

function deriveLabFlowMode(opsState: LabOpsState) {
  if (opsState === "error") return "error" as const;
  if (opsState === "executing") return "to-brain" as const;
  if (opsState === "approved") return "from-brain" as const;
  return "ambient" as const;
}

function deriveEdgeFlowMode(
  edge: (typeof SYNAPSE_EDGES)[number],
  labStates: Record<SynapseNodeId, LabOpsState | undefined>,
) {
  if (edge.kind === "context") {
    return deriveLabFlowMode(labStates[edge.from] ?? "idle");
  }
  const fromState = labStates[edge.from] ?? "idle";
  const toState = labStates[edge.to] ?? "idle";
  if (fromState === "error" || toState === "error") return "error" as const;
  if (fromState === "executing" || toState === "executing") return "to-brain" as const;
  if (fromState === "approved" || toState === "approved") return "from-brain" as const;
  return "ambient" as const;
}

export function computeSynapseEdgesFromMeasured(
  geometry: MeasuredSceneGeometry,
  labStates: Record<SynapseNodeId, LabOpsState | undefined>,
): SynapseEdgeComputed[] {
  if (!geometry.ready) return [];

  const { brainNexus, nodes } = geometry;
  const edges: SynapseEdgeComputed[] = [];

  for (const edge of SYNAPSE_EDGES) {
    const lab = nodes[edge.from];
    if (!lab) continue;

    const from = perimeterToward(lab.center, lab.radius, brainNexus.center);
    const to = brainIntakeFromMeasured(brainNexus, edge.from);
    const approachDeg = BRAIN_PORT_DEGREES[edge.from] ?? -90;
    const corridor = getConduitCorridorConfig(edge.id);
    const path = computeOrbitalConduitPath(from, to, approachDeg, corridor);
    const flowMode = deriveEdgeFlowMode(edge, labStates);

    edges.push({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      path,
      start: from,
      end: to,
      depthLayer: getNodeLayout(edge.from).depth,
      flowMode,
      active: flowMode !== "ambient",
      flowTowardBrain: flowMode !== "from-brain",
    });
  }

  return edges;
}
