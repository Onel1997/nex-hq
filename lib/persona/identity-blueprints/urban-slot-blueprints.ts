/**
 * Phase 2.5B — Urban Community Hero L2 Slot Blueprints.
 * Second permanent male Brand Face: dark-skinned / Black, 21–25, short-hair A–D.
 * Never exact permanent persons. No provider calls.
 */

import type { ControlledPools, DiscoverySlot, SlotBlueprint } from "./types";

export const URBAN_ARCHETYPE_ID = "arch-urban-community-hero" as const;
export const URBAN_SLOT_BLUEPRINT_VERSION = "2.5B.5" as const;

const SHARED_CAMERA_RULES = [
  "A1 casting-editorial: head-and-shoulders / chest-up, shoulders fully visible",
  "Never passport-centered symmetry — each slot uses its own camera height and crop",
  "Real camera / real lens rendering — photographic depth, natural shadows",
  "Soft natural daylight commercial casting — no dramatic cinematic lighting",
  "Controlled casting set — not a campaign location",
  "Accurate dark-skin exposure — real pores, subtle tonal variation — no orange cast, no plastic AI skin",
] as const;

const SHARED_QUALITY_BAR =
  "Second permanent male Brand Face — cool modern naturally stylish Black / Afro-European commercial casting (apparent age ~21–25) — lean to athletic — approachable confident natural — hair rotates per discovery run (short, curls, afro, twists, braids, locs all allowed) — clean shave or light stubble — “I want to wear what he is wearing” — never hyper-masculine, never harsh or cold — QUALITY BAR only";

function pools(p: ControlledPools): ControlledPools {
  return p;
}

const SLOT_A_CAMERA_RULES = [
  ...SHARED_CAMERA_RULES,
  "Slot A: ~85mm intimate community casting distance, camera slightly above eye level",
  "Slot A: soft window key from camera-left, gentle 8–12° head turn",
] as const;

const SLOT_B_CAMERA_RULES = [
  ...SHARED_CAMERA_RULES,
  "Slot B: ~50mm documentary-fashion distance, eye-level to slightly below",
  "Slot B: clearer directional key from camera-right, firmer 15–20° body rotation",
] as const;

const SLOT_C_CAMERA_RULES = [
  ...SHARED_CAMERA_RULES,
  "Slot C: ~70mm commercial portrait with airy headroom, camera slightly below eye level",
  "Slot C: soft high-window wrap, soft three-quarter turn toward camera-right",
] as const;

const SLOT_D_CAMERA_RULES = [
  ...SHARED_CAMERA_RULES,
  "Slot D: ~58–65mm commercial streetwear casting distance, true eye-level hold",
  "Slot D: warm soft even key with gentle cheek dimension — optimized for deep skin",
] as const;

