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
      "~23–25y · soft masculine oval · expressive relaxed eyes · slightly thicker brows · subtle jaw · clean shave or slight stubble · soft curls/waves or taper · “he looks cool”",
    preferredAxes: [
      { axis: "faceGeometry", direction: "longer oval soft masculine" },
      { axis: "jaw", direction: "subtle tapered" },
      { axis: "eyeShape", direction: "expressive relaxed almond" },
      { axis: "eyebrows", direction: "slightly thicker natural" },
      { axis: "noseBridge", direction: "narrow refined" },
      { axis: "beardPattern", direction: "clean or slight stubble" },
      { axis: "haircut", direction: "soft curls waves taper" },
    ],
    incompatibleRegions: ["broader_stronger"],
  },
  B: {
    slot: "B",
    regionId: "broader_stronger",
    label: "Broader / warmer street geometry — still soft masculine",
    castingBrief:
      "~24–26y · broader soft-masculine rectangle · thicker brows · subtle-not-oversized jaw · short textured curls / low fade · lean athletic · approachable urban cool",
    preferredAxes: [
      { axis: "faceGeometry", direction: "broader soft rectangle" },
      { axis: "jaw", direction: "subtle broader — never oversized" },
      { axis: "eyeSpacing", direction: "slightly denser set" },
      { axis: "noseWidth", direction: "broader natural" },
      { axis: "beardPattern", direction: "slight dense stubble or clean" },
      { axis: "haircut", direction: "textured curls low fade" },
    ],
    incompatibleRegions: ["refined_longer_softer", "alternative_strong"],
  },
  C: {
    slot: "C",
    regionId: "narrower_angular",
    label: "Narrower / creative geometry — soft masculine",
    castingBrief:
      "~24–27y · thicker natural brows · longer/slimmer soft face · relaxed wavy medium or messy curls · olive creative skin · approachable artistic presence",
    preferredAxes: [
      { axis: "faceGeometry", direction: "narrow soft angular" },
      { axis: "facialRatioVariant", direction: "defined-not-exaggerated cheek vertical" },
      { axis: "haircut", direction: "relaxed wavy medium messy curls" },
      { axis: "cheekbones", direction: "defined not sculpted" },
      { axis: "eyebrows", direction: "slightly thicker natural" },
      { axis: "noseBridge", direction: "straight refined" },
    ],
    incompatibleRegions: [],
  },
  D: {
    slot: "D",
    regionId: "alternative_strong",
    label: "Warm Mediterranean ambassador — soft masculine hero",
    castingBrief:
      "~24–26y · natural curly crop · subtle jaw · defined-not-exaggerated cheekbones · Mediterranean warmth · quiet confidence — brand ambassador not movie hero",
    preferredAxes: [
      { axis: "faceGeometry", direction: "balanced rectangular soft masculine" },
      { axis: "chin", direction: "natural broader — never oversized jaw" },
      { axis: "eyeShape", direction: "expressive relaxed deeper lid" },
      { axis: "noseTip", direction: "natural fuller soft" },
      { axis: "cheekbones", direction: "defined not exaggerated" },
      { axis: "haircut", direction: "natural curly textured crop" },
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
