import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import type { PlacementProfile } from "@/lib/design/design-knowledge/wearability/placement";

const POSTER_TEMPLATES = new Set([
  "editorial-poster",
  "technical-blueprint",
]);

export interface PrintDensityAssessment {
  score: number;
  elementCount: number;
  focalPointCount: number;
  isPosterLike: boolean;
  isOverfilled: boolean;
  hasClutter: boolean;
  hasBreathingRoom: boolean;
  issues: string[];
}

function elementCount(spec: LibraryArtworkSpec): number {
  return spec.symbols.length + spec.ornaments.length + spec.typography.length;
}

function countFocalPoints(spec: LibraryArtworkSpec): number {
  let focal = 0;
  if (spec.typography.some((t) => t.role === "headline" || t.role === "stacked-headline")) focal += 1;
  if (spec.symbols.filter((s) => s.zone === "hero").length >= 1) focal += 1;
  if (spec.typography.filter((t) => t.layer === "typography").length >= 3) focal += 1;
  if (spec.ornaments.length >= 5) focal += 1;
  return focal;
}

function hasTinyDetails(spec: LibraryArtworkSpec): boolean {
  return spec.typography.some((t) => t.size < 7 && t.layer === "typography") ||
    spec.ornaments.some((o) => o.scale < spec.layoutZones.heroZone.width * 0.08);
}

/** Evaluate print density — reject poster compositions, reward apparel breathing room. */
export function evaluatePrintDensity(
  spec: LibraryArtworkSpec,
  placement: PlacementProfile,
): PrintDensityAssessment {
  const count = elementCount(spec);
  const focalPointCount = countFocalPoints(spec);
  const maxElements = Math.round(4 + placement.densityAllowance * 10);
  const issues: string[] = [];

  const isPosterLike =
    POSTER_TEMPLATES.has(spec.template.id) &&
    placement.densityAllowance < 0.55 &&
    count >= 8;

  const isOverfilled = count > maxElements + 2;
  const hasClutter = focalPointCount >= 4 || (count >= 10 && placement.ornamentCap <= 3);
  const hasBreathingRoom = count <= maxElements && focalPointCount <= 2;

  let score = 58;
  if (hasBreathingRoom) score += 18;
  if (focalPointCount === 1) score += 12;
  else if (focalPointCount === 2) score += 6;
  if (focalPointCount >= 4) score -= 22;
  if (isPosterLike) {
    score -= 20;
    issues.push("poster composition on garment-scale placement");
  }
  if (isOverfilled) {
    score -= 16;
    issues.push("overfilled graphic — too many elements for fabric");
  }
  if (hasClutter) {
    score -= 14;
    issues.push("competing focal points reduce wearability");
  }
  if (hasTinyDetails(spec) && placement.id !== "oversized-back") {
    score -= 10;
    issues.push("tiny details will disappear on fabric at chest scale");
  }
  if (spec.style.negativeSpace >= 0.38 && count <= maxElements) score += 10;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    elementCount: count,
    focalPointCount,
    isPosterLike,
    isOverfilled,
    hasClutter,
    hasBreathingRoom,
    issues,
  };
}

export function getDensityCap(placement: PlacementProfile, role: string): number {
  const r = role.toLowerCase();
  let cap = Math.round(4 + placement.densityAllowance * 8);
  if (r.includes("core essential") || r.includes("essential")) cap = Math.min(cap, 6);
  if (r.includes("statement")) cap += 2;
  return cap;
}
