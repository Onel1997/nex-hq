import type {
  FacilityDepthLayer,
  FacilityNodeLayout,
  FacilitySceneNodeId,
} from "@/lib/facility/types";

/** Reference canvas for converting orbital px → layout %. */
const ORBIT_REF = { width: 1000, height: 720 } as const;

/** Brain-center to chamber-center distance (px). Target: 220–280. */
export const FACILITY_ORBIT_RADIUS_PX = 250;

/** Command stack — Brain (sun) + CEO (north pole). */
const BRAIN_CENTER = { left: 50, top: 41 } as const;

function orbitPercent(
  angleDeg: number,
  radiusPx = FACILITY_ORBIT_RADIUS_PX,
): { left: number; top: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cx = (BRAIN_CENTER.left / 100) * ORBIT_REF.width;
  const cy = (BRAIN_CENTER.top / 100) * ORBIT_REF.height;
  const x = cx + radiusPx * Math.cos(rad);
  const y = cy + radiusPx * Math.sin(rad);
  return {
    left: Math.round((x / ORBIT_REF.width) * 1000) / 10,
    top: Math.round((y / ORBIT_REF.height) * 1000) / 10,
  };
}

/**
 * Planetary AI layout — Brain at center, CEO above, labs on balanced orbits.
 *
 *                    CEO (50, 16)
 *                        │
 *         Analytics    Brain    Image
 *            ╲         (50,41)      ╱
 *     Research ─────────┼───────── Marketing
 *                        │
 *          Design    Operations    Shopify
 *            ╲         │           ╱
 *           Content ──┴── Commerce
 *
 * Upper orbit (205°→335°): Research · Analytics · Image · Marketing
 * Lower orbit (155°→25°):  Design · Content · Operations · Commerce · Shopify
 */
export const FACILITY_NODE_LAYOUT: FacilityNodeLayout[] = [
  {
    id: "brain",
    left: BRAIN_CENTER.left,
    top: BRAIN_CENTER.top,
    size: 328,
    zone: "command",
    depth: "midground",
    tier: "command",
  },
  {
    id: "ceo",
    left: 50,
    top: 16,
    size: 220,
    zone: "command",
    depth: "midground",
    tier: "command",
  },

  /* Upper orbit */
  {
    id: "research",
    ...orbitPercent(205),
    size: 180,
    zone: "research",
    depth: "midground",
    tier: "primary",
  },
  {
    id: "analytics",
    ...orbitPercent(235),
    size: 155,
    zone: "research",
    depth: "foreground",
    tier: "support",
  },
  {
    id: "image",
    ...orbitPercent(305),
    size: 165,
    zone: "marketing",
    depth: "foreground",
    tier: "support",
  },
  {
    id: "marketing",
    ...orbitPercent(335),
    size: 180,
    zone: "marketing",
    depth: "midground",
    tier: "primary",
  },

  /* Lower orbit */
  {
    id: "designer",
    ...orbitPercent(155),
    size: 170,
    zone: "design",
    depth: "background",
    tier: "peripheral",
  },
  {
    id: "content",
    ...orbitPercent(125),
    size: 160,
    zone: "design",
    depth: "background",
    tier: "support",
  },
  {
    id: "operations",
    ...orbitPercent(88),
    size: 145,
    zone: "operations",
    depth: "background",
    tier: "peripheral",
  },
  {
    id: "commerce",
    ...orbitPercent(55),
    size: 145,
    zone: "commerce",
    depth: "background",
    tier: "peripheral",
  },
  {
    id: "shopify",
    ...orbitPercent(25),
    size: 160,
    zone: "commerce",
    depth: "background",
    tier: "peripheral",
  },
];

/** Environment illumination anchor — matches Neural Nexus layout position. */
export const NEXUS_ENVIRONMENT_ANCHOR = {
  left: BRAIN_CENTER.left,
  top: BRAIN_CENTER.top,
} as const;

/** Overview camera — tighter framing for orbital composition. */
export const FACILITY_HERO_SCALE = 0.74;

/** Global composition pan — centers the planetary system in viewport. */
export const FACILITY_COMPOSITION_OFFSET = { x: 0, y: -2.5 } as const;

/** 3D atmosphere offsets per depth plane. */
export const DEPTH_ATMOSPHERE: Record<
  FacilityDepthLayer,
  { translateZ: number; scale: number; zBias: number }
> = {
  foreground: { translateZ: 40, scale: 1.02, zBias: 3 },
  midground: { translateZ: 0, scale: 1, zBias: 2 },
  background: { translateZ: -56, scale: 0.93, zBias: 0 },
};

const FALLBACK_NODE_LAYOUT: FacilityNodeLayout = {
  id: "brain",
  left: 50,
  top: 50,
  size: 120,
  zone: "command",
  depth: "midground",
  tier: "command",
};

const warnedUnknownNodes = new Set<string>();

export function isFacilitySceneNodeId(id: string): id is FacilitySceneNodeId {
  return FACILITY_NODE_LAYOUT.some((node) => node.id === id);
}

export function getNodeLayout(id: string): FacilityNodeLayout {
  const layout = FACILITY_NODE_LAYOUT.find((node) => node.id === id);
  if (layout) return layout;

  if (!warnedUnknownNodes.has(id)) {
    warnedUnknownNodes.add(id);
    console.warn(
      `[facility] Unknown node layout "${id}" — using fallback position`,
    );
  }
  return FALLBACK_NODE_LAYOUT;
}

export function depthAtmosphere(depth: FacilityDepthLayer) {
  return DEPTH_ATMOSPHERE[depth];
}

/** Orbital positions for debug / future ring visuals. */
export function getOrbitRingPositions(
  radiusPx = FACILITY_ORBIT_RADIUS_PX,
): Array<{ left: number; top: number }> {
  return Array.from({ length: 12 }, (_, i) =>
    orbitPercent((i / 12) * 360, radiusPx),
  );
}
