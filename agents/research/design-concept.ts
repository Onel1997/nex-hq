import {
  CREATIVE_APPROACHES,
  PRODUCTION_DIFFICULTY_LEVELS,
  type ColorBreakdownEntry,
  type CreativeApproach,
  type DesignConcept,
} from "./types";

export interface NormalizeDesignConceptContext {
  title?: string;
  products?: string[];
  colors?: string[];
  printAreas?: string[];
  styleDirection?: string;
  targetAudience?: string;
  collectionIdea?: string;
}

type ApproachProfile = {
  styleDirection: string;
  emotion: string;
  visualConcept: string;
  designDescription: string;
  message: string;
  typography: string;
  symbolism: string;
  printTechnique: string;
  printSize: string;
  placementDimensions: string;
  garmentInspiration: string;
  brandInspiration: string;
  productionDifficulty: (typeof PRODUCTION_DIFFICULTY_LEVELS)[number];
  visualReferences: string;
};

type ArtDirectionProfile = {
  exactComposition: string;
  graphicElements: string[];
  elementCount: string;
  layoutDescription: string;
  visualHierarchy: string;
  colorBreakdown: ColorBreakdownEntry[];
  materialEffects: string;
  negativeSpaceUsage: string;
  designInstructions: string[];
  mockupDescription: string;
};

const APPROACH_ALIASES: Record<string, CreativeApproach> = {
  typography: "Typography Design",
  "typography design": "Typography Design",
  type: "Typography Design",
  "symbolic illustration": "Symbolic Illustration",
  illustration: "Symbolic Illustration",
  symbolic: "Symbolic Illustration",
  "abstract graphic": "Abstract Graphic",
  abstract: "Abstract Graphic",
  graphic: "Abstract Graphic",
  "minimal back print": "Minimal Back Print",
  minimal: "Minimal Back Print",
  "back print": "Minimal Back Print",
  "photography style": "Photography Style",
  photography: "Photography Style",
  photo: "Photography Style",
  "japanese editorial": "Japanese Editorial",
  japanese: "Japanese Editorial",
  editorial: "Japanese Editorial",
  "vintage archive": "Vintage Archive",
  vintage: "Vintage Archive",
  archive: "Vintage Archive",
  "luxury minimalism": "Luxury Minimalism",
  luxury: "Luxury Minimalism",
};

