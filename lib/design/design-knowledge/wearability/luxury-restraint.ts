import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import type { PlacementProfile } from "@/lib/design/design-knowledge/wearability/placement";

const REMOVABLE_ORNAMENTS = new Set([
  "registration-marks",
  "coordinates",
  "tiny-capsules",
  "micro-lines",
  "roman-ids",
]);

const ESSENTIAL_ORNAMENTS = new Set([
  "rule-lines",
  "luxury-borders",
  "editorial-dividers",
  "vertical-rules",
]);

export interface LuxuryRestraintAssessment {
  score: number;
  ornamentCount: number;
  removableCount: number;
  negativeSpaceRatio: number;
  feelsExpensive: boolean;
  canRemoveOrnament: boolean;
  notes: string[];
}

function negativeSpaceRatio(spec: LibraryArtworkSpec): number {
  const density = spec.symbols.length + spec.ornaments.length + spec.typography.length;
  const ideal = 6 + spec.style.negativeSpace * 8;
  return Math.max(0, Math.min(1, 1 - Math.abs(density - ideal) / ideal));
}

/** Luxury often removes elements — evaluate restraint and expensive print feeling. */
export function evaluateLuxuryRestraint(
  spec: LibraryArtworkSpec,
  placement: PlacementProfile,
): LuxuryRestraintAssessment {
  const notes: string[] = [];
  const removable = spec.ornaments.filter((o) => REMOVABLE_ORNAMENTS.has(o.ornamentId));
  const essential = spec.ornaments.filter((o) => ESSENTIAL_ORNAMENTS.has(o.ornamentId));
  const negRatio = negativeSpaceRatio(spec);

  let score = 52;
  if (negRatio >= 0.55) score += 16;
  if (spec.style.negativeSpace >= 0.4) score += 12;
  if (essential.length >= 1 && removable.length <= 1) score += 10;
  if (removable.length >= 3) {
    score -= 14;
    notes.push("unnecessary ornaments reduce luxury perception");
  }
  if (spec.ornaments.length > placement.ornamentCap + 1) {
    score -= 12;
    notes.push("ornament count exceeds premium placement allowance");
  }
  if (spec.typography.filter((t) => t.layer === "decorative").length >= 4) {
    score -= 8;
    notes.push("decorative typography layers feel graphic, not garment");
  }

  const feelsExpensive =
    score >= 68 &&
    negRatio >= 0.45 &&
    spec.ornaments.length <= placement.ornamentCap + 1;
  const canRemoveOrnament = removable.length >= 1;

  if (feelsExpensive) notes.push("print restraint reads expensive on fabric");
  if (canRemoveOrnament) notes.push("one ornament could be removed for cleaner luxury");

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    ornamentCount: spec.ornaments.length,
    removableCount: removable.length,
    negativeSpaceRatio: negRatio,
    feelsExpensive,
    canRemoveOrnament,
    notes,
  };
}

/** Apply luxury restraint — remove lowest-value ornaments, preserve emotional focal layers. */
export function applyLuxuryRestraint(
  spec: LibraryArtworkSpec,
  placement: PlacementProfile,
): LibraryArtworkSpec {
  let ornaments = [...spec.ornaments];
  const cap = placement.ornamentCap;

  if (ornaments.length <= cap) return spec;

  const ranked = [...ornaments].sort((a, b) => {
    const aRemovable = REMOVABLE_ORNAMENTS.has(a.ornamentId) ? 0 : 1;
    const bRemovable = REMOVABLE_ORNAMENTS.has(b.ornamentId) ? 0 : 1;
    if (aRemovable !== bRemovable) return aRemovable - bRemovable;
    return a.opacity - b.opacity;
  });

  ornaments = ranked.slice(0, cap);

  let symbols = [...spec.symbols];
  if (symbols.length > placement.symbolCap) {
    const hero = symbols.filter((s) => s.zone === "hero");
    const secondary = symbols.filter((s) => s.zone !== "hero").slice(0, placement.symbolCap - hero.length);
    symbols = [...hero, ...secondary];
  }

  if (placement.densityAllowance < 0.5) {
    symbols = symbols.filter((s) => s.zone !== "accent");
  }

  return { ...spec, ornaments, symbols };
}
