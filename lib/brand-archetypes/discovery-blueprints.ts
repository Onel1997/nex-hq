/**
 * Phase 1.8E / 1.9 / 1.9A / 1.9A.1 — Archetype-scoped A1 discovery identity blueprints.
 *
 * Official Brand Face casting MUST use these per-archetype biological identities.
 * Global CANDIDATE_VARIATION_PROFILES must not control gender, ethnicity, or face biology.
 *
 * Phase 1.9 adds FashionCastingProfile — commercial fashion-model presence
 * distinct from biology, so candidates differ as models, not only as faces.
 *
 * Phase 1.9A deepens permanent facial anatomy per slot so candidates cannot
 * read as brothers / cloned Mediterranean templates.
 *
 * Phase 1.9A.1 adds Discovery Diversity Sampling — regional clusters + Diversity Brief
 * so A1 casts maximize biological distance within one archetype.
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

/**
 * Commercial fashion-model profile — distinct from biological Identity DNA.
 * Each slot must have a unique fashionPresence so the cast differs as models.
 */
export type FashionCastingProfile = {
  modelBuild: string;
  modelHeightDirection: string;
  shoulderLine: string;
  neckProportions: string;
  facialCharacter: string;
  memorabilityCue: string;
  commercialAppeal: string;
  fashionPresence: string;
  cameraPresence: string;
  postureDirection: string;
  microExpression: string;
  garmentBehavior: string;
  castingRiskExclusions: string[];
};

/**
 * Phase 1.9A.1 — Diversity sampling axes.
 * Treat biological distance as a first-class casting quality metric.
 */
