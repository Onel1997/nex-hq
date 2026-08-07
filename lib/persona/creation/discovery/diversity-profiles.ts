/**
 * Phase 2.2A / 2.2B — Discovery Diversity Profiles (regions, not locked people).
 * Same Mediterranean Premium Hero archetype; biologically separated regions for A/B/C/D.
 *
 * Creative target: four casting-director briefs that never read as four brothers.
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
  /** Casting-director brief — soft guidance for humans reading diversity intent. */
  readonly castingBrief: string;
  /** Preferred high-leverage directions — soft guidance for sampling bias checks. */
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
  /** Regions that must not share neighboring high-leverage clusters. */
  readonly incompatibleRegions: readonly DiversityRegionId[];
};

export const DISCOVERY_DIVERSITY_PROFILES: Record<DiscoverySlot, DiscoveryDiversityProfile> = {
  A: {
    slot: "A",
    regionId: "refined_longer_softer",
    label: "Refined / longer / softer geometry — quiet luxury",
    castingBrief:
      "~24y feel · clean shave or faint stubble · oval/soft face · refined eyes · soft curls/waves · slim jaw · friendly quiet luxury",
    preferredAxes: [
      { axis: "faceGeometry", direction: "longer oval" },
      { axis: "jaw", direction: "softer tapered" },
      { axis: "eyeShape", direction: "almond refined" },
      { axis: "noseBridge", direction: "narrow refined" },
      { axis: "beardPattern", direction: "clean or faint" },
      { axis: "haircut", direction: "soft waves curls" },
    ],
    incompatibleRegions: ["broader_stronger"],
  },
  B: {
    slot: "B",
    regionId: "broader_stronger",
    label: "Broader / stronger / athletic street geometry",
    castingBrief:
      "~31y feel · light dense beard/stubble · square/rectangular jaw · darker eyes · messy dense curls · athletic · confident urban",
    preferredAxes: [
      { axis: "faceGeometry", direction: "broader square" },
      { axis: "jaw", direction: "strong angular" },
      { axis: "eyeSpacing", direction: "wider set" },
      { axis: "noseWidth", direction: "broader" },
      { axis: "beardPattern", direction: "dense short stubble" },
      { axis: "haircut", direction: "messy coil curl fade" },
    ],
    incompatibleRegions: ["refined_longer_softer", "alternative_strong"],
  },
  C: {
    slot: "C",
    regionId: "narrower_angular",
    label: "Narrower / angular / creative editorial geometry",
    castingBrief:
      "~27y feel · thick brows · longer/slimmer face · straight refined nose · olive creative skin · editorial · artistic presence",
    preferredAxes: [
      { axis: "faceGeometry", direction: "narrow angular" },
      { axis: "facialRatioVariant", direction: "high cheek vertical" },
      { axis: "haircut", direction: "structured textured medium waves" },
      { axis: "cheekbones", direction: "high defined" },
      { axis: "eyebrows", direction: "thick creative" },
      { axis: "noseBridge", direction: "straight refined" },
    ],
    incompatibleRegions: [],
  },
  D: {
    slot: "D",
    regionId: "alternative_strong",
    label: "Alternative strong / Mediterranean warmth hero",
    castingBrief:
      "~29y feel · curly dense crop · slightly wider hero nose · strong cheekbones · Mediterranean warmth · relaxed luxury confidence",
    preferredAxes: [
      { axis: "faceGeometry", direction: "rectangular strong" },
      { axis: "chin", direction: "broader cleft-capable" },
      { axis: "eyeShape", direction: "deeper set stronger lid" },
      { axis: "noseTip", direction: "blunter fuller" },
      { axis: "cheekbones", direction: "broad strong" },
      { axis: "haircut", direction: "thick curly textured crop" },
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
