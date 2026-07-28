/**
 * Phase 1.8E — Archetype-scoped A1 discovery identity blueprints.
 *
 * Official Brand Face casting MUST use these per-archetype biological identities.
 * Global CANDIDATE_VARIATION_PROFILES must not control gender, ethnicity, or face biology.
 */

import type { BrandArchetype } from "./types";

export class DiscoveryBlueprintError extends Error {
  readonly code = "CONFIG";
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DiscoveryBlueprintError";
    this.details = details;
  }
}

/** Deterministic short hash — safe in Node and browser bundles (no node:crypto). */
function shortHash(input: string, length = 10): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  // Mix a second pass for longer fingerprints.
  let h2 = 0x811c9dc5;
  for (let i = input.length - 1; i >= 0; i -= 1) {
    h2 ^= input.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193);
  }
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${hex}${hex2}`.slice(0, length);
}

export type DiscoverySlot = "A" | "B" | "C" | "D";
export type BlueprintGender = "male" | "female";

export type ArchetypeCandidateBlueprint = {
  id: string;
  archetypeId: string;
  slot: DiscoverySlot;
  /** Display name for secondary card metadata — never a global variation label. */
  name: string;
  gender: BlueprintGender;
  ageRange: string;
  ancestryDirection: string;
  skinTone: string;
  faceGeometry: string;
  jaw: string;
  cheekbones: string;
  nose: string;
  eyes: string;
  lips: string;
  hairTexture: string;
  haircut: string;
  facialHair: string;
  bodyStructure: string;
  expression: string;
  stylingDirection: string;
  backgroundDirection: string;
  lightingDirection: string;
};

const ARCH_MED = "arch-mediterranean-premium-hero";
const ARCH_URBAN = "arch-urban-community-hero";
const ARCH_FEMALE = "arch-female-lifestyle-hero";

const SLOT_BY_NUMBER: Record<number, DiscoverySlot> = {
  1: "A",
  2: "B",
  3: "C",
  4: "D",
};

export const MEDITERRANEAN_DISCOVERY_BLUEPRINTS: readonly ArchetypeCandidateBlueprint[] = [
  {
    id: "med-a-soft-luxury",
    archetypeId: ARCH_MED,
    slot: "A",
    name: "Mediterranean Soft Luxury",
    gender: "male",
    ageRange: "24-29",
    ancestryDirection: "Southern European / Mediterranean direction",
    skinTone: "light-medium olive skin with warm sun-kissed undertone and visible natural pores",
    faceGeometry: "oval-rectangular everyday masculine planes with mild natural asymmetry",
    jaw: "defined but approachable jaw — never razor-sharp fashion geometry",
    cheekbones: "natural medium cheekbones with healthy facial volume",
    nose: "straight natural nose with soft everyday tip",
    eyes: "warm almond-shaped brown eyes with soft lids and calm gaze",
    lips: "natural medium lips, soft definition, calm closed mouth",
    hairTexture: "dark brown naturally wavy hair with lived-in density",
    haircut: "modern soft taper textured crop — not overstyled",
    facialHair: "light natural 2–3 day stubble, uneven real density",
    bodyStructure: "lean everyday-athletic adult male frame, natural proportions",
    expression: "calm relaxed confidence — soft neutral to lightly friendly",
    stylingDirection: "approachable premium streetwear basics — washed black / charcoal",
    backgroundDirection: "controlled Stage-A casting set — warm grey plaster wall",
    lightingDirection: "soft premium daylight key with gentle fill",
  },
  {
    id: "med-b-north-african-street",
    archetypeId: ARCH_MED,
    slot: "B",
    name: "North African Street Premium",
    gender: "male",
    ageRange: "24-30",
    ancestryDirection: "North African / Mediterranean direction",
    skinTone: "medium olive-brown skin with warm undertones and realistic texture",
    faceGeometry: "slightly longer face with clearer vertical planes — distinct from Candidate A",
    jaw: "angular but not aggressive jawline",
    cheekbones: "higher defined cheekbones with lean midface",
    nose: "wider natural nose bridge with strong everyday character",
    eyes: "deeper-set dark eyes with quiet intensity",
    lips: "natural fuller-medium lips, calm closed mouth",
    hairTexture: "dark textured curls with dense natural coil-wave pattern",
    haircut: "short textured curls with clean low fade",
    facialHair: "short designer stubble — precise but natural",
    bodyStructure: "slim-athletic adult male body, lean shoulders",
    expression: "easy modern streetwear presence — calm confident",
    stylingDirection: "premium modern streetwear — charcoal / off-white oversized tee energy",
    backgroundDirection: "neutral quiet casting wall — slightly cooler grey",
    lightingDirection: "soft directional daylight with clean shadow definition",
  },
  {
    id: "med-c-southern-creative",
    archetypeId: ARCH_MED,
    slot: "C",
    name: "Southern European Creative",
    gender: "male",
    ageRange: "23-29",
    ancestryDirection: "Southern European direction",
    skinTone: "warm olive skin with soft golden undertone — distinct from A and B",
    faceGeometry: "softer triangular face with narrower chin and open midface",
    jaw: "softer jaw with less angularity — still masculine adult",
    cheekbones: "strong visible cheekbones on a softer overall face",
    nose: "distinctive natural nose with character — not model-perfect",
    eyes: "expressive hazel or warm brown eyes with open lids",
    lips: "softer natural lips with light definition",
    hairTexture: "medium-brown loose waves with natural movement",
    haircut: "medium-length loose curls or waves — creative, not corporate",
    facialHair: "clean-shaven or minimal soft stubble only",
    bodyStructure: "lean creative adult male frame — not gym-heavy",
    expression: "approachable creative confidence — warm quiet energy",
    stylingDirection: "creative premium basics — soft washed tones, effortless fit",
    backgroundDirection: "soft warm plaster casting backdrop",
    lightingDirection: "soft diffused daylight — flattering not beauty-retouch",
  },
  {
    id: "med-d-levantine-hero",
    archetypeId: ARCH_MED,
    slot: "D",
    name: "Levantine Modern Hero",
    gender: "male",
    ageRange: "25-31",
    ancestryDirection: "Levantine / Eastern Mediterranean direction",
    skinTone: "warm medium olive skin with richer undertone — not A/B/C recipes",
    faceGeometry: "broader balanced face with stronger horizontal presence",
    jaw: "controlled defined jaw with clear masculine structure",
    cheekbones: "broad supportive cheek structure — campaign-ready",
    nose: "strong natural nose with clear bridge character",
    eyes: "dark expressive eyes with premium campaign calm",
    lips: "fuller natural lips with soft volume",
    hairTexture: "thick near-black hair with dense natural texture",
    haircut: "thick near-black textured crop — dense and modern",
    facialHair: "short even beard or dense controlled stubble",
    bodyStructure: "lean-athletic shoulders, premium adult male silhouette",
    expression: "premium but friendly campaign presence — calm authority",
    stylingDirection: "premium campaign streetwear — black / deep charcoal hero basics",
    backgroundDirection: "clean luxury casting grey — homepage-ready",
    lightingDirection: "editorial soft key with subtle luxury contrast",
  },
] as const;

export const URBAN_DISCOVERY_BLUEPRINTS: readonly ArchetypeCandidateBlueprint[] = [
  {
    id: "urban-a-soft-community",
    archetypeId: ARCH_URBAN,
    slot: "A",
    name: "Soft Community Anchor",
    gender: "male",
    ageRange: "24-28",
    ancestryDirection: "Afro-European / African-diaspora community direction",
    skinTone: "rich deep brown skin with warm undertones and realistic complexion variation",
    faceGeometry: "softer rounded facial planes with wider friendly midface",
    jaw: "soft rounded jaw with low angularity",
    cheekbones: "soft full cheek volume — friendly community face",
    nose: "broader softer nose with rounded tip",
    eyes: "softly rounded warm eyes, open lids, kind calm expression",
    lips: "fuller natural lips with soft volume, calm relaxed mouth",
    hairTexture: "tight natural coils with soft afro-curl density",
    haircut: "short natural coils / clean soft afro texture — never chemically straightened",
    facialHair: "clean-shaven or extremely light soft facial hair only",
    bodyStructure: "lean-normal relaxed weekend adult male proportions",
    expression: "easy warmth — approachable community Brand Face",
    stylingDirection: "relaxed heavyweight hoodie / zip hoodie streetwear",
    backgroundDirection: "soft airy community casting wall",
    lightingDirection: "soft airy daylight — accurate deep-skin rendering",
  },
  {
    id: "urban-b-structured-street",
    archetypeId: ARCH_URBAN,
    slot: "B",
    name: "Structured Street Presence",
    gender: "male",
    ageRange: "25-30",
    ancestryDirection: "Black / Afro-European streetwear direction",
    skinTone: "medium-deep brown skin with cooler undertone — distinct from Candidate A",
    faceGeometry: "longer oval face with clearer vertical structure — not Candidate A",
    jaw: "firmer defined jaw without aggressive hard angles",
    cheekbones: "higher lean cheekbones",
    nose: "straighter medium-broad nose with defined bridge",
    eyes: "almond dark eyes with calm focused gaze",
    lips: "medium-full lips with clear natural shape",
    hairTexture: "dense 4C / tight coil texture",
    haircut: "clean low fade with short textured top coils",
    facialHair: "neat short boxed line beard — controlled community-premium",
    bodyStructure: "slim-athletic adult male with slightly broader shoulders",
    expression: "relaxed modern street confidence — never aggressive",
    stylingDirection: "premium community streetwear — charcoal hoodie / tee",
    backgroundDirection: "neutral cool-grey casting backdrop",
    lightingDirection: "directional soft daylight with clean skin detail",
  },
  {
    id: "urban-c-twist-lifestyle",
    archetypeId: ARCH_URBAN,
    slot: "C",
    name: "Twist Lifestyle Hero",
    gender: "male",
    ageRange: "23-29",
    ancestryDirection: "African-diaspora lifestyle direction",
    skinTone: "warm medium-brown skin with golden undertone — distinct from A and B",
    faceGeometry: "softer heart-shaped face with narrower chin",
    jaw: "gentle jawline with soft adult masculine finish",
    cheekbones: "soft lifted cheekbones with youthful volume",
    nose: "softer shorter nose with rounded tip",
    eyes: "large warm brown eyes with open friendly lids",
    lips: "full soft lips with natural pout, calm mouth",
    hairTexture: "soft twists / mini-twist texture pattern",
    haircut: "short neat twists with clean edges — lifestyle authentic",
    facialHair: "clean-shaven — no beard",
    bodyStructure: "lean soft-athletic lifestyle frame",
    expression: "friendly social lifestyle energy — Instagram/TikTok natural",
    stylingDirection: "relaxed premium tee / light hoodie community look",
    backgroundDirection: "warm light community casting wall",
    lightingDirection: "bright soft daylight — social-native feel",
  },
  {
    id: "urban-d-braid-campaign",
    archetypeId: ARCH_URBAN,
    slot: "D",
    name: "Campaign Coil Presence",
    gender: "male",
    ageRange: "25-31",
    ancestryDirection: "Afro-European campaign / community hero direction",
    skinTone: "deep dark brown / near-ebony skin with rich undertone — never a recolor of A–C",
    faceGeometry: "broader balanced rectangular face with strong presence",
    jaw: "strong controlled jaw — premium campaign structure",
    cheekbones: "broad supportive cheekbones",
    nose: "wide strong natural nose with clear character",
    eyes: "deep-set dark expressive eyes with calm campaign authority",
    lips: "fuller prominent natural lips",
    hairTexture: "dense natural coils with thicker strand definition",
    haircut: "short neat cornrow or braid-inspired cropped style OR dense sculpted coils — distinct from A–C",
    facialHair: "short even dense stubble — neat community-premium",
    bodyStructure: "lean-athletic broader shoulder line — campaign silhouette",
    expression: "premium friendly campaign calm — community hero authority",
    stylingDirection: "premium campaign streetwear — black / deep charcoal hero basics",
    backgroundDirection: "clean campaign casting grey",
    lightingDirection: "editorial soft key optimized for deep skin",
  },
] as const;

export const FEMALE_DISCOVERY_BLUEPRINTS: readonly ArchetypeCandidateBlueprint[] = [
  {
    id: "female-a-mediterranean",
    archetypeId: ARCH_FEMALE,
    slot: "A",
    name: "Mediterranean Lifestyle Soft",
    gender: "female",
    ageRange: "23-28",
    ancestryDirection: "Mediterranean / Southern European female direction",
    skinTone: "warm light-medium olive skin with natural texture — not porcelain",
    faceGeometry: "soft oval feminine face with healthy volume",
    jaw: "soft feminine jawline — never sharp high-fashion contour",
    cheekbones: "soft natural cheekbones with healthy fullness",
    nose: "natural soft feminine nose — everyday proportions",
    eyes: "warm open brown eyes with soft approachable gaze",
    lips: "natural soft lips, light definition, minimal makeup reading",
    hairTexture: "dark brown soft waves with natural density",
    haircut: "shoulder-grazing soft waves — lived-in, not glam",
    facialHair: "none",
    bodyStructure: "natural feminine lean-soft lifestyle frame",
    expression: "warm friendly authentic lifestyle presence",
    stylingDirection: "premium oversized hoodie / lifestyle tee — feminine fit reading",
    backgroundDirection: "warm soft lifestyle casting wall",
    lightingDirection: "soft natural daylight — not beauty ring light",
  },
  {
    id: "female-b-afro-european",
    archetypeId: ARCH_FEMALE,
    slot: "B",
    name: "Afro-European Lifestyle Glow",
    gender: "female",
    ageRange: "24-29",
    ancestryDirection: "Afro-European female direction",
    skinTone: "rich medium-deep brown skin with warm undertone and realistic texture",
    faceGeometry: "softer rounded feminine face with fuller midface — distinct from A",
    jaw: "soft rounded feminine jaw",
    cheekbones: "full soft cheek volume",
    nose: "softer broader feminine nose with rounded tip",
    eyes: "warm dark eyes with open friendly lids",
    lips: "fuller natural lips with soft volume — minimal makeup",
    hairTexture: "natural coils / soft afro-curl texture",
    haircut: "short natural coils or soft afro crown — authentic, not straightened glam",
    facialHair: "none",
    bodyStructure: "natural feminine lifestyle proportions — soft athletic ease",
    expression: "radiant calm social energy — Pinterest / Instagram natural",
    stylingDirection: "premium oversized lifestyle hoodie — community feminine",
    backgroundDirection: "soft airy lifestyle casting backdrop",
    lightingDirection: "soft daylight with accurate deep-skin rendering",
  },
  {
    id: "female-c-mixed-european",
    archetypeId: ARCH_FEMALE,
    slot: "C",
    name: "Mixed European Soft Editorial",
    gender: "female",
    ageRange: "23-27",
    ancestryDirection: "mixed European / Mediterranean female direction",
    skinTone: "light warm beige / soft peach-olive skin — distinct from A and B",
    faceGeometry: "narrower heart-shaped feminine face",
    jaw: "delicate soft jaw with fine adult feminine finish",
    cheekbones: "higher soft cheekbones",
    nose: "narrower soft feminine nose",
    eyes: "light hazel or soft green-brown eyes with gentle lids",
    lips: "medium soft lips with light natural color",
    hairTexture: "light-to-medium brown fine waves",
    haircut: "long soft layers with natural movement — not salon glam",
    facialHair: "none",
    bodyStructure: "lean soft feminine frame",
    expression: "quiet friendly editorial calm — email / couple campaign ready",
    stylingDirection: "premium soft lifestyle basics — oversized tee / hoodie",
    backgroundDirection: "pale warm casting wall",
    lightingDirection: "gentle diffused daylight",
  },
  {
    id: "female-d-mena-warm",
    archetypeId: ARCH_FEMALE,
    slot: "D",
    name: "Warm MENA Lifestyle Hero",
    gender: "female",
    ageRange: "24-30",
    ancestryDirection: "warm brown / Middle Eastern or North African female direction",
    skinTone: "warm medium brown / golden olive-brown skin — never a recolor of A–C",
    faceGeometry: "broader balanced feminine face with strong soft presence",
    jaw: "soft but structured feminine jaw",
    cheekbones: "broad soft supportive cheekbones",
    nose: "stronger natural feminine nose with character",
    eyes: "dark expressive almond eyes with soft lids",
    lips: "fuller warm natural lips",
    hairTexture: "thick dark near-black hair with natural wave",
    haircut: "long thick dark hair with soft center or side part — lived-in",
    facialHair: "none",
    bodyStructure: "natural feminine lean-soft shoulders and lifestyle silhouette",
    expression: "premium warm lifestyle confidence — couple / social campaign",
    stylingDirection: "premium lifestyle streetwear — oversized hoodie hero look",
    backgroundDirection: "clean warm lifestyle casting grey",
    lightingDirection: "soft editorial daylight with warm fill",
  },
] as const;

export const ALL_DISCOVERY_BLUEPRINTS: readonly ArchetypeCandidateBlueprint[] = [
  ...MEDITERRANEAN_DISCOVERY_BLUEPRINTS,
  ...URBAN_DISCOVERY_BLUEPRINTS,
  ...FEMALE_DISCOVERY_BLUEPRINTS,
];

const BLUEPRINTS_BY_ARCHETYPE_ID: Record<
  string,
  readonly ArchetypeCandidateBlueprint[]
> = {
  [ARCH_MED]: MEDITERRANEAN_DISCOVERY_BLUEPRINTS,
  [ARCH_URBAN]: URBAN_DISCOVERY_BLUEPRINTS,
  [ARCH_FEMALE]: FEMALE_DISCOVERY_BLUEPRINTS,
};

export function slotForCandidateNumber(candidateNumber: number): DiscoverySlot {
  const slot = SLOT_BY_NUMBER[candidateNumber];
  if (!slot) {
    throw new DiscoveryBlueprintError(`Official Brand Face discovery only supports slots 1–4 (got ${candidateNumber})`, { candidateNumber },
    );
  }
  return slot;
}

export function requiredGenderForArchetype(
  archetype: Pick<BrandArchetype, "genderPresentation" | "slug" | "id">,
): BlueprintGender {
  if (
    archetype.slug === "female-lifestyle-hero" ||
    archetype.genderPresentation.toLowerCase().startsWith("female")
  ) {
    return "female";
  }
  return "male";
}

export function listDiscoveryBlueprintsForArchetype(
  archetypeId: string,
): readonly ArchetypeCandidateBlueprint[] {
  const list = BLUEPRINTS_BY_ARCHETYPE_ID[archetypeId];
  if (!list || list.length !== 4) {
    throw new DiscoveryBlueprintError(`No A1 discovery blueprints for archetype ${archetypeId}`, { archetypeId },
    );
  }
  return list;
}

export function resolveDiscoveryBlueprint(input: {
  archetypeId: string;
  candidateNumber: number;
}): ArchetypeCandidateBlueprint {
  const slot = slotForCandidateNumber(input.candidateNumber);
  const list = listDiscoveryBlueprintsForArchetype(input.archetypeId);
  const blueprint = list.find((b) => b.slot === slot);
  if (!blueprint) {
    throw new DiscoveryBlueprintError(`Missing discovery blueprint for ${input.archetypeId} slot ${slot}`, );
  }
  if (blueprint.archetypeId !== input.archetypeId) {
    throw new DiscoveryBlueprintError("Discovery blueprint archetype mismatch", {
        expected: input.archetypeId,
        got: blueprint.archetypeId,
      },
    );
  }
  return blueprint;
}

export function assertBlueprintGenderMatchesArchetype(
  blueprint: ArchetypeCandidateBlueprint,
  archetype: Pick<BrandArchetype, "id" | "slug" | "genderPresentation" | "name">,
): void {
  const required = requiredGenderForArchetype(archetype);
  if (blueprint.gender !== required) {
    throw new DiscoveryBlueprintError(`Discovery blueprint gender mismatch for ${archetype.name}: blueprint=${blueprint.gender} required=${required}`, {
        archetypeId: archetype.id,
        blueprintId: blueprint.id,
        blueprintGender: blueprint.gender,
        requiredGender: required,
      },
    );
  }
  if (blueprint.archetypeId !== archetype.id) {
    throw new DiscoveryBlueprintError("Blueprint does not belong to the selected archetype", {
        archetypeId: archetype.id,
        blueprintArchetypeId: blueprint.archetypeId,
        blueprintId: blueprint.id,
      },
    );
  }
}

/** Biological identity descriptor — must be unique per slot within an archetype. */
export function blueprintIdentityDescriptor(
  blueprint: ArchetypeCandidateBlueprint,
): string {
  return [
    `Unique adult ${blueprint.gender} identity ${blueprint.slot} — ${blueprint.name}`,
    `${blueprint.ancestryDirection}`,
    `age ≈${blueprint.ageRange}`,
    `skin: ${blueprint.skinTone}`,
    `face: ${blueprint.faceGeometry}`,
    `jaw: ${blueprint.jaw}`,
    `eyes: ${blueprint.eyes}`,
    `nose: ${blueprint.nose}`,
    `lips: ${blueprint.lips}`,
    `hair: ${blueprint.hairTexture}; cut: ${blueprint.haircut}`,
    `facial hair: ${blueprint.facialHair}`,
    `body: ${blueprint.bodyStructure}`,
    `expression: ${blueprint.expression}`,
  ].join(" — ");
}

export function blueprintHairDescriptor(
  blueprint: ArchetypeCandidateBlueprint,
): string {
  return `${blueprint.hairTexture} | ${blueprint.haircut}`;
}

export function blueprintFaceTrio(
  blueprint: ArchetypeCandidateBlueprint,
): string {
  return `${blueprint.nose} | ${blueprint.eyes} | ${blueprint.jaw}`;
}

/**
 * Convert blueprint → CandidateVariationProfile for diversity/quality helpers.
 * Biology comes ONLY from the blueprint — never from global variation slots.
 */
export function variationProfileFromBlueprint(
  blueprint: ArchetypeCandidateBlueprint,
  archetype: Pick<BrandArchetype, "name" | "wardrobeDirection">,
): import("@/lib/persona/creation/candidate-intelligence/variations").CandidateVariationProfile {
  const identityDescriptor = blueprintIdentityDescriptor(blueprint);
  const hair = blueprintHairDescriptor(blueprint);
  return {
    id: blueprint.id,
    label: blueprint.name,
    style: blueprint.name.toLowerCase(),
    identityDescriptor,
    faceGeometry: blueprint.faceGeometry,
    jawShape: blueprint.jaw,
    chinShape: blueprint.jaw,
    eyeShape: blueprint.eyes,
    eyeSpacing: "natural spacing from archetype discovery blueprint",
    noseShape: blueprint.nose,
    lipShape: blueprint.lips,
    skinTone: blueprint.skinTone,
    hairTexture: blueprint.hairTexture,
    haircut: blueprint.haircut,
    facialHair: blueprint.facialHair,
    bodyBuild: blueprint.bodyStructure,
    shoulderProfile: blueprint.bodyStructure,
    socialPresence: blueprint.expression,
    stylingDirection: blueprint.stylingDirection,
    faceStructure: blueprint.faceGeometry,
    jawline: blueprint.jaw,
    cheekbones: blueprint.cheekbones,
    nose: blueprint.nose,
    hair,
    stubble: blueprint.facialHair,
    body: blueprint.bodyStructure,
    posture: "relaxed natural casting stance from blueprint",
    expression: blueprint.expression,
    presence: blueprint.expression,
    wardrobe: blueprint.stylingDirection || archetype.wardrobeDirection,
    lighting: blueprint.lightingDirection,
    background: blueprint.backgroundDirection,
    aesthetic: `${archetype.name} · ${blueprint.name}`,
    promptLines: [
      `Official Brand Face blueprint: ${blueprint.name} (${blueprint.slot}).`,
      `Gender locked: adult ${blueprint.gender} only.`,
      `Ancestry: ${blueprint.ancestryDirection}.`,
      identityDescriptor,
    ],
  };
}

/** Safe run-specific creative variation token — not a seed, not shown to users. */
export function discoveryRunVariationToken(creationProjectId: string): string {
  return shortHash(`obf-discovery-run:${creationProjectId}`, 10);
}

export function promptFingerprint(text: string): string {
  return shortHash(text, 16);
}

export function formatBlueprintIdentityPrompt(
  blueprint: ArchetypeCandidateBlueprint,
): string {
  return [
    `2. CANDIDATE-SPECIFIC BIOLOGICAL IDENTITY — Slot ${blueprint.slot} (${blueprint.name})`,
    `THIS PERSON ONLY — adult ${blueprint.gender}, age ≈${blueprint.ageRange}.`,
    `Ancestry direction: ${blueprint.ancestryDirection}.`,
    `Skin: ${blueprint.skinTone}.`,
    `Face geometry: ${blueprint.faceGeometry}.`,
    `Jaw: ${blueprint.jaw}. Cheekbones: ${blueprint.cheekbones}.`,
    `Nose: ${blueprint.nose}. Eyes: ${blueprint.eyes}. Lips: ${blueprint.lips}.`,
    `Hair texture: ${blueprint.hairTexture}. Haircut: ${blueprint.haircut}.`,
    `Facial hair: ${blueprint.facialHair}.`,
    "Do NOT reuse another candidate's face, hair, skin recipe, or body.",
    "Do NOT generate a recolored version of another slot.",
  ].join("\n");
}

export function assertDiscoveryCastBlueprintsUnique(
  blueprints: readonly ArchetypeCandidateBlueprint[],
): void {
  if (blueprints.length !== 4) {
    throw new DiscoveryBlueprintError(`A1 discovery requires exactly 4 blueprints, got ${blueprints.length}`, );
  }
  const ids = new Set(blueprints.map((b) => b.id));
  const descriptors = new Set(blueprints.map((b) => blueprintIdentityDescriptor(b)));
  const faces = new Set(blueprints.map((b) => b.faceGeometry));
  const hairs = new Set(blueprints.map((b) => blueprintHairDescriptor(b)));
  const trios = new Set(blueprints.map((b) => blueprintFaceTrio(b)));
  const skins = new Set(blueprints.map((b) => b.skinTone));
  if (ids.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate blueprint IDs in discovery cast");
  }
  if (descriptors.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate identity descriptors in discovery cast", );
  }
  if (faces.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate face geometries in discovery cast", );
  }
  if (hairs.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate hair descriptors in discovery cast", );
  }
  if (trios.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate nose/eye/jaw combinations in discovery cast", );
  }
  if (skins.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate skin-tone descriptions in discovery cast", );
  }
}

export function logDiscoveryBlueprintTrace(payload: {
  archetypeId: string;
  blueprintId: string;
  promptFingerprint: string;
  creationProjectId: string;
  requiredGender: BlueprintGender;
}): void {
  if (process.env.NODE_ENV === "production") return;
  console.info("[persona-discovery-blueprint]", {
    archetypeId: payload.archetypeId,
    blueprintId: payload.blueprintId,
    promptFingerprint: payload.promptFingerprint,
    creationProjectId: payload.creationProjectId,
    requiredGender: payload.requiredGender,
  });
}
