/**
 * Mediterranean Premium Hero — L2 Slot Blueprints (Phase 2.1A).
 *
 * Casting lanes with controlled pools. Never exact permanent persons.
 */

import type { ControlledPools, DiscoverySlot, SlotBlueprint } from "./types";

export const MEDITERRANEAN_ARCHETYPE_ID =
  "arch-mediterranean-premium-hero" as const;

export const SLOT_BLUEPRINT_VERSION = "2.1A.0" as const;

const SHARED_CAMERA_RULES = [
  "A1 casting-editorial: mid-torso or chest upward, shoulders fully visible",
  "Slight 10–20° body rotation — never passport-centered symmetry",
  "50mm–85mm portrait lens direction, shallow but natural depth of field",
  "Controlled casting set — not a campaign location",
] as const;

const SHARED_QUALITY_BAR =
  "Agency-signed premium streetwear campaign model — photoreal, commercially memorable, suitable for homepage / Shopify / social / future video";

function pools(p: ControlledPools): ControlledPools {
  return p;
}

const SLOT_A_POOLS = pools({
  skinToneExact: [
    "light-medium warm olive with soft sun-kissed peach undertone",
    "light warm olive with subtle golden cheek flush",
    "medium-light Iberian olive with soft peach midtones",
    "warm light olive with faint freckling-ready tone",
  ],
  facialRatioVariant: [
    "balanced soft vertical thirds with slightly longer lower face",
    "elegant midface with narrower bizygomatic width",
    "soft oval proportions with calm vertical balance",
    "refined midface length with gentle lower-third softness",
  ],
  faceGeometry: [
    "elegant soft oval silhouette with gently rounded temples",
    "narrow-to-medium soft oval cranial outline",
    "smooth oval face with refined chin tip readiness",
    "soft oval with calm temple curves — never rectangular",
  ],
  forehead: [
    "medium-smooth forehead with soft temples",
    "calm medium forehead height with gentle vertical plane",
    "soft forehead with light temple openness",
  ],
  eyebrows: [
    "medium soft arched brows with natural sparse outer tails",
    "soft medium brows with gentle upward outer arch",
    "natural soft arch with lighter outer density",
  ],
  eyeShape: [
    "warm expressive almond eyes with softly open lids",
    "calm almond eyes with luminous soft lid character",
    "open soft-luxury almond lids with gentle crease",
    "expressive almond shape with relaxed upper lid",
  ],
  eyeSpacing: [
    "slightly wider interpupillary spacing — open soft-luxury gaze",
    "open balanced spacing with soft-luxury width",
    "moderately wide set with calm open midface",
    "wider-than-average soft spacing — never dense urban close-set",
  ],
  noseBridge: [
    "slim straight high-ish bridge — refined Iberian soft luxury",
    "narrow straight bridge with delicate root",
    "slim refined bridge with soft vertical line",
    "narrow elegant bridge — never broad Maghrebi root",
  ],
  noseWidth: [
    "narrow alar width — delicate nostrils",
    "slim alar base with fine nostril character",
    "narrow-to-medium refined width",
    "delicate narrow alar span",
  ],
  noseTip: [
    "soft rounded tip with light definition",
    "refined soft tip — never bulbous, never aquiline",
    "delicate rounded tip with calm definition",
    "soft lightly defined tip with slim character",
  ],
  jaw: [
    "refined elegant jaw with soft masculine angle",
    "clean soft jawline without square mass",
    "narrow elegant jaw with gentle gonial soft angle",
    "refined masculine jaw — never athletic flare",
  ],
  chin: [
    "refined rounded chin tip with light projection",
    "soft rounded chin — no cleft, no square block",
    "elegant light-projection chin tip",
    "gentle rounded menton with soft luxury finish",
  ],
  cheekbones: [
    "elegant medium cheekbones with soft under-cheek volume",
    "soft medium cheek support — never hollow fashion cut",
    "gentle mid-cheek volume with calm plane",
  ],
  lips: [
    "medium-soft lips with gentle cupid bow",
    "soft medium lips with light philtrum definition",
    "calm closed mouth with medium soft vermillion",
  ],
  ears: [
    "medium neat ears close to the head with soft lobes",
    "low-projection neat ears with soft helix",
    "close-set medium ears — low athletic projection",
  ],
  hairline: [
    "soft rounded natural hairline with gentle temple curves",
    "natural soft hairline without harsh widow's peak",
    "gentle temple-curve hairline — soft luxury edge",
    "rounded natural hairline with calm density at temples",
  ],
  haircut: [
    "modern soft taper with loose textured crown waves",
    "soft luxury medium-short waves with lived-in crown",
    "textured soft taper — not fade-heavy street",
    "loose crown waves with refined soft sides",
  ],
  beardPattern: [
    "subtle uneven 2–3 day stubble denser on chin and upper lip",
    "refined light chin-weighted shadow — never full beard",
    "soft uneven stubble with lighter cheeks",
    "light designer stubble focused on jaw tip and philtrum",
  ],
  microExpression: [
    "relaxed mouth, almost-smile without teeth, calm attentive gaze",
    "quiet confidence with soft focused eyes",
    "calm approachable resting mouth with soft eye contact",
  ],
  asymmetry: [
    "mild natural left-cheek softness and uneven stubble density",
    "subtle brow-height difference with soft left bias",
    "natural cheek-plane asymmetry — authentic not plastic",
    "uneven freckle-ready nose-bridge texture with mild left softness",
  ],
  optionalMicroMarks: [
    "none",
    "faint freckling across nose bridge only",
    "tiny mole near left outer cheek",
    "subtle beauty mark below right lip corner",
  ],
  garmentColor: [
    "washed-black heavyweight oversized T-shirt",
    "charcoal heavyweight oversized T-shirt",
    "deep washed black oversized tee with soft fade",
  ],
  castingBackground: [
    "warm grey mineral-plaster studio wall",
    "soft warm-grey premium casting plaster",
    "muted warm concrete casting wall",
  ],
});