const SLOT_A_POOLS = pools({
  skinToneExact: [
    "rich deep brown with warm undertone",
    "deep warm brown with soft golden cheek midtones",
    "rich mahogany-brown with natural highlight variation",
    "deep brown with warm red-brown undertone — never orange cast",
  ],
  facialRatioVariant: [
    "softer wider midface with shorter vertical lower third",
    "friendly midface width with soft lower-face taper",
    "open upper face with rounded cranial curve",
  ],
  faceGeometry: [
    "softer oval / slightly rounded face with friendly midface",
    "soft oval-round community silhouette — softer jaw — wider-set eyes cue",
    "rounded friendly midface — never longer narrow oval Slot B twin",
  ],
  forehead: [
    "soft rounded forehead with gentle temples",
    "open friendly forehead with calm frontal width",
    "soft medium forehead with rounded temple curve",
  ],
  eyebrows: [
    "soft medium brows with rounded arch",
    "natural soft arch with lighter outer density",
    "friendly rounded brows — never dense straight bars",
  ],
  eyeShape: [
    "softly rounded warm eyes with open lids",
    "warm medium-open eyes with soft lids",
    "kind calm rounded almond eyes",
    "soft community eyes with gentle outer-corner lift",
  ],
  eyeSpacing: [
    "open medium-wide friendly spacing",
    "balanced open community spacing",
    "slightly wider friendly midface spacing",
    "open balanced community spacing with soft midface width"
  ],
  noseBridge: [
    "softer lower bridge",
    "soft medium-low bridge with warm community character",
    "broader soft bridge — never aquiline",
    "soft low-medium bridge with community warmth"
  ],
  noseWidth: [
    "broader soft alar width",
    "soft medium-broad alar span",
    "friendly broader nose base",
    "friendly soft-broad alar reading"
  ],
  noseTip: [
    "rounded soft tip",
    "soft rounded tip with calm finish",
    "gentle rounded tip — never sharp",
    "soft blunt rounded tip with calm finish"
  ],
  jaw: [
    "soft rounded jaw with low angularity",
    "gentle mandibular curve — never razor-sharp",
    "soft community jawline with low gonial definition",
    "soft rounded mandibular curve with friendly width"
  ],
  chin: [
    "soft rounded chin with low angular projection",
    "gentle rounded chin tip",
    "soft menton — no square block",
    "rounded soft chin with gentle vertical finish"
  ],
  cheekbones: [
    "soft full cheek volume — friendly community face",
    "gentle mid-cheek volume with calm plane",
    "soft cheek support — never hollow fashion cut",
  ],
  lips: [
    "fuller natural lips with soft volume",
    "medium-full soft lips with calm mouth",
    "full soft vermillion with approachable closed mouth",
  ],
  ears: [
    "medium soft ears close to head with rounded lobes",
    "low-projection soft ears",
    "close-set medium ears — friendly community read",
  ],
  hairline: [
    "natural soft coil hairline with rounded temples under short textured curls",
    "soft rounded hairline supporting short curls + low taper",
    "natural temple curve under short textured curls — never braids",
    "soft coil hairline with gentle temple roundness under short curls"
  ],
  haircut: [
    "short textured curls with clean low taper",
    "short soft curls + low taper — clearly SHORT",
    "short textured coil crown with clean taper sides — NEVER braids/cornrows/locs",
    "short soft textured curls + clean low taper sides"
  ],
  beardPattern: [
    "clean-shaven soft community jaw",
    "clean shave with faint peach-fuzz only",
    "very light separated natural stubble — never full beard",
    "clean-shaven with optional faint cheek fuzz only"
  ],
  microExpression: [
    "soft neutral-friendly mouth, open calm eyes",
    "easy community warmth with quiet confidence",
    "approachable confident resting mouth",
  ],
  asymmetry: [
    "mild natural cheek fullness asymmetry",
    "subtle brow-height difference with soft left bias",
    "natural temple hairline density variation",
    "subtle left-right cheek softness difference"
  ],
  optionalMicroMarks: [
    "none",
    "cheek mole on left mid-cheek",
    "subtle cheek pigmentation variation — natural",
    "faint under-eye texture note — realistic",
  ],
  garmentColor: [
    "faded grey heavyweight oversized hoodie",
    "muted taupe heavyweight oversized hoodie",
    "soft charcoal oversized hoodie",
  ],
  castingBackground: [
    "soft airy warm-grey casting plaster",
    "neutral soft community casting wall",
    "light mineral plaster casting backdrop",
  ],
});

