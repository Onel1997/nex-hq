import type { FacilityNodeLayout, FacilitySceneNodeId } from "@/lib/facility/types";

/**
 * Sector-based facility layout (% of scene canvas).
 * Hero composition: CEO → Neural Nexus → Agent Labs, all within safe viewport bounds.
 */
export const FACILITY_NODE_LAYOUT: FacilityNodeLayout[] = [
  { id: "brain", left: 50, top: 46, size: 272, zone: "command" },
  { id: "ceo", left: 50, top: 17, size: 168, zone: "command" },
  { id: "research", left: 14, top: 31, size: 158, zone: "research" },
  { id: "analytics", left: 14, top: 58, size: 158, zone: "research" },
  { id: "marketing", left: 86, top: 31, size: 158, zone: "marketing" },
  { id: "image", left: 86, top: 58, size: 158, zone: "marketing" },
  { id: "designer", left: 24, top: 79, size: 158, zone: "design" },
  { id: "content", left: 38, top: 79, size: 158, zone: "design" },
  { id: "commerce", left: 54, top: 79, size: 158, zone: "commerce" },
  { id: "shopify", left: 68, top: 79, size: 158, zone: "commerce" },
  { id: "operations", left: 82, top: 79, size: 158, zone: "operations" },
];

export const FACILITY_ZONES = [
  { id: "command", label: "CEO Command", left: 50, top: 8 },
  { id: "research", label: "Research", left: 10, top: 20 },
  { id: "marketing", label: "Marketing", left: 90, top: 20 },
  { id: "design", label: "Design", left: 26, top: 92 },
  { id: "commerce", label: "Commerce", left: 62, top: 92 },
] as const;

/** Default overview camera — zoomed out ~20% for full HQ hero shot. */
export const FACILITY_HERO_SCALE = 0.8;

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