const SLOT_B_POOLS = pools({
  skinToneExact: [
    "medium olive-brown with warm amber undertone",
    "deeper medium olive with amber cheek variation",
    "warm medium-brown olive with visible cheek texture readiness",
    "medium Maghrebi olive-brown clearly deeper than Iberian soft luxury",
  ],
  facialRatioVariant: [
    "athletic proportions — shorter midface relative to jaw width",
    "wider mandible balance with stronger horizontal lower face",
    "longer vertical facial balance with athletic lower third",
    "rectangular athletic ratios with firm jaw mass",
  ],
  faceGeometry: [
    "longer athletic rectangular face with clear vertical planes",
    "rectangular athletic outline with wider lower third",
    "longer cranial rectangular silhouette — never soft oval",
    "athletic rectangular face with firm vertical length",
  ],
  forehead: [
    "broader flatter forehead with stronger brow shelf",
    "horizontal athletic forehead plane",
    "broader forehead with firmer brow presence",
  ],
  eyebrows: [
    "dense straight low-set brows with continuous dark hair",
    "flat dense urban brows — never soft arched Iberian",
    "low straight masculine brow bar with dense coverage",
  ],
  eyeShape: [
    "deeper-set dark brown eyes with heavier lids",
    "calm urban intensity lids — deeper set than soft luxury",
    "heavier-lid dark eyes with denser crease",
    "deep-set almond-dark eyes with urban lid weight",
  ],
  eyeSpacing: [
    "closer interpupillary spacing — denser urban eye set",
    "moderately close athletic spacing",
    "compact urban eye spacing — never soft-luxury wide",
    "closer-set deep eyes with denser midface",
  ],
  noseBridge: [
    "broader lower bridge with stronger nasal root",
    "stronger Maghrebi nasal root with broader character",
    "broader athletic bridge — not Iberian slim",
    "lower broader bridge with firm root mass",
  ],
  noseWidth: [
    "wider alar base than soft-luxury Iberian",
    "medium-wide Maghrebi alar width",
    "broader alar span with natural street-premium character",
    "wider nostrils supporting stronger bridge",
  ],
  noseTip: [
    "stronger rounded tip with clearer tip definition",
    "athletic rounded tip — not aquiline, not refined soft",
    "fuller defined tip with Maghrebi character",
    "strong tip mass with clear definition",
  ],
  jaw: [
    "stronger masculine jaw with broader gonial angle",
    "athletic jaw with firmer chin mass readiness",
    "broader mandible with urban masculine angle",
    "stronger gonial flare — never soft-luxury refined",
  ],
  chin: [
    "firmer squared chin mass with clear menton",
    "athletic squared chin — no soft rounded tip",
    "firm chin block with clear projection",
    "stronger menton mass with square soft edge",
  ],
  cheekbones: [
    "higher angular cheekbones with lean midface hollow",
    "athletic cheek planes with lean under-cheek",
    "higher angular support with urban midface",
  ],
  lips: [
    "fuller medium-wide lips with stronger philtrum",
    "denser vermillion with calm closed mouth",
    "fuller medium lips — stronger than soft luxury",
  ],
  ears: [
    "slightly larger projected ears with clearer helix",
    "more athletic ear projection",
    "moderate projection ears supporting rectangular head",
  ],
  hairline: [
    "lower denser hairline with tight temple fade edge",
    "dense low hairline supporting short textured curls",
    "tight temple-fade hairline with urban precision",
    "lower dense Maghrebi hairline — never soft temple recession",
  ],
  haircut: [
    "short textured curls with clean low fade",
    "dense coil-wave short crop with low fade",
    "urban short curls — never medium-length creative waves",
    "tight textured curl crop with precise fade",
  ],
  beardPattern: [
    "well-kept short dense stubble covering cheeks and jaw evenly",
    "even dense cheek-to-jaw stubble with sharp cheek edge",
    "short urban stubble denser along jawline",
    "dense refined stubble — sharper than chin-only soft luxury",
  ],
  microExpression: [
    "soft focused eyes, relaxed mouth, quiet street confidence",
    "cooler urban calm with strong camera hold",
    "modern urban confidence without aggression",
  ],
  asymmetry: [
    "natural cheek-plane asymmetry and uneven curl density at temples",
    "subtle left brow density difference with urban character",
    "uneven stubble edge along right jaw",
    "mild midface hollow asymmetry — authentic Maghrebi street",
  ],
  optionalMicroMarks: [
    "none",
    "small mole on left cheekbone",
    "faint scar-like texture note near right brow (subtle, natural)",
    "tiny mark above left lip corner",
  ],
  garmentColor: [
    "black zip hoodie over plain dark heavyweight T-shirt",
    "charcoal zip hoodie over dark heavyweight tee",
    "washed charcoal hoodie open over black heavyweight tee",
  ],
  castingBackground: [
    "muted charcoal-grey casting studio wall",
    "quiet premium charcoal agency wall",
    "deep muted grey mineral casting backdrop",
  ],
});