const SLOT_B_POOLS = pools({
  skinToneExact: [
    "medium-deep brown with cooler undertone",
    "cool medium-deep brown with clean midtone",
    "deeper cool brown — distinct from warm Slot A",
    "medium-deep espresso with cooler cheek plane",
  ],
  facialRatioVariant: [
    "longer oval with leaner midface",
    "structured vertical thirds with longer midface",
    "lean oblong proportions with clearer brow plane",
  ],
  faceGeometry: [
    "longer narrow oval face with clearer vertical structure",
    "elongated narrow oval — more defined jaw — deeper-set eyes cue",
    "lean longer narrow face — never soft rounded Slot A twin",
  ],
  forehead: [
    "longer vertical forehead with clearer brow plane",
    "straighter forehead plane with structured height",
    "longer frontal plane — structured street presence",
  ],
  eyebrows: [
    "denser defined brows with straighter line",
    "straighter denser brow — structured masculine",
    "defined medium-dense straight brow",
  ],
  eyeShape: [
    "almond dark eyes with calm focused gaze",
    "leaner almond lids with focused commercial crease",
    "calm almond eyes — never soft rounded community twin",
    "narrower structured almond lids with commercial focus",
  ],
  eyeSpacing: [
    "closer focused almond spacing",
    "medium-focused interpupillary spacing",
    "slightly closer structured spacing",
    "focused medium spacing with structured commercial hold"
  ],
  noseBridge: [
    "straighter medium-broad bridge",
    "defined medium-broad bridge",
    "straighter bridge with clearer root — not soft Slot A",
    "clearer straighter medium-broad root line"
  ],
  noseWidth: [
    "medium-broad defined alar",
    "defined medium-broad nose base",
    "structured medium-broad alar span",
    "structured medium-broad alar with clean edges"
  ],
  noseTip: [
    "defined medium tip",
    "clearer medium tip finish",
    "defined tip — never soft rounded Slot A twin",
    "medium defined tip with street-commercial finish"
  ],
  jaw: [
    "firmer defined jaw without aggressive hard angles",
    "leaner mandibular line with calm definition",
    "structured jaw — never hyper-masculine square",
    "lean structured jaw with calm street definition"
  ],
  chin: [
    "firmer defined chin without aggressive square",
    "leaner chin projection with controlled finish",
    "structured chin tip — never soft rounded Slot A",
    "leaner chin with controlled street projection"
  ],
  cheekbones: [
    "higher lean cheekbones",
    "higher cheek support with lean plane",
    "leaner cheek structure — structured street",
  ],
  lips: [
    "medium-full lips with clear natural shape",
    "medium lips with defined vermillion",
    "clear medium-full closed mouth",
  ],
  ears: [
    "leaner ears with clearer helix",
    "slightly more projected lean ears",
    "structured ear helix — leaner than Slot A",
  ],
  hairline: [
    "clean fade hairline with sharp temple edge under very short crop",
    "tight fade hairline supporting buzz-adjacent crop",
    "clean short-crop hairline — never braids",
    "sharp fade temple edge under very short dense crop"
  ],
  haircut: [
    "very short crop / buzz-adjacent with clean fade",
    "buzz-adjacent short crop + clean fade — clearly SHORT",
    "very short dense texture with fade — NEVER braids/cornrows/locs",
    "ultra-short buzz-adjacent crop with clean fade"
  ],
  beardPattern: [
    "clean shave with structured jaw",
    "very light natural stubble — never heavy full beard",
    "near clean-shaven with sparse upper-lip note",
    "clean structured shave — no dense beard shadow"
  ],
  microExpression: [
    "relaxed mouth, soft focused eyes — never harsh",
    "calm modern street confidence",
    "quiet focused commercial hold",
  ],
  asymmetry: [
    "natural jaw-side stubble density variation",
    "subtle brow density asymmetry",
    "uneven temple fade density",
    "subtle right-left jaw-plane definition difference"
  ],
  optionalMicroMarks: [
    "none",
    "temple mole near right hairline",
    "subtle cheek plane texture variation",
    "faint under-eye texture — realistic",
  ],
  garmentColor: [
    "charcoal heavyweight oversized hoodie",
    "washed black oversized tee",
    "deep charcoal oversized tee",
  ],
  castingBackground: [
    "cooler charcoal casting stone wall",
    "neutral cool-grey casting backdrop",
    "dense tonal grey casting plaster",
  ],
});

