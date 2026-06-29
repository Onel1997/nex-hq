import type { Rect } from "@/lib/design/design-library/types";
import type { FocalSystem } from "@/lib/design/design-library/composition-intelligence/focal-system";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export interface NegativeSpacePlan {
  /** Reserved void around primary focal — luxury breathing room. */
  primaryVoid: Rect;
  /** Large intentional void zones (luxury = empty space). */
  luxuryVoids: Rect[];
  topBreath: number;
  bottomBreath: number;
  lateralBias: number;
  densityCap: number;
  voidRatio: number;
}

/** Treats empty space as an active design element — large voids are luxury. */
export function buildNegativeSpacePlan(
  safeZone: Rect,
  focal: FocalSystem,
  seed: number,
  negativeSpaceBias: number,
): NegativeSpacePlan {
  const breath = 0.12 + negativeSpaceBias * 0.16;
  const voidW = focal.primary.scale * range(seed, 901, 0.58, 0.78);
  const voidH = focal.primary.scale * range(seed, 902, 0.5, 0.68);

  const primaryVoid: Rect = {
    x: snap(focal.primary.x - voidW / 2),
    y: snap(focal.primary.y - voidH / 2),
    width: voidW,
    height: voidH,
  };

  const luxuryVoids: Rect[] = [];
  const voidCount = 1 + Math.floor(negativeSpaceBias * 2);
  for (let i = 0; i < voidCount; i++) {
    const side = range(seed, 910 + i, 0, 1) > 0.5 ? "right" : "left";
    const w = safeZone.width * range(seed, 920 + i, 0.18, 0.32);
    const h = safeZone.height * range(seed, 930 + i, 0.22, 0.38);
    luxuryVoids.push({
      x: snap(side === "right" ? safeZone.x + safeZone.width - w - 8 : safeZone.x + 8),
      y: snap(safeZone.y + safeZone.height * range(seed, 940 + i, 0.08, 0.2)),
      width: w,
      height: h,
    });
  }

  const voidArea = primaryVoid.width * primaryVoid.height + luxuryVoids.reduce((s, v) => s + v.width * v.height, 0);
  const safeArea = safeZone.width * safeZone.height;
  const voidRatio = voidArea / safeArea;

  return {
    primaryVoid,
    luxuryVoids,
    topBreath: breath + range(seed, 905, 0, 0.08),
    bottomBreath: breath + range(seed, 906, 0.02, 0.1),
    lateralBias: range(seed, 907, -0.14, 0.14),
    densityCap: Math.round(4 + negativeSpaceBias * 5),
    voidRatio,
  };
}

export function pointInVoid(x: number, y: number, plan: NegativeSpacePlan): boolean {
  const inPrimary =
    x >= plan.primaryVoid.x &&
    x <= plan.primaryVoid.x + plan.primaryVoid.width &&
    y >= plan.primaryVoid.y &&
    y <= plan.primaryVoid.y + plan.primaryVoid.height;
  if (inPrimary) return true;
  return plan.luxuryVoids.some(
    (v) => x >= v.x && x <= v.x + v.width && y >= v.y && y <= v.y + v.height,
  );
}

export function nudgeFromVoid(
  x: number,
  y: number,
  plan: NegativeSpacePlan,
  seed: number,
  index: number,
): { x: number; y: number } {
  if (!pointInVoid(x, y, plan)) return { x, y };
  const push = plan.primaryVoid.width * 0.14;
  const dir = range(seed, 950 + index, -1, 1);
  return {
    x: snap(x + push * dir),
    y: snap(y + push * range(seed, 960 + index, -0.5, 0.5)),
  };
}

/** Rejects compositions where every area is occupied. */
export function hasPoorNegativeSpace(plan: NegativeSpacePlan, elementCount: number): boolean {
  if (plan.voidRatio < 0.12) return true;
  if (elementCount > plan.densityCap * 4) return true;
  return false;
}