const SLOT_C_POOLS = pools({
  skinToneExact: [
    "warm light-olive with soft golden undertone",
    "lighter golden olive with cooler cheek flush",
    "warm light Hellenic olive — lighter than Maghrebi",
    "soft golden light-olive creative tone",
  ],
  facialRatioVariant: [
    "slim artistic proportions — longer midface, narrower jaw",
    "lighter overall facial mass with longer midface",
    "narrow jaw relative to cheekbones — creative taper",
    "airy vertical forehead-to-chin creative balance",
  ],
  faceGeometry: [
    "slim triangular / soft diamond face with narrow chin",
    "soft diamond outline with open midface",
    "slim artistic face — never oval soft luxury, never rectangular",
    "narrow-chin diamond silhouette with open temples",
  ],
  forehead: [
    "higher open forehead with airy temples",
    "taller forehead vault with creative openness",
    "high open forehead — more vertical than athletic slots",
  ],
  eyebrows: [
    "finer soft brows with natural break and lighter density",
    "soft lifted outer brow with natural break",
    "lighter artistic brows — never dense urban bars",
  ],
  eyeShape: [
    "large expressive hazel-to-warm-brown eyes with open lids",
    "open expressive creative lids with soft crease",
    "larger open eyes with artistic lid character",
    "expressive warm-brown open lids — softer than deep-set urban",
  ],
  eyeSpacing: [
    "widest interpupillary spacing of the Mediterranean cast",
    "open expressive wide set — creative gaze",
    "wide artistic spacing with open midface",
    "maximum open spacing within Hellenic creative lane",
  ],
  noseBridge: [
    "narrow bridge with slight natural irregularity / micro-bump",
    "Greek character narrow bridge with soft irregularity",
    "narrow artistic bridge — not model-perfect straight",
    "slim bridge with Hellenic micro-character",
  ],
  noseWidth: [
    "narrow-to-medium alar width — finer than Maghrebi",
    "narrow creative alar span",
    "fine medium-narrow nostrils",
    "narrower alar base than street-premium athletic",
  ],
  noseTip: [
    "slightly downturned character tip — artistic",
    "character tip with soft downturn — not soft rounded Iberian",
    "artistic tip with light downward character",
    "narrow character tip — never aquiline Levantine hero",
  ],
  jaw: [
    "soft tapered jaw with narrow chin and minimal gonial flare",
    "slim artistic jaw — still adult masculine",
    "tapered creative jaw without square athletic mass",
    "narrow soft jawline with creative taper",
  ],
  chin: [
    "narrow pointed-soft chin with minimal projection",
    "artistic taper chin — never square hero",
    "soft narrow menton with light point",
    "delicate narrow chin tip with creative finish",
  ],
  cheekbones: [
    "high prominent cheekbones with visible under-cheek hollow",
    "artistic high cheek support with hollow readiness",
    "prominent creative cheekbones — open midface",
  ],
  lips: [
    "softer thinner-medium lips with delicate cupid bow",
    "lighter vermillion with artistic almost-smile readiness",
    "delicate medium-thin lips — lighter than Maghrebi/Levantine",
  ],
  ears: [
    "smaller close-set ears with delicate lobes",
    "low projection refined ears",
    "delicate close ears supporting slim head",
  ],
  hairline: [
    "higher soft temple-receding creative hairline",
    "soft creative hairline framing medium-length waves",
    "higher open temples with gentle recession cue",
    "airy creative hairline — never dense low hero crop",
  ],
  haircut: [
    "medium-length loose curls or waves past the ears",
    "chestnut creative waves with airy movement",
    "medium loose waves — never short fade",
    "editorial medium-length textured waves",
  ],
  beardPattern: [
    "clean-shaven or extremely sparse light stubble only on upper lip",
    "near clean-shaven with whisper upper-lip shadow",
    "extremely sparse creative stubble — never designer cheek stubble",
    "clean creative jaw with minimal upper-lip note",
  ],
  microExpression: [
    "naturally composed, soft focused eyes, almost-smile without teeth",
    "relaxed artistic resting calm",
    "expressive calm gaze with effortless camera ease",
  ],
  asymmetry: [
    "visible natural asymmetry in brow height and cheek hollow",
    "memorable left brow lift difference",
    "uneven creative wave density at temples",
    "mild cheek hollow asymmetry — never cloned symmetry",
  ],
  optionalMicroMarks: [
    "none",
    "faint freckle cluster on right cheek",
    "tiny mole near left nostril",
    "subtle mark on right temple hairline",
  ],
  garmentColor: [
    "off-white oversized heavyweight T-shirt",
    "muted stone oversized heavyweight T-shirt",
    "pale stone washed oversized tee",
  ],
  castingBackground: [
    "soft off-white pale concrete studio",
    "natural window-light pale casting wall",
    "soft pale mineral plaster backdrop",
  ],
});