const APPROACH_PROFILES: Record<CreativeApproach, ApproachProfile> = {
  "Typography Design": {
    styleDirection: "Typo-led statement streetwear with bold hierarchy",
    emotion: "Confidence",
    visualConcept:
      "Stacked oversized wordmark with distressed ink bleed and tight kerning across the chest.",
    designDescription:
      "Two-layer type composition: condensed headline over wide-tracked subline with rough screen texture.",
    message: "SPEAK LOUDER.",
    typography: "Condensed grotesk headline + ultra-wide sans subline, distressed registration.",
    symbolism: "Voice and self-expression through type scale.",
    printTechnique: "Screen print, 2-color plastisol with distress overlay",
    printSize: "28 cm wide chest graphic",
    placementDimensions: "Center chest, 8 cm below collar seam",
    garmentInspiration: "90s rave flyers meets NYC skate shop tees",
    brandInspiration: "Stüssy wordmarks, Helmut Lang typography drops",
    productionDifficulty: "Low",
    visualReferences: "Rave poster typography, Barbara Kruger text blocks, skate shop rack tees",
  },
  "Symbolic Illustration": {
    styleDirection: "Icon-driven narrative streetwear with symbolic clarity",
    emotion: "Defiance",
    visualConcept:
      "Single bold heraldic symbol — a cracked crown above a rose — rendered as flat vector icon.",
    designDescription:
      "High-contrast emblem with thick outlines and limited 3-color fill, no gradients.",
    message: "RISE AGAIN.",
    typography: "Small sans-serif caption beneath emblem, letter-spaced.",
    symbolism: "Power reclaimed through struggle and regrowth.",
    printTechnique: "Screen print, 3-color spot palette",
    printSize: "32 cm tall back graphic",
    placementDimensions: "Center back, 10 cm below yoke seam",
    garmentInspiration: "Military heraldry patches on oversized hoodies",
    brandInspiration: "Alyx iconography, Palace tri-ferg clarity",
    productionDifficulty: "Medium",
    visualReferences: "Heraldic crests, punk zine icons, tattoo flash sheets",
  },
  "Abstract Graphic": {
    styleDirection: "Experimental graphic streetwear with color blocking",
    emotion: "Energy",
    visualConcept:
      "Angular color blocks and halftone shards colliding diagonally across the torso.",
    designDescription:
      "Non-representational composition using 4-color geometric shards and halftone gradients.",
    message: "",
    typography: "No type — pure graphic impact.",
    symbolism: "Chaos and momentum in urban life.",
    printTechnique: "Digital print (DTG) for halftone gradients",
    printSize: "A3-scale all-over front panel",
    placementDimensions: "Full front panel, 5 cm inset from side seams",
    garmentInspiration: "Rave windbreakers and art-school screen experiments",
    brandInspiration: "Daily Paper abstract drops, A-COLD-WALL* graphic panels",
    productionDifficulty: "High",
    visualReferences: "Bauhaus geometry, rave flyer abstraction, Risograph texture",
  },
  "Minimal Back Print": {
    styleDirection: "Quiet luxury streetwear with restrained back placement",
    emotion: "Calm",
    visualConcept:
      "Single small monoline icon — an open eye — centered on the upper back.",
    designDescription:
      "Hairline stroke icon at 4 cm scale, no fill, maximum negative space.",
    message: "SEE CLEARLY.",
    typography: "Micro sans-serif under icon, 8 pt equivalent.",
    symbolism: "Awareness and intention in a noisy world.",
    printTechnique: "Screen print, 1-color water-based ink",
    printSize: "4 cm icon + 10 cm text line",
    placementDimensions: "Upper back center, 12 cm below collar",
    garmentInspiration: "Japanese minimal back stamps on premium blanks",
    brandInspiration: "Jil Sander x Uniqlo restraint, A.P.C. micro graphics",
    productionDifficulty: "Low",
    visualReferences: "Japanese stamp prints, COS minimal back tags, A.P.C. micro logos",
  },
  "Photography Style": {
    styleDirection: "Photo-led documentary streetwear with raw texture",
    emotion: "Nostalgia",
    visualConcept:
      "Grainy B&W street photograph of a rainy crosswalk with lone figure, high contrast.",
    designDescription:
      "Full-bleed photo print with halftone grain overlay and torn-edge mask on back panel.",
    message: "",
    typography: "Tiny film-stock credit line along bottom hem interior.",
    symbolism: "Urban solitude and fleeting moments.",
    printTechnique: "DTG photo print with soft-hand pretreatment",
    printSize: "38 cm tall back photo panel",
    placementDimensions: "Center back, full width within 6 cm side margins",
    garmentInspiration: "90s photo tees and indie band merch",
    brandInspiration: "Supreme photo tees, Raf Simons archive imagery",
    productionDifficulty: "Medium",
    visualReferences: "Daido Moriyama street grain, 90s zine photography, Wolfgang Tillmans",
  },
  "Japanese Editorial": {
    styleDirection: "Editorial East-Asian streetwear with layout discipline",
    emotion: "Stillness",
    visualConcept:
      "Vertical kanji column beside a narrow film strip of cherry blossom macro photography.",
    designDescription:
      "Asymmetric editorial layout: kanji stack left, photo strip right, generous margins.",
    message: "静かな力",
    typography: "Traditional kanji column + narrow Latin date stamp.",
    symbolism: "Strength through restraint and seasonal cycles.",
    printTechnique: "Screen print photo base + 1-color kanji overlay",
    printSize: "30 cm tall editorial block",
    placementDimensions: "Left chest to mid-torso, asymmetric offset",
    garmentInspiration: "Japanese fashion editorials and city pop sleeves",
    brandInspiration: "Visvim lookbooks, Kapital editorial layouts",
    productionDifficulty: "High",
    visualReferences: "City pop sleeves, Vogue Japan layouts, Wabi-sabi still life",
  },
  "Vintage Archive": {
    styleDirection: "Heritage streetwear with washed archive character",
    emotion: "Rebellion",
    visualConcept:
      "Distressed collegiate arch logo with faux 1978 establishment date and cracked ink.",
    designDescription:
      "Vintage athletic arch with cracked plastisol texture and faded secondary line.",
    message: "EST. 1978",
    typography: "Collegiate arch serif with worn varsity numerals.",
    symbolism: "Timeless subculture and borrowed heritage.",
    printTechnique: "Screen print with discharge base for vintage fade",
    printSize: "26 cm wide chest arch",
    placementDimensions: "Center chest, classic varsity placement",
    garmentInspiration: "Thrifted 70s college sweats and flea-market tees",
    brandInspiration: "Vintage Nike campus tees, Bootleg Romeo archive",
    productionDifficulty: "Medium",
    visualReferences: "Flea-market varsity tees, bootleg tour merch, faded campus sweats",
  },
  "Luxury Minimalism": {
    styleDirection: "Premium minimal streetwear with subtle material focus",
    emotion: "Poise",
    visualConcept:
      "Debossed-tone wordmark only — brand name in whisper-thin spaced caps, no graphic.",
    designDescription:
      "Tone-on-tone micro wordmark, no contrast ink — material and spacing carry the idea.",
    message: "MILAENE",
    typography: "Wide-tracked caps, 6 pt equivalent, tone-on-tone.",
    symbolism: "Understated confidence without visual noise.",
    printTechnique: "Tone-on-tone screen print or micro embroidery",
    printSize: "12 cm wide micro wordmark",
    placementDimensions: "Left chest, 7 cm from collar, aligned to heart line",
    garmentInspiration: "Luxury house understated labeling on premium fleece",
    brandInspiration: "Loro Piana subtle branding, Jil Sander logo discipline",
    productionDifficulty: "Low",
    visualReferences: "Quiet luxury labels, Lemaire minimal tags, The Row tone-on-tone",
  },
};