const SLOT_C_POOLS = pools({
  skinToneExact: [
    "warm medium-brown with golden undertone",
    "warm medium brown with soft golden cheek flush",
    "lighter-than-A warm brown with golden midtones",
    "warm caramel-brown — distinct from cool Slot B",
  ],
  facialRatioVariant: [
    "softer heart-shaped proportions with narrower chin",
    "open upper face with lighter lower cranial mass",
    "youthful heart ratios with fuller upper cheeks",
  ],
  faceGeometry: [
    "heart / tapered face with higher cheekbones and shorter lower face",
    "soft heart silhouette — broader nose — fuller upper lip — upturned eyes cue",
    "youthful heart taper — never broader rectangular Slot D",
  ],
  forehead: [
    "softer higher forehead with open youthful temples",
    "open lifestyle forehead with soft temples",
    "higher soft forehead vault",
  ],
  eyebrows: [
    "lighter soft brows with gentle lift",
    "soft lifestyle brow with gentle arch",
    "lighter brows — never dense Slot D bars",
  ],
  eyeShape: [
    "large warm brown eyes with open friendly lids",
    "open warm eyes with soft smile potential",
    "wide-open friendly lids — lifestyle social",
    "bright open lifestyle eyes with soft upper-lid show",
  ],
  eyeSpacing: [
    "wide open friendly spacing",
    "open social eye spacing",
    "wider friendly lifestyle spacing",
    "open youthful lifestyle spacing with friendly width"
  ],
  noseBridge: [
    "softer shorter bridge",
    "soft short bridge with gentle root",
    "shorter soft bridge — lifestyle character",
    "soft short lifestyle bridge with gentle rise"
  ],
  noseWidth: [
    "softer medium alar",
    "medium soft alar span",
    "softer medium nose base",
    "soft medium lifestyle alar width"
  ],
  noseTip: [
    "rounded shorter tip",
    "soft shorter tip with calm lift",
    "rounded lifestyle tip",
    "soft rounded shorter tip with friendly lift"
  ],
  jaw: [
    "gentle jawline with soft adult masculine finish",
    "soft jaw with narrow chin taper",
    "gentle mandibular line — never structured Slot B twin",
    "soft heart-taper jaw with youthful finish"
  ],
  chin: [
    "narrower soft chin",
    "soft tapered chin tip",
    "narrower lifestyle chin",
    "narrow soft chin with light projection"
  ],
  cheekbones: [
    "soft lifted cheekbones with youthful volume",
    "youthful upper-cheek volume",
    "soft lifted cheek support",
  ],
  lips: [
    "full soft lips with natural pout, calm mouth",
    "soft full lips with almost-smile readiness",
    "full soft vermillion — lifestyle friendly",
  ],
  ears: [
    "smaller soft ears close to head",
    "delicate close-set soft ears",
    "small soft ears — lifestyle read",
  ],
  hairline: [
    "neat natural curl hairline with clean soft edges under fuller short top",
    "soft curl hairline supporting short fuller-top curls",
    "natural short-curl hairline — never twists/braids",
    "neat short-curl hairline with fuller-top support"
  ],
  haircut: [
    "short natural curls with slightly fuller top",
    "short fuller-top curls — clearly SHORT not medium/long",
    "short natural curls fuller crown — NEVER braids/twists/locs",
    "short natural curls with airy fuller crown — still SHORT"
  ],
  beardPattern: [
    "clean-shaven — no beard",
    "clean shave only",
    "completely clean-shaven jaw",
    "clean-shaven youthful jaw — zero beard"
  ],
  microExpression: [
    "easy warmth in the eyes, soft neutral-friendly mouth",
    "friendly social lifestyle resting energy",
    "open warm camera ease",
  ],
  asymmetry: [
    "natural eye-lid openness asymmetry",
    "subtle cheek volume asymmetry",
    "soft temple density variation",
    "subtle smile-ready mouth-corner asymmetry"
  ],
  optionalMicroMarks: [
    "none",
    "cheek mole on right mid-cheek",
    "subtle golden cheek pigmentation variation",
    "faint under-eye texture — realistic",
  ],
  garmentColor: [
    "off-white oversized heavyweight T-shirt",
    "muted stone oversized heavyweight T-shirt",
    "soft ivory oversized tee",
  ],
  castingBackground: [
    "warm light community casting wall",
    "pale off-white mineral plaster",
    "airy warm casting backdrop",
  ],
});

