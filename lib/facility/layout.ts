import type { FacilityNodeLayout } from "@/lib/facility/types";

/**
 * Sector-based facility layout (% of scene canvas).
 * Brain anchors center; departments cluster in named zones.
 */
export const FACILITY_NODE_LAYOUT: FacilityNodeLayout[] = [
  { id: "brain", left: 50, top: 50, size: 313, zone: "command" },
  { id: "ceo", left: 50, top: 13, size: 190, zone: "command" },
  { id: "research", left: 9, top: 30, size: 172, zone: "research" },
  { id: "analytics", left: 9, top: 58, size: 172, zone: "research" },
  { id: "marketing", left: 91, top: 30, size: 172, zone: "marketing" },
  { id: "image", left: 91, top: 58, size: 172, zone: "marketing" },
  { id: "designer", left: 20, top: 86, size: 172, zone: "design" },
  { id: "content", left: 36, top: 86, size: 172, zone: "design" },
  { id: "commerce", left: 58, top: 86, size: 172, zone: "commerce" },
  { id: "shopify", left: 74, top: 86, size: 172, zone: "commerce" },
  { id: "operations", left: 90, top: 86, size: 172, zone: "operations" },
];

export const FACILITY_ZONES = [
  { id: "command", label: "CEO Command", left: 50, top: 4 },
  { id: "research", label: "Research", left: 6, top: 18 },
  { id: "marketing", label: "Marketing", left: 94, top: 18 },
  { id: "design", label: "Design", left: 22, top: 96 },
  { id: "commerce", label: "Commerce", left: 66, top: 96 },
] as const;

export function getNodeLayout(
  id: FacilityNodeLayout["id"],
): FacilityNodeLayout {
  const layout = FACILITY_NODE_LAYOUT.find((node) => node.id === id);
  if (!layout) {
    throw new Error(`Unknown facility node: ${id}`);
  }
  return layout;
}