const ART_DIRECTION_BY_APPROACH: Record<CreativeApproach, ArtDirectionProfile> = {
  "Typography Design": {
    exactComposition:
      "Headline block spans 24 cm wide, centered on chest axis, top edge 8 cm below collar seam. Subline sits 1.2 cm beneath headline baseline, left-aligned to headline left edge. Distress overlay covers a 26 cm × 12 cm bounding box.",
    graphicElements: [
      "1 condensed headline wordmark",
      "1 ultra-wide tracked subline",
      "1 distress texture overlay",
    ],
    elementCount: "2 type layers + 1 texture overlay",
    layoutDescription:
      "Vertical stack, center-aligned on chest vertical axis. Headline occupies upper 70% of graphic height; subline anchors bottom 30%.",
    visualHierarchy:
      "1) Condensed headline at 8.5 cm cap height  2) Wide subline at 1.1 cm cap height  3) Distress texture registering across both layers",
    colorBreakdown: [
      { color: "Soft Black", usage: "75%" },
      { color: "Stone Grey", usage: "20%" },
      { color: "Garment base (Natural Raw)", usage: "5%" },
    ],
    materialEffects:
      "Distress overlay at 15% opacity; 2% ink bleed on headline outer edges; headline plastisol raised 0.3 mm, subline flat ink.",
    negativeSpaceUsage:
      "12 cm clear zone below subline before kangaroo pocket line; minimum 6 cm from each side seam to graphic edge.",
    designInstructions: [
      "Set headline in condensed grotesk at 8.5 cm cap height, 98% horizontal scale, center on chest axis.",
      "Place subline 1.2 cm below headline baseline in ultra-wide sans at 1.1 cm cap height.",
      "Apply distress texture overlay across 26 cm × 12 cm bounding box at 15% opacity.",
      "Register screen print with top edge 8 cm below collar seam, centered left-right.",
      "Fade distress layer on right edge by 40% over the final 3 cm width.",
    ],
    mockupDescription:
      "Hoodie flat-lay on raw concrete, overhead soft daylight at 10:00. Include one 45° fold across chest so ink texture and raised plastisol catch sidelight.",
  },
  "Symbolic Illustration": {
    exactComposition:
      "Heraldic emblem centered on back panel: crown mark 9 cm wide sits 4 cm above rose icon 7 cm wide. Total emblem height 18 cm. Emblem center aligned to spine, top edge 10 cm below yoke seam.",
    graphicElements: [
      "1 cracked crown icon",
      "1 rose silhouette",
      "1 caption line",
      "3 outline stroke weights",
    ],
    elementCount: "2 icons + 1 caption line + 3 stroke weights",
    layoutDescription:
      "Vertical emblem stack on back center axis. Crown top-heavy; rose anchors bottom. Caption centered 1.5 cm below rose.",
    visualHierarchy:
      "1) Crown icon (largest, highest contrast)  2) Rose icon  3) Letter-spaced caption line",
    colorBreakdown: [
      { color: "Soft Black", usage: "60%" },
      { color: "Deep Burgundy", usage: "25%" },
      { color: "Natural Raw (negative)", usage: "15%" },
    ],
    materialEffects:
      "Flat vector fills, no gradients. Outer stroke 2.5 mm; inner detail strokes 1 mm. Slight underbase flash on burgundy fill only.",
    negativeSpaceUsage:
      "18 cm emblem floating in 32 cm tall back zone — 7 cm breathing room above kangaroo pocket seam and 7 cm below yoke.",
    designInstructions: [
      "Draw crown at 9 cm width with 2.5 mm outer stroke, centered on spine.",
      "Place rose 4 cm below crown center at 7 cm width, burgundy fill.",
      "Add caption in spaced caps 1.5 cm below rose, 0.9 cm cap height.",
      "Limit palette to soft black and burgundy — no gradients.",
      "Register print top edge 10 cm below yoke seam, spine-centered.",
    ],
    mockupDescription:
      "Model shot from back, overcast daylight, hoodie natural drape. Emblem sharp against muted urban background; no front print visible.",
  },
  "Abstract Graphic": {
    exactComposition:
      "Four angular shards rotate 18°–32° across front panel inside 38 cm × 42 cm zone, inset 5 cm from side seams. Shards overlap at 2–3 cm intersections; halftone field fills gaps between shards.",
    graphicElements: [
      "4 angular color shards",
      "1 halftone gradient field",
      "1 grain texture overlay",
    ],
    elementCount: "4 shards + 1 halftone field + 1 grain overlay",
    layoutDescription:
      "Diagonal collision layout — shards enter from upper-left and lower-right quadrants, overlapping at center torso.",
    visualHierarchy:
      "1) Largest shard (upper-left, 70% opacity)  2) Contrasting shard pair at center overlap  3) Halftone field in negative gaps",
    colorBreakdown: [
      { color: "Electric Cobalt", usage: "35%" },
      { color: "Acid Yellow", usage: "25%" },
      { color: "Soft Black", usage: "25%" },
      { color: "Garment base", usage: "15%" },
    ],
    materialEffects:
      "DTG halftone dots at 35 LPI in overlap zones; grain overlay at 12% opacity across full panel; shard edges hard-cut, no feather.",
    negativeSpaceUsage:
      "Garment base visible only in 15% interstitial gaps — intentional tension between shards, not empty calm.",
    designInstructions: [
      "Plot four polygons within 38 cm × 42 cm front zone, 5 cm inset from sides.",
      "Rotate shards 18°–32°; allow 2–3 cm overlaps only at center torso.",
      "Fill overlaps with 35 LPI halftone gradient cobalt → black.",
      "Apply grain overlay at 12% opacity across entire panel.",
      "Export at 300 DPI, sRGB, no soft edges on shard boundaries.",
    ],
    mockupDescription:
      "Front-facing studio shot, high-key white backdrop, arms slightly away from torso so shard overlaps read clearly. Color accuracy prioritized under D65 lighting.",
  },
  "Minimal Back Print": {
    exactComposition:
      "Monoline eye icon 4 cm wide, stroke 1.2 mm, centered on upper back 12 cm below collar. Caption line 6 cm wide sits 0.8 cm below icon, cap height 0.7 cm.",
    graphicElements: ["1 monoline eye icon", "1 micro caption line"],
    elementCount: "1 icon + 1 caption line",
    layoutDescription:
      "Single vertical axis stack on upper back — icon dominant, caption subordinate, both spine-centered.",
    visualHierarchy:
      "1) Eye icon (only figurative mark)  2) Caption microtype  3) Unprinted fleece field",
    colorBreakdown: [
      { color: "Soft Black", usage: "8%" },
      { color: "Garment base (Sand)", usage: "92%" },
    ],
    materialEffects:
      "Water-based ink, flat matte, no raised ink. Stroke terminals rounded 0.3 mm radius. Zero distress, zero texture.",
    negativeSpaceUsage:
      "92% of back panel remains unprinted — icon floats in open fleece to amplify restraint.",
    designInstructions: [
      "Draw eye icon 4 cm wide using uniform 1.2 mm stroke, no fill.",
      "Center icon on spine, top of icon 12 cm below collar seam.",
      "Set caption 0.8 cm below icon in spaced caps, 0.7 cm cap height.",
      "Print single pass water-based soft black — no underbase on sand fleece.",
      "QC: stroke weight variance must stay within ±0.1 mm across run.",
    ],
    mockupDescription:
      "Rear three-quarter model shot in soft evening sidelight. Print visible only when light grazes back at 30° — demonstrate tonal subtlety, not flash.",
  },
  "Photography Style": {
    exactComposition:
      "B&W photo panel 34 cm wide × 38 cm tall on back, centered, margins 6 cm from side seams. Figure occupies lower two-thirds; sky negative in upper third. Torn-edge mask shaves 0.5 cm off left border irregularly.",
    graphicElements: [
      "1 street photograph panel",
      "1 torn-edge mask",
      "1 film grain overlay",
      "1 credit microline",
    ],
    elementCount: "1 photo panel + 1 edge mask + 1 grain layer + 1 credit line",
    layoutDescription:
      "Full-height back panel composition — figure grounded on bottom edge, horizon line at upper third.",
    visualHierarchy:
      "1) Lone figure silhouette  2) Rain texture on asphalt  3) Film grain + torn edge as frame",
    colorBreakdown: [
      { color: "Photo Black", usage: "45%" },
      { color: "Mid Grey", usage: "35%" },
      { color: "Highlight White", usage: "15%" },
      { color: "Garment base", usage: "5%" },
    ],
    materialEffects:
      "Halftone grain at 40 LPI, contrast pushed +18%. Torn mask alpha irregular. Pretreat for soft-hand DTG hand feel.",
    negativeSpaceUsage:
      "Upper third sky band holds highlight white — balances dense figure mass in lower frame.",
    designInstructions: [
      "Crop source photo to 34 × 38 cm, figure anchored bottom center.",
      "Convert to high-contrast B&W, push midtones +18% contrast.",
      "Apply torn-edge mask on left border, max 0.5 cm irregular shave.",
      "Overlay 40 LPI grain at 20% opacity across full panel.",
      "Print spine-centered on back with 6 cm side margins; add interior hem credit at 0.5 cm size.",
    ],
    mockupDescription:
      "Outdoor lifestyle shot, light rain, model walking away from camera. Back print reads as documentary moment — motion blur minimal, print sharp.",
  },
  "Japanese Editorial": {
    exactComposition:
      "Kanji column 3.2 cm wide, 14 cm tall, placed 5 cm left of chest center axis, top 9 cm below collar. Photo strip 2.8 cm wide × 16 cm tall sits 1.5 cm right of kanji column, aligned top edges. Latin date stamp 4 cm wide below kanji base at 0.6 cm height.",
    graphicElements: [
      "1 vertical kanji column",
      "1 narrow photo strip",
      "1 Latin date stamp",
      "1 blossom macro crop",
    ],
    elementCount: "3 layout blocks + 1 photo crop",
    layoutDescription:
      "Asymmetric editorial diptych — kanji left, photo strip right, date stamp anchoring bottom-left of text column.",
    visualHierarchy:
      "1) Kanji column (darkest ink)  2) Photo strip blossom detail  3) Date microstamp",
    colorBreakdown: [
      { color: "Sumi Black", usage: "40%" },
      { color: "Sakura Pink (photo)", usage: "30%" },
      { color: "Warm Grey (photo shadows)", usage: "20%" },
      { color: "Garment base", usage: "10%" },
    ],
    materialEffects:
      "Kanji screen print matte black; photo strip DTG with soft gradient only in blossom petals; date stamp flat grey ink.",
    negativeSpaceUsage:
      "Right chest and lower torso deliberately open — editorial margin lets diptych breathe, no center symmetry.",
    designInstructions: [
      "Set kanji column 3.2 cm wide, 14 cm tall, 5 cm left of chest center, 9 cm below collar.",
      "Place photo strip 1.5 cm right of kanji, matching top alignment at 16 cm height.",
      "Print kanji first pass sumi black; second pass DTG photo strip only.",
      "Add date stamp 0.6 cm cap height, 4 cm wide, flush under kanji baseline.",
      "Maintain 10% minimum garment base visible around block — do not fill chest.",
    ],
    mockupDescription:
      "Editorial studio shot, model facing 15° off-camera, soft key light from left. Layout asymmetry must read clearly — not centered logo composition.",
  },
  "Vintage Archive": {
    exactComposition:
      "Collegiate arch 26 cm wide, center chest, arch apex 7 cm below collar. 'EST. 1978' arc follows inner arch at 1.8 cm offset. Crack texture overlay spans full arch bounding box 26 cm × 11 cm.",
    graphicElements: [
      "1 collegiate arch wordmark",
      "1 establishment date arc",
      "1 crack distress overlay",
      "1 faux flock texture",
    ],
    elementCount: "2 type arcs + 2 texture overlays",
    layoutDescription:
      "Classic varsity center-chest arch — symmetrical on vertical axis, date nested inside arch curve.",
    visualHierarchy:
      "1) Arch outer wordmark  2) Establishment date  3) Crack/distress texture",
    colorBreakdown: [
      { color: "Faded Navy", usage: "55%" },
      { color: "Cream", usage: "30%" },
      { color: "Garment base fade", usage: "15%" },
    ],
    materialEffects:
      "Discharge underbase for vintage fade; crack overlay 25% opacity; faux flock on arch apex only, 1 mm nap height simulation in file.",
    negativeSpaceUsage:
      "Lower chest open below arch — 14 cm clear before pocket zone preserves vintage tee proportion.",
    designInstructions: [
      "Draw arch 26 cm wide, apex 7 cm below collar, centered.",
      "Nest 'EST. 1978' along inner arch at 1.8 cm radial offset.",
      "Apply discharge underbase on navy, target 20% opacity loss on garment dye.",
      "Overlay crack texture at 25% across 26 × 11 cm box.",
      "Add flock effect only on apex 6 cm segment — do not extend to full arch.",
    ],
    mockupDescription:
      "Vintage laundry flat-lay — hoodie slightly wrinkled on terry towel, warm tungsten light. Show fade variance and crack ink naturally across fleece nap.",
  },
  "Luxury Minimalism": {
    exactComposition:
      "Micro wordmark 12 cm wide, 1.1 cm cap height, tracked +240, placed on left chest 7 cm below collar and 6 cm in from left shoulder seam. No secondary elements. Ink matches garment within 8% ΔE.",
    graphicElements: ["1 spaced-caps wordmark"],
    elementCount: "1 wordmark only",
    layoutDescription:
      "Single anchor point left chest — heart-line alignment, no supporting graphics or borders.",
    visualHierarchy:
      "1) Wordmark letterforms  2) Fleece knit texture  3) Seam construction",
    colorBreakdown: [
      { color: "Tone-on-tone Sand ink", usage: "6%" },
      { color: "Garment Sand base", usage: "94%" },
    ],
    materialEffects:
      "Tone-on-tone plastisol or micro embroidery 0.8 mm stitch height. Zero distress, zero gloss — matte hand throughout.",
    negativeSpaceUsage:
      "94% garment field unmarked — spacing and material quality carry perceived luxury.",
    designInstructions: [
      "Set wordmark in wide-tracked caps, 1.1 cm height, +240 tracking.",
      "Position 7 cm below collar, 6 cm in from left shoulder seam on heart line.",
      "Match ink to fleece within 8% ΔE — test under D65 and tungsten.",
      "Single pass tone-on-tone or 0.8 mm embroidery — no double hit.",
      "Reject run if any letter exceeds ±0.15 mm stroke variance.",
    ],
    mockupDescription:
      "Clean studio product shot, mannequin torso, dual soft boxes eliminating shadow. Wordmark legible only in raking light close-up inset — hero shot shows restraint.",
  },
};

