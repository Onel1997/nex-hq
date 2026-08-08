/**
 * Mediterranean Premium Hero — L2 Slot Blueprints (Phase 2.1A).
 *
 * Casting lanes with controlled pools. Never exact permanent persons.
 */

import type { ControlledPools, DiscoverySlot, SlotBlueprint } from "./types";

export const MEDITERRANEAN_ARCHETYPE_ID =
  "arch-mediterranean-premium-hero" as const;

/** Bumped in 2.2K for softer primary streetwear face refinement (all Mediterranean slots). */
export const SLOT_BLUEPRINT_VERSION = "2.2K.0" as const;

const SHARED_CAMERA_RULES = [
  "A1 casting-editorial: mid-torso or chest upward, shoulders fully visible",
  "Never passport-centered symmetry — each slot uses its own camera height and crop",
  "Real camera / real lens rendering — photographic depth, natural shadows",
  "Controlled casting set — not a campaign location",
] as const;

const SLOT_A_CAMERA_RULES = [
  ...SHARED_CAMERA_RULES,
  "Slot A: ~85mm intimate quiet-luxury distance, camera slightly above eye level",
  "Slot A: soft window key from camera-left, gentle 8–12° head turn",
] as const;

const SLOT_B_CAMERA_RULES = [
  ...SHARED_CAMERA_RULES,
  "Slot B: ~50mm documentary-fashion distance, eye-level to slightly below",
  "Slot B: harder directional key from camera-right, firmer 15–20° body rotation",
] as const;

const SLOT_C_CAMERA_RULES = [
  ...SHARED_CAMERA_RULES,
  "Slot C: ~70mm editorial portrait with airy headroom, camera slightly below eye level",
  "Slot C: soft high-window wrap, soft three-quarter turn toward camera-right",
] as const;

const SLOT_D_CAMERA_RULES = [
  ...SHARED_CAMERA_RULES,
  "Slot D: ~58–65mm commercial streetwear casting distance, true eye-level hold",
  "Slot D: warm soft even key with gentle cheek dimension — no Rembrandt drama, subtle 5–10° turn",
] as const;

const SHARED_QUALITY_BAR =
  "Primary Brand Face — cleaner younger soft-masculine commercial streetwear ambassador (apparent age ~22–25) who looks good in oversized tees — softer oval / subtle rectangular, reduced facial width, natural medium jaw, softer lower face, youthful cheeks, relaxed open eyes, balanced brows, clean shave or very light stubble — ~70% approachable commercial · ~20% premium polish · ~10% masculine edge — “He looks good in that outfit,” not extremely masculine/model face — never rugged, beard-heavy, square oversized jaw, or alpha-male casting — QUALITY BAR only, never a prior Candidate D identity copy";

function pools(p: ControlledPools): ControlledPools {
  return p;
}

