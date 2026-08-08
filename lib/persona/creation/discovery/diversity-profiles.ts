/**
 * Phase 2.2A / 2.2B / 2.2I / 2.2J / 2.2K — Discovery Diversity Profiles.
 * Same Mediterranean Premium Hero archetype; biologically separated regions for A/B/C/D.
 * Phase 2.2K softens toward cleaner younger soft-masculine streetwear — never copies a face.
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
  readonly castingBrief: string;
  readonly preferredAxes: ReadonlyArray<{
    axis:
      | HighLeveragePoolKey
      | "faceGeometry"
      | "facialRatioVariant"
      | "cheekbones"
      | "forehead"
      | "eyebrows";
    direction: string;
  }>;
  readonly incompatibleRegions: readonly DiversityRegionId[];
};

export const DISCOVERY_DIVERSITY_PROFILES: Record<DiscoverySlot, DiscoveryDiversityProfile> = {
  A: {
    slot: "A",
    regionId: "refined_longer_softer",
    label: "Refined / longer / softer geometry — quiet luxury",
    castingBrief:
      "~22–24y · Iberian soft oval · reduced facial width · relaxed open eyes · balanced brows · natural medium soft jaw · youthful cheeks · clean shave or very light stubble · short textured curls/taper · looks good in oversized tee — NOT a Levantine D twin",
    preferredAxes: [
      { axis: "faceGeometry", direction: "softer oval soft masculine — reduced width" },
      { axis: "jaw", direction: "natural medium soft — reduced sharpness" },
      { axis: "eyeShape", direction: "relaxed open warm almond" },
      { axis: "eyebrows", direction: "balanced medium soft" },
      { axis: "noseBridge", direction: "narrow refined" },
      { axis: "beardPattern", direction: "clean shave or very light stubble" },
      { axis: "haircut", direction: "short textured curls soft taper" },
      { axis: "cheekbones", direction: "youthful soft — reduced prominence" },
    ],
    incompatibleRegions: ["broader_stronger"],
  },
  B: {
    slot: "B",
    regionId: "broader_stronger",
    label: "Broader / warmer street geometry — still soft masculine",
    castingBrief:
      "~22–25y · Maghrebi soft-masculine subtle rectangle · reduced width · relaxed open eyes · balanced brows · natural medium jaw · clean shave or very light stubble · short textured curls / low fade · calm friendly youthful — NOT Candidate D twin",
    preferredAxes: [
      { axis: "faceGeometry", direction: "soft subtle rectangle — reduced width" },
      { axis: "jaw", direction: "natural medium soft broader — never oversized square" },
      { axis: "eyeSpacing", direction: "slightly denser set" },
      { axis: "noseWidth", direction: "broader natural" },
      { axis: "beardPattern", direction: "clean shave or very light stubble" },
      { axis: "haircut", direction: "short textured curls low fade" },
      { axis: "cheekbones", direction: "youthful soft — never hollow" },
      { axis: "eyebrows", direction: "balanced medium low" },
    ],
    incompatibleRegions: ["refined_longer_softer", "alternative_strong"],
  },
  C: {
    slot: "C",
    regionId: "narrower_angular",
    label: "Narrower / creative geometry — soft masculine",
    castingBrief:
      "~22–25y · Greek/Balkan narrower soft face · balanced brows · relaxed open eyes · youthful cheeks · clean shave · short natural waves / cropped messy curls (medium only occasionally) · calm friendly youthful — NOT Candidate D twin",
    preferredAxes: [
      { axis: "faceGeometry", direction: "narrow soft angular" },
      { axis: "facialRatioVariant", direction: "youthful soft cheek — never sculpted" },
      { axis: "haircut", direction: "short natural waves cropped messy curls" },
      { axis: "cheekbones", direction: "youthful soft" },
      { axis: "eyebrows", direction: "balanced medium creative" },
      { axis: "noseBridge", direction: "straight refined character" },
      { axis: "eyeShape", direction: "relaxed open warm creative" },
      { axis: "beardPattern", direction: "clean shave or sparse light stubble" },
    ],
    incompatibleRegions: [],
  },
  D: {
    slot: "D",
    regionId: "alternative_strong",
    label: "Warm Levantine commercial ambassador — soft masculine quality lane",
    castingBrief:
      "~22–25y · Levantine balanced soft-masculine · cropped curly crop · natural medium soft jaw · youthful cheeks · relaxed open eyes · balanced brows · clean shave or very light stubble · looks good in oversized tee — QUALITY BAR exemplar, never locked prior Candidate D identity",
    preferredAxes: [
      { axis: "faceGeometry", direction: "balanced subtle rectangular soft masculine — reduced width" },
      { axis: "chin", direction: "softer natural — never oversized jaw" },
      { axis: "eyeShape", direction: "relaxed open warm" },
      { axis: "noseTip", direction: "natural fuller soft Levantine" },
      { axis: "cheekbones", direction: "youthful soft supportive" },
      { axis: "haircut", direction: "cropped curly textured crop" },
      { axis: "jaw", direction: "natural medium soft-masculine" },
      { axis: "eyebrows", direction: "balanced medium continuous" },
      { axis: "beardPattern", direction: "clean shave or very light stubble" },
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