const REPETITIVE_MOTIFS =
  /\b(line drawing|line drawings|fading lines?|memory|memories|silhouette|silhouettes|hands reaching|broken connection|ghosted outline|fading hands?)\b/i;

const VAGUE_ART_DIRECTION =
  /\b(minimal lines?|abstract shapes?|soft pattern|flowing forms?|flows across|subtle pattern|gentle curves?|ethereal|soft graphic|abstract motif)\b/i;

/** Safely coerce nested AI values to displayable strings — never `[object Object]`. */
export function coerceConceptField(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => coerceConceptField(item))
      .filter(Boolean)
      .join(", ");
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["name", "label", "title", "value", "text"]) {
      const candidate = obj[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
    return JSON.stringify(value);
  }
  if (value == null) return "";
  return String(value);
}

function pickField(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = coerceConceptField(source[key]);
    if (value) return value;
  }
  return "";
}

function pickAt(values: string[] | undefined, index: number): string {
  if (!values || values.length === 0) return "";
  return values[index] ?? values[0] ?? "";
}

function ensureMinLength(value: string, min: number, fallback: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= min) return trimmed;
  return fallback.trim().length >= min ? fallback : `${fallback} ${trimmed}`.trim();
}

export function normalizeCreativeApproach(value: unknown): CreativeApproach | undefined {
  const raw = coerceConceptField(value);
  if (!raw) return undefined;
  if ((CREATIVE_APPROACHES as readonly string[]).includes(raw)) {
    return raw as CreativeApproach;
  }
  const key = raw.toLowerCase();
  return APPROACH_ALIASES[key] ?? APPROACH_ALIASES[key.replace(/_/g, " ")];
}