/** Phase 2.1E — Soft Luxury lane expanded for biological distance within Iberian premium. */
const SLOT_A_POOLS = pools({
  skinToneExact: [
    "light-medium warm olive with soft sun-kissed peach undertone",
    "light warm olive with subtle golden cheek flush",
    "medium-light Iberian olive with soft peach midtones",
    "warm light olive with even clear complexion — no freckling emphasis",
    "fair-warm Iberian olive with soft porcelain-peach balance",
  ],
  facialRatioVariant: [
    "balanced soft vertical thirds with slightly longer lower face",
    "elegant midface with narrower bizygomatic width",
    "elongated vertical balance with longer midface",
    "subtle heart-oval ratios with narrower chin relative to temples",
    "slim oblong proportions with calm vertical length",
  ],
  faceGeometry: [
    "elegant soft oval silhouette with gently rounded temples",
    "elongated oval cranial outline with refined length",
    "subtle heart-oval face with softer temple-to-chin taper",
    "slim oblong face with quiet premium length — never rectangular athletic",
    "softly angular oval with light cheek-plane definition",
  ],
  forehead: [
    "medium-smooth forehead with soft temples",
    "straighter forehead plane with calm vertical height",
    "wider upper forehead with open frontal presence",
    "narrower temples with focused frontal width",
    "higher forehead vault with soft luxury openness",
  ],
  eyebrows: [
    "medium soft arched brows with natural sparse outer tails",
    "soft medium brows with gentle upward outer arch",
    "natural soft arch with lighter outer density",
    "straighter soft-luxury brows with light density",
  ],
  eyeShape: [
    "rounded almond eyes with soft premium lid character",
    "hooded almond eyes with quiet luxury lid weight",
    "softer downturned outer-corner eyes — approachable commercial",
    "calm medium-open almond lids with refined crease",
    "warm more-relaxed almond eyes with soft lids and smile potential",
  ],
  eyeSpacing: [
    "wider-set soft-luxury spacing with open midface",
    "medium balanced interpupillary spacing",
    "slightly deep-set spacing with quieter eye recess",
    "open balanced spacing with soft-luxury width",
    "moderately wide set with calm open midface",
  ],
  noseBridge: [
    "narrow straight bridge with delicate root",
    "medium-width straight Iberian bridge",
    "subtle convex bridge with soft character — never aquiline hero",
    "broader soft bridge with gentle root mass",
    "slim refined bridge with soft vertical line",
  ],
  noseWidth: [
    "narrow alar width — delicate nostrils",
    "medium-width soft alar base",
    "narrow-to-medium refined width",
    "soft broader alar span within Iberian premium",
    "balanced medium alar character — not Maghrebi widest",
  ],
  noseTip: [
    "soft rounded tip with light definition",
    "slightly upturned soft tip with calm lift",
    "defined rounded tip with clear soft finish",
    "refined soft tip — never bulbous, never aquiline",
    "delicate rounded tip with calm definition",
  ],
  jaw: [
    "refined tapered jaw with soft masculine finish — less pronounced",
    "softly angular jaw with light gonial definition",
    "narrow elegant jaw with gentle gonial soft angle",
    "moderate mandibular width with calm premium line — slightly less facial width",
    "clean soft jawline without square mass",
  ],
  chin: [
    "narrower soft chin with light projection",
    "broader rounded chin with gentle menton mass",
    "refined rounded chin tip with light projection",
    "soft rounded chin — no cleft, no square block",
    "elegant light-projection chin tip",
  ],
  cheekbones: [
    "softer medium cheekbones with soft under-cheek volume",
    "soft medium cheek support — never hollow fashion cut",
    "gentle mid-cheek volume with calm plane",
    "slightly higher soft cheek support with quiet definition",
  ],
  lips: [
    "medium-soft lips with gentle cupid bow",
    "soft medium lips with light philtrum definition",
    "calm closed mouth with medium soft vermillion and effortless smile potential",
  ],
  ears: [
    "medium neat ears close to the head with soft lobes",
    "low-projection neat ears with soft helix",
    "close-set medium ears — low athletic projection",
  ],
  hairline: [
    "straight natural soft-luxury hairline",
    "soft M-shape hairline with gentle temple notches",
    "higher corner hairline with open temples",
    "rounded natural hairline with calm density at temples",
    "uneven natural hairline with lived-in temple variation",
  ],
  haircut: [
    "short textured curls with soft natural crown",
    "natural curly crop — lived-in streetwear",
    "clean taper fade with textured top",
    "low fade with relaxed wavy medium top",
    "effortless messy curls — never perfect editorial hair",
  ],
  beardPattern: [
    "clean-shaven soft luxury jaw",
    "clean shave with faint peach-fuzz only",
    "very light separated natural stubble with uneven cheek gaps",
    "whisper-light stubble covering jaw lightly — never dense",
    "near clean-shaven with sparse upper-lip note — never full beard",
  ],
  microExpression: [
    "relaxed mouth with effortless smile potential, warmer attentive gaze",
    "quiet confidence with soft relaxed eyes",
    "warmer approachable resting mouth with soft eye contact",
  ],
  asymmetry: [
    "mild natural left-cheek softness and uneven stubble density",
    "subtle brow-height difference with soft left bias",
    "natural cheek-plane asymmetry — authentic not plastic",
    "uneven temple hairline density with mild left softness",
  ],
  optionalMicroMarks: [
    "none",
    "cheek mole on left mid-cheek",
    "temple mole near right hairline",
    "subtle cheek pigmentation variation — natural not freckle field",
    "faint under-eye texture note — realistic, never beauty-filter",
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
    "athletic proportions — shorter midface relative to jaw width, slightly moderated facial width",
    "wider mandible balance with softer horizontal lower face",
    "longer vertical facial balance with soft-masculine lower third",
    "rectangular soft-masculine ratios with natural jaw mass — never oversized",
  ],
  faceGeometry: [
    "longer soft-masculine rectangular face with clear vertical planes",
    "rectangular soft-masculine outline with warmer lower third",
    "longer cranial rectangular silhouette — never soft oval",
    "athletic rectangular face with firm vertical length — slightly less facial width",
  ],
  forehead: [
    "broader flatter forehead with natural brow shelf",
    "horizontal athletic forehead plane",
    "broader forehead with softer brow presence",
  ],
  eyebrows: [
    "dense straight low-set brows with continuous dark hair",
    "flat dense urban brows — never soft arched Iberian",
    "low straight masculine brow bar with dense coverage",
  ],
  eyeShape: [
    "deeper-set dark brown eyes with softer heavier lids",
    "calmer urban lids — deeper set than soft luxury, never hunter intensity",
    "softer-lid dark eyes with denser crease",
    "deep-set almond-dark eyes with relaxed urban lid weight",
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
    "broader soft-masculine jaw with subtler gonial angle — less pronounced",
    "athletic jaw with softer chin mass readiness — never oversized",
    "broader mandible with urban soft-masculine angle",
    "clearer gonial presence than soft luxury — never razor runway",
  ],
  chin: [
    "firmer soft-square chin with clear menton — not intimidating",
    "athletic soft-square chin — no soft rounded tip",
    "firm chin with clear projection — never superhero block",
    "stronger menton mass with soft square edge",
  ],
  cheekbones: [
    "softer medium-high cheekbones with lean midface — never hollow fashion cut",
    "soft athletic cheek planes with gentle under-cheek",
    "medium-high soft cheek support with urban midface",
  ],
  lips: [
    "fuller medium-wide lips with stronger philtrum",
    "denser vermillion with calm closed mouth and effortless smile potential",
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
    "natural curly crop with low fade",
    "dense coil-wave short crop — effortless streetwear",
    "clean taper fade with textured curls — never perfect editorial hair",
  ],
  beardPattern: [
    "clean-shaven Maghrebi street jaw",
    "clean shave with faint natural shadow only",
    "very light urban stubble — never dense",
    "whisper-light cheek-to-jaw stubble with soft edge — never full beard",
  ],
  microExpression: [
    "relaxed open eyes, soft mouth, quiet youthful street confidence",
    "calmer urban friendly approachable camera hold",
    "modern urban confidence without aggression or ruggedness",
  ],
  asymmetry: [
    "natural cheek-plane asymmetry and uneven curl density at temples",
    "subtle left brow density difference with urban character",
    "uneven stubble edge along right jaw",
    "mild midface softness asymmetry — authentic Maghrebi street",
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
    "softer medium-high cheekbones with gentle under-cheek volume",
    "artistic soft cheek support — never hollow fashion cut",
    "softer creative cheekbones — open midface",
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
    "short natural waves with soft crown — cleaner contemporary streetwear",
    "cropped messy curls — never long editorial male-model waves",
    "short chestnut textured crop with soft taper",
    "occasionally medium loose waves — diversity only, never long editorial",
  ],
  beardPattern: [
    "clean-shaven creative jaw",
    "near clean-shaven with whisper upper-lip shadow",
    "extremely sparse light stubble — never designer cheek stubble",
    "clean creative jaw with minimal upper-lip note — never beard",
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
    "deeper golden-bronze olive with commercial warmth — natural imperfections welcome",
  ],
  facialRatioVariant: [
    "commercial premium proportions — wider bizygomatic and mandibular width, slightly moderated",
    "balanced vertical thirds with warmer lower-face presence — never superhero mass",
    "broader commercial width with soft horizontal presence",
    "flagship ambassador ratios with natural cheek-to-jaw span — slightly less facial width",
  ],
  faceGeometry: [
    "balanced rectangular Levantine head with warm horizontal presence",
    "wider cranial footprint rectangular outline — slightly less facial width than prior hero casting",
    "soft commercial rectangular silhouette — never slim diamond or soft oval",
    "warm horizontal ambassador head — never movie-hero mass",
  ],
  forehead: [
    "broader natural forehead with balanced brow plane",
    "broad frontal width with natural brow shelf",
    "stronger horizontal forehead mass than creative slot — never intimidating",
  ],
  eyebrows: [
    "thick straight dense near-black brows with continuous coverage",
    "straight dense near-horizontal soft-masculine brows",
    "continuous brow shelf of the Mediterranean cast — never aggressive hunter bars",
  ],
  eyeShape: [
    "dark more-relaxed almond eyes with soft lid crease",
    "steady commercial almond eyes with warmer approachable lids",
    "relaxed almond with soft crease — commercial hold, not editorial intensity",
    "dark almond commercial eyes — not soft-luxury openness, not hunter stare",
  ],
  eyeSpacing: [
    "balanced commercial eye spacing — between open soft luxury and close urban",
    "steady mid commercial spacing",
    "balanced ambassador interpupillary set",
    "commercial-balanced spacing with soft lid presence",
  ],
  noseBridge: [
    "natural aquiline-leaning high bridge — Levantine character nasal root",
    "high aquiline-family bridge with clear character",
    "Levantine character bridge — not narrow Iberian, not wide-flat Maghrebi",
    "elevated aquiline-leaning root with natural mass",
  ],
  noseWidth: [
    "medium-strong alar width supporting Levantine bridge",
    "medium-strong Levantine alar span",
    "ambassador alar width — not Maghrebi widest, not Iberian narrowest",
    "fuller medium-strong nostrils for aquiline family",
  ],
  noseTip: [
    "fuller defined tip with downward character — aquiline family",
    "stronger tip mass with downward Levantine character",
    "full defined aquiline-family tip — never soft Iberian tip",
    "commercial tip with clear downward definition",
  ],
  jaw: [
    "less pronounced soft-masculine jaw with natural chin mass",
    "premium commercial jaw — broader than Iberian/creative, never oversized square",
    "controlled soft-masculine mandible with natural width",
    "clear but softer jawline with gentle gonial presence — never superhero structure",
  ],
  chin: [
    "natural broader chin with optional soft dimple readiness",
    "highest chin mass of the Mediterranean cast — never intimidating block",
    "soft-square menton with clear projection",
    "natural chin with soft dimple option — never superhero chin",
  ],
  cheekbones: [
    "softer supportive cheekbones with natural commercial width",
    "wider cheek support than soft luxury / creative slots — never sculpted",
    "soft ambassador cheek planes — never perfume-campaign hollow",
  ],
  lips: [
    "fuller wide lips with soft volume and soft cupid definition",
    "denser lip volume than Iberian/Hellenic slots",
    "full commercial lips with calm closed mouth and effortless smile potential",
  ],
  ears: [
    "stronger lobed ears with clearer antihelix",
    "moderate projection supporting Levantine head width",
    "stronger ear presence with commercial cranial width",
  ],
  hairline: [
    "dense low near-black hairline with thick textured crop support",
    "dense low Levantine hairline — no soft temple recession",
    "thick near-black low hairline with commercial density",
    "low dense Levantine hairline framing textured crop",
  ],
  haircut: [
    "natural curly crop — thick textured streetwear",
    "short textured curls with soft modern density",
    "thick textured crop with clean taper — never perfect editorial hair",
    "effortless dense curly crop — contemporary premium streetwear",
  ],
  beardPattern: [
    "clean-shaven Levantine ambassador jaw",
    "clean shave with faint natural shadow only",
    "very light natural stubble — never dense jawline beard",
    "whisper-light stubble with soft mandibular note — never full beard",
  ],
  microExpression: [
    "relaxed open eyes, approachable neutral mouth, quiet youthful confidence",
    "warm commercial resting calm without CEO hardness or rugged hero energy",
    "steady calm camera hold with approachable trustworthiness",
  ],
  asymmetry: [
    "subtle natural asymmetry in brow shelf and light stubble density",
    "mild left brow shelf weight difference",
    "uneven very light stubble density — authentic commercial human",
    "soft right cheek plane difference under soft even lighting",
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
  cameraRules: readonly string[];
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
    cameraRules: [...input.cameraRules],
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
    ageRange: "22-25",
    regionalCluster: "Spanish Mediterranean / Iberian soft luxury",
    skinToneRange: "light-medium warm olive to soft sun-kissed peach Iberian band",
    bodyDirection: "tall lean naturally athletic streetwear casting frame — never bodybuilder",
    facialProportionFamily: "softer oval narrow-to-medium midface family — reduced facial width",
    hairTextureFamily: "dark chocolate-brown short soft waves / fine-to-medium strands",
    facialHairFamily: "clean shave or very light natural stubble family — never full beard",
    expressionFamily: "calm friendly quiet youthful confidence — approachable commercial streetwear presence",
    fashionDirection: "washed-black / charcoal oversized heavyweight tee — soft streetwear lane",
    brandRole: "Homepage · Shopify · Premium Campaign",
    crossSlotExclusions: [
      "Maghrebi athletic rectangular skull",
      "Greek/Balkan slim diamond creative head",
      "Levantine broad aquiline hero skull",
      "dense urban curl fade",
      "square hero chin mass",
    ],
    controlledPools: SLOT_A_POOLS,
    cameraRules: SLOT_A_CAMERA_RULES,
  }),
  mediterraneanLane({
    slot: "B",
    id: "med-lane-b-north-african-street",
    name: "North African Street Premium",
    ageRange: "22-25",
    regionalCluster: "North African / Maghrebi street premium",
    skinToneRange: "medium olive-brown to warm amber Maghrebi band — deeper than Iberian",
    bodyDirection: "tall slim-athletic streetwear build with thicker athletic neck — never bodybuilder",
    facialProportionFamily: "longer soft-masculine subtle rectangular family — reduced facial width",
    hairTextureFamily: "dark dense coil-wave curls — Maghrebi street-premium",
    facialHairFamily: "clean shave or very light natural stubble family — never dense beard",
    expressionFamily: "calm friendly urban youthful confidence — approachable commercial streetwear attitude",
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
    cameraRules: SLOT_B_CAMERA_RULES,
  }),
  mediterraneanLane({
    slot: "C",
    id: "med-lane-c-southern-creative",
    name: "Southern European Creative",
    ageRange: "22-25",
    regionalCluster: "Greek / Balkan Mediterranean creative",
    skinToneRange: "warm light-olive to soft golden Hellenic band",
    bodyDirection: "tall lean creative streetwear build with long slender neck — never bodybuilder",
    facialProportionFamily: "slim diamond-triangular artistic midface family",
    hairTextureFamily: "medium chestnut-brown short natural waves — creative commercial",
    facialHairFamily: "clean-shaven to extremely sparse light stubble family — never beard",
    expressionFamily: "calm friendly artistic youthful presence — approachable, never runway severity",
    fashionDirection: "off-white / muted stone oversized heavyweight tee — lifestyle commercial",
    brandRole: "Lifestyle · Editorial Social · Storytelling",
    crossSlotExclusions: [
      "Spanish Iberian soft oval",
      "Maghrebi athletic rectangular",
      "Levantine broad aquiline hero",
      "short urban curl fade",
      "dense hero jawline beard",
    ],
    controlledPools: SLOT_C_POOLS,
    cameraRules: SLOT_C_CAMERA_RULES,
  }),
  mediterraneanLane({
    slot: "D",
    id: "med-lane-d-levantine-hero",
    name: "Levantine Modern Hero",
    ageRange: "22-25",
    regionalCluster: "Lebanese / Levantine Eastern Mediterranean",
    skinToneRange: "warm medium-rich olive to deeper golden-bronze Levantine band",
    bodyDirection: "tall lean-athletic with slightly broader shoulders — streetwear casting, never bodybuilder",
    facialProportionFamily: "balanced subtle rectangular commercial streetwear casting family — never oversized jaw",
    hairTextureFamily: "thick near-black dense coarse texture — Levantine casting",
    facialHairFamily: "clean shave or very light natural stubble family — never dense jawline beard",
    expressionFamily: "calm friendly approachable youthful confidence — without CEO or rugged-hero energy",
    fashionDirection: "charcoal heavyweight hoodie or washed-dark oversized tee — flagship streetwear",
    brandRole: "Flagship Campaign · Product Hero · Video",
    crossSlotExclusions: [
      "Spanish Iberian soft oval",
      "Maghrebi athletic street skull",
      "Greek/Balkan slim diamond creative",
      "medium-length creative waves",
      "soft luxury narrow refined jaw",
    ],
    controlledPools: SLOT_D_POOLS,
    cameraRules: SLOT_D_CAMERA_RULES,
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
