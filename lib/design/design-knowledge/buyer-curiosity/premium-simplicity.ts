import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import { evaluateLuxuryRestraint } from "@/lib/design/design-knowledge/wearability";
import { resolvePlacementProfile } from "@/lib/design/design-knowledge/wearability/placement";

/** Premium simplicity — restraint without emptiness. */
export function evaluatePremiumSimplicity(spec: LibraryArtworkSpec): {
  score: number;
  notes: string[];
  penalties: string[];
} {
  const notes: string[] = [];
  const penalties: string[] = [];
  let score = 52;
  const density = spec.symbols.length + spec.ornaments.length + spec.typography.length;
  const placement = spec.wearabilityDirection
    ? spec.wearabilityDirection.placement
    : resolvePlacementProfile(spec.brief);
  const restraint = evaluateLuxuryRestraint(spec, placement);

  if (restraint.feelsExpensive) {
    score += 18;
    notes.push("premium restraint reads expensive");
  }
  if (spec.style.negativeSpace >= 0.4 && density <= 10) {
    score += 14;
    notes.push("premium whitespace with focal clarity");
  }
  if (restraint.negativeSpaceRatio >= 0.5) {
    score += 10;
  }
  if (spec.typography.filter((t) => t.layer === "typography").length <= 3 && density <= 9) {
    score += 8;
  }

  if (density >= 14) {
    penalties.push("clutter breaks premium simplicity");
    score -= 16;
  }
  if (restraint.removableCount >= 3) {
    penalties.push("unnecessary elements reduce simplicity");
    score -= 10;
  }
  if (density <= 2) {
    penalties.push("too empty — lacks focal pull");
    score -= 8;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    notes,
    penalties,
  };
}
