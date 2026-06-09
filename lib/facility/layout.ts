import type { FacilityNodeLayout } from "@/lib/facility/types";

/** Normalized orbital positions (% of scene). Brain is always center. */
export const FACILITY_NODE_LAYOUT: FacilityNodeLayout[] = [
  { id: "brain", left: 50, top: 50, size: 368 },
  { id: "ceo", left: 50, top: 20, size: 158 },
  { id: "research", left: 16, top: 38, size: 120 },
  { id: "designer", left: 32, top: 72, size: 120 },
  { id: "marketing", left: 68, top: 72, size: 120 },
  { id: "content", left: 50, top: 84, size: 120 },
  { id: "image", left: 84, top: 38, size: 120 },
  { id: "shopify", left: 10, top: 68, size: 120 },
];

export function getNodeLayout(
  id: FacilityNodeLayout["id"],
): FacilityNodeLayout {
  const layout = FACILITY_NODE_LAYOUT.find((node) => node.id === id);
  if (!layout) {
    throw new Error(`Unknown facility node: ${id}`);
  }
  return layout;
}