const SLOT_D_POOLS = pools({
  skinToneExact: [
    "warm medium-rich olive with deeper golden-bronze undertone",
    "richest Levantine olive-bronze of the Mediterranean cast",
    "warm medium-rich olive — never a recolor of Iberian/Maghrebi/Hellenic",
    "deeper golden-bronze olive with campaign warmth",
  ],
  facialRatioVariant: [
    "premium campaign proportions — widest bizygomatic and mandibular width",
    "balanced vertical thirds with heroic lower-face presence",
    "broad campaign width with strong horizontal presence",
    "flagship hero ratios with broad cheek-to-jaw span",
  ],
  faceGeometry: [
    "broad balanced rectangular hero head with strong horizontal presence",
    "widest cranial footprint rectangular hero outline",
    "broad campaign rectangular silhouette",
    "strong horizontal hero head — never slim diamond or soft oval",
  ],
  forehead: [
    "broader hero forehead with stronger horizontal brow plane",
    "broad frontal width with hero brow shelf",
    "stronger horizontal forehead mass than creative slot",
  ],
  eyebrows: [
    "thick straight dense near-black brows with continuous coverage",
    "straight dense near-horizontal hero brows",
    "strongest continuous brow shelf of the Mediterranean cast",
  ],
  eyeShape: [
    "dark deep expressive almond eyes with strong lid crease",
    "steady campaign almond eyes with warm authority lids",
    "deep expressive almond with strong crease — hero hold",
    "dark almond campaign eyes — not soft-luxury openness",
  ],
  eyeSpacing: [
    "balanced campaign eye spacing — between open soft luxury and close urban",
    "steady mid campaign spacing",
    "balanced hero interpupillary set",
    "campaign-balanced spacing with strong lid presence",
  ],
  noseBridge: [
    "strong aquiline-leaning high bridge — Levantine hero nasal root",
    "high aquiline-family bridge with clear character",
    "strong hero bridge — not narrow Iberian, not wide-flat Maghrebi",
    "elevated aquiline-leaning root with campaign mass",
  ],
  noseWidth: [
    "medium-strong alar width supporting hero bridge",
    "medium-strong Levantine alar span",
    "hero alar width — not Maghrebi widest, not Iberian narrowest",
    "fuller medium-strong nostrils for aquiline family",
  ],
  noseTip: [
    "fuller defined tip with downward character — aquiline family",
    "stronger tip mass with downward Levantine character",
    "full defined aquiline-family tip — never soft Iberian tip",
    "campaign tip with clear downward definition",
  ],
  jaw: [
    "strongest controlled square jaw with clear chin mass",
    "premium hero square jaw — not soft Iberian or tapered creative",
    "controlled square mandible with campaign width",
    "strong square jawline with firm gonial presence",
  ],
  chin: [
    "strong square chin with optional soft dimple readiness",
    "highest chin mass of the Mediterranean cast",
    "square hero menton with clear projection",
    "strong chin block with soft dimple option",
  ],
  cheekbones: [
    "broad supportive high cheekbones with campaign-plane width",
    "wider cheek support than soft luxury / creative slots",
    "broad hero cheek planes",
  ],
  lips: [
    "fuller wide lips with soft volume and strong cupid definition",
    "denser lip volume than Iberian/Hellenic slots",
    "full campaign lips with calm closed mouth",
  ],
  ears: [
    "stronger lobed ears with clearer antihelix",
    "moderate projection supporting hero head width",
    "stronger ear presence with hero cranial width",
  ],
  hairline: [
    "dense low near-black hairline with thick textured crop support",
    "dense low hero hairline — no soft temple recession",
    "thick near-black low hairline with campaign density",
    "low dense Levantine hairline framing textured crop",
  ],
  haircut: [
    "thick near-black textured crop — dense modern hero cut",
    "dense textured hero crop — never medium-length waves",
    "near-black coarse textured crop with modern density",
    "flagship textured crop — never Maghrebi curl fade",
  ],
  beardPattern: [
    "short even beard or dense refined stubble denser along jawline",
    "continuous hero beard shadow along jaw",
    "dense refined jawline stubble — not clean-shaven creative",
    "short even hero beard with denser mandibular line",
  ],
  microExpression: [
    "calm attentive gaze, relaxed mouth, quiet confidence",
    "warm hero resting authority without CEO hardness",
    "steady calm camera hold with approachable intensity",
  ],
  asymmetry: [
    "subtle natural asymmetry in brow shelf and beard density along jaw",
    "mild left brow shelf weight difference",
    "uneven jawline stubble density — authentic campaign human",
    "soft right cheek plane difference under hero lighting",
  ],
  optionalMicroMarks: [
    "none",
    "soft chin dimple emphasis",
    "tiny mole on right cheek",
    "subtle mark near left brow outer third",
  ],
  garmentColor: [
    "charcoal heavyweight hoodie",
    "washed-dark oversized heavyweight T-shirt",
    "deep charcoal oversized tee with heavyweight drape",
  ],
  castingBackground: [
    "neutral warm concrete or stone-grey background",
    "warm stone-grey premium casting wall",
    "neutral warm concrete casting set",
  ],
});

