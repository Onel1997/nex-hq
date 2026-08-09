/**
 * Phase 2.2A / 2.2B / 2.2I / 2.2J / 2.2K / 2.2L — Discovery Diversity Profiles.
 * Same Mediterranean Premium Hero archetype; biologically separated regions for A/B/C/D.
 * Phase 2.2K softens toward cleaner younger soft-masculine streetwear — never copies a face.
 * Phase 2.2L restores strong hair + face-geometry separation across A/B/C/D.
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
      "~22–24y · Iberian soft oval / slight rectangle · medium nose · softer jaw · open relaxed eyes · soft arched brows · clean shave or very light stubble · SHORT textured crop / short curls / clean taper — NO medium-long waves — looks good in oversized tee — NOT a Levantine D twin",
    preferredAxes: [
      { axis: "faceGeometry", direction: "softer oval / slightly rectangular soft masculine" },
      { axis: "jaw", direction: "softer medium — reduced sharpness — different width from B/C/D" },
      { axis: "eyeShape", direction: "relaxed open warm almond" },
      { axis: "eyebrows", direction: "balanced medium soft upward arch" },
      { axis: "noseBridge", direction: "medium straight Iberian" },
      { axis: "beardPattern", direction: "clean shave or very light stubble" },
      { axis: "haircut", direction: "short textured crop clean taper — NO medium-long waves" },
      { axis: "cheekbones", direction: "youthful soft — reduced prominence" },
    ],
    incompatibleRegions: ["broader_stronger"],
  },
  B: {
    slot: "B",
    regionId: "broader_stronger",
    label: "Narrower elongated Maghrebi street geometry — still soft masculine",
    castingBrief:
      "~22–25y · Maghrebi narrower elongated face · different nose bridge/nostrils · compact jaw · flatter brow shape · deep-set relaxed eyes · clean shave or very light stubble · VERY SHORT crop / buzz-adjacent OR tight short curls with fade — NO loose long curls — calm friendly youthful — NOT Candidate D twin",
    preferredAxes: [
      { axis: "faceGeometry", direction: "narrower elongated soft masculine" },
      { axis: "jaw", direction: "more compact soft — never oversized square" },
      { axis: "eyeSpacing", direction: "slightly denser set" },
      { axis: "noseWidth", direction: "broader natural — different nostril structure" },
      { axis: "beardPattern", direction: "clean shave or very light stubble" },
      { axis: "haircut", direction: "very short crop / tight short curls with fade — NO loose long curls" },
      { axis: "cheekbones", direction: "youthful soft lean midface — never hollow" },
      { axis: "eyebrows", direction: "balanced medium flat-to-low — different from A arch" },
    ],
    incompatibleRegions: ["refined_longer_softer", "alternative_strong"],
  },
  C: {
    slot: "C",
    regionId: "narrower_angular",
    label: "Wider-upper creative geometry — soft masculine — ONLY medium-wave lane",
    castingBrief:
      "~22–25y · Greek/Balkan slightly wider upper face · softer lower face · distinct eye spacing · different cheek structure · creative brows · clean shave · MEDIUM-LENGTH RELAXED WAVES strongly preferred — ONLY slot for longer/wavier hair — calm friendly youthful — NOT Candidate D twin",
    preferredAxes: [
      { axis: "faceGeometry", direction: "slightly wider upper face / softer lower face" },
      { axis: "facialRatioVariant", direction: "wider upper / softer lower — never sculpted" },
      { axis: "haircut", direction: "medium-length relaxed waves — ONLY longer/wavier slot" },
      { axis: "cheekbones", direction: "different softer creative cheek structure" },
      { axis: "eyebrows", direction: "balanced medium creative lifted outer" },
      { axis: "noseBridge", direction: "straight refined character with micro-irregularity" },
      { axis: "eyeShape", direction: "relaxed open warm creative — widest spacing" },
      { axis: "beardPattern", direction: "clean shave or sparse light stubble" },
    ],
    incompatibleRegions: [],
  },
  D: {
    slot: "D",
    regionId: "alternative_strong",
    label: "Warm Levantine commercial ambassador — soft masculine quality lane",
    castingBrief:
      "~22–25y · Levantine balanced narrow-to-medium · subtle angularity · natural medium soft jaw · distinct nose tip / lips / chin · warm approachable eyes · continuous brows · clean shave or very light stubble · SHORT messy curls OR short natural texture OR soft taper — NO long editorial — QUALITY BAR exemplar, never locked prior Candidate D identity / never anatomy template for A/B/C",
    preferredAxes: [
      { axis: "faceGeometry", direction: "balanced narrow-to-medium subtle angular soft masculine" },
      { axis: "chin", direction: "distinct chin-to-lips relationship — never oversized jaw" },
      { axis: "eyeShape", direction: "relaxed open warm approachable" },
      { axis: "noseTip", direction: "distinct fuller soft Levantine tip" },
      { axis: "cheekbones", direction: "youthful soft supportive — different from C" },
      { axis: "haircut", direction: "short messy curls / soft taper texture — NO long editorial" },
      { axis: "jaw", direction: "natural medium soft-masculine — different width from A/B/C" },
      { axis: "eyebrows", direction: "balanced medium continuous — different from A/B/C" },
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
