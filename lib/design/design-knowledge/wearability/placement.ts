import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LayoutId } from "@/lib/design/design-library/types";

export type GarmentPlacement =
  | "center-chest"
  | "left-chest"
  | "oversized-front"
  | "oversized-back"
  | "sleeve"
  | "dual-print"
  | "micro-emblem";

export interface PlacementProfile {
  id: GarmentPlacement;
  /** Relative print density allowance — back prints may be denser than chest. */
  densityAllowance: number;
  /** Ideal negative-space ratio for this placement. */
  negativeSpaceTarget: number;
  /** Max ornament count before feeling overfilled on fabric. */
  ornamentCap: number;
  /** Max symbol count for wearable hierarchy. */
  symbolCap: number;
  /** Preferred layout ids for this placement. */
  layoutBias: LayoutId[];
  /** Distance-readability minimum type size factor. */
  readabilityScale: number;
}

const PLACEMENT_PROFILES: Record<GarmentPlacement, PlacementProfile> = {
  "center-chest": {
    id: "center-chest",
    densityAllowance: 0.42,
    negativeSpaceTarget: 0.68,
    ornamentCap: 3,
    symbolCap: 2,
    layoutBias: ["center-chest", "micro-chest", "symbol-above-type"],
    readabilityScale: 0.85,
  },
  "left-chest": {
    id: "left-chest",
    densityAllowance: 0.38,
    negativeSpaceTarget: 0.72,
    ornamentCap: 2,
    symbolCap: 1,
    layoutBias: ["micro-chest", "center-chest", "corner-print"],
    readabilityScale: 0.78,
  },
  "oversized-front": {
    id: "oversized-front",
    densityAllowance: 0.62,
    negativeSpaceTarget: 0.52,
    ornamentCap: 5,
    symbolCap: 3,
    layoutBias: ["oversized-front", "editorial-layout", "gallery-layout"],
    readabilityScale: 1.0,
  },
  "oversized-back": {
    id: "oversized-back",
    densityAllowance: 0.78,
    negativeSpaceTarget: 0.45,
    ornamentCap: 6,
    symbolCap: 3,
    layoutBias: ["oversized-back", "oversized-front", "wrap-composition"],
    readabilityScale: 1.12,
  },
  sleeve: {
    id: "sleeve",
    densityAllowance: 0.28,
    negativeSpaceTarget: 0.8,
    ornamentCap: 2,
    symbolCap: 1,
    layoutBias: ["vertical-print", "corner-print", "micro-chest"],
    readabilityScale: 0.72,
  },
  "dual-print": {
    id: "dual-print",
    densityAllowance: 0.55,
    negativeSpaceTarget: 0.58,
    ornamentCap: 4,
    symbolCap: 2,
    layoutBias: ["dual-print", "split-layout", "center-chest"],
    readabilityScale: 0.9,
  },
  "micro-emblem": {
    id: "micro-emblem",
    densityAllowance: 0.32,
    negativeSpaceTarget: 0.74,
    ornamentCap: 2,
    symbolCap: 1,
    layoutBias: ["micro-chest", "center-chest", "symbol-above-type"],
    readabilityScale: 0.75,
  },
};

/** Parse garment placement from brief text — apparel designer lens, not graphic layout. */
export function resolvePlacementProfile(brief: DesignStudioBrief): PlacementProfile {
  const text = `${brief.placement} ${brief.printArea} ${brief.role} ${brief.designDescription}`.toLowerCase();

  if (text.includes("dual") || text.includes("front and back")) {
    return PLACEMENT_PROFILES["dual-print"];
  }
  if (text.includes("sleeve")) return PLACEMENT_PROFILES.sleeve;
  if (text.includes("left chest") || text.includes("left-chest")) {
    return PLACEMENT_PROFILES["left-chest"];
  }
  if (text.includes("micro") || text.includes("emblem") || text.includes("small mark")) {
    return PLACEMENT_PROFILES["micro-emblem"];
  }
  if (text.includes("oversized") && text.includes("back")) {
    return PLACEMENT_PROFILES["oversized-back"];
  }
  if (text.includes("oversized") || text.includes("statement")) {
    return text.includes("back")
      ? PLACEMENT_PROFILES["oversized-back"]
      : PLACEMENT_PROFILES["oversized-front"];
  }
  if (text.includes("back")) return PLACEMENT_PROFILES["oversized-back"];
  if (text.includes("center chest") || text.includes("chest")) {
    return PLACEMENT_PROFILES["center-chest"];
  }

  const role = brief.role.toLowerCase();
  if (role.includes("core essential") || role.includes("essential")) {
    return PLACEMENT_PROFILES["micro-emblem"];
  }
  if (role.includes("statement") || role.includes("hero")) {
    return PLACEMENT_PROFILES["oversized-back"];
  }

  return PLACEMENT_PROFILES["center-chest"];
}

export function getPlacementProfile(id: GarmentPlacement): PlacementProfile {
  return PLACEMENT_PROFILES[id];
}