function normalizeProductionDifficulty(
  value: unknown,
): (typeof PRODUCTION_DIFFICULTY_LEVELS)[number] {
  const raw = coerceConceptField(value).toLowerCase();
  if (raw.includes("high") || raw.includes("hoch")) return "High";
  if (raw.includes("low") || raw.includes("niedrig")) return "Low";
  return "Medium";
}

export function visualConceptFingerprint(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .sort()
    .join(" ");
}

function isRepetitiveVisual(text: string): boolean {
  return REPETITIVE_MOTIFS.test(text);
}

function isVagueArtDirection(...texts: string[]): boolean {
  return texts.some((text) => text.trim() && VAGUE_ART_DIRECTION.test(text));
}

function normalizeStringList(value: unknown, minLength = 3): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => coerceConceptField(item)).filter((s) => s.length >= minLength);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|,/)
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter((s) => s.length >= minLength);
  }
  return [];
}

function normalizeColorBreakdown(value: unknown): ColorBreakdownEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        const match = item.match(/^(.+?)\s+(\d+\s*%)$/);
        if (match) {
          return { color: match[1].trim(), usage: match[2].replace(/\s+/g, "") };
        }
        return item.trim() ? { color: item.trim(), usage: "—" } : null;
      }
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const color = coerceConceptField(obj.color ?? obj.name ?? obj.label);
        const usage = coerceConceptField(obj.usage ?? obj.percent ?? obj.percentage);
        if (color && usage) return { color, usage };
      }
      return null;
    })
    .filter((entry): entry is ColorBreakdownEntry => entry != null);
}

function normalizeInstructionList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => coerceConceptField(item))
      .filter((step) => step.length >= 10);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n+/)
      .map((step) => step.replace(/^\d+\.\s*/, "").trim())
      .filter((step) => step.length >= 10);
  }
  return [];
}

export function formatColorBreakdown(
  breakdown: ColorBreakdownEntry[],
): string {
  return breakdown.map((entry) => `${entry.color} (${entry.usage})`).join(" · ");
}