const SLOT_D_POOLS = pools({
  skinToneExact: [
    "deep dark brown / near-ebony with rich undertone",
    "deep ebony-brown with rich cool-warm balance",
    "near-ebony deep brown — never a recolor of A–C",
    "deep rich brown with accurate highlight variation",
  ],
  facialRatioVariant: [
    "broad rectangular proportions with widest jaw/cheek span",
    "broader cranial base with balanced vertical thirds",
    "campaign rectangular ratios — widest of urban cast",
  ],
  faceGeometry: [
    "broader rectangular face with wider jaw and stronger chin",
    "broad rectangular campaign silhouette — straighter brow / deeper sockets",
    "wider balanced rectangular face — never soft heart Slot C twin",
  ],
  forehead: [
    "broader campaign forehead with stronger horizontal brow mass",
    "wider frontal plane with strong brow mass",
    "broader forehead — campaign presence",
  ],
  eyebrows: [
    "thick dense dark brows — strongest of the urban cast",
    "dense straight campaign brows",
    "thick dark brows with strong presence",
  ],
  eyeShape: [
    "deep-set dark expressive eyes with calm campaign authority",
    "deep-set calm campaign eyes",
    "expressive deep dark eyes — approachable authority",
    "deeper-set campaign lids with steady commercial presence",
  ],
  eyeSpacing: [
    "balanced deep campaign spacing",
    "balanced medium-deep spacing",
    "steady campaign eye spacing",
    "balanced campaign spacing with deep-set calm"
  ],
  noseBridge: [
    "wide strong natural bridge",
    "strong wide bridge with clear character",
    "widest strong bridge of urban cast",
    "wide strong character bridge with natural mass"
  ],
  noseWidth: [
    "widest strong alar of urban cast",
    "wide strong natural alar span",
    "strong character nose width",
    "wide strong alar with campaign character"
  ],
  noseTip: [
    "strong character tip",
    "strong defined tip with natural finish",
    "character tip — never soft Slot A twin",
    "strong natural tip with calm campaign finish"
  ],
  jaw: [
    "strong controlled jaw — premium campaign structure without intimidation",
    "broader controlled jawline — never hyper-masculine aggression",
    "strong campaign jaw with calm finish",
    "broader controlled campaign jaw with approachable finish"
  ],
  chin: [
    "strong controlled campaign chin",
    "broader controlled chin tip",
    "strong menton — approachable campaign",
    "broader controlled chin with calm campaign mass"
  ],
  cheekbones: [
    "broad supportive cheekbones",
    "broad cheek support with campaign plane",
    "supportive broad cheeks",
  ],
  lips: [
    "fuller prominent natural lips",
    "full campaign lip volume with calm closed mouth",
    "fuller prominent vermillion",
  ],
  ears: [
    "stronger lobed ears supporting broader head width",
    "stronger ear lobes with broader head support",
    "campaign ear presence — broader head",
  ],
  hairline: [
    "dense short afro/coil hairline with strong temple presence — neat natural",
    "neat short textured afro hairline",
    "dense short natural texture hairline — NEVER braids",
    "dense neat short afro hairline with strong temples"
  ],
  haircut: [
    "short textured afro / neat natural texture",
    "short neat textured afro — clearly SHORT",
    "short sculpted natural afro texture — NEVER braids/cornrows/locs",
    "short neat textured afro / natural coil — clearly SHORT"
  ],
  beardPattern: [
    "clean shave or very light even stubble",
    "very light even stubble — never heavy full beard",
    "clean-shaven campaign jaw",
    "clean shave or micro-stubble only — never full beard"
  ],
  microExpression: [
    "calm attentive gaze, relaxed mouth, quiet confidence",
    "premium friendly campaign resting calm",
    "approachable campaign authority — never harsh",
  ],
  asymmetry: [
    "natural deep-skin highlight asymmetry",
    "subtle brow density asymmetry",
    "natural temple density variation under short afro",
    "subtle deep-skin highlight plane asymmetry"
  ],
  optionalMicroMarks: [
    "none",
    "cheek mole on left mid-cheek",
    "subtle deep-skin tonal variation — natural",
    "faint under-eye texture — realistic",
  ],
  garmentColor: [
    "black heavyweight oversized hoodie",
    "deep charcoal oversized tee",
    "black oversized heavyweight tee",
  ],
  castingBackground: [
    "clean campaign casting grey",
    "warm stone-grey concrete casting wall",
    "neutral campaign grey plaster",
  ],
});