export type DiscoveryDiversitySampling = {
  /** Regional appearance cluster — must be unique within an archetype cast. */
  regionalCluster: string;
  headShape: string;
  skullProportions: string;
  chinShape: string;
  eyeSpacing: string;
  eyebrowAngle: string;
  noseBridge: string;
  noseWidth: string;
  noseTip: string;
  facialAsymmetry: string;
  smileAnatomy: string;
  restingExpression: string;
  /** Per-slot instruction injected into the Diversity Brief. */
  slotDiversityInstruction: string;
};

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
  /** Permanent anatomy — must differ across slots within an archetype. */
  forehead: string;
  eyebrowDensity: string;
  earShape: string;
  hairline: string;
  facialProportions: string;
  hairTexture: string;
  haircut: string;
  facialHair: string;
  bodyStructure: string;
  expression: string;
  stylingDirection: string;
  backgroundDirection: string;
  lightingDirection: string;
  /** Product Intelligence–aligned garment cue for A1 (category + color only). */
  garmentDirection: string;
  /** Concise intended-use chips for card review (not fake visual scores). */
  intendedUseLabel: string;
  /** Regional + anatomical diversity sampling (Phase 1.9A.1). */
  diversitySampling: DiscoveryDiversitySampling;
  /** Commercial fashion-model presence — must be unique per slot. */
  fashionCasting: FashionCastingProfile;
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
    ancestryDirection:
      "Spanish / Iberian Mediterranean direction — soft coastal Southern Spanish premium, NOT Maghrebi, NOT Greek, NOT Levantine",
    skinTone:
      "light-medium warm olive skin with soft sun-kissed peach undertone, fine natural pores, faint freckling across nose bridge only",
    faceGeometry:
      "elegant soft oval face — smooth oval silhouette, gently rounded temples, refined chin tip; NEVER rectangular, NEVER brother to B/C/D",
    jaw: "refined elegant jaw with soft masculine angle — clean line without square mass or aggressive flare",
    cheekbones: "elegant medium cheekbones with soft under-cheek volume — never hollow, never sharp fashion cut",
    nose: "narrow refined straight nose with soft tip and delicate nostrils — slim bridge, not wide",
    eyes: "warm expressive almond brown eyes, softly open lids, slightly wider inter-eye spacing, calm luminous gaze",
    lips: "medium-soft lips with gentle cupid bow and light philtrum definition — calm closed mouth",
    forehead: "medium-smooth forehead with soft temples and calm vertical height — never heavy brow shelf",
    eyebrowDensity: "medium soft arched brows with natural sparse outer tails — never dense straight bars",
    earShape: "medium neat ears close to the head with soft lobes — low projection",
    hairline: "soft rounded natural hairline with gentle temple curves — no harsh widow’s peak, no low dense crop edge",
    facialProportions:
      "balanced soft vertical thirds with slightly longer lower face softness; narrower bizygomatic width than Candidate D; elegant midface",
    hairTexture: "dark chocolate-brown soft waves with lived-in density and fine-to-medium strands",
    haircut: "modern soft taper with loose textured crown waves — premium soft luxury, not fade-heavy street",
    facialHair:
      "subtle uneven 2–3 day stubble denser on chin and upper lip than cheeks — refined light shadow, never full beard",
    bodyStructure:
      "tall lean naturally athletic soft-luxury model frame with elegant neck column — never ordinary desk-job proportions",
    expression: "quiet confidence — calm, approachable soft luxury; not smiling broadly",
    stylingDirection: "washed-black heavyweight oversized T-shirt — Milaene Product Intelligence only",
    backgroundDirection:
      "warm grey mineral-plaster studio wall — premium agency casting set, not a campaign location",
    lightingDirection: "soft side daylight with gentle directional falloff — dimensional face, controlled shadows",
    garmentDirection:
      "washed-black heavyweight oversized T-shirt — visible oversized shoulder and sleeve drape; no logos, no graphics, no text",
    intendedUseLabel: "Homepage · Shopify · Premium Campaign",
    diversitySampling: {
      regionalCluster: "Spanish Mediterranean / Iberian soft luxury",
      headShape: "narrow-to-medium soft oval head — elegant cranial silhouette",
      skullProportions: "balanced cranial vault with softer occipital curve — never broad hero skull",
      chinShape: "refined rounded chin tip with light projection — no cleft, no square block",
      eyeSpacing: "slightly wider interpupillary spacing — open soft-luxury gaze",
      eyebrowAngle: "soft upward outer arch — never flat low urban bars",
      noseBridge: "slim straight high-ish bridge — refined Iberian soft luxury",
      noseWidth: "narrow alar width — delicate nostrils",
      noseTip: "soft rounded tip with light definition — never bulbous, never aquiline hook",
      facialAsymmetry: "mild natural left-cheek softness and uneven stubble density — authentic human, not plastic symmetry",
      smileAnatomy: "closed-mouth almost-smile with soft upper-lip lift — no full tooth grin anatomy engaged",
      restingExpression: "calm approachable resting face — quiet confidence without blank passport stare",
      slotDiversityInstruction:
        "Slot A must read as a Spanish/Iberian soft-luxury agency model — maximum distance from Maghrebi B, Greek/Balkan C, and Levantine D. Different skull, jaw, nose template, and eye spacing from all other slots.",
    },
    fashionCasting: {
      modelBuild: "lean and naturally athletic tall-model impression — fashion agency signed, not gym-heavy",
      modelHeightDirection: "tall-model impression around 184–190 cm direction",
      shoulderLine: "elegant relaxed shoulder line — fully visible in frame",
      neckProportions: "elegant slender proportional neck — soft luxury head carriage, distinct from B/D thicker necks",
      facialCharacter:
        "softer premium luxury Mediterranean identity — elegant oval, refined jaw, expressive eyes, instantly approachable",
      memorabilityCue: "soft luxury face remembered after one homepage glance — not a generic handsome AI man",
      commercialAppeal: "suitable for homepage hero, Shopify product campaigns, and premium drops",
      fashionPresence: "calm approachable luxury streetwear model — agency soft-luxury lane",
      cameraPresence: "naturally directed toward camera with soft focused eye contact",
      postureDirection:
        "shoulders relaxed, slight 10–20° body rotation, head slightly angled — never passport-square",
      microExpression: "relaxed mouth, almost-smile without teeth, calm attentive gaze",
      garmentBehavior:
        "heavyweight oversized tee drapes with premium streetwear sleeve and shoulder volume",
      castingRiskExclusions: [
        "ordinary ID-card man",
        "passport symmetry",
        "generic handsome Mediterranean clone",
        "brother of Candidates B/C/D",
        "forced broad smile",
        "aggressive stare",
        "CEO authority",
        "blank lifeless expression",
      ],
    },
  },
  {
    id: "med-b-north-african-street",
    archetypeId: ARCH_MED,
    slot: "B",
    name: "North African Street Premium",
    gender: "male",
    ageRange: "24-30",
    ancestryDirection:
      "North African / Maghrebi Mediterranean direction (Moroccan–Algerian street premium) — NOT Spanish Iberian, NOT Greek, NOT Levantine",
    skinTone:
      "medium olive-brown skin with warm amber undertone and visible texture variation on cheeks — clearly deeper than Candidate A",
    faceGeometry:
      "longer athletic rectangular face with clear vertical planes and wider lower third — NEVER oval like A, NEVER triangular like C",
    jaw: "stronger masculine jaw with broader gonial angle and firmer chin mass — athletic, never soft-luxury refined",
    cheekbones: "higher angular cheekbones with lean midface hollow — athletic facial architecture",
    nose: "slightly wider natural nose with broader bridge and stronger tip character — distinct from A’s narrow refined nose",
    eyes: "deeper-set dark brown eyes with heavier lids and closer inter-eye spacing — calm urban intensity, not soft luxury openness",
    lips: "fuller medium-wide lips with stronger philtrum and denser vermillion — calm closed mouth",
    forehead: "broader flatter forehead with stronger brow shelf — more horizontal presence than A or C",
    eyebrowDensity: "dense straight low-set brows with continuous dark hair — urban masculine, never soft arched",
    earShape: "slightly larger projected ears with clearer helix definition — more athletic silhouette",
    hairline: "lower denser hairline with tight temple fade edge supporting short textured curls",
    facialProportions:
      "athletic facial proportions — shorter midface relative to jaw width; wider mandible than A/C; stronger horizontal lower face",
    hairTexture: "dark dense coil-wave curls with tight natural texture — Maghrebi street-premium, not soft European waves",
    haircut: "short textured curls with clean low fade — urban precision, never medium-length creative waves",
    facialHair:
      "well-kept short dense stubble covering cheeks and jaw evenly — sharper cheek edge than A’s light chin-weighted shadow",
    bodyStructure:
      "tall slim-athletic fashion build with thicker athletic neck and cleaner clavicle line — modern urban model silhouette",
    expression: "modern urban confidence — stronger streetwear attitude than A, never aggressive",
    stylingDirection:
      "black or charcoal zip hoodie over a plain dark heavyweight T-shirt — Product Intelligence only",
    backgroundDirection:
      "muted charcoal-grey casting studio — quiet premium agency wall, not a street campaign",
    lightingDirection: "gentle directional light with clean shadow definition — never flat front flash",
    garmentDirection:
      "black or charcoal zip hoodie worn open or lightly zipped over a plain dark heavyweight T-shirt — oversized fit readable; no logos, no graphics, no text",
    intendedUseLabel: "Social · Zip Hoodie · Community Campaign",
    diversitySampling: {
      regionalCluster: "North African / Maghrebi street premium",
      headShape: "longer rectangular athletic head — stronger vertical cranial line",
      skullProportions: "longer cranial length with flatter frontal plane — athletic Maghrebi street skull, not Iberian oval",
      chinShape: "firmer squared chin mass with clear menton — athletic, no soft rounded A tip",
      eyeSpacing: "closer interpupillary spacing — denser urban eye set",
      eyebrowAngle: "flat-to-slightly-downward dense low brows — never soft arched Iberian",
      noseBridge: "broader lower bridge with stronger nasal root — Maghrebi character",
      noseWidth: "wider alar base than A/C — distinct width template",
      noseTip: "stronger rounded tip with clearer tip definition — not aquiline D, not refined A",
      facialAsymmetry: "natural cheek-plane asymmetry and uneven curl density at temples — never twin-symmetric AI",
      smileAnatomy: "closed-mouth calm with fuller lip mass at rest — smile muscles not engaged",
      restingExpression: "quiet urban resting confidence — cooler than A, never aggressive scowl",
      slotDiversityInstruction:
        "Slot B must read as a Maghrebi North African street-premium agency model — maximum biological distance from Spanish A, Greek/Balkan C, and Levantine D. Different skull length, jaw width, nose width, and brow angle from all other slots.",
    },
    fashionCasting: {
      modelBuild: "tall slim-athletic fashion build — street-premium agency model",
      modelHeightDirection: "tall fashion height impression — lean vertical line",
      shoulderLine: "clean athletic shoulder line visible under zip hoodie",
      neckProportions: "thicker athletic neck with modern streetwear carriage — distinct from A’s slender luxury neck",
      facialCharacter:
        "stronger masculine jaw, wider nose, athletic facial proportions — urban premium identity, not Soft Luxury’s brother",
      memorabilityCue: "instantly recognizable North African street-premium face — commercial social campaign value",
      commercialAppeal: "suitable for Instagram/TikTok, zip hoodies, and heavyweight tees",
      fashionPresence: "modern urban confidence — cooler streetwear attitude than Soft Luxury, never intimidating",
      cameraPresence: "calm eye contact, slightly stronger camera hold than Candidate A",
      postureDirection:
        "subtle weight shift, 10–20° body turn, shoulders fully visible — casting-editorial not mugshot",
      microExpression: "soft focused eyes, relaxed mouth, quiet street confidence — no aggression",
      garmentBehavior:
        "zip hoodie and heavyweight tee show premium oversized drape without costume styling",
      castingRiskExclusions: [
        "gangster energy",
        "aggressive stare",
        "military posture",
        "passport crop",
        "generic Mediterranean clone of Candidate A",
        "brother resemblance to A/C/D",
        "ordinary casting-database thumbnail",
        "intimidating expression",
      ],
    },
  },
  {
    id: "med-c-southern-creative",
    archetypeId: ARCH_MED,
    slot: "C",
    name: "Southern European Creative",
    gender: "male",
    ageRange: "23-29",
    ancestryDirection:
      "Greek / Balkan Mediterranean creative direction — Hellenic–Adriatic artistic, NOT Spanish Iberian, NOT Maghrebi, NOT Levantine",
    skinTone:
      "warm light-olive skin with soft golden undertone and cooler cheek flush — lighter and more golden than B, warmer than pale beige",
    faceGeometry:
      "slim triangular / soft diamond face with narrow chin and open midface — NEVER oval A, NEVER rectangular B/D",
    jaw: "soft tapered jaw with narrow chin and minimal gonial flare — still adult masculine, never square athletic",
    cheekbones: "high prominent cheekbones with visible under-cheek hollow — artistic bone structure",
    nose: "narrow characterful nose with slight natural bridge irregularity — artistic, not model-perfect straight A",
    eyes: "large expressive hazel-to-warm-brown eyes with open lids and wider spacing — softer artistic gaze than B’s deep-set intensity",
    lips: "softer thinner-medium lips with delicate cupid bow — lighter vermillion than B/D",
    forehead: "higher open forehead with airy temples — more vertical forehead height than A/B",
    eyebrowDensity: "finer soft brows with natural break and lighter density — artistic, never dense urban bars",
    earShape: "smaller close-set ears with delicate lobes — low projection, refined silhouette",
    hairline: "higher soft temple-receding creative hairline framing medium-length loose waves",
    facialProportions:
      "slim artistic proportions — longer midface, narrower jaw relative to cheekbones, lighter overall facial mass than A/B/D",
    hairTexture: "medium chestnut-brown loose waves with lighter ends and airy movement — not near-black dense crop",
    haircut: "medium-length loose curls or waves past the ears — creative editorial, never short fade or dense hero crop",
    facialHair: "clean-shaven or extremely sparse light stubble only on upper lip — never designer cheek stubble like B, never beard like D",
    bodyStructure:
      "tall lean creative-model build with long slender neck and narrower clavicles — effortless, not gym-sculpted",
    expression: "artistic relaxed contemporary presence — softer fashion energy without looking feminine",
    stylingDirection:
      "off-white or muted stone oversized heavyweight T-shirt — Product Intelligence only",
    backgroundDirection:
      "soft off-white or pale concrete studio — natural window-light feeling, controlled casting set",
    lightingDirection: "natural window-light feeling — soft diffused daylight, flattering not beauty-retouch",
    garmentDirection:
      "off-white or muted stone oversized heavyweight T-shirt — oversized shoulder/sleeve proportions visible; no logos, no graphics, no text",
    intendedUseLabel: "Lifestyle · Editorial Social · Storytelling",
    diversitySampling: {
      regionalCluster: "Greek / Balkan Mediterranean creative",
      headShape: "slim diamond-triangular head with narrower cranial base",
      skullProportions: "taller forehead vault with lighter jaw mass — Hellenic creative skull, not Maghrebi athletic or Levantine broad",
      chinShape: "narrow pointed-soft chin with minimal projection — artistic taper, never square D",
      eyeSpacing: "widest interpupillary spacing of the cast — open expressive creative set",
      eyebrowAngle: "soft lifted outer brow with natural break — artistic angle, never flat B bars",
      noseBridge: "narrow bridge with slight natural irregularity / micro-bump — Greek character nose",
      noseWidth: "narrow-to-medium alar width — finer than B, different tip language from A",
      noseTip: "slightly downturned character tip — artistic, not soft rounded A or aquiline D",
      facialAsymmetry: "visible natural asymmetry in brow height and cheek hollow — memorable, never cloned symmetry",
      smileAnatomy: "delicate closed-mouth lift with thinner lip anatomy — almost-smile without teeth",
      restingExpression: "relaxed artistic resting face — softer contemporary calm, never hero authority",
      slotDiversityInstruction:
        "Slot C must read as a Greek/Balkan creative agency model — maximum biological distance from Spanish A, Maghrebi B, and Levantine D. Different head shape, chin taper, eye spacing, and nose tip from all other slots.",
    },
    fashionCasting: {
      modelBuild: "tall lean creative-model build — editorial lifestyle presence",
      modelHeightDirection: "tall lean creative height impression",
      shoulderLine: "narrower elegant shoulder line — still fully visible and masculine",
      neckProportions: "long slender graceful neck with relaxed creative head tilt — distinct from B/D",
      facialCharacter:
        "slimmer artistic facial structure, softer eyes, naturally memorable asymmetry — not a recolored Soft Luxury",
      memorabilityCue: "instantly recognizable creative face after one editorial social image — unique bone language",
      commercialAppeal: "suitable for editorial social, lifestyle storytelling, and softer campaigns",
      fashionPresence: "artistic relaxed contemporary — softer fashion energy than A/B/D, never feminine-coded",
      cameraPresence: "expressive calm gaze with effortless camera ease",
      postureDirection:
        "relaxed weight shift, slight head tilt or turn, mid-torso framing — never stiff passport stance",
      microExpression: "naturally composed, soft focused eyes, almost-smile without teeth",
      garmentBehavior:
        "muted stone oversized heavyweight tee drapes loosely — garment supports evaluation, does not dominate",
      castingRiskExclusions: [
        "overstyled fashion-week hair",
        "feminine-coded face on male hero",
        "forced smile",
        "perfectly symmetrical plastic face",
        "brother of Candidates A/B/D",
        "average AI Mediterranean template",
        "head-only crop",
        "lifeless blank stare",
      ],
    },
  },
  {
    id: "med-d-levantine-hero",
    archetypeId: ARCH_MED,
    slot: "D",
    name: "Levantine Modern Hero",
    gender: "male",
    ageRange: "25-31",
    ancestryDirection:
      "Lebanese / Levantine Eastern Mediterranean direction — flagship Levantine hero, NOT Spanish Iberian, NOT Maghrebi, NOT Greek/Balkan",
    skinTone:
      "warm medium-rich olive skin with deeper golden-bronze undertone — richest of the four, never a recolor of A/B/C",
    faceGeometry:
      "broad balanced rectangular hero head with strong horizontal presence and wider cheek-to-jaw span — strongest campaign silhouette",
    jaw: "strongest controlled square jaw with clear chin mass and optional soft chin dimple — premium hero, not soft A or tapered C",
    cheekbones: "broad supportive high cheekbones with campaign-plane width — wider than A/B/C",
    nose: "strong natural aquiline-leaning bridge with clear character and fuller tip — hero nose, not narrow A or wide-flat B",
    eyes: "dark deep expressive almond eyes with strong lid crease and steady campaign spacing — warm authority, not soft luxury openness",
    lips: "fuller wide lips with soft volume and strong cupid definition — denser than A/C",
    forehead: "broader hero forehead with stronger horizontal brow plane — more mass than C’s high open forehead",
    eyebrowDensity: "thick straight dense near-black brows with continuous coverage — strongest brow of the four",
    earShape: "stronger lobed ears with clearer antihelix — moderate projection supporting hero head width",
    hairline: "dense low near-black hairline with thick textured crop — no soft temple recession like C",
    facialProportions:
      "premium campaign proportions — widest bizygomatic and mandibular width of the cast; balanced vertical thirds with heroic lower-face presence",
    hairTexture: "thick near-black dense hair with coarse natural texture — Levantine hero density, not chestnut creative waves",
    haircut: "thick near-black textured crop — dense modern hero cut, never medium-length waves, never Maghrebi curl fade",
    facialHair:
      "short even beard or dense refined stubble denser along jawline than upper cheeks — continuous hero beard shadow, not clean-shaven C",
    bodyStructure:
      "tall lean-athletic build with slightly broader shoulders and strong column neck — flagship hero silhouette",
    expression: "premium hero presence — calm authority without CEO energy; masculine, warm, approachable",
    stylingDirection:
      "charcoal heavyweight hoodie or washed-dark oversized T-shirt — Product Intelligence only",
    backgroundDirection:
      "neutral warm concrete or stone-grey background — premium directional soft light casting set",
    lightingDirection: "premium directional soft light with subtle contrast — editorial clarity, no orange skin",
    garmentDirection:
      "charcoal heavyweight hoodie OR washed-dark oversized heavyweight T-shirt — heavyweight drape readable; no logos, no graphics, no text",
    intendedUseLabel: "Flagship Campaign · Product Hero · Video",
    diversitySampling: {
      regionalCluster: "Lebanese / Levantine modern hero",
      headShape: "broad rectangular hero head — widest cranial footprint of the cast",
      skullProportions: "broad cranial base with strong frontal width — Levantine campaign skull, not Iberian oval or Hellenic slim",
      chinShape: "strong square chin with optional soft dimple — highest chin mass of the four",
      eyeSpacing: "balanced campaign eye spacing — between A’s open set and B’s close set",
      eyebrowAngle: "straight dense near-horizontal hero brows — strongest continuous brow shelf",
      noseBridge: "strong aquiline-leaning high bridge — Levantine hero nasal root",
      noseWidth: "medium-strong alar width supporting hero bridge — not Maghrebi widest, not Iberian narrowest",
      noseTip: "fuller defined tip with downward character — aquiline family, never soft A tip",
      facialAsymmetry: "subtle natural asymmetry in brow shelf and beard density along jaw — authentic campaign human",
      smileAnatomy: "fuller closed-mouth resting lip volume — calm authority, teeth not shown",
      restingExpression: "warm hero resting authority — highest memorability calm, never CEO hardness",
      slotDiversityInstruction:
        "Slot D must read as a Lebanese/Levantine flagship agency hero — maximum biological distance from Spanish A, Maghrebi B, and Greek/Balkan C. Different skull width, chin mass, brow shelf, and aquiline nose from all other slots.",
    },
    fashionCasting: {
      modelBuild: "tall lean-athletic with slightly broader shoulders — flagship campaign model",
      modelHeightDirection: "tall premium hero height impression",
      shoulderLine: "slightly broader athletic shoulder line — fully visible, relaxed not military",
      neckProportions: "strong column neck supporting calm hero head carriage — thickest of A–C contrast",
      facialCharacter:
        "strongest hero presence — premium campaign face with highest memorability and natural authority, not generic stock",
      memorabilityCue: "flagship Levantine hero face for product hero and video — instantly recognizable, not brother of A/B/C",
      commercialAppeal: "suitable for flagship campaigns, product hero stills, and future video",
      fashionPresence: "premium hero presence — calm authority without CEO or realtor energy",
      cameraPresence: "steady calm camera hold with warm approachable intensity",
      postureDirection:
        "subtle body rotation, shoulders open and visible, mid-torso crop — casting-editorial hero frame",
      microExpression: "calm attentive gaze, relaxed mouth, quiet confidence — never scowl or grin",
      garmentBehavior:
        "charcoal hoodie or washed-dark oversized tee communicates heavyweight premium streetwear fit",
      castingRiskExclusions: [
        "CEO portrait",
        "luxury realtor",
        "runway severity",
        "generic stock-model face",
        "repetitive Mediterranean template",
        "brother resemblance to A/B/C",
        "passport centered symmetry",
        "intimidating hard stare",
      ],
    },
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
    forehead: "soft rounded forehead with gentle temples — friendly community openness",
    eyebrowDensity: "soft medium brows with rounded arch — never dense straight bars",
    earShape: "medium soft ears close to head with rounded lobes",
    hairline: "natural soft coil hairline with rounded temples",
    facialProportions: "softer wider midface with shorter vertical lower third — friendly community proportions",
    hairTexture: "tight natural coils with soft afro-curl density",
    haircut: "short natural coils / clean soft afro texture — never chemically straightened",
    facialHair: "clean-shaven or extremely light soft facial hair only",
    bodyStructure: "tall lean-normal relaxed weekend adult male fashion proportions",
    expression: "easy warmth — approachable community Brand Face",
    stylingDirection: "relaxed heavyweight hoodie / zip hoodie streetwear",
    backgroundDirection: "soft airy community casting wall",
    lightingDirection: "soft airy daylight — accurate deep-skin rendering",
    garmentDirection:
      "faded grey or muted taupe heavyweight hoodie — oversized fit; no logos, no graphics, no text",
    intendedUseLabel: "Community · Social · Lifestyle",
    diversitySampling: {
      regionalCluster: "Afro-European soft community West/Central diaspora",
      headShape: "softer rounded head with wider friendly midface cranial curve",
      skullProportions: "softer vault with fuller cheek-adjacent cranial soft tissue reading",
      chinShape: "soft rounded chin with low angular projection",
      eyeSpacing: "open medium-wide friendly spacing",
      eyebrowAngle: "soft rounded brow arch",
      noseBridge: "softer lower bridge",
      noseWidth: "broader soft alar width",
      noseTip: "rounded soft tip",
      facialAsymmetry: "mild natural cheek fullness asymmetry",
      smileAnatomy: "soft closed-mouth warmth ready",
      restingExpression: "easy community resting warmth",
      slotDiversityInstruction:
        "Slot A must be a soft community Afro-European face — not Structured Street, not Twist Lifestyle, not Campaign Coil.",
    },
    fashionCasting: {
      modelBuild: "lean-normal relaxed community fashion build",
      modelHeightDirection: "tall approachable community height impression",
      shoulderLine: "soft relaxed shoulder line fully visible",
      neckProportions: "natural proportional neck",
      facialCharacter: "soft rounded friendly community face",
      memorabilityCue: "warm community anchor face",
      commercialAppeal: "community social and lifestyle campaigns",
      fashionPresence: "easy warmth community Brand Face — never ordinary passport man",
      cameraPresence: "kind calm eye contact",
      postureDirection: "relaxed body rotation, mid-torso framing, shoulders visible",
      microExpression: "soft neutral-friendly mouth, open calm eyes",
      garmentBehavior: "heavyweight hoodie drapes with premium oversized ease",
      castingRiskExclusions: ["passport photo", "aggressive stare", "gangster styling"],
    },
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
    forehead: "longer vertical forehead with clearer brow plane — structured street presence",
    eyebrowDensity: "denser defined brows with straighter line — structured masculine",
    earShape: "leaner ears with clearer helix — slightly more projection than Soft Community",
    hairline: "clean low-fade hairline with sharp temple edge under short coils",
    facialProportions: "longer oval proportions with leaner midface than Soft Community — structured vertical face",
    hairTexture: "dense 4C / tight coil texture",
    haircut: "clean low fade with short textured top coils",
    facialHair: "neat short boxed line beard — controlled community-premium",
    bodyStructure: "tall slim-athletic adult male with slightly broader shoulders",
    expression: "relaxed modern street confidence — never aggressive",
    stylingDirection: "premium community streetwear — charcoal hoodie / tee",
    backgroundDirection: "neutral cool-grey casting backdrop",
    lightingDirection: "directional soft daylight with clean skin detail",
    garmentDirection:
      "charcoal heavyweight hoodie or oversized tee — no logos, no graphics, no text",
    intendedUseLabel: "Street · Social · Product",
    diversitySampling: {
      regionalCluster: "Afro-European structured street / West African diaspora street premium",
      headShape: "longer oval structured head",
      skullProportions: "longer cranial vertical with leaner midface plane",
      chinShape: "firmer defined chin without aggressive square",
      eyeSpacing: "closer focused almond spacing",
      eyebrowAngle: "straighter denser brow line",
      noseBridge: "straighter medium-broad bridge",
      noseWidth: "medium-broad defined alar",
      noseTip: "defined medium tip",
      facialAsymmetry: "natural jaw-side stubble density variation",
      smileAnatomy: "calm closed mouth with medium-full lips",
      restingExpression: "relaxed modern street resting confidence",
      slotDiversityInstruction:
        "Slot B must be a structured street Afro-European face — maximum distance from Soft Community A and lifestyle C.",
    },
    fashionCasting: {
      modelBuild: "slim-athletic structured street fashion build",
      modelHeightDirection: "tall slim-athletic height impression",
      shoulderLine: "slightly broader clean shoulder line",
      neckProportions: "lean structured neck",
      facialCharacter: "longer oval with higher cheekbones — structured street presence",
      memorabilityCue: "structured street-premium commercial face",
      commercialAppeal: "street social and product campaigns",
      fashionPresence: "relaxed modern street confidence — cooler than Soft Community",
      cameraPresence: "calm focused eye contact",
      postureDirection: "10–20° body turn, shoulders visible, mid-torso crop",
      microExpression: "relaxed mouth, soft focused eyes — never intimidating",
      garmentBehavior: "charcoal hoodie/tee shows heavyweight oversized fit",
      castingRiskExclusions: ["gangster energy", "military stance", "passport crop"],
    },
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
    forehead: "softer higher forehead with open youthful temples",
    eyebrowDensity: "lighter soft brows with gentle lift — lifestyle friendly",
    earShape: "smaller soft ears close to head",
    hairline: "neat twist hairline with clean soft edges",
    facialProportions: "softer heart-shaped proportions — narrower chin, fuller upper cheeks than Structured Street",
    hairTexture: "soft twists / mini-twist texture pattern",
    haircut: "short neat twists with clean edges — lifestyle authentic",
    facialHair: "clean-shaven — no beard",
    bodyStructure: "tall lean soft-athletic lifestyle fashion frame",
    expression: "friendly social lifestyle energy — Instagram/TikTok natural",
    stylingDirection: "relaxed premium tee / light hoodie community look",
    backgroundDirection: "warm light community casting wall",
    lightingDirection: "bright soft daylight — social-native feel",
    garmentDirection:
      "off-white or muted stone oversized heavyweight T-shirt — no logos, no graphics, no text",
    intendedUseLabel: "Lifestyle · Social · Storytelling",
    diversitySampling: {
      regionalCluster: "African-diaspora lifestyle / soft Caribbean–European creative mix reading",
      headShape: "softer heart-shaped head with narrower chin cranial taper",
      skullProportions: "lighter lower cranial mass with open upper face",
      chinShape: "narrower soft chin",
      eyeSpacing: "wide open friendly spacing",
      eyebrowAngle: "soft lifted lifestyle brow",
      noseBridge: "softer shorter bridge",
      noseWidth: "softer medium alar",
      noseTip: "rounded shorter tip",
      facialAsymmetry: "natural eye-lid openness asymmetry",
      smileAnatomy: "soft almost-smile lip anatomy",
      restingExpression: "friendly social lifestyle resting energy",
      slotDiversityInstruction:
        "Slot C must be a twist lifestyle face — different head taper and eye openness from A/B/D.",
    },
    fashionCasting: {
      modelBuild: "lean soft-athletic lifestyle creative build",
      modelHeightDirection: "tall lean lifestyle height impression",
      shoulderLine: "soft lean shoulder line fully visible",
      neckProportions: "natural lifestyle neck proportions",
      facialCharacter: "softer heart-shaped face with open friendly eyes",
      memorabilityCue: "distinctive twist lifestyle face for social storytelling",
      commercialAppeal: "Instagram/TikTok lifestyle and community content",
      fashionPresence: "friendly social lifestyle energy — softer than Structured Street",
      cameraPresence: "open warm camera ease",
      postureDirection: "relaxed weight shift, slight head tilt, mid-torso framing",
      microExpression: "easy warmth in the eyes, soft neutral-friendly mouth",
      garmentBehavior: "oversized tee drapes with lived-in premium ease",
      castingRiskExclusions: ["forced stock smile", "beauty-filter skin", "head-only crop"],
    },
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
    forehead: "broader campaign forehead with stronger horizontal brow mass",
    eyebrowDensity: "thick dense dark brows — strongest of the urban cast",
    earShape: "stronger lobed ears supporting broader head width",
    hairline: "dense coil/braid-crop hairline with strong temple presence",
    facialProportions: "broad rectangular campaign proportions — widest jaw/cheek span of urban cast",
    hairTexture: "dense natural coils with thicker strand definition",
    haircut: "short neat cornrow or braid-inspired cropped style OR dense sculpted coils — distinct from A–C",
    facialHair: "short even dense stubble — neat community-premium",
    bodyStructure: "tall lean-athletic broader shoulder line — campaign silhouette",
    expression: "premium friendly campaign calm — community hero authority without CEO energy",
    stylingDirection: "premium campaign streetwear — black / deep charcoal hero basics",
    backgroundDirection: "clean campaign casting grey",
    lightingDirection: "editorial soft key optimized for deep skin",
    garmentDirection:
      "black or deep charcoal heavyweight hoodie or oversized tee — no logos, no graphics, no text",
    intendedUseLabel: "Flagship · Product Hero · Community Campaign",
    diversitySampling: {
      regionalCluster: "Afro-European campaign / East–West African diaspora hero mix",
      headShape: "broader rectangular campaign head",
      skullProportions: "widest cranial base of urban cast",
      chinShape: "strong controlled campaign chin",
      eyeSpacing: "balanced deep campaign spacing",
      eyebrowAngle: "dense straight campaign brows",
      noseBridge: "wide strong natural bridge",
      noseWidth: "widest strong alar of urban cast",
      noseTip: "strong character tip",
      facialAsymmetry: "natural deep-skin highlight asymmetry",
      smileAnatomy: "fuller closed-mouth campaign lip volume",
      restingExpression: "premium friendly campaign resting calm",
      slotDiversityInstruction:
        "Slot D must be the campaign coil/braid hero — broadest skull and strongest nose of the urban cast.",
    },
    fashionCasting: {
      modelBuild: "lean-athletic broader-shoulder campaign build",
      modelHeightDirection: "tall campaign hero height impression",
      shoulderLine: "broader athletic shoulder line — relaxed, not military",
      neckProportions: "strong proportional campaign neck",
      facialCharacter: "broader balanced rectangular face — premium community hero",
      memorabilityCue: "flagship community campaign face — not generic",
      commercialAppeal: "flagship community campaigns and product hero",
      fashionPresence: "premium friendly campaign calm — hero without CEO energy",
      cameraPresence: "steady warm campaign camera hold",
      postureDirection: "subtle body rotation, shoulders open, mid-torso crop",
      microExpression: "calm attentive gaze, relaxed mouth, quiet confidence",
      garmentBehavior: "black/charcoal heavyweight piece shows oversized premium fit",
      castingRiskExclusions: ["CEO portrait", "gangster styling", "passport symmetry"],
    },
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
    forehead: "soft medium feminine forehead with calm temples",
    eyebrowDensity: "soft natural medium brows — lived-in, not laminated glam",
    earShape: "delicate medium ears close to head",
    hairline: "soft natural wavy hairline with gentle temple curves",
    facialProportions: "soft oval feminine proportions with healthy midface volume",
    hairTexture: "dark brown soft waves with natural density",
    haircut: "shoulder-grazing soft waves — lived-in, not glam",
    facialHair: "none",
    bodyStructure: "natural feminine lean-soft lifestyle fashion frame",
    expression: "warm friendly authentic lifestyle presence",
    stylingDirection: "premium oversized hoodie / lifestyle tee — feminine fit reading",
    backgroundDirection: "warm soft lifestyle casting wall",
    lightingDirection: "soft natural daylight — not beauty ring light",
    garmentDirection:
      "washed black or charcoal oversized heavyweight T-shirt or hoodie — no logos, no graphics, no text",
    intendedUseLabel: "Lifestyle · Social · Shopify",
    diversitySampling: {
      regionalCluster: "Mediterranean / Southern European female soft lifestyle",
      headShape: "soft oval feminine head",
      skullProportions: "balanced soft feminine vault",
      chinShape: "soft feminine rounded chin",
      eyeSpacing: "open warm medium spacing",
      eyebrowAngle: "soft natural arch",
      noseBridge: "soft medium feminine bridge",
      noseWidth: "soft medium alar",
      noseTip: "soft rounded tip",
      facialAsymmetry: "mild natural freckle/texture asymmetry",
      smileAnatomy: "soft closed-mouth warmth",
      restingExpression: "warm friendly lifestyle resting calm",
      slotDiversityInstruction:
        "Slot A Mediterranean soft female — distinct from Afro-European B, Mixed European C, MENA D.",
    },
    fashionCasting: {
      modelBuild: "lean-soft feminine lifestyle fashion build",
      modelHeightDirection: "tall lifestyle model height impression",
      shoulderLine: "soft feminine shoulder line fully visible",
      neckProportions: "graceful natural neck",
      facialCharacter: "soft oval Mediterranean lifestyle face",
      memorabilityCue: "warm Mediterranean lifestyle Brand Face",
      commercialAppeal: "lifestyle social and Shopify campaigns",
      fashionPresence: "warm friendly authentic lifestyle model presence",
      cameraPresence: "soft approachable eye contact",
      postureDirection: "relaxed body rotation, mid-torso framing, shoulders visible",
      microExpression: "warm calm gaze, soft closed mouth — never forced smile",
      garmentBehavior: "oversized premium tee/hoodie drapes with lifestyle ease",
      castingRiskExclusions: ["beauty-pageant glam", "passport crop", "plastic AI face"],
    },
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
    forehead: "softer rounded forehead with fuller temple softness",
    eyebrowDensity: "fuller natural dark brows with soft arch",
    earShape: "soft rounded ears close to head",
    hairline: "natural coil crown hairline with soft edges",
    facialProportions: "fuller midface feminine proportions — wider friendly cheeks than Mediterranean Soft",
    hairTexture: "natural coils / soft afro-curl texture",
    haircut: "short natural coils or soft afro crown — authentic, not straightened glam",
    facialHair: "none",
    bodyStructure: "natural feminine lifestyle proportions — soft athletic ease",
    expression: "radiant calm social energy — Pinterest / Instagram natural",
    stylingDirection: "premium oversized lifestyle hoodie — community feminine",
    backgroundDirection: "soft airy lifestyle casting backdrop",
    lightingDirection: "soft daylight with accurate deep-skin rendering",
    garmentDirection:
      "muted taupe or charcoal oversized heavyweight hoodie — no logos, no graphics, no text",
    intendedUseLabel: "Social · Community · Lifestyle",
    diversitySampling: {
      regionalCluster: "Afro-European female lifestyle glow",
      headShape: "softer rounded feminine head with fuller midface",
      skullProportions: "fuller midface cranial soft tissue reading",
      chinShape: "soft rounded feminine chin",
      eyeSpacing: "open friendly dark-eye spacing",
      eyebrowAngle: "fuller soft arch",
      noseBridge: "softer broader feminine bridge",
      noseWidth: "softer broader alar",
      noseTip: "rounded soft tip",
      facialAsymmetry: "natural deep-skin glow asymmetry",
      smileAnatomy: "fuller soft closed-mouth volume",
      restingExpression: "radiant calm social resting energy",
      slotDiversityInstruction:
        "Slot B Afro-European glow — different midface fullness and nose width from A/C/D.",
    },
    fashionCasting: {
      modelBuild: "soft athletic feminine lifestyle build",
      modelHeightDirection: "tall soft lifestyle height impression",
      shoulderLine: "soft full shoulder line visible under hoodie",
      neckProportions: "natural feminine neck",
      facialCharacter: "softer rounded Afro-European glow face",
      memorabilityCue: "radiant community lifestyle face",
      commercialAppeal: "Pinterest/Instagram community lifestyle",
      fashionPresence: "radiant calm social energy — distinct from Mediterranean Soft",
      cameraPresence: "open friendly camera ease",
      postureDirection: "relaxed mid-torso crop with visible shoulders",
      microExpression: "warm calm almost-smile without teeth",
      garmentBehavior: "oversized hoodie drapes with premium lifestyle volume",
      castingRiskExclusions: ["ring-light influencer", "plastic skin", "passport photo"],
    },
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
    forehead: "higher soft feminine forehead with airy temples",
    eyebrowDensity: "finer lighter brows with delicate arch",
    earShape: "small delicate ears with fine lobes",
    hairline: "soft high temple hairline framing long layers",
    facialProportions: "narrower heart-shaped proportions — longer midface, lighter jaw than A/B",
    hairTexture: "light-to-medium brown fine waves",
    haircut: "long soft layers with natural movement — not salon glam",
    facialHair: "none",
    bodyStructure: "lean soft feminine fashion frame",
    expression: "quiet friendly editorial calm — email / couple campaign ready",
    stylingDirection: "premium soft lifestyle basics — oversized tee / hoodie",
    backgroundDirection: "pale warm casting wall",
    lightingDirection: "gentle diffused daylight",
    garmentDirection:
      "off-white or muted stone oversized heavyweight T-shirt — no logos, no graphics, no text",
    intendedUseLabel: "Editorial · Email · Couple Campaign",
    diversitySampling: {
      regionalCluster: "Mixed European soft editorial female",
      headShape: "narrower heart-shaped feminine head",
      skullProportions: "lighter narrower cranial base",
      chinShape: "delicate soft chin",
      eyeSpacing: "lighter hazel wider-soft spacing",
      eyebrowAngle: "finer lifted editorial brow",
      noseBridge: "narrower soft bridge",
      noseWidth: "narrower soft alar",
      noseTip: "narrow soft tip",
      facialAsymmetry: "subtle brow-height asymmetry",
      smileAnatomy: "medium soft closed mouth",
      restingExpression: "quiet friendly editorial resting calm",
      slotDiversityInstruction:
        "Slot C mixed European editorial — slimmer skull and lighter eyes than A/B/D.",
    },
    fashionCasting: {
      modelBuild: "lean soft feminine editorial build",
      modelHeightDirection: "tall lean editorial height impression",
      shoulderLine: "narrower soft shoulder line fully visible",
      neckProportions: "delicate proportional neck",
      facialCharacter: "narrower heart-shaped soft editorial face",
      memorabilityCue: "quiet editorial face for email and couple campaigns",
      commercialAppeal: "editorial social and email marketing",
      fashionPresence: "quiet friendly editorial calm — softer than A/B",
      cameraPresence: "gentle attentive camera presence",
      postureDirection: "slight head tilt, body rotation, mid-torso framing",
      microExpression: "soft focused eyes, naturally composed mouth",
      garmentBehavior: "muted oversized tee supports soft editorial evaluation",
      castingRiskExclusions: ["high-fashion severity", "beauty retouch", "head-only crop"],
    },
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
    forehead: "broader warm feminine forehead with soft horizontal presence",
    eyebrowDensity: "thick dark expressive brows — strongest of the female cast",
    earShape: "soft structured ears with clear lobes",
    hairline: "dense dark hairline with soft center or side part",
    facialProportions: "broader balanced feminine proportions — widest soft presence of the female cast",
    hairTexture: "thick dark near-black hair with natural wave",
    haircut: "long thick dark hair with soft center or side part — lived-in",
    facialHair: "none",
    bodyStructure: "natural feminine lean-soft shoulders and lifestyle silhouette",
    expression: "premium warm lifestyle confidence — couple / social campaign",
    stylingDirection: "premium lifestyle streetwear — oversized hoodie hero look",
    backgroundDirection: "clean warm lifestyle casting grey",
    lightingDirection: "soft editorial daylight with warm fill",
    garmentDirection:
      "charcoal or washed-black oversized heavyweight hoodie — no logos, no graphics, no text",
    intendedUseLabel: "Flagship Lifestyle · Social · Couple Campaign",
    diversitySampling: {
      regionalCluster: "Warm MENA / Eastern Mediterranean female lifestyle hero",
      headShape: "broader balanced feminine head",
      skullProportions: "broader soft cranial presence",
      chinShape: "soft but structured feminine chin",
      eyeSpacing: "dark almond expressive spacing",
      eyebrowAngle: "thick dark expressive brows",
      noseBridge: "stronger natural feminine bridge",
      noseWidth: "medium-strong character alar",
      noseTip: "stronger character tip",
      facialAsymmetry: "natural warm-skin plane asymmetry",
      smileAnatomy: "fuller warm closed-mouth volume",
      restingExpression: "premium warm lifestyle resting confidence",
      slotDiversityInstruction:
        "Slot D warm MENA hero — broadest soft presence and strongest brows of the female cast.",
    },
    fashionCasting: {
      modelBuild: "lean-soft broader-presence feminine lifestyle build",
      modelHeightDirection: "tall warm lifestyle hero height impression",
      shoulderLine: "soft structured shoulder line fully visible",
      neckProportions: "strong soft proportional neck",
      facialCharacter: "broader balanced warm MENA lifestyle face",
      memorabilityCue: "premium warm lifestyle hero face — not generic",
      commercialAppeal: "flagship lifestyle and couple campaigns",
      fashionPresence: "premium warm lifestyle confidence — hero without glam severity",
      cameraPresence: "steady warm expressive camera hold",
      postureDirection: "subtle body rotation, shoulders open, mid-torso crop",
      microExpression: "calm warm gaze, relaxed mouth, quiet confidence",
      garmentBehavior: "oversized hoodie communicates premium lifestyle streetwear fit",
      castingRiskExclusions: ["glam casting", "CEO energy", "passport symmetry"],
    },
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
    throw new DiscoveryBlueprintError(
      `Official Brand Face discovery only supports slots 1–4 (got ${candidateNumber})`,
      { candidateNumber },
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
    throw new DiscoveryBlueprintError(
      `No A1 discovery blueprints for archetype ${archetypeId}`,
      { archetypeId },
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
    throw new DiscoveryBlueprintError(
      `Missing discovery blueprint for ${input.archetypeId} slot ${slot}`,
    );
  }
  if (blueprint.archetypeId !== input.archetypeId) {
    throw new DiscoveryBlueprintError("Discovery blueprint archetype mismatch", {
      expected: input.archetypeId,
      got: blueprint.archetypeId,
    });
  }
  return blueprint;
}

export function assertBlueprintGenderMatchesArchetype(
  blueprint: ArchetypeCandidateBlueprint,
  archetype: Pick<BrandArchetype, "id" | "slug" | "genderPresentation" | "name">,
): void {
  const required = requiredGenderForArchetype(archetype);
  if (blueprint.gender !== required) {
    throw new DiscoveryBlueprintError(
      `Discovery blueprint gender mismatch for ${archetype.name}: blueprint=${blueprint.gender} required=${required}`,
      {
        archetypeId: archetype.id,
        blueprintId: blueprint.id,
        blueprintGender: blueprint.gender,
        requiredGender: required,
      },
    );
  }
  if (blueprint.archetypeId !== archetype.id) {
    throw new DiscoveryBlueprintError(
      "Blueprint does not belong to the selected archetype",
      {
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
    `proportions: ${blueprint.facialProportions}`,
    `forehead: ${blueprint.forehead}`,
    `brows: ${blueprint.eyebrowDensity}`,
    `jaw: ${blueprint.jaw}`,
    `cheekbones: ${blueprint.cheekbones}`,
    `eyes: ${blueprint.eyes}`,
    `nose: ${blueprint.nose}`,
    `lips: ${blueprint.lips}`,
    `ears: ${blueprint.earShape}`,
    `hairline: ${blueprint.hairline}`,
    `hair: ${blueprint.hairTexture}; cut: ${blueprint.haircut}`,
    `facial hair: ${blueprint.facialHair}`,
    `neck/body: ${blueprint.fashionCasting.neckProportions}; ${blueprint.bodyStructure}`,
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

/** Full permanent anatomy key — used to prevent brother/clone casts. */
export function blueprintAnatomyKey(
  blueprint: ArchetypeCandidateBlueprint,
): string {
  const d = blueprint.diversitySampling;
  return [
    blueprint.faceGeometry,
    blueprint.facialProportions,
    blueprint.forehead,
    blueprint.eyebrowDensity,
    blueprint.jaw,
    blueprint.cheekbones,
    blueprint.eyes,
    blueprint.nose,
    blueprint.lips,
    blueprint.earShape,
    blueprint.hairline,
    blueprint.facialHair,
    blueprint.fashionCasting.neckProportions,
    d.regionalCluster,
    d.headShape,
    d.skullProportions,
    d.chinShape,
    d.eyeSpacing,
    d.eyebrowAngle,
    d.noseBridge,
    d.noseWidth,
    d.noseTip,
  ].join(" || ");
}

export function blueprintFashionPresenceKey(
  blueprint: ArchetypeCandidateBlueprint,
): string {
  return blueprint.fashionCasting.fashionPresence;
}

export function formatFashionCastingProfilePrompt(
  blueprint: ArchetypeCandidateBlueprint,
): string {
  const f = blueprint.fashionCasting;
  return [
    `FASHION CASTING PROFILE — Slot ${blueprint.slot} (${blueprint.name})`,
    `Model build: ${f.modelBuild}.`,
    `Height direction: ${f.modelHeightDirection}.`,
    `Shoulder line: ${f.shoulderLine}. Neck: ${f.neckProportions}.`,
    `Facial character: ${f.facialCharacter}.`,
    `Memorability: ${f.memorabilityCue}.`,
    `Commercial appeal: ${f.commercialAppeal}.`,
    `Fashion presence (UNIQUE to this slot): ${f.fashionPresence}.`,
    `Camera presence: ${f.cameraPresence}.`,
    `Posture: ${f.postureDirection}.`,
    `Micro-expression: ${f.microExpression}.`,
    `Garment behavior: ${f.garmentBehavior}.`,
    `Casting risk exclusions: ${f.castingRiskExclusions.join("; ")}.`,
    "This candidate must look like a credible international premium streetwear campaign model — agency-castable, photogenic, commercially memorable.",
    "Realistic authentic skin with natural pores and asymmetry — not an idealized AI beauty clone.",
    "Suitable as a recurring Brand Face for homepage, Shopify, Instagram, campaign stills, and future video.",
  ].join("\n");
}

export function formatBlueprintGarmentPrompt(
  blueprint: ArchetypeCandidateBlueprint,
): string {
  return [
    "A1 GARMENT DIRECTION (Product Intelligence authority)",
    `Assigned garment for Slot ${blueprint.slot}: ${blueprint.garmentDirection}.`,
    "Only Oversized Heavyweight T-Shirt, Heavyweight Hoodie, or Zip Hoodie.",
    "No caps, jackets, jewelry, suits, cargo pants, footwear, or accessories.",
    "No visible third-party logos, no invented Milaene artwork, no random graphics, no text on clothing.",
    "Garment must visibly drape like heavyweight premium streetwear with oversized shoulder/sleeve proportions.",
    "Clothing supports model evaluation — does not dominate the portrait.",
  ].join("\n");
}

/**
 * Phase 1.9A.1 — Diversity Brief created before biology injection.
 * Instructs maximum facial diversity while remaining brand-consistent.
 */
export function formatDiscoveryDiversityBrief(input: {
  archetypeId: string;
  slot: DiscoverySlot;
  blueprints?: readonly ArchetypeCandidateBlueprint[];
}): string {
  const cast =
    input.blueprints ?? listDiscoveryBlueprintsForArchetype(input.archetypeId);
  const self = cast.find((b) => b.slot === input.slot);
  if (!self) {
    throw new DiscoveryBlueprintError(
      `Missing blueprint for diversity brief slot ${input.slot}`,
      { archetypeId: input.archetypeId, slot: input.slot },
    );
  }
  const clusters = cast
    .map((b) => `${b.slot}=${b.diversitySampling.regionalCluster}`)
    .join(" · ");
  const d = self.diversitySampling;
  return [
    "DISCOVERY DIVERSITY BRIEF (first-class quality metric)",
    'Generate four biologically distinct premium agency models with maximum facial diversity while remaining brand consistent.',
    "A real casting agency selected four completely different premium models — NOT four versions of the same man.",
    `Cast regional sampling (four different appearance clusters): ${clusters}.`,
    "Maximize biological distance within this archetype. NEVER brothers, cousins, twins, cloned AI faces, or the same facial template.",
    "Intentional difference axes: head shape, skull proportions, forehead height, jaw geometry, chin shape, cheekbone prominence, eye spacing, eye shape, eyebrow density, eyebrow angle, nose bridge, nose width, nose tip, lip proportions, ear shape, neck proportions, facial hair density, hairline, hair texture, facial asymmetry, smile anatomy, resting expression.",
    "",
    `SLOT ${self.slot} DIVERSITY INSTRUCTION (${self.name})`,
    d.slotDiversityInstruction,
    `Regional appearance cluster for THIS slot only: ${d.regionalCluster}.`,
    `Head shape: ${d.headShape}. Skull: ${d.skullProportions}. Chin: ${d.chinShape}.`,
    `Eye spacing: ${d.eyeSpacing}. Eyebrow angle: ${d.eyebrowAngle}.`,
    `Nose bridge: ${d.noseBridge}. Nose width: ${d.noseWidth}. Nose tip: ${d.noseTip}.`,
    `Facial asymmetry: ${d.facialAsymmetry}.`,
    `Smile anatomy: ${d.smileAnatomy}. Resting expression: ${d.restingExpression}.`,
    "Do NOT pull facial anatomy from any other slot's regional cluster.",
  ].join("\n");
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
  const f = blueprint.fashionCasting;
  return {
    id: blueprint.id,
    label: blueprint.name,
    style: blueprint.name.toLowerCase(),
    identityDescriptor,
    faceGeometry: blueprint.faceGeometry,
    jawShape: blueprint.jaw,
    chinShape: blueprint.diversitySampling.chinShape,
    eyeShape: blueprint.eyes,
    eyeSpacing: blueprint.diversitySampling.eyeSpacing,
    noseShape: blueprint.nose,
    lipShape: blueprint.lips,
    skinTone: blueprint.skinTone,
    hairTexture: blueprint.hairTexture,
    haircut: blueprint.haircut,
    facialHair: blueprint.facialHair,
    bodyBuild: blueprint.bodyStructure,
    shoulderProfile: f.shoulderLine,
    socialPresence: f.fashionPresence,
    stylingDirection: blueprint.garmentDirection,
    faceStructure: blueprint.faceGeometry,
    jawline: blueprint.jaw,
    cheekbones: blueprint.cheekbones,
    nose: blueprint.nose,
    hair,
    stubble: blueprint.facialHair,
    body: blueprint.bodyStructure,
    posture: f.postureDirection,
    expression: f.microExpression,
    presence: f.fashionPresence,
    wardrobe: blueprint.garmentDirection || archetype.wardrobeDirection,
    lighting: blueprint.lightingDirection,
    background: blueprint.backgroundDirection,
    aesthetic: `${archetype.name} · ${blueprint.name} · ${blueprint.intendedUseLabel}`,
    promptLines: [
      `Official Brand Face blueprint: ${blueprint.name} (${blueprint.slot}).`,
      `Gender locked: adult ${blueprint.gender} only.`,
      `Ancestry: ${blueprint.ancestryDirection}.`,
      `Regional cluster: ${blueprint.diversitySampling.regionalCluster}.`,
      `Permanent anatomy: ${blueprint.facialProportions}.`,
      `Fashion presence: ${f.fashionPresence}.`,
      `Intended use: ${blueprint.intendedUseLabel}.`,
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
  const d = blueprint.diversitySampling;
  return [
    `2. CANDIDATE-SPECIFIC BIOLOGICAL IDENTITY — Slot ${blueprint.slot} (${blueprint.name})`,
    `THIS PERSON ONLY — adult ${blueprint.gender}, age ≈${blueprint.ageRange}.`,
    "Permanent unique human identity — instantly recognizable agency model, not a generic handsome man.",
    `Regional cluster: ${d.regionalCluster}.`,
    `Ancestry direction: ${blueprint.ancestryDirection}.`,
    `Skin: ${blueprint.skinTone}.`,
    `Head shape: ${d.headShape}. Skull proportions: ${d.skullProportions}.`,
    `Face shape: ${blueprint.faceGeometry}.`,
    `Facial proportions: ${blueprint.facialProportions}.`,
    `Forehead: ${blueprint.forehead}.`,
    `Eyebrow density: ${blueprint.eyebrowDensity}. Eyebrow angle: ${d.eyebrowAngle}.`,
    `Jaw: ${blueprint.jaw}. Chin: ${d.chinShape}.`,
    `Cheekbones: ${blueprint.cheekbones}.`,
    `Eyes: ${blueprint.eyes}. Eye spacing: ${d.eyeSpacing}.`,
    `Nose bridge: ${d.noseBridge}. Nose width: ${d.noseWidth}. Nose tip: ${d.noseTip}.`,
    `Composite nose: ${blueprint.nose}.`,
    `Lip proportions: ${blueprint.lips}.`,
    `Ear shape: ${blueprint.earShape}.`,
    `Hairline: ${blueprint.hairline}.`,
    `Hair texture: ${blueprint.hairTexture}. Haircut: ${blueprint.haircut}.`,
    `Facial hair pattern: ${blueprint.facialHair}.`,
    `Neck proportions: ${blueprint.fashionCasting.neckProportions}.`,
    `Facial asymmetry: ${d.facialAsymmetry}.`,
    `Smile anatomy: ${d.smileAnatomy}. Resting expression: ${d.restingExpression}.`,
    "Distinct facial anatomy required — realistic human variation, natural asymmetry, memorable premium identity.",
    "Do NOT reuse another candidate's face, jaw, chin, nose template, eyes, brows, hairline, ears, skull, skin recipe, or body.",
    "Do NOT generate a recolored version, brother, cousin, twin, or clone of another slot.",
    "Do NOT use a repetitive Mediterranean template, average AI face, similar relatives, or symmetrically cloned appearance.",
    "Do NOT use old generic global identity labels as biological direction.",
  ].join("\n");
}

export function assertDiscoveryCastBlueprintsUnique(
  blueprints: readonly ArchetypeCandidateBlueprint[],
): void {
  if (blueprints.length !== 4) {
    throw new DiscoveryBlueprintError(
      `A1 discovery requires exactly 4 blueprints, got ${blueprints.length}`,
    );
  }
  const ids = new Set(blueprints.map((b) => b.id));
  const descriptors = new Set(blueprints.map((b) => blueprintIdentityDescriptor(b)));
  const faces = new Set(blueprints.map((b) => b.faceGeometry));
  const hairs = new Set(blueprints.map((b) => blueprintHairDescriptor(b)));
  const trios = new Set(blueprints.map((b) => blueprintFaceTrio(b)));
  const skins = new Set(blueprints.map((b) => b.skinTone));
  const foreheads = new Set(blueprints.map((b) => b.forehead));
  const brows = new Set(blueprints.map((b) => b.eyebrowDensity));
  const ears = new Set(blueprints.map((b) => b.earShape));
  const hairlines = new Set(blueprints.map((b) => b.hairline));
  const proportions = new Set(blueprints.map((b) => b.facialProportions));
  const jaws = new Set(blueprints.map((b) => b.jaw));
  const noses = new Set(blueprints.map((b) => b.nose));
  const eyes = new Set(blueprints.map((b) => b.eyes));
  const anatomies = new Set(blueprints.map((b) => blueprintAnatomyKey(b)));
  const clusters = new Set(
    blueprints.map((b) => b.diversitySampling.regionalCluster),
  );
  const heads = new Set(blueprints.map((b) => b.diversitySampling.headShape));
  const skulls = new Set(
    blueprints.map((b) => b.diversitySampling.skullProportions),
  );
  const chins = new Set(blueprints.map((b) => b.diversitySampling.chinShape));
  const noseBridges = new Set(
    blueprints.map((b) => b.diversitySampling.noseBridge),
  );
  const fashionPresence = new Set(blueprints.map((b) => blueprintFashionPresenceKey(b)));
  const garments = new Set(blueprints.map((b) => b.garmentDirection));
  const backgrounds = new Set(blueprints.map((b) => b.backgroundDirection));
  const lightings = new Set(blueprints.map((b) => b.lightingDirection));
  if (ids.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate blueprint IDs in discovery cast");
  }
  if (descriptors.size !== 4) {
    throw new DiscoveryBlueprintError(
      "Duplicate identity descriptors in discovery cast",
    );
  }
  if (faces.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate face geometries in discovery cast");
  }
  if (hairs.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate hair descriptors in discovery cast");
  }
  if (trios.size !== 4) {
    throw new DiscoveryBlueprintError(
      "Duplicate nose/eye/jaw combinations in discovery cast",
    );
  }
  if (skins.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate skin-tone descriptions in discovery cast");
  }
  if (foreheads.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate forehead descriptions in discovery cast");
  }
  if (brows.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate eyebrow density in discovery cast");
  }
  if (ears.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate ear shapes in discovery cast");
  }
  if (hairlines.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate hairlines in discovery cast");
  }
  if (proportions.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate facial proportions in discovery cast");
  }
  if (jaws.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate jaw shapes in discovery cast");
  }
  if (noses.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate nose structures in discovery cast");
  }
  if (eyes.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate eye shapes in discovery cast");
  }
  if (anatomies.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate full anatomy keys in discovery cast");
  }
  if (clusters.size !== 4) {
    throw new DiscoveryBlueprintError(
      "Duplicate regional appearance clusters in discovery cast",
    );
  }
  if (heads.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate head shapes in discovery cast");
  }
  if (skulls.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate skull proportions in discovery cast");
  }
  if (chins.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate chin shapes in discovery cast");
  }
  if (noseBridges.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate nose bridges in discovery cast");
  }
  if (fashionPresence.size !== 4) {
    throw new DiscoveryBlueprintError(
      "Duplicate fashionPresence directions in discovery cast",
    );
  }
  if (garments.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate garment directions in discovery cast");
  }
  if (backgrounds.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate background directions in discovery cast");
  }
  if (lightings.size !== 4) {
    throw new DiscoveryBlueprintError("Duplicate lighting directions in discovery cast");
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
