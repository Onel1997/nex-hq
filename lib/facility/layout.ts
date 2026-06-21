import type {
  FacilityDepthLayer,
  FacilityNodeLayout,
  FacilitySceneNodeId,
} from "@/lib/facility/types";

/** Reference canvas for orbital spatial math (px → %). */
const ORBIT_REF = { width: 1100, height: 880 } as const;

/**
 * Brain anchor — center of gravity, slightly below viewport midpoint.
 * Raised ~100px from Phase J to open the lower arc for Mission Control.
 */
const BRAIN_CENTER = { left: 50, top: 40 } as const;

/** Orbital distance from Brain center (px). Target: 260–340. */
export const FACILITY_ORBIT_RADIUS_PX = 480;

/** CEO command platform — north pole above the Nexus (px). */
export const FACILITY_CEO_ABOVE_BRAIN_PX = 325;

/** No chamber may sit in the column beneath the Brain. */
export const BRAIN_UNDERNEATH_EXCLUSION_X_PX = 210;

interface OrbitalSlot {
  id: FacilitySceneNodeId;
  offsetX: number;
  offsetY: number;
  size: number;
  depth: FacilityDepthLayer;
  zone: FacilityNodeLayout["zone"];
  tier: FacilityNodeLayout["tier"];
}

function nodeOffsetPx(
  offsetX: number,
  offsetY: number,
): { left: number; top: number } {
  const cx = (BRAIN_CENTER.left / 100) * ORBIT_REF.width;
  const cy = (BRAIN_CENTER.top / 100) * ORBIT_REF.height;
  return {
    left: Math.round(((cx + offsetX) / ORBIT_REF.width) * 1000) / 10,
    top: Math.round(((cy + offsetY) / ORBIT_REF.height) * 1000) / 10,
  };
}

function ceoStackPercent(): { left: number; top: number } {
  const cy = (BRAIN_CENTER.top / 100) * ORBIT_REF.height;
  return {
    left: BRAIN_CENTER.left,
    top:
      Math.round(
        ((cy - FACILITY_CEO_ABOVE_BRAIN_PX) / ORBIT_REF.height) * 1000,
      ) / 10,
  };
}

/**
 * Phase K — Orbital headquarters. Chambers wrap the Brain on a wide arc
 * from left to right; nothing sits beneath the Nexus.
 *
 *                      CEO
 *
 *        Research      Analytics
 *
 *  Design                          Image
 *
 *             BRAIN NEXUS
 *
 *  Content                        Marketing
 *
 *       Shopify        Commerce
 *
 *                 Operations
 *
 * Marketing mirrors Content on the lower arc (left / right balance).
 * Shopify, Commerce, and Operations sweep the lower-right wing.
 * The column beneath Brain center stays empty for Mission Control.
 *
 * Vertical zones:
 *   TOP          — CEO
 *   UPPER LEFT   — Research, Analytics
 *   UPPER RIGHT  — Image, Marketing
 *   LOWER LEFT   — Design, Content
 *   LOWER RIGHT  — Shopify, Commerce, Operations
 *
 * Depth (scale 0.85 → 1.0):
 *   foreground — Content, Commerce, Operations
 *   midground  — Brain, CEO, Design, Shopify
 *   background — Research, Marketing, Analytics, Image
 */
