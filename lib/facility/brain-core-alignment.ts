/** Shared Brain Core node geometry — Shopify Operations is the alignment reference. */

export const BRAIN_CHAMBER_SIZE = 630;
export const BRAIN_NODE_RADIUS = 252;
export const BRAIN_INTEL_ORBIT_RADIUS = 186;
export const BRAIN_FEEDBACK_ORBIT_RADIUS = 208;
export const BRAIN_COMMAND_RING_RADIUS = BRAIN_NODE_RADIUS - 6;

/** Identical dot diameter for every agent node. */
export const BRAIN_NODE_DOT_PX = 10;

/** Identical orbit glow radius (Shopify reference). */
export const BRAIN_NODE_ORBIT_GLOW_PX = 58;

/** Identical halo radius when live-active. */
export const BRAIN_NODE_HALO_PX = 38;

/** Identical aura ring diameter. */
export const BRAIN_NODE_AURA_PX = 28;

/** Lines terminate at dot center — no edge trim. */
export const BRAIN_NODE_EDGE_TRIM = 0;

/** CEO glow intensity scale (~10% reduction). */
export const BRAIN_CEO_GLOW_SCALE = 0.9;

export type BrainCoreAgentNodeId =
  | "ceo"
  | "research"
  | "commerce"
  | "designer"
  | "marketing"
  | "content"
  | "image"
  | "shopify";

/**
 * Fine-tune offsets from the orbital anchor (px).
 * Shopify stays at (0, 0) — all other nodes align to the same rules.
 */
export const BRAIN_NODE_ALIGN_OFFSETS: Record<
  BrainCoreAgentNodeId,
  { x: number; y: number }
> = {
  ceo: { x: 0, y: 0 },
  research: { x: 0, y: 0 },
  commerce: { x: 0, y: 0 },
  designer: { x: 0, y: 0 },
  marketing: { x: 0, y: -5 },
  content: { x: 0, y: -5 },
  image: { x: 5, y: 0 },
  shopify: { x: 0, y: 0 },
};

export function brainChamberCenter(chamberSize = BRAIN_CHAMBER_SIZE): number {
  return chamberSize / 2;
}

export function brainNodeCenter(
  angleDeg: number,
  agentId?: BrainCoreAgentNodeId,
  chamberSize = BRAIN_CHAMBER_SIZE,
  nodeRadius = BRAIN_NODE_RADIUS,
): { x: number; y: number } {
  const center = brainChamberCenter(chamberSize);
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const base = {
    x: center + nodeRadius * Math.cos(rad),
    y: center + nodeRadius * Math.sin(rad),
  };
  if (!agentId) return base;
  const offset = BRAIN_NODE_ALIGN_OFFSETS[agentId];
  return { x: base.x + offset.x, y: base.y + offset.y };
}
