import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export type ApparelPlacement =
  | "center-chest"
  | "oversized-front"
  | "oversized-back"
  | "sleeve"
  | "pocket"
  | "neck";

export type VisualWeight = "primary" | "secondary" | "supporting" | "micro";

export interface WeightedAnchor {
  x: number;
  y: number;
  weight: VisualWeight;
  scale: number;
  opacity: number;
  rotation: number;
}

export interface HierarchyPlan {
  primary: WeightedAnchor;
  secondary: WeightedAnchor;
  supporting: WeightedAnchor[];
  micro: WeightedAnchor[];
  typeDominance: number;
  geometryDominance: number;
}

function weightOpacity(weight: VisualWeight): number {
  switch (weight) {
    case "primary":
      return 0.94;
    case "secondary":
      return 0.62;
    case "supporting":
      return 0.42;
    case "micro":
      return 0.28;
  }
}

/** Builds a four-tier hierarchy — never equal visual weight across tiers. */
export function buildHierarchyPlan(
  spec: LibraryArtworkSpec,
  placement: ApparelPlacement,
  typeFirst: boolean,
): HierarchyPlan {
  const { safeZone, anchors, heroZone } = spec.layoutZones;
  const seed = spec.seed;
  const span = Math.min(heroZone.width, heroZone.height);

  const offsetX = range(seed, 3, -safeZone.width * 0.06, safeZone.width * 0.06);
  const offsetY = range(seed, 5, -safeZone.height * 0.04, safeZone.height * 0.05);

  const primaryScale =
    placement === "oversized-back" || placement === "oversized-front"
      ? span * 0.78
      : placement === "center-chest"
        ? span * 0.52
        : span * 0.58;

  const primary: WeightedAnchor = {
    x: snap(anchors.focal.x + offsetX * 0.35),
    y: snap(anchors.focal.y + offsetY * 0.25),
    weight: "primary",
    scale: primaryScale,
    opacity: weightOpacity("primary"),
    rotation: range(seed, 11, -5, 5),
  };

  const secondary: WeightedAnchor = {
    x: snap(primary.x + range(seed, 17, safeZone.width * 0.1, safeZone.width * 0.18)),
    y: snap(primary.y + range(seed, 19, -safeZone.height * 0.14, safeZone.height * 0.08)),
    weight: "secondary",
    scale: primaryScale * range(seed, 23, 0.34, 0.48),
    opacity: weightOpacity("secondary"),
    rotation: range(seed, 29, -12, 12),
  };

  const supporting: WeightedAnchor[] = [
    {
      x: snap(safeZone.x + safeZone.width * range(seed, 31, 0.14, 0.22)),
      y: snap(primary.y + span * 0.22),
      weight: "supporting",
      scale: primaryScale * 0.28,
      opacity: weightOpacity("supporting"),
      rotation: range(seed, 37, -6, 6),
    },
    {
      x: snap(safeZone.x + safeZone.width * range(seed, 41, 0.72, 0.84)),
      y: snap(primary.y - span * 0.18),
      weight: "supporting",
      scale: primaryScale * 0.22,
      opacity: weightOpacity("supporting") * 0.9,
      rotation: range(seed, 43, 4, 14),
    },
  ];

  const micro: WeightedAnchor[] = Array.from({ length: 3 + (seed % 3) }, (_, i) => ({
    x: snap(
      safeZone.x + safeZone.width * range(seed, 50 + i, 0.08 + i * 0.04, 0.16 + i * 0.06),
    ),
    y: snap(
      safeZone.y + safeZone.height * range(seed, 60 + i, 0.12 + i * 0.08, 0.22 + i * 0.1),
    ),
    weight: "micro" as const,
    scale: primaryScale * range(seed, 70 + i, 0.06, 0.12),
    opacity: weightOpacity("micro") + range(seed, 80 + i, 0, 0.12),
    rotation: range(seed, 90 + i, -20, 20),
  }));

  return {
    primary,
    secondary,
    supporting,
    micro,
    typeDominance: typeFirst ? 0.62 : 0.38,
    geometryDominance: typeFirst ? 0.38 : 0.62,
  };
}