function mediterraneanLane(input: {
  slot: DiscoverySlot;
  id: string;
  name: string;
  ageRange: string;
  regionalCluster: string;
  skinToneRange: string;
  bodyDirection: string;
  facialProportionFamily: string;
  hairTextureFamily: string;
  facialHairFamily: string;
  expressionFamily: string;
  fashionDirection: string;
  brandRole: string;
  crossSlotExclusions: readonly string[];
  controlledPools: ControlledPools;
}): SlotBlueprint {
  return {
    id: input.id,
    version: SLOT_BLUEPRINT_VERSION,
    archetypeId: MEDITERRANEAN_ARCHETYPE_ID,
    slot: input.slot,
    name: input.name,
    gender: "male",
    ageRange: input.ageRange,
    regionalCluster: input.regionalCluster,
    skinToneRange: input.skinToneRange,
    bodyDirection: input.bodyDirection,
    facialProportionFamily: input.facialProportionFamily,
    hairTextureFamily: input.hairTextureFamily,
    facialHairFamily: input.facialHairFamily,
    expressionFamily: input.expressionFamily,
    qualityBar: SHARED_QUALITY_BAR,
    garmentCategories: ["oversized_heavyweight_tee", "heavyweight_hoodie", "zip_hoodie"],
    cameraRules: [...SHARED_CAMERA_RULES],
    crossSlotExclusions: input.crossSlotExclusions,
    controlledPools: input.controlledPools,
    fashionDirection: input.fashionDirection,
    brandRole: input.brandRole,
  };
}

