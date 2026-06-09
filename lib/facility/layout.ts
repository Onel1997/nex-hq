import type { FacilityNodeLayout, FacilitySceneNodeId } from "@/lib/facility/types";

/**
 * Facility distribution — each lab owns a distinct territory across the HQ.
 *
 * Labs are spread into empty regions to break left/right clustering.
 * Center-left and center-right chambers (Analytics, Image) sit nearer leadership;
 * corner chambers (Research, Design, Marketing, Operations) feel distant.
 *
 *              CEO (50, 6)
 *           NEXUS (50, 26)
 *         ═══ protected void ═══
 *
 *  Research (5,10)                    Marketing (97,9)
 *
 *       Analytics (38,42)      Image (64,38)
 *
 *    Content (30,70)              Shopify (88,68)
 *
 *  Design (4,90)         Commerce (68,84)    Operations (96,88)
 */
export const FACILITY_NODE_LAYOUT: FacilityNodeLayout[] = [
  { id: "brain", left: 50, top: 26, size: 278, zone: "command" },
  { id: "ceo", left: 50, top: 6, size: 164, zone: "command" },

  { id: "research", left: 5, top: 10, size: 154, zone: "research" },
  { id: "analytics", left: 38, top: 42, size: 154, zone: "research" },
  { id: "content", left: 30, top: 70, size: 154, zone: "design" },
  { id: "designer", left: 4, top: 90, size: 154, zone: "design" },

  { id: "marketing", left: 97, top: 9, size: 154, zone: "marketing" },
  { id: "image", left: 64, top: 38, size: 154, zone: "marketing" },
  { id: "shopify", left: 88, top: 68, size: 154, zone: "commerce" },
  { id: "operations", left: 96, top: 88, size: 154, zone: "operations" },

  { id: "commerce", left: 68, top: 84, size: 154, zone: "commerce" },
];

export const FACILITY_ZONES = [
  { id: "command", label: "Command Core", left: 50, top: 1 },
  { id: "research", label: "Research", left: 3, top: 6 },
  { id: "marketing", label: "Marketing", left: 97, top: 5 },
  { id: "design", label: "Design", left: 3, top: 84 },
  { id: "commerce", label: "Commerce", left: 92, top: 78 },
] as const;

/** Default overview camera — zoomed out for expansive HQ hero shot. */
export const FACILITY_HERO_SCALE = 0.73;

const FALLBACK_NODE_LAYOUT: FacilityNodeLayout = {
  id: "brain",
  left: 50,
  top: 50,
  size: 120,
  zone: "command",
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
