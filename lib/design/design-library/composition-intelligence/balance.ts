import type { Rect } from "@/lib/design/design-library/types";
import type { FocalSystem } from "@/lib/design/design-library/composition-intelligence/focal-system";
import type { TypographyPlacement } from "@/lib/design/design-library/types";

export interface BalanceProfile {
  /** 0 = perfectly symmetric, 1 = fully asymmetric */
  asymmetryIndex: number;
  leftMass: number;
  rightMass: number;
  verticalOffset: number;
  score: number;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function massAt(x: number, y: number, scale: number, safeZone: Rect): { left: number; right: number } {
  const cx = safeZone.x + safeZone.width / 2;
  const weight = scale * scale;
  return x < cx ? { left: weight, right: weight * 0.3 } : { left: weight * 0.3, right: weight };
}

/** Luxury apparel should rarely feel perfectly centered. */
export function analyzeBalance(
  focal: FocalSystem,
  typography: TypographyPlacement[],
  safeZone: Rect,
): BalanceProfile {
  let leftMass = 0;
  let rightMass = 0;

  const points = [
    { x: focal.primary.x, y: focal.primary.y, scale: focal.primary.scale },
    { x: focal.secondary.x, y: focal.secondary.y, scale: focal.secondary.scale },
    ...focal.supporting.map((s) => ({ x: s.x, y: s.y, scale: s.scale })),
    ...typography.map((t) => ({ x: t.x, y: t.y, scale: t.size })),
  ];

  for (const p of points) {
    const m = massAt(p.x, p.y, p.scale, safeZone);
    leftMass += m.left;
    rightMass += m.right;
  }

  const total = leftMass + rightMass || 1;
  const asymmetryIndex = Math.abs(leftMass - rightMass) / total;

  const cx = safeZone.x + safeZone.width / 2;
  const verticalOffset = (focal.primary.y - (safeZone.y + safeZone.height / 2)) / safeZone.height;

  let score = 55;
  if (asymmetryIndex >= 0.18 && asymmetryIndex <= 0.42) score += 22;
  else if (asymmetryIndex >= 0.12) score += 10;
  else score -= 18;

  if (Math.abs(verticalOffset) >= 0.04) score += 12;
  else score -= 8;

  if (asymmetryIndex < 0.06) score -= 25;

  return { asymmetryIndex, leftMass, rightMass, verticalOffset, score: clamp(score) };
}

export function isPerfectlyCentered(profile: BalanceProfile): boolean {
  return profile.asymmetryIndex < 0.06 && Math.abs(profile.verticalOffset) < 0.03;
}