export const MEDITERRANEAN_SLOT_BLUEPRINTS: readonly SlotBlueprint[] = [
  mediterraneanLane({
    slot: "A",
    id: "med-lane-a-soft-luxury",
    name: "Mediterranean Soft Luxury",
    ageRange: "24-29",
    regionalCluster: "Spanish Mediterranean / Iberian soft luxury",
    skinToneRange: "light-medium warm olive to soft sun-kissed peach Iberian band",
    bodyDirection: "tall lean naturally athletic soft-luxury model frame",
    facialProportionFamily: "soft oval elegant midface family",
    hairTextureFamily: "dark chocolate-brown soft waves / fine-to-medium strands",
    facialHairFamily: "light uneven 2–3 day stubble family — never full beard",
    expressionFamily: "quiet confidence — calm approachable soft luxury",
    fashionDirection: "washed-black / charcoal oversized heavyweight tee — soft luxury lane",
    brandRole: "Homepage · Shopify · Premium Campaign",
    crossSlotExclusions: [
      "Maghrebi athletic rectangular skull",
      "Greek/Balkan slim diamond creative head",
      "Levantine broad aquiline hero skull",
      "dense urban curl fade",
      "square hero chin mass",
    ],
    controlledPools: SLOT_A_POOLS,
  }),
  mediterraneanLane({
    slot: "B",
    id: "med-lane-b-north-african-street",
    name: "North African Street Premium",
    ageRange: "24-30",
    regionalCluster: "North African / Maghrebi street premium",
    skinToneRange: "medium olive-brown to warm amber Maghrebi band — deeper than Iberian",
    bodyDirection: "tall slim-athletic fashion build with thicker athletic neck",
    facialProportionFamily: "longer athletic rectangular lower-third family",
    hairTextureFamily: "dark dense coil-wave curls — Maghrebi street-premium",
    facialHairFamily: "short dense even stubble family — sharper cheek edge",
    expressionFamily: "modern urban confidence — cooler streetwear attitude",
    fashionDirection: "black/charcoal zip hoodie over dark heavyweight tee — street premium",
    brandRole: "Social · Zip Hoodie · Community Campaign",
    crossSlotExclusions: [
      "Spanish Iberian soft oval",
      "Greek/Balkan slim diamond",
      "Levantine aquiline broad hero",
      "medium-length creative waves",
      "soft luxury narrow refined nose",
    ],
    controlledPools: SLOT_B_POOLS,
  }),
  mediterraneanLane({
    slot: "C",
    id: "med-lane-c-southern-creative",
    name: "Southern European Creative",
    ageRange: "23-29",
    regionalCluster: "Greek / Balkan Mediterranean creative",
    skinToneRange: "warm light-olive to soft golden Hellenic band",
    bodyDirection: "tall lean creative-model build with long slender neck",
    facialProportionFamily: "slim diamond-triangular artistic midface family",
    hairTextureFamily: "medium chestnut-brown loose waves — creative editorial",
    facialHairFamily: "clean-shaven to extremely sparse upper-lip shadow family",
    expressionFamily: "artistic relaxed contemporary presence",
    fashionDirection: "off-white / muted stone oversized heavyweight tee — lifestyle editorial",
    brandRole: "Lifestyle · Editorial Social · Storytelling",
    crossSlotExclusions: [
      "Spanish Iberian soft oval",
      "Maghrebi athletic rectangular",
      "Levantine broad aquiline hero",
      "short urban curl fade",
      "dense hero jawline beard",
    ],
    controlledPools: SLOT_C_POOLS,
  }),
  mediterraneanLane({
    slot: "D",
    id: "med-lane-d-levantine-hero",
    name: "Levantine Modern Hero",
    ageRange: "25-31",
    regionalCluster: "Lebanese / Levantine Eastern Mediterranean",
    skinToneRange: "warm medium-rich olive to deeper golden-bronze Levantine band",
    bodyDirection: "tall lean-athletic with slightly broader shoulders — flagship hero",
    facialProportionFamily: "broad balanced rectangular campaign hero family",
    hairTextureFamily: "thick near-black dense coarse texture — Levantine hero",
    facialHairFamily: "short even beard / dense jawline stubble family",
    expressionFamily: "premium hero presence — calm authority without CEO energy",
    fashionDirection: "charcoal heavyweight hoodie or washed-dark oversized tee — flagship",
    brandRole: "Flagship Campaign · Product Hero · Video",
    crossSlotExclusions: [
      "Spanish Iberian soft oval",
      "Maghrebi athletic street skull",
      "Greek/Balkan slim diamond creative",
      "medium-length creative waves",
      "soft luxury narrow refined jaw",
    ],
    controlledPools: SLOT_D_POOLS,
  }),
] as const;

export function listMediterraneanSlotBlueprints(): readonly SlotBlueprint[] {
  return MEDITERRANEAN_SLOT_BLUEPRINTS;
}

export function getMediterraneanSlotBlueprint(
  slot: DiscoverySlot,
): SlotBlueprint {
  const found = MEDITERRANEAN_SLOT_BLUEPRINTS.find((b) => b.slot === slot);
  if (!found) {
    throw new Error(`Missing Mediterranean slot blueprint for slot ${slot}`);
  }
  return found;
}

export function listSlotBlueprintsForArchetype(
  archetypeId: string,
): readonly SlotBlueprint[] {
  if (archetypeId === MEDITERRANEAN_ARCHETYPE_ID) {
    return MEDITERRANEAN_SLOT_BLUEPRINTS;
  }
  return [];
}

export function resolveSlotBlueprint(input: {
  archetypeId: string;
  slot: DiscoverySlot;
}): SlotBlueprint {
  const list = listSlotBlueprintsForArchetype(input.archetypeId);
  const found = list.find((b) => b.slot === input.slot);
  if (!found) {
    throw new Error(
      `Missing slot blueprint for archetype ${input.archetypeId} slot ${input.slot}`,
    );
  }
  return found;
}
