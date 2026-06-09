import type {
  FacilityDepthLayer,
  FacilityNodeLayout,
  FacilitySceneNodeId,
} from "@/lib/facility/types";

/**
 * Facility distribution — layered HQ with depth, hierarchy, and scale variation.
 *
 * Depth planes (environment design):
 * - foreground: chambers orbiting close to the Neural Nexus
 * - midground: command core + major departments
 * - background: distant peripheral wings
 *
 * Hierarchy tiers:
 * - command: CEO + Brain (centerpiece)
 * - primary: Research, Marketing (major divisions)
 * - support: Analytics, Content, Image (adjacent specialists)
 * - peripheral: Design, Commerce, Operations (distant wings)
 *
 *              CEO (50, -2)
 *           NEXUS (47, 36)  ← intelligence engine
 *         ═══ protected void ═══
 *
 *  Research (5,10)     Analytics (25,8)
 *       [primary]         [support · bridge]
 *
 *                    Marketing (97,9)
 *                         [primary]
 *              Image (77,14)
 *              [support · marketing wing]
 *
 *    Content (30,70)              Shopify (88,68)
 *    [support · far]              [peripheral · far]
 *
 *  Design (4,90)         Commerce (73,88)    Operations (98,93)
 */
export const FACILITY_NODE_LAYOUT: FacilityNodeLayout[] = [
  {
    id: "brain",
    left: 47,
    top: 36,
    size: 318,
    zone: "command",
    depth: "midground",
    tier: "command",
  },
  {
    id: "ceo",
    left: 50,
    top: -2,
    size: 156,
    zone: "command",
    depth: "midground",
    tier: "command",
  },

  {
    id: "research",
    left: 5,
    top: 10,
    size: 186,
    zone: "research",
    depth: "midground",
    tier: "primary",
  },
  {
    id: "marketing",
    left: 97,
    top: 9,
    size: 186,
    zone: "marketing",
    depth: "midground",
    tier: "primary",
  },

  {
    id: "analytics",
    left: 25,
    top: 8,
    size: 124,
    zone: "research",
    depth: "foreground",
    tier: "support",
  },
  {
    id: "content",
    left: 30,
    top: 70,
    size: 128,
    zone: "design",
    depth: "background",
    tier: "support",
  },
  {
    id: "designer",
    left: 4,
    top: 90,
    size: 138,
    zone: "design",
    depth: "background",
    tier: "peripheral",
  },

  {
    id: "image",
    left: 77,
    top: 14,
    size: 148,
    zone: "marketing",
    depth: "foreground",
    tier: "support",
  },
  {
    id: "shopify",
    left: 88,
    top: 68,
    size: 134,
    zone: "commerce",
    depth: "background",
    tier: "peripheral",
  },
  {
    id: "operations",
    left: 98,
    top: 93,
    size: 126,
    zone: "operations",
    depth: "background",
    tier: "peripheral",
  },
  {
    id: "commerce",
    left: 73,
    top: 88,
    size: 130,
    zone: "commerce",
    depth: "background",
    tier: "peripheral",
  },
];

/** Environment illumination anchor — matches Neural Nexus layout position. */
export const NEXUS_ENVIRONMENT_ANCHOR = { left: 47, top: 38 } as const;

/** Default overview camera — zoomed out for expansive HQ hero shot. */
export const FACILITY_HERO_SCALE = 0.71;

/** Global composition pan — shifts the HQ as a whole without moving individual nodes. */
export const FACILITY_COMPOSITION_OFFSET = { x: -4, y: 0 } as const;

/** 3D atmosphere offsets per depth plane. */
export const DEPTH_ATMOSPHERE: Record<
  FacilityDepthLayer,
  { translateZ: number; scale: number; zBias: number }
> = {
  foreground: { translateZ: 52, scale: 1.03, zBias: 4 },
  midground: { translateZ: 0, scale: 1, zBias: 2 },
  background: { translateZ: -78, scale: 0.9, zBias: 0 },
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
