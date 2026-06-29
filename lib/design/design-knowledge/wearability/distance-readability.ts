import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import type { PlacementProfile } from "@/lib/design/design-knowledge/wearability/placement";

export interface DistanceReadabilityAssessment {
  score: number;
  readableAtDistance: boolean;
  headlineScale: number;
  hierarchyClear: boolean;
  issues: string[];
}

/** Would the design still look good from 2–3 meters away on a garment? */
export function evaluateDistanceReadability(
  spec: LibraryArtworkSpec,
  placement: PlacementProfile,
): DistanceReadabilityAssessment {
  const issues: string[] = [];
  const headline = spec.typography.find(
    (t) => t.role === "headline" || t.role === "stacked-headline",
  );
  const typeLayers = spec.typography.filter((t) => t.layer === "typography");
  const minReadableSize = 10 * placement.readabilityScale;

  const headlineScale = headline?.size ?? 0;
  const hierarchyClear =
    headlineScale >= minReadableSize ||
    (spec.symbols.length >= 1 && spec.symbols[0]!.scale >= spec.layoutZones.heroZone.width * 0.35);

  let score = 55;
  if (headlineScale >= minReadableSize * 1.2) score += 18;
  else if (headlineScale >= minReadableSize) score += 10;
  else if (headlineScale > 0) {
    score -= 12;
    issues.push("headline too small for distance readability on fabric");
  }

  if (typeLayers.length >= 2 && headline) {
    const sub = spec.typography.find((t) => t.role === "subheadline");
    if (!sub || headline.size >= (sub.size * 1.4)) score += 12;
    else {
      score -= 8;
      issues.push("type hierarchy unclear at garment viewing distance");
    }
  } else if (spec.symbols.length >= 1 && spec.ornaments.length <= 3) {
    score += 14;
  }

  if (spec.ornaments.length >= 6 && placement.densityAllowance < 0.6) {
    score -= 10;
    issues.push("ornament density obscures silhouette at distance");
  }

  const tinyType = spec.typography.filter((t) => t.size < 7).length;
  if (tinyType >= 3 && placement.id !== "oversized-back") {
    score -= 14;
    issues.push("micro type disappears at 2–3 meter viewing distance");
  }

  const readableAtDistance = score >= 68 && hierarchyClear;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    readableAtDistance,
    headlineScale,
    hierarchyClear,
    issues,
  };
}