function resolveUniqueApproach(
  current: CreativeApproach | undefined,
  used: Set<string>,
  index: number,
): CreativeApproach {
  if (current && !used.has(current)) return current;
  const unused = CREATIVE_APPROACHES.find((approach) => !used.has(approach));
  return unused ?? CREATIVE_APPROACHES[index % CREATIVE_APPROACHES.length];
}

function mergeApproachProfile(
  concept: DesignConcept,
  profile: ApproachProfile,
  overwriteVisual = false,
): DesignConcept {
  const art = ART_DIRECTION_BY_APPROACH[concept.creativeApproach];
  const vague = isVagueArtDirection(
    concept.exactComposition,
    concept.layoutDescription,
    concept.visualConcept,
  );
  const overwriteArt = overwriteVisual || vague;

  const pickArtString = (current: string, fallback: string) =>
    overwriteArt || !current.trim() || isVagueArtDirection(current)
      ? fallback
      : current;

  const pickArtList = (current: string[], fallback: string[]) =>
    overwriteArt || current.length === 0 ? fallback : current;

  const pickColorBreakdown = (
    current: ColorBreakdownEntry[],
    fallback: ColorBreakdownEntry[],
  ) => (overwriteArt || current.length < 2 ? fallback : current);

  return {
    ...concept,
    styleDirection: concept.styleDirection || profile.styleDirection,
    emotion: concept.emotion || profile.emotion,
    visualConcept:
      overwriteVisual || !concept.visualConcept || isVagueArtDirection(concept.visualConcept)
        ? profile.visualConcept
        : concept.visualConcept,
    designDescription:
      overwriteVisual || !concept.designDescription
        ? profile.designDescription
        : concept.designDescription,
    message: concept.message || profile.message,
    typography: concept.typography || profile.typography,
    symbolism: concept.symbolism || profile.symbolism,
    printTechnique: concept.printTechnique || profile.printTechnique,
    printSize: concept.printSize || profile.printSize,
    placementDimensions:
      concept.placementDimensions || profile.placementDimensions,
    garmentInspiration:
      concept.garmentInspiration || profile.garmentInspiration,
    brandInspiration: concept.brandInspiration || profile.brandInspiration,
    productionDifficulty:
      concept.productionDifficulty || profile.productionDifficulty,
    visualReferences: concept.visualReferences || profile.visualReferences,
    exactComposition: pickArtString(concept.exactComposition, art.exactComposition),
    graphicElements: pickArtList(concept.graphicElements, art.graphicElements),
    elementCount: pickArtString(concept.elementCount, art.elementCount),
    layoutDescription: pickArtString(concept.layoutDescription, art.layoutDescription),
    visualHierarchy: pickArtString(concept.visualHierarchy, art.visualHierarchy),
    colorBreakdown: pickColorBreakdown(concept.colorBreakdown, art.colorBreakdown),
    materialEffects: pickArtString(concept.materialEffects, art.materialEffects),
    negativeSpaceUsage: pickArtString(
      concept.negativeSpaceUsage,
      art.negativeSpaceUsage,
    ),
    designInstructions: pickArtList(concept.designInstructions, art.designInstructions),
    mockupDescription: pickArtString(concept.mockupDescription, art.mockupDescription),
  };
}

function enrichDesignConcept(
  concept: DesignConcept,
  index: number,
  context: NormalizeDesignConceptContext,
): DesignConcept {
  const creativeApproach =
    concept.creativeApproach ??
    CREATIVE_APPROACHES[index % CREATIVE_APPROACHES.length];
  const profile = APPROACH_PROFILES[creativeApproach];
  const art = ART_DIRECTION_BY_APPROACH[creativeApproach];

  const title =
    concept.title ||
    concept.message ||
    context.collectionIdea ||
    context.title ||
    `Konzept ${index + 1}`;

  const merged = mergeApproachProfile(
    {
      ...concept,
      creativeApproach,
      title,
      product: concept.product || pickAt(context.products, index),
      color: concept.color || pickAt(context.colors, index),
      printArea:
        concept.printArea || pickAt(context.printAreas, index) || "Back",
      targetAudience: ensureMinLength(
        concept.targetAudience ||
          context.targetAudience ||
          "18-30 streetwear consumers with distinct style identities",
        10,
        "18-30 streetwear consumers with distinct style identities",
      ),
      rationale:
        concept.rationale ||
        concept.designDescription ||
        `Creative direction for ${title} (${creativeApproach}).`,
    },
    profile,
  );

  return {
    ...merged,
    styleDirection: ensureMinLength(merged.styleDirection, 5, profile.styleDirection),
    emotion: ensureMinLength(merged.emotion, 2, profile.emotion),
    visualConcept: ensureMinLength(merged.visualConcept, 10, profile.visualConcept),
    designDescription: ensureMinLength(
      merged.designDescription,
      10,
      profile.designDescription,
    ),
    symbolism: ensureMinLength(merged.symbolism, 5, profile.symbolism),
    typography: ensureMinLength(merged.typography, 5, profile.typography),
    message: ensureMinLength(merged.message, 3, profile.message || title),
    printTechnique: ensureMinLength(merged.printTechnique, 5, profile.printTechnique),
    printSize: ensureMinLength(merged.printSize, 3, profile.printSize),
    placementDimensions: ensureMinLength(
      merged.placementDimensions,
      5,
      profile.placementDimensions,
    ),
    garmentInspiration: ensureMinLength(
      merged.garmentInspiration,
      5,
      profile.garmentInspiration,
    ),
    brandInspiration: ensureMinLength(
      merged.brandInspiration,
      5,
      profile.brandInspiration,
    ),
    visualReferences: ensureMinLength(
      merged.visualReferences,
      10,
      profile.visualReferences,
    ),
    exactComposition: ensureMinLength(
      merged.exactComposition,
      20,
      art.exactComposition,
    ),
    graphicElements:
      merged.graphicElements.length > 0
        ? merged.graphicElements
        : art.graphicElements,
    elementCount: ensureMinLength(merged.elementCount, 3, art.elementCount),
    layoutDescription: ensureMinLength(
      merged.layoutDescription,
      20,
      art.layoutDescription,
    ),
    visualHierarchy: ensureMinLength(
      merged.visualHierarchy,
      15,
      art.visualHierarchy,
    ),
    colorBreakdown:
      merged.colorBreakdown.length >= 2
        ? merged.colorBreakdown
        : art.colorBreakdown,
    materialEffects: ensureMinLength(
      merged.materialEffects,
      10,
      art.materialEffects,
    ),
    negativeSpaceUsage: ensureMinLength(
      merged.negativeSpaceUsage,
      10,
      art.negativeSpaceUsage,
    ),
    designInstructions:
      merged.designInstructions.length >= 3
        ? merged.designInstructions
        : art.designInstructions,
    mockupDescription: ensureMinLength(
      merged.mockupDescription,
      20,
      art.mockupDescription,
    ),
  };
}