function urbanLane(input: {
  slot: DiscoverySlot;
  id: string;
  name: string;
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
    version: URBAN_SLOT_BLUEPRINT_VERSION,
    archetypeId: URBAN_ARCHETYPE_ID,
    slot: input.slot,
    name: input.name,
    gender: "male",
    ageRange: "21-25",
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

export const URBAN_SLOT_BLUEPRINTS: readonly SlotBlueprint[] = [
  urbanLane({
    slot: "A",
    id: "urban-lane-a-soft-community",
    name: "Soft Community Anchor",
    regionalCluster: "Afro-European soft community West/Central diaspora",
    skinToneRange: "rich deep brown warm undertone band",
    bodyDirection: "lean to athletic relaxed streetwear casting frame — never bodybuilder",
    facialProportionFamily: "softer oval / slightly rounded midface family — softer jaw — wider-set eyes",
    hairTextureFamily:
      "short textured curls + clean low taper family — run hair may rotate (short/curls/afro/twists/braids/locs)",
    facialHairFamily: "clean shave or very light natural stubble family — never full beard",
    expressionFamily: "approachable confident natural — cool modern community presence",
    fashionDirection: "faded grey / muted taupe oversized hoodie — soft community lane",
    brandRole: "Community · Social · Lifestyle",
    crossSlotExclusions: [
      "longer oval structured street skull",
      "softer heart narrower chin lifestyle",
      "broader rectangular campaign skull",
      "very short buzz-adjacent fade",
      "short fuller-top curls",
      "short textured afro",
    ],
    controlledPools: SLOT_A_POOLS,
    cameraRules: SLOT_A_CAMERA_RULES,
  }),
  urbanLane({
    slot: "B",
    id: "urban-lane-b-structured-street",
    name: "Structured Street Presence",
    regionalCluster: "Afro-European structured street / West African diaspora street premium",
    skinToneRange: "medium-deep cooler brown band — distinct from warm Slot A",
    bodyDirection: "lean-athletic streetwear build with slightly broader shoulders — never bodybuilder",
    facialProportionFamily: "longer narrow oval structured family — defined jaw — deeper-set eyes",
    hairTextureFamily:
      "very short crop / buzz-adjacent + clean fade family — run hair may rotate",
    facialHairFamily: "clean shave or very light natural stubble family — never heavy full beard",
    expressionFamily: "relaxed modern street confidence — never aggressive / never harsh",
    fashionDirection: "charcoal hoodie / washed-black oversized tee — structured street",
    brandRole: "Street · Social · Product",
    crossSlotExclusions: [
      "softer rounded wider midface community",
      "softer heart narrower chin lifestyle",
      "broader rectangular campaign skull",
      "short textured curls + low taper",
      "short fuller-top curls",
      "short textured afro",
      "heavy full beard",
    ],
    controlledPools: SLOT_B_POOLS,
    cameraRules: SLOT_B_CAMERA_RULES,
  }),
  urbanLane({
    slot: "C",
    id: "urban-lane-c-fuller-top-curls",
    name: "Fuller-Top Short Curls",
    regionalCluster: "African-diaspora lifestyle / soft Caribbean–European creative mix",
    skinToneRange: "warm medium-brown golden undertone band",
    bodyDirection: "tall lean soft-athletic lifestyle fashion frame — never bodybuilder",
    facialProportionFamily: "heart / tapered shorter-lower-face family — higher cheekbones — broader nose",
    hairTextureFamily:
      "short natural curls slightly fuller top family — run hair may rotate",
    facialHairFamily: "clean-shaven only family — no beard",
    expressionFamily: "friendly social lifestyle energy — Instagram/TikTok natural",
    fashionDirection: "off-white / muted stone oversized heavyweight tee — lifestyle commercial",
    brandRole: "Lifestyle · Social · Storytelling",
    crossSlotExclusions: [
      "softer rounded wider midface community",
      "longer oval structured street",
      "broader rectangular campaign skull",
      "short textured curls + low taper",
      "very short buzz-adjacent fade",
      "short textured afro",
    ],
    controlledPools: SLOT_C_POOLS,
    cameraRules: SLOT_C_CAMERA_RULES,
  }),
  urbanLane({
    slot: "D",
    id: "urban-lane-d-textured-afro",
    name: "Short Textured Afro",
    regionalCluster: "Afro-European campaign / East–West African diaspora hero mix",
    skinToneRange: "deep dark brown / near-ebony rich undertone band",
    bodyDirection: "tall lean-athletic broader shoulder campaign frame — never bodybuilder",
    facialProportionFamily: "broader rectangular family — wider jaw — stronger chin — deeper eye sockets",
    hairTextureFamily:
      "short textured afro / neat natural texture family — run hair may rotate",
    facialHairFamily: "clean shave or very light even stubble family — never heavy full beard",
    expressionFamily:
      "premium friendly campaign calm — community hero without intimidation or CEO energy",
    fashionDirection: "black / deep charcoal heavyweight hoodie or oversized tee — flagship streetwear",
    brandRole: "Flagship · Product Hero · Community Campaign",
    crossSlotExclusions: [
      "softer rounded wider midface community",
      "longer oval structured street",
      "softer heart narrower chin lifestyle",
      "short textured curls + low taper",
      "very short buzz-adjacent fade",
      "short fuller-top curls",
      "hyper-masculine intimidation",
    ],
    controlledPools: SLOT_D_POOLS,
    cameraRules: SLOT_D_CAMERA_RULES,
  }),
] as const;

export function listUrbanSlotBlueprints(): readonly SlotBlueprint[] {
  return URBAN_SLOT_BLUEPRINTS;
}

export function getUrbanSlotBlueprint(slot: DiscoverySlot): SlotBlueprint {
  const found = URBAN_SLOT_BLUEPRINTS.find((b) => b.slot === slot);
  if (!found) {
    throw new Error(`Missing Urban slot blueprint for slot ${slot}`);
  }
  return found;
}
