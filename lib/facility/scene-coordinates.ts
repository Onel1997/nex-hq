import { depthAtmosphere, getNodeLayout } from "@/lib/facility/layout";
import type { FacilityDepthLayer, FacilitySceneNodeId } from "@/lib/facility/types";
import type { SynapsePoint } from "@/lib/facility/graph";

/** Matches `.facility-scene-canvas` perspective and transform-origin. */
const SCENE_PERSPECTIVE = 1200;
const SCENE_ORIGIN_X_RATIO = 0.5;
const SCENE_ORIGIN_Y_RATIO = 0.44;

/** Brain wrap includes knowledge panel — nexus sits above the wrap center. */
const BRAIN_NEXUS_OFFSET_Y_RATIO = 0.12;

export interface SceneNodeFrame {
  id: FacilitySceneNodeId;
  layoutCenter: SynapsePoint;
  projectedCenter: SynapsePoint;
  projectedRadius: number;
  depthLayer: FacilityDepthLayer;
}

function layoutCenter(
  id: FacilitySceneNodeId,
  width: number,
  height: number,
): SynapsePoint {
  const layout = getNodeLayout(id);
  return {
    x: (layout.left / 100) * width,
    y: (layout.top / 100) * height,
  };
}

/**
 * Project a layout-space point through the same 3D depth transform applied to
 * `.facility-scene-node-wrap` elements (translateZ + scale).
 */
export function projectDepthPoint(
  point: SynapsePoint,
  width: number,
  height: number,
  depth: FacilityDepthLayer,
): SynapsePoint {
  const { translateZ, scale } = depthAtmosphere(depth);
  const originX = width * SCENE_ORIGIN_X_RATIO;
  const originY = height * SCENE_ORIGIN_Y_RATIO;
  const factor = SCENE_PERSPECTIVE / (SCENE_PERSPECTIVE - translateZ);

  return {
    x: originX + (point.x - originX) * factor,
    y: originY + (point.y - originY) * factor,
  };
}

/** Visual Brain Nexus center — not the full wrap centroid. */
export function getBrainNexusCenter(
  width: number,
  height: number,
): SynapsePoint {
  const layout = getNodeLayout("brain");
  const wrapCenter = layoutCenter("brain", width, height);
  const offsetY = layout.size * BRAIN_NEXUS_OFFSET_Y_RATIO;
  const nexusLayout = {
    x: wrapCenter.x,
    y: wrapCenter.y - offsetY,
  };
  return projectDepthPoint(nexusLayout, width, height, layout.depth);
}

export function getSceneNodeFrame(
  nodeId: FacilitySceneNodeId,
  width: number,
  height: number,
): SceneNodeFrame {
  const layout = getNodeLayout(nodeId);
  const center = layoutCenter(nodeId, width, height);
  const projectedCenter = projectDepthPoint(center, width, height, layout.depth);
  const { scale } = depthAtmosphere(layout.depth);
  const factor =
    SCENE_PERSPECTIVE /
    (SCENE_PERSPECTIVE - depthAtmosphere(layout.depth).translateZ);
  const projectedRadius = layout.size * 0.44 * scale * factor;

  return {
    id: nodeId,
    layoutCenter: center,
    projectedCenter,
    projectedRadius,
    depthLayer: layout.depth,
  };
}

export function getProjectedPerimeterPoint(
  nodeId: FacilitySceneNodeId,
  toward: SynapsePoint,
  width: number,
  height: number,
): SynapsePoint {
  const frame = getSceneNodeFrame(nodeId, width, height);
  const { projectedCenter, projectedRadius } = frame;
  const angle = Math.atan2(
    toward.y - projectedCenter.y,
    toward.x - projectedCenter.x,
  );
  return {
    x: projectedCenter.x + projectedRadius * Math.cos(angle),
    y: projectedCenter.y + projectedRadius * Math.sin(angle),
  };
}

export function getProjectedBrainPortPoint(
  connectingNodeId: FacilitySceneNodeId,
  width: number,
  height: number,
  portDegrees: Partial<Record<FacilitySceneNodeId, number>>,
): SynapsePoint {
  const nexus = getBrainNexusCenter(width, height);
  const layout = getNodeLayout("brain");
  const angleDeg = portDegrees[connectingNodeId] ?? -90;
  const angle = (angleDeg * Math.PI) / 180;
  const { scale } = depthAtmosphere(layout.depth);
  const factor =
    SCENE_PERSPECTIVE /
    (SCENE_PERSPECTIVE - depthAtmosphere(layout.depth).translateZ);
  const rx = layout.size * 0.44 * scale * factor;
  const ry = layout.size * 0.4 * scale * factor;
  return {
    x: nexus.x + rx * Math.cos(angle),
    y: nexus.y + ry * Math.sin(angle),
  };
}

export function parseCubicPath(path: string): {
  start: SynapsePoint;
  c1: SynapsePoint;
  c2: SynapsePoint;
  end: SynapsePoint;
} | null {
  const match = path.match(
    /^M\s*([\d.]+)\s+([\d.]+)\s+C\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)$/,
  );
  if (!match) return null;
  return {
    start: { x: Number(match[1]), y: Number(match[2]) },
    c1: { x: Number(match[3]), y: Number(match[4]) },
    c2: { x: Number(match[5]), y: Number(match[6]) },
    end: { x: Number(match[7]), y: Number(match[8]) },
  };
}