/** Ensure each concept uses a unique creative approach and visual direction. */
export function diversifyDesignConcepts(
  concepts: DesignConcept[],
  adjustments: string[] = [],
): DesignConcept[] {
  const usedApproaches = new Set<string>();
  const usedVisuals = new Set<string>();

  return concepts.map((concept, index) => {
    const approach = resolveUniqueApproach(
      concept.creativeApproach,
      usedApproaches,
      index,
    );
    const profile = APPROACH_PROFILES[approach];

    let next = enrichDesignConcept(
      { ...concept, creativeApproach: approach },
      index,
      {},
    );

    if (approach !== concept.creativeApproach) {
      adjustments.push(
        `reassigned designs[${index}] creativeApproach → ${approach}`,
      );
      next = mergeApproachProfile(
        next,
        profile,
        isRepetitiveVisual(next.visualConcept),
      );
    }
    usedApproaches.add(approach);

    let visualKey = visualConceptFingerprint(next.visualConcept);
    const duplicateVisual = usedVisuals.has(visualKey);
    const repetitiveMotif = isRepetitiveVisual(next.visualConcept);

    if (duplicateVisual || repetitiveMotif) {
      next = mergeApproachProfile(next, profile, true);
      visualKey = visualConceptFingerprint(next.visualConcept);
      adjustments.push(
        `diversified designs[${index}] visual (${duplicateVisual ? "duplicate" : "repetitive motif"})`,
      );
    }

    usedVisuals.add(visualKey);
    return next;
  });
}

/** Normalize a single design entry from string or structured object output. */
export function normalizeDesignConcept(
  entry: unknown,
  index: number,
  context: NormalizeDesignConceptContext,
): DesignConcept {
  const defaultApproach = CREATIVE_APPROACHES[index % CREATIVE_APPROACHES.length];

  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const source = entry as Record<string, unknown>;
    const concept: DesignConcept = {
      title: pickField(source, ["title", "name", "concept", "summary"]),
      creativeApproach:
        normalizeCreativeApproach(
          source.creativeApproach ?? source.approach ?? source.category,
        ) ?? defaultApproach,
      product: pickField(source, ["product", "garment", "item"]),
      color: pickField(source, ["color", "colour", "shade"]),
      printArea: pickField(source, [
        "printArea",
        "printPosition",
        "printAreas",
        "placement",
      ]),
      styleDirection: pickField(source, [
        "styleDirection",
        "style",
        "direction",
        "aesthetic",
      ]),
      emotion: pickField(source, ["emotion", "mood", "feeling"]),
      targetAudience: pickField(source, ["targetAudience", "audience"]),
      visualConcept: pickField(source, [
        "visualConcept",
        "visual",
        "visualIdea",
        "graphicIdea",
      ]),
      designDescription: pickField(source, [
        "designDescription",
        "description",
        "conceptDescription",
      ]),
      symbolism: pickField(source, ["symbolism", "symbol", "meaning"]),
      typography: pickField(source, ["typography", "type", "fontStyle", "fonts"]),
      message: pickField(source, ["message", "text", "copy", "garmentText", "slogan"]),
      rationale: pickField(source, ["rationale", "reason", "why"]),
      printTechnique: pickField(source, [
        "printTechnique",
        "technique",
        "printMethod",
        "productionTechnique",
      ]),
      printSize: pickField(source, ["printSize", "size", "graphicSize"]),
      placementDimensions: pickField(source, [
        "placementDimensions",
        "dimensions",
        "placementSize",
        "printDimensions",
      ]),
      garmentInspiration: pickField(source, [
        "garmentInspiration",
        "garmentReference",
        "silhouetteInspiration",
      ]),
      brandInspiration: pickField(source, [
        "brandInspiration",
        "brandReference",
        "referenceBrand",
      ]),
      productionDifficulty: normalizeProductionDifficulty(
        source.productionDifficulty ?? source.difficulty,
      ),
      visualReferences: pickField(source, [
        "visualReferences",
        "references",
        "moodReferences",
        "referenceImages",
      ]),
      exactComposition: pickField(source, [
        "exactComposition",
        "composition",
        "exactLayout",
        "positioning",
      ]),
      graphicElements: normalizeStringList(
        source.graphicElements ?? source.elements ?? source.graphics,
      ),
      elementCount: pickField(source, ["elementCount", "elementsCount", "count"]),
      layoutDescription: pickField(source, [
        "layoutDescription",
        "layout",
        "compositionLayout",
      ]),
      visualHierarchy: pickField(source, [
        "visualHierarchy",
        "hierarchy",
        "viewingOrder",
      ]),
      colorBreakdown: normalizeColorBreakdown(
        source.colorBreakdown ?? source.colors ?? source.palette,
      ),
      materialEffects: pickField(source, [
        "materialEffects",
        "textureEffects",
        "finishing",
        "effects",
      ]),
      negativeSpaceUsage: pickField(source, [
        "negativeSpaceUsage",
        "negativeSpace",
        "whitespace",
      ]),
      designInstructions: normalizeInstructionList(
        source.designInstructions ?? source.instructions ?? source.steps,
      ),
      mockupDescription: pickField(source, [
        "mockupDescription",
        "mockup",
        "productPhoto",
        "photoDirection",
      ]),
    };
    return enrichDesignConcept(concept, index, context);
  }

  const summary = coerceConceptField(entry);
  const concept: DesignConcept = {
    title: summary || context.collectionIdea || context.title || `Konzept ${index + 1}`,
    creativeApproach: defaultApproach,
    product: pickAt(context.products, index),
    color: pickAt(context.colors, index),
    printArea: pickAt(context.printAreas, index),
    styleDirection: context.styleDirection || summary,
    emotion: "",
    targetAudience: context.targetAudience || "",
    visualConcept: summary,
    designDescription: summary,
    symbolism: "",
    typography: "",
    message: summary,
    rationale: summary,
    printTechnique: "",
    printSize: "",
    placementDimensions: "",
    garmentInspiration: "",
    brandInspiration: "",
    productionDifficulty: "Medium",
    visualReferences: "",
    exactComposition: "",
    graphicElements: [],
    elementCount: "",
    layoutDescription: "",
    visualHierarchy: "",
    colorBreakdown: [],
    materialEffects: "",
    negativeSpaceUsage: "",
    designInstructions: [],
    mockupDescription: "",
  };

  return enrichDesignConcept(concept, index, context);
}

