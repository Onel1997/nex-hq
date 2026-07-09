import type { Rect } from "@/lib/design/design-library/types";
import type { HierarchyPlan } from "@/lib/design/design-library/composition/premium/hierarchy";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export interface NegativeSpaceField {
  /** Reserved void around primary focal — do not populate. */
  primaryVoid: Rect;
  /** Upper breathing margin ratio of safe zone. */
  topBreath: number;
  /** Lower breathing margin ratio. */
  bottomBreath: number;
  /** Lateral asymmetry — more void on one side. */
  lateralBias: number;
  densityCap: number;
}

/** Treats empty space as an active design element. */
export function buildNegativeSpaceField(
  safeZone: Rect,
  plan: HierarchyPlan,
  seed: number,
  negativeSpaceBias: number,
): NegativeSpaceField {
  const breath = 0.1 + negativeSpaceBias * 0.14;
  const voidW = plan.primary.scale * range(seed, 101, 0.55, 0.72);
  const voidH = plan.primary.scale * range(seed, 103, 0.48, 0.65);

  const primaryVoid: Rect = {
    x: snap(plan.primary.x - voidW / 2),
    y: snap(plan.primary.y - voidH / 2),
    width: voidW,
    height: voidH,
  };

  return {
    primaryVoid,
    topBreath: breath + range(seed, 105, 0, 0.06),
    bottomBreath: breath + range(seed, 107, 0.02, 0.08),
    lateralBias: range(seed, 109, -0.12, 0.12),
    densityCap: Math.round(5 + negativeSpaceBias * 4),
  };
}

export function pointInsideVoid(x: number, y: number, field: NegativeSpaceField): boolean {
  const v = field.primaryVoid;
  return x >= v.x && x <= v.x + v.width && y >= v.y && y <= v.y + v.height;
}

/** Nudges a point away from the primary void if it would crowd the focal area. */
export function respectNegativeSpace(
  x: number,
  y: number,
  field: NegativeSpaceField,
  seed: number,
  index: number,
): { x: number; y: number } {
  if (!pointInsideVoid(x, y, field)) return { x, y };
  const push = field.primaryVoid.width * 0.12;
  const dir = range(seed, 120 + index, -1, 1);
  return {
    x: snap(x + push * dir),
    y: snap(y + push * range(seed, 130 + index, -0.4, 0.4)),
  };
}
