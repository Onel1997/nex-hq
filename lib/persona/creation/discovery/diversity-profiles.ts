/**
 * Phase 2.2A — Discovery Diversity Profiles (regions, not locked people).
 * Same Mediterranean Premium Hero archetype; biologically separated regions for A/B/C/D.
 */

import type { DiscoverySlot, HighLeveragePoolKey } from "@/lib/persona/identity-blueprints";

export type DiversityRegionId =
  | "refined_longer_softer"
  | "broader_stronger"
  | "narrower_angular"
  | "alternative_strong";

export type DiscoveryDiversityProfile = {
  readonly slot: DiscoverySlot;
  readonly regionId: DiversityRegionId;
  readonly label: string;
  /** Preferred high-leverage directions — soft guidance for sampling bias checks. */
  readonly preferredAxes: ReadonlyArray<{
    axis: HighLeveragePoolKey | "faceGeometry" | "facialRatioVariant" | "cheekbones" | "forehead";
    direction: string;
  }>;
  /** Regions that must not share neighboring high-leverage clusters. */
  readonly incompatibleRegions: readonly DiversityRegionId[];
};

export const DISCOVERY_DIVERSITY_PROFILES: Record<DiscoverySlot, DiscoveryDiversityProfile> = {
  A: {
    slot: "A",
    regionId: "refined_longer_softer",
    label: "Refined / longer / softer geometry",
    preferredAxes: [
      { axis: "faceGeometry", direction: "longer oval" },
      { axis: "jaw", direction: "softer tapered" },
      { axis: "eyeShape", direction: "almond refined" },
      { axis: "noseBridge", direction: "narrow refined" },
    ],
    incompatibleRegions: ["broader_stronger"],
  },
  B: {
    slot: "B",
    regionId: "broader_stronger",
    label: "Broader / stronger / different eye-nose-jaw geometry",
    preferredAxes: [
      { axis: "faceGeometry", direction: "broader square" },
      { axis: "jaw", direction: "strong angular" },
      { axis: "eyeSpacing", direction: "wider set" },
      { axis: "noseWidth", direction: "broader" },
    ],
    incompatibleRegions: ["refined_longer_softer", "alternative_strong"],
  },
  C: {
    slot: "C",
    regionId: "narrower_angular",
    label: "Narrower / angular / different ratios + hair structure",
    preferredAxes: [
      { axis: "faceGeometry", direction: "narrow angular" },
      { axis: "facialRatioVariant", direction: "high cheek vertical" },
      { axis: "haircut", direction: "structured textured" },
      { axis: "cheekbones", direction: "high defined" },
    ],
    incompatibleRegions: [],
  },
  D: {
    slot: "D",
    regionId: "alternative_strong",
    label: "Alternative strong geometry clearly separated from B",
    preferredAxes: [
      { axis: "faceGeometry", direction: "rectangular strong" },
      { axis: "chin", direction: "broader cleft-capable" },
      { axis: "eyeShape", direction: "deeper set stronger lid" },
      { axis: "noseTip", direction: "blunter" },
    ],
    incompatibleRegions: ["broader_stronger"],
  },
};

export function diversityProfileForSlot(slot: DiscoverySlot): DiscoveryDiversityProfile {
  return DISCOVERY_DIVERSITY_PROFILES[slot];
}

export function listDiscoveryDiversityProfiles(): DiscoveryDiversityProfile[] {
  return [
    DISCOVERY_DIVERSITY_PROFILES.A,
    DISCOVERY_DIVERSITY_PROFILES.B,
    DISCOVERY_DIVERSITY_PROFILES.C,
    DISCOVERY_DIVERSITY_PROFILES.D,
  ];
}