export function normalizeDesignConcepts(
  value: unknown,
  context: NormalizeDesignConceptContext,
  adjustments: string[] = [],
): DesignConcept[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const concepts = value.map((entry, index) => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      adjustments.push(`normalized designs[${index}] object → DesignConcept`);
    } else if (typeof entry === "string") {
      adjustments.push(`coerced designs[${index}] string → DesignConcept`);
    }
    return normalizeDesignConcept(entry, index, context);
  });

  if (concepts.length === 0) return undefined;

  return diversifyDesignConcepts(concepts, adjustments);
}

export function summarizeDesignConcept(concept: DesignConcept): string {
  return [concept.creativeApproach, concept.title, concept.visualConcept]
    .filter(Boolean)
    .join(" — ");
}

export function summarizeDesignConcepts(concepts: DesignConcept[]): string[] {
  return concepts.map(summarizeDesignConcept);
}

export function formatDesignConceptMarkdown(
  concept: DesignConcept,
  index: number,
): string {
  return [
    `### ${index + 1}. ${concept.title}`,
    `**Approach:** ${concept.creativeApproach}`,
    concept.emotion ? `**Emotion:** ${concept.emotion}` : "",
    concept.visualConcept ? `**Visual:** ${concept.visualConcept}` : "",
    concept.designDescription
      ? `**Design:** ${concept.designDescription}`
      : "",
    concept.message ? `**Message:** ${concept.message}` : "",
    concept.typography ? `**Typography:** ${concept.typography}` : "",
    concept.symbolism ? `**Symbolism:** ${concept.symbolism}` : "",
    concept.printTechnique ? `**Print technique:** ${concept.printTechnique}` : "",
    concept.printSize ? `**Print size:** ${concept.printSize}` : "",
    concept.placementDimensions
      ? `**Placement:** ${concept.placementDimensions}`
      : "",
    concept.productionDifficulty
      ? `**Production difficulty:** ${concept.productionDifficulty}`
      : "",
    concept.garmentInspiration
      ? `**Garment inspiration:** ${concept.garmentInspiration}`
      : "",
    concept.brandInspiration
      ? `**Brand inspiration:** ${concept.brandInspiration}`
      : "",
    concept.visualReferences
      ? `**Visual references:** ${concept.visualReferences}`
      : "",
    concept.product ? `**Product:** ${concept.product}` : "",
    concept.color ? `**Color:** ${concept.color}` : "",
    concept.printArea ? `**Print area:** ${concept.printArea}` : "",
    concept.styleDirection ? `**Style:** ${concept.styleDirection}` : "",
    concept.targetAudience ? `**Audience:** ${concept.targetAudience}` : "",
    concept.rationale ? `**Rationale:** ${concept.rationale}` : "",
    "",
    "#### Art Direction",
    concept.exactComposition
      ? `**Composition:** ${concept.exactComposition}`
      : "",
    concept.graphicElements.length
      ? `**Elements:** ${concept.graphicElements.join("; ")}`
      : "",
    concept.elementCount ? `**Element count:** ${concept.elementCount}` : "",
    concept.layoutDescription
      ? `**Layout:** ${concept.layoutDescription}`
      : "",
    concept.visualHierarchy
      ? `**Hierarchy:** ${concept.visualHierarchy}`
      : "",
    concept.colorBreakdown.length
      ? `**Color breakdown:** ${formatColorBreakdown(concept.colorBreakdown)}`
      : "",
    concept.materialEffects
      ? `**Material effects:** ${concept.materialEffects}`
      : "",
    concept.negativeSpaceUsage
      ? `**Negative space:** ${concept.negativeSpaceUsage}`
      : "",
    concept.designInstructions.length
      ? `**Designer instructions:**\n${concept.designInstructions.map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join("\n")}`
      : "",
    concept.mockupDescription
      ? `**Mockup:** ${concept.mockupDescription}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
