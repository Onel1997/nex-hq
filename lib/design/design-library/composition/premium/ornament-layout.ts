import type { LibraryArtworkSpec, OrnamentId, OrnamentPlacement } from "@/lib/design/design-library/types";
import type { HierarchyPlan } from "@/lib/design/design-library/composition/premium/hierarchy";
import type { NegativeSpaceField } from "@/lib/design/design-library/composition/premium/negative-space";
import type { RhythmGrid } from "@/lib/design/design-library/composition/premium/rhythm";
import type { CompositionType } from "@/lib/design/design-library/composition/premium/apparel-composer";
import { respectNegativeSpace } from "@/lib/design/design-library/composition/premium/negative-space";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export interface OrnamentLayoutPlan {
  ornaments: OrnamentPlacement[];
}

function ornamentsForComposition(type: CompositionType): OrnamentId[] {
  const map: Record<CompositionType, OrnamentId[]> = {
    "luxury-editorial": ["rule-lines", "editorial-dividers", "roman-ids"],
    "gallery-poster": ["collection-numbers", "corner-marks", "vertical-rules"],
    "museum-label": ["registration-marks", "alignment-guides", "micro-dots"],
    architectural: ["luxury-borders", "flank-strikes", "rule-lines"],
    "faith-collection": ["roman-ids", "minimal-labels", "rule-lines"],
    "modern-minimal": ["micro-dots", "tiny-capsules"],
    "fashion-campaign": ["editorial-dividers", "flank-strikes", "collection-numbers"],
    "technical-luxury": ["coordinates", "registration-marks", "alignment-guides"],
    "silent-collection": ["micro-dots", "tiny-capsules", "roman-ids"],
    "oversized-graphic": ["vertical-rules", "editorial-dividers", "rule-lines", "flank-strikes"],
  };
  return map[type];
}

/** Places ornaments only when they strengthen the composition. */
export function buildOrnamentLayout(
  spec: LibraryArtworkSpec,
  plan: HierarchyPlan,
  rhythm: RhythmGrid,
  space: NegativeSpaceField,
  compositionType: CompositionType,
): OrnamentLayoutPlan {
  const { safeZone } = spec.layoutZones;
  const seed = spec.seed;
  const ids = ornamentsForComposition(compositionType);
  const maxCount = Math.min(ids.length, space.densityCap - 2);

  const ornaments: OrnamentPlacement[] = [];
  const anchorPositions = [
    { x: safeZone.x + safeZone.width * 0.12, y: rhythm.rows[0] ?? plan.primary.y },
    { x: safeZone.x + safeZone.width * 0.88, y: rhythm.rows[1] ?? plan.secondary.y },
    { x: rhythm.columns[1] ?? plan.primary.x, y: safeZone.y + safeZone.height * 0.88 },
    { x: plan.secondary.x, y: plan.secondary.y + plan.secondary.scale * 0.2 },
  ];

  for (let i = 0; i < maxCount; i++) {
    const ornamentId = ids[i]!;
    const pos = anchorPositions[i % anchorPositions.length]!;
    const adjusted = respectNegativeSpace(pos.x, pos.y, space, seed, i);

    ornaments.push({
      id: `premium-ornament-${i}`,
      ornamentId,
      cx: snap(adjusted.x + range(seed, 600 + i, -6, 6)),
      cy: snap(adjusted.y + range(seed, 610 + i, -6, 6)),
      scale: plan.primary.scale * range(seed, 620 + i, 0.22, 0.38),
      rotation: range(seed, 630 + i, -4, 4),
      opacity: range(seed, 640 + i, 0.28, 0.48),
    });
  }

  return { ornaments };
}