const ORBITAL_SLOTS: OrbitalSlot[] = [
  {
    id: "brain",
    offsetX: 0,
    offsetY: 0,
    size: 310,
    depth: "midground",
    zone: "command",
    tier: "command",
  },
  {
    id: "ceo",
    offsetX: 0,
    offsetY: -FACILITY_CEO_ABOVE_BRAIN_PX,
    size: 235,
    depth: "midground",
    zone: "command",
    tier: "command",
  },

  /* Upper left arc */
  {
    id: "research",
    offsetX: -620,
    offsetY: -320,
    size: 195,
    depth: "background",
    zone: "research",
    tier: "primary",
  },
  {
    id: "analytics",
    offsetX: -370,
    offsetY: -40,
    size: 190,
    depth: "background",
    zone: "research",
    tier: "support",
  },

  /* Upper right arc */
  {
    id: "image",
    offsetX: -500,
    offsetY: 240,
    size: 195,
    depth: "background",
    zone: "marketing",
    tier: "support",
  },
  {
    id: "marketing",
    offsetX: 620,
    offsetY: -40,
    size: 195,
    depth: "background",
    zone: "marketing",
    tier: "primary",
  },

  /* Lower left arc */
  {
    id: "designer",
    offsetX: -370,
    offsetY: -320,
    size: 195,
    depth: "midground",
    zone: "design",
    tier: "primary",
  },
  {
    id: "content",
    offsetX: -620,
    offsetY: -40,
    size: 200,
    depth: "foreground",
    zone: "design",
    tier: "support",
  },

  /* Lower right arc — sweeps around Brain; column beneath Nexus stays empty */
  {
    id: "shopify",
    offsetX: 370,
    offsetY: -320,
    size: 190,
    depth: "midground",
    zone: "commerce",
    tier: "peripheral",
  },
  {
    id: "commerce",
    offsetX: 370,
    offsetY: -40,
    size: 200,
    depth: "foreground",
    zone: "commerce",
    tier: "peripheral",
  },
  {
    id: "operations",
    offsetX: 620,
    offsetY: -320,
    size: 195,
    depth: "foreground",
    zone: "operations",
    tier: "peripheral",
  },
];

export const FACILITY_NODE_LAYOUT: FacilityNodeLayout[] = ORBITAL_SLOTS.map(
  (slot) => ({
    id: slot.id,
    ...(slot.id === "ceo"
      ? ceoStackPercent()
      : slot.id === "brain"
        ? { left: BRAIN_CENTER.left, top: BRAIN_CENTER.top }
        : nodeOffsetPx(slot.offsetX, slot.offsetY)),
    size: slot.size,
    zone: slot.zone,
    depth: slot.depth,
    tier: slot.tier,
  }),
);

/** Environment illumination anchor — matches Neural Nexus layout position. */
export const NEXUS_ENVIRONMENT_ANCHOR = {
  left: BRAIN_CENTER.left,
  top: BRAIN_CENTER.top,
} as const;

/** Overview camera — single cinematic shot of the full orbital ring. */
export const FACILITY_HERO_SCALE = 0.62;

/** Global composition pan — Brain as center of gravity with HUD below. */
export const FACILITY_COMPOSITION_OFFSET = { x: 0, y: -1 } as const;

/** Parallax strength per depth plane (px per normalized pointer delta). */
export const DEPTH_PARALLAX_FACTOR: Record<FacilityDepthLayer, number> = {
  foreground: 12,
  midground: 6,
  background: 3,
};

/** 3D atmosphere — foreground 1.0, midground ~0.92, background 0.85. */
export const DEPTH_ATMOSPHERE: Record<
  FacilityDepthLayer,
  { translateZ: number; scale: number; zBias: number }
> = {
  foreground: { translateZ: 48, scale: 1, zBias: 4 },
  midground: { translateZ: 0, scale: 0.92, zBias: 2 },
  background: { translateZ: -80, scale: 0.85, zBias: 0 },
};

/** Scene stacking — Brain visible; CEO command platform on top. */
export const FACILITY_NODE_Z_INDEX: Partial<Record<FacilitySceneNodeId, number>> =
  {
    brain: 10,
    ceo: 14,
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

export function nodeSceneZIndex(
  id: FacilitySceneNodeId,
  layout: FacilityNodeLayout,
  activityBoost = 0,
): number {
  const pinned = FACILITY_NODE_Z_INDEX[id];
  if (pinned != null) return pinned + activityBoost;
  const atmosphere = depthAtmosphere(layout.depth);
  return 3 + atmosphere.zBias + activityBoost;
}

/**
 * Semicircular orbital arc for debug / ring visuals — wraps L→R, open beneath Brain.
 */
export function getOrbitRingPositions(
  radiusPx = FACILITY_ORBIT_RADIUS_PX,
): Array<{ left: number; top: number }> {
  const arcStartDeg = 155;
  const arcEndDeg = 385;
  const steps = 14;
  return Array.from({ length: steps }, (_, i) => {
    const angleDeg = arcStartDeg + ((arcEndDeg - arcStartDeg) * i) / (steps - 1);
    const rad = (angleDeg * Math.PI) / 180;
    return nodeOffsetPx(radiusPx * Math.cos(rad), radiusPx * Math.sin(rad));
  });
}
