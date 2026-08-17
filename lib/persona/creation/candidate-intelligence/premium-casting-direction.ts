/**
 * Phase 2.2B / 2.2C / 2.2H / 2.2I / 2.2J / 2.2K / 2.2L — Primary Brand Face direction (creative only).
 *
 * Mediterranean Premium Hero = primary face of a premium modern streetwear brand.
 * Phase 2.2I softens final casting quality toward timeless commercial premium
 * streetwear — does NOT redesign the archetype.
 * Phase 2.2J raises the QUALITY BAR toward the creative casting DNA that made a
 * prior Candidate D successful — NEVER copies that face, identity, embedding,
 * or anatomy template. A/B/C/D remain biologically distinct humans.
 * Phase 2.2K further softens toward a cleaner, younger (22–25) soft-masculine
 * e-commerce streetwear face — reduces traditional rugged / beard-heavy masculinity.
 * Phase 2.2L restores strong A/B/C/D casting diversity (hair silhouettes + face
 * geometry) while keeping the 2.2K softer commercial quality — never four brothers.
 *
 * Target balance: ~70% approachable commercial streetwear · ~20% premium polish · ~10% masculine edge.
 * Target impression: “He looks good in that outfit.” / “I want to dress like him.”
 * NOT: “That man has an extremely masculine/model face.”
 *
 * Attractiveness from harmony, relatability, trustworthiness — NOT extreme
 * masculinity, editorial beauty, or “most handsome man” casting.
 *
 * Quality inspiration (casting bar /wardrobe vibe only, never identity copy):
 * Fear of God ESSENTIALS, Aimé Leon Dore, Our Legacy, COS, ARKET, Zara Studio.
 * Avoid: Dolce & Gabbana campaign, perfume ads, luxury runway, Instagram model.
 */

import type { ArchetypeCandidateBlueprint, BrandArchetype } from "@/lib/brand-archetypes";
import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";
import {
  URBAN_CASTING_DIVERSITY_FACE_GEOMETRY,
  URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES,
} from "./urban-face-diversity";

export {
  URBAN_CASTING_DIVERSITY_FACE_GEOMETRY,
  URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES,
} from "./urban-face-diversity";

/** Quality reference brands — casting bar only, never identity copy. */
export const PREMIUM_CASTING_QUALITY_REFERENCE = [
  "Fear of God ESSENTIALS",
  "Aimé Leon Dore",
  "Our Legacy",
  "COS",
  "ARKET",
  "Zara Studio",
] as const;

/**
 * Phase 2.2J — creative casting QUALITY BAR inspired by a successful prior Candidate D.
 * Tokens only — NEVER a face match, embedding, or locked anatomy template.
 * Phase 2.2K softens further (cleaner / younger / less rugged) while keeping this bar.
 */
export const CANDIDATE_D_CREATIVE_DNA_QUALITY = [
  "youthful Mediterranean appearance",
  "narrow-to-medium face shape",
  "soft masculine bone structure",
  "natural medium jaw",
  "relaxed open eyes",
  "balanced brows",
  "natural lips",
  "cleaner contemporary textured dark hair",
  "slot-specific streetwear haircut — never one shared board haircut",
  "clean shave or very light natural stubble",
  "approachable neutral expression",
  "quiet confidence",
  "effortless charisma",
  "slight individuality / imperfection",
  "naturally handsome",
  "premium everyday attractiveness",
  "naturally belongs in Milaene",
] as const;

/** Phase 2.2K — softer primary streetwear face casting tokens. */
export const SOFTER_PRIMARY_STREETWEAR_FACE_QUALITY = [
  "apparent age 22–25",
  "softer oval or subtle rectangular face",
  "reduced facial width",
  "reduced jaw width and sharpness",
  "softer lower face",
  "youthful cheeks",
  "clean shave or very light stubble",
  "70% approachable commercial streetwear",
  "20% premium fashion polish",
  "10% masculine edge",
  "He looks good in that outfit",
] as const;

/**
 * Phase 2.2L — mandatory A/B/C/D casting diversity (creative only).
 * Hair silhouette families + face-geometry families must stay visibly distinct.
 */
export const CASTING_DIVERSITY_HAIR_SILHOUETTES = {
  A: "short textured crop / short curls / clean taper — low-maintenance streetwear — NO medium-long waves",
  B: "very short crop / buzz-adjacent texture OR tight short curls with fade — cleaner hairline — NO loose long curls",
  C: "medium-length relaxed waves — creative streetwear lane — ONLY slot that strongly prefers longer/wavier hair",
  D: "short messy curls OR short natural textured hair OR soft taper with texture — NO long editorial hair",
} as const;

export const CASTING_DIVERSITY_FACE_GEOMETRY = {
  A: "softer oval / slightly rectangular — medium nose — softer jaw — open relaxed eyes",
  B: "narrower elongated face — different nose bridge/nostril structure — more compact jaw — different brow shape",
  C: "slightly wider upper face — softer lower face — distinct eye spacing — different cheek structure",
  D: "balanced narrow-to-medium face — subtle angularity — distinct nose tip / lips / chin relationship — warm approachable eyes",
} as const;

/** Explicit non-goals — prove we do not encode a prior Candidate D identity. */
export const CANDIDATE_D_CREATIVE_DNA_NON_GOALS = [
  "Do NOT copy any prior Candidate D face or identity",
  "Do NOT attempt face matching to a previous board slot",
  "Do NOT create a reference embedding from Candidate D",
  "Do NOT use Candidate D as an anatomy template for A/B/C/D",
] as const;

export type OfficialArchetypeSlug =
  | "mediterranean-premium-hero"
  | "urban-community-hero"
  | "female-lifestyle-hero";

const OFFICIAL_ARCHETYPE_SLUGS: readonly OfficialArchetypeSlug[] = [
  "mediterranean-premium-hero",
  "urban-community-hero",
  "female-lifestyle-hero",
] as const;

export function isOfficialArchetypeSlug(
  slug: string,
): slug is OfficialArchetypeSlug {
  return (OFFICIAL_ARCHETYPE_SLUGS as readonly string[]).includes(slug);
}

/** Strict gender enforcement — never mix roles. */
export function genderEnforcementBlock(archetype: BrandArchetype): string {
  const slug = archetype.slug;
  if (slug === "female-lifestyle-hero") {
    return [
      "STRICT CASTING ROLE — Female Lifestyle Hero",
      "ONLY adult female presentation. Never male. Never androgynous male-coded face.",
    ].join("\n");
  }
  if (slug === "mediterranean-premium-hero" || slug === "urban-community-hero") {
    return [
      `STRICT CASTING ROLE — ${archetype.name}`,
      "ONLY adult male presentation. Never female. Never feminine-coded face on a male hero role.",
    ].join("\n");
  }
  return [
    "STRICT CASTING ROLE",
    `Gender presentation locked: ${archetype.genderPresentation}.`,
  ].join("\n");
}

/**
 * Highest-priority A1 opener — real human photograph before fashion styling.
 * Keep archetype-neutral biology here; slot L3 owns exact face/hair.
 */
export function realHumanPhotographPriorityBlock(
  archetypeSlug?: string | null,
): string {
  const urban = archetypeSlug === "urban-community-hero";
  return [
    "REAL HUMAN PHOTOGRAPH — A1 DISCOVERY PRIORITY",
    "Output must read as a real unretouched commercial streetwear casting photograph,",
    "shot on a real camera — not AI fashion, CGI, Midjourney, or Instagram AI face.",
    urban
      ? "PRIMARY BRAND FACE: cool modern naturally stylish Black / Afro-European commercial streetwear model (apparent age ~21–24)."
      : "PRIMARY BRAND FACE: cleaner younger soft-masculine premium streetwear ambassador (apparent age ~22–25).",
    "Someone who looks excellent in oversized T-shirts and hoodies — commercial fashion model, not runway-extreme.",
    "Hair silhouette and face geometry MUST follow THIS slot’s casting lane — never one shared haircut across A/B/C/D.",
    urban
      ? "Emotional target: “Cool, modern, naturally stylish — I want to wear what he is wearing.”"
      : "Emotional target: “He looks good in that outfit.” / “I want to dress like him.”",
    "Identity and human realism matter more than beauty, glamour, or cinematic polish.",
  ].join("\n");
}

/**
 * Phase 2.2J — shared QUALITY BAR only. Never a face/identity template.
 * Phase 2.2K softens proportions further (cleaner / younger).
 */
function candidateDCreativeDnaQualityBarBlock(): string {
  return [
    "PHASE 2.2J — CANDIDATE D CREATIVE DNA (QUALITY BAR ONLY — NOT AN IDENTITY)",
    "Raise casting quality toward the creative qualities that make a Brand Face feel like he naturally belongs in Milaene.",
    "This is a QUALITY BAR for all four slots — NEVER a face match, NEVER a prior Candidate D identity copy,",
    "NEVER a reference embedding, NEVER a shared anatomy template. A/B/C/D must remain four different humans.",
    "",
    "Prefer: youthful Mediterranean appearance · narrow-to-medium face · soft masculine bone structure ·",
    "natural medium jaw · relaxed open eyes · balanced brows · natural lips · cleaner contemporary textured dark hair ·",
    "slot-specific streetwear haircut (never one shared board haircut) · clean shave or very light natural stubble · approachable neutral expression ·",
    "quiet confidence · effortless charisma · slight individuality / imperfection · naturally handsome ·",
    "premium everyday attractiveness — memorable without extreme facial features.",
    "",
    "Believable wearing oversized heavyweight tees, premium hoodies, zip hoodies, relaxed trousers, minimal contemporary streetwear.",
    "Soft masculine without looking hyper-masculine, rugged, or beard-heavy. Approachable. Recurring face of Milaene.",
    "",
    "Further reduce: square oversized jaws, extremely sharp jawlines, aggressive masculinity, heavy beard styling,",
    "bodybuilder appearance, mature 27+ / 30+ look, runway-model intensity, perfume-campaign beauty, luxury-fashion hero posing,",
    "dramatic cheekbones, intimidating eyes, perfect facial symmetry, Instagram influencer perfection, artificial beauty,",
    "overly styled editorial hair, cinematic hero lighting, alpha-male casting, rugged Mediterranean hero energy.",
    "Candidate D creative DNA is a QUALITY BAR only — NEVER the anatomy template that makes A/B/C/D look like brothers.",
  ].join("\n");
}

/** Phase 2.2K — softer primary streetwear face (proportional refinement only). */
function softerPrimaryStreetwearFaceBlock(): string {
  return [
    "PHASE 2.2K — SOFTER PRIMARY STREETWEAR FACE (PROPORTIONAL REFINEMENT ONLY)",
    "The Brand Face still reads too traditionally masculine — soften further without becoming feminine.",
    "Keep clear male identity with softer masculine proportions.",
    "",
    "REDUCE: facial width · jaw width · jaw sharpness · chin projection · cheekbone prominence · brow heaviness ·",
    "beard density · ruggedness · mature masculine hardness.",
    "",
    "INCREASE: soft-masculine youthful proportions within THIS slot’s geometry family · smooth facial transitions ·",
    "softer lower face · natural medium jaw · youthful cheeks · relaxed open eyes · balanced brows · natural lips ·",
    "approachable neutral expression.",
    "",
    "AGE: strongly prefer apparent age 22–25. Avoid faces that visually read as 27+.",
    "PRESENCE: calm · friendly · quietly confident · youthful · effortless · trustworthy.",
    "NOT: dominant · intimidating · seductive · rugged · heroic · alpha-male.",
    "",
    "FACIAL HAIR preference: clean shave OR very light natural stubble.",
    "Reduce: full beard · dense beard shadow · sharply lined beard · heavy moustache · strongly masculine facial-hair styling.",
    "",
    "HAIR: keep cleaner contemporary streetwear quality — but hair SILHOUETTE is SLOT-SPECIFIC.",
    "Do NOT apply one board-wide short-curl / soft-taper / medium-wave haircut to A/B/C/D.",
    "Follow THIS slot’s mandatory hair family. Only Slot C strongly prefers medium-length relaxed waves.",
    "Reduce overly editorial long/wavy male-model hair on slots A, B, and D.",
    "",
    "TARGET BALANCE: ~70% approachable commercial streetwear · ~20% premium fashion polish · ~10% masculine edge.",
    "Do NOT let masculine edge dominate the casting.",
    "Viewer should think “He looks good in that outfit.” — not “That man has an extremely masculine/model face.”",
    "Do NOT copy any previously generated person’s exact identity — proportional / casting-quality refinement only.",
  ].join("\n");
}

/**
 * Phase 2.2L — restore strong A/B/C/D casting diversity (creative only).
 * Keeps 2.2K softer commercial quality while forbidding sibling / same-haircut collapse.
 */
function castingDiversityAntiCollapseBlock(): string {
  return [
    "PHASE 2.2L — STRONG A/B/C/D CASTING DIVERSITY (ANTI-COLLAPSE)",
    "Keep the softer, younger, commercial streetwear QUALITY from 2.2K.",
    "BUT restore immediate visual separation — four different people, never brothers,",
    "never four variations of one Mediterranean male-model archetype,",
    "never four copies of a prior Candidate D face.",
    "",
    "MANDATORY HAIR DIVERSITY — minimum 3 clearly different haircut silhouettes across A/B/C/D:",
    `Slot A: ${CASTING_DIVERSITY_HAIR_SILHOUETTES.A}`,
    `Slot B: ${CASTING_DIVERSITY_HAIR_SILHOUETTES.B}`,
    `Slot C: ${CASTING_DIVERSITY_HAIR_SILHOUETTES.C}`,
    `Slot D: ${CASTING_DIVERSITY_HAIR_SILHOUETTES.D}`,
    "Do NOT allow all four candidates to use wavy medium-length hair.",
    "Do NOT share the same middle-part hairstyle across slots.",
    "Do NOT share the same haircut silhouette across slots.",
    "",
    "MANDATORY FACE-GEOMETRY DIVERSITY — different facial geometry family per slot:",
    `Slot A: ${CASTING_DIVERSITY_FACE_GEOMETRY.A}`,
    `Slot B: ${CASTING_DIVERSITY_FACE_GEOMETRY.B}`,
    `Slot C: ${CASTING_DIVERSITY_FACE_GEOMETRY.C}`,
    `Slot D: ${CASTING_DIVERSITY_FACE_GEOMETRY.D}`,
    "Do NOT reuse the same jaw width, eye shape, nose structure, brow structure, hairline, or lip proportions across all four.",
    "",
    "REGIONAL CASTING LANES (modern believable casting — not stereotypes):",
    "A — Iberian / Southern European commercial · B — Maghrebi / North African Mediterranean ·",
    "C — Greek / Balkan creative streetwear · D — Levantine / Eastern Mediterranean ambassador.",
    "",
    "ANTI-COLLAPSE — explicitly discourage:",
    "same wavy hairstyle across slots · same middle-part hairstyle · same jaw shape · same eyebrow shape ·",
    "same beard pattern · same eye shape · four conventionally handsome Mediterranean male-model variants ·",
    "sibling appearance · repeated facial proportions · Candidate D anatomy template applied to A/B/C.",
    "A/B/C/D should look like four people who could appear in the same Milaene campaign —",
    "not four versions of one casting archetype.",
  ].join("\n");
}

/**
 * Mediterranean quality bar — NO shared biology recipe.
 * Slot-specific face/hair/skin live only in discovery blueprints / L3.
 */
function mediterraneanPremiumBlock(): string {
  return [
    "PREMIUM CASTING — Mediterranean Premium Hero / PRIMARY BRAND FACE (quality bar only)",
    "Phase 2.2I–2.2L: softer commercial premium streetwear face + strong A/B/C/D diversity.",
    "Cast four completely different naturally handsome Mediterranean males (apparent age ~22–25).",
    "Biology comes ONLY from each candidate's Discovery Identity Instance — never homogenize faces.",
    "Four different real people — never brothers, cousins, twins, or four versions of one prior Candidate D face.",
    "Do NOT copy any prior Candidate D face. NEVER a reference embedding. QUALITY BAR ONLY — not an identity.",
    "Haircuts must show at least three distinct silhouettes — only Slot C strongly prefers medium/long waves.",
    "Naturally handsome rather than striking — agency-castable, commercially memorable soft-masculine streetwear face.",
    "FASHION MODEL QUALITY BAR: clean modern e-commerce streetwear casting — photorealistic, campaign-ready later.",
    "",
    candidateDCreativeDnaQualityBarBlock(),
    "",
    softerPrimaryStreetwearFaceBlock(),
    "",
    castingDiversityAntiCollapseBlock(),
    "",
    `Wardrobe vibe (never copy identity): ${PREMIUM_CASTING_QUALITY_REFERENCE.join(", ")}.`,
    "Photorealistic commercial casting — campaign-ready later — soft natural daylight, soft even shadows.",
    "Reduce model perfection ~10%. Emotional target: “He looks good in that outfit.” / “I want to dress like him.”",
    "Avoid: hyper masculine faces, square oversized jaws, perfume advertisement, luxury runway, heavy beard,",
    "bodybuilder, Instagram model, looking older than 26 / visually 27+ / mature 30+ appearance, sibling appearance,",
    "same wavy medium-length hair across A/B/C/D, cinematic hero lighting, Rembrandt drama, plastic skin.",
  ].join("\n");
}

function urbanCommunityBlock(recipe?: {
  hairLanes: Record<"A" | "B" | "C" | "D", string>;
} | null): string {
  const hair = recipe?.hairLanes;
  return [
    "PREMIUM CASTING — Urban Community Hero",
    "Adult male Black / Afro-European young streetwear model, apparent age 21–24.",
    "Young fashion-model face with distinctive but believable features.",
    "Lean / athletic · modern streetwear · realistic commercial fashion casting · natural skin · clean portrait photography · Milaene-compatible look.",
    "Four genuinely new, clearly different people across A/B/C/D.",
    "Create new people not based on previous discovery faces.",
    "Do NOT force detailed fixed jaw / nose / lip / eye geometry.",
    "Never underage / teenage / baby-face. Avoid late-20s mature adult look.",
    "Hair styles rotate per discovery run — short, medium, braids, locs, and afros are all allowed.",
    "",
    "This run hair lanes:",
    `A: ${hair?.A ?? URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES.A}`,
    `B: ${hair?.B ?? URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES.B}`,
    `C: ${hair?.C ?? URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES.C}`,
    `D: ${hair?.D ?? URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES.D}`,
    "",
    "Slot moods only (not anatomy): A approachable lifestyle · B clean street · C creative fashion · D confident campaign.",
    "Visually distinct from Mediterranean Premium Hero. Photorealistic casting photograph — not CGI.",
  ].join("\n");
}

function femaleLifestyleBlock(): string {
  return [
    "PREMIUM CASTING — Female Lifestyle Hero (quality bar only)",
    "Cast DISTINCT adult female premium streetwear / lifestyle faces — real people, not beauty-campaign dolls.",
    "Biology and fashion presence come ONLY from each candidate's discovery blueprint / L3.",
    "",
    "Natural beauty. No heavy makeup. Healthy realistic skin with visible texture.",
    "Expression: authentic warmth when appropriate — never forced stock smile.",
    "COS / ARKET / Zara Studio / Acne Studios casting quality. Photorealistic, campaign-ready potential — casting frame first.",
    "Authenticity is more important than beauty.",
    "",
    "NOT passport photo. NOT beauty-pageant glam. NOT plastic AI face. NOT Instagram filter.",
  ].join("\n");
}

export function premiumArchetypeCastingBlock(
  archetype: BrandArchetype,
  options?: {
    urbanHairLanes?: Record<"A" | "B" | "C" | "D", string> | null;
  },
): string {
  switch (archetype.slug) {
    case "mediterranean-premium-hero":
      return mediterraneanPremiumBlock();
    case "urban-community-hero":
      return urbanCommunityBlock(
        options?.urbanHairLanes
          ? { hairLanes: options.urbanHairLanes }
          : null,
      );
    case "female-lifestyle-hero":
      return femaleLifestyleBlock();
    default:
      return [
        "PREMIUM CASTING DIRECTION",
        "Agency casting presence — real human photograph first,",
        "premium skin texture, photorealistic luxury streetwear casting.",
        "Per-candidate biology comes from discovery blueprints / L3 only.",
        "Four different real humans — never four AI clones.",
      ].join("\n");
  }
}

export function premiumFashionPresenceBlock(): string {
  return [
    "PRIMARY BRAND FACE — CLEANER YOUNGER SOFT-MASCULINE STREETWEAR CASTING (not rugged / not luxury house)",
    "Cast a naturally handsome Mediterranean male with apparent age ~22–25 customers believe could represent Milaene.",
    "Clean modern e-commerce streetwear model energy — youthful, soft masculine, approachable, commercially attractive.",
    "Soft-masculine youthful proportions within THIS slot’s face-geometry family — reduced facial width · natural medium jaw · softer lower face · youthful cheeks.",
    "Relaxed open eyes · balanced brows · natural lips · approachable neutral expression · quiet youthful confidence.",
    "Cleaner contemporary textured dark hair — SILHOUETTE follows THIS slot (A short crop/taper · B very short/tight fade ·",
    "C medium relaxed waves · D short messy curls / soft taper) — never board-wide identical waves.",
    "Clean shave OR very light natural stubble — never beard-heavy casting.",
    "Naturally handsome rather than striking — premium everyday attractiveness, not editorial beauty.",
    "Soft masculine without hyper-masculinity, ruggedness, or alpha-male edge.",
    "Lean athletic body — not muscular. Looks excellent in oversized tees, premium hoodies, zip hoodies.",
    "Target balance: ~70% approachable commercial streetwear · ~20% premium polish · ~10% masculine edge.",
    "Reduce model perfection ~10% while preserving premium quality and authentic Mediterranean identity.",
    "Agency-castable, commercially memorable, biologically distinct from other board slots.",
    "Emotional target: “He looks good in that outfit.” / “I want to dress like him.” / “He naturally belongs in Milaene.”",
    "NOT “That man has an extremely masculine/model face.” NOT luxury runway. NOT rugged Mediterranean hero.",
    "Attractive in a lived-in commercial way — realistic, imperfect, not an idealized AI beauty clone.",
    "Skin must look photographed — not porcelain, not waxy, not plastic beauty-filter skin.",
    "",
    "Do NOT cast: hyper masculine faces, square oversized jaws, extremely sharp jawlines, bodybuilder face,",
    "aggressive hunter eyes, heavy beard / dense beard shadow / full beard, perfume advertisement look,",
    "movie hero, luxury runway casting, luxury-fashion hero posing, Dolce & Gabbana campaign energy,",
    "dramatic cheekbones, brow heaviness, superhero facial structure, dramatic facial shadows,",
    "perfect symmetry, influencer / Instagram model aesthetics, intimidating expressions,",
    "looking older than 26 / visually 27+ / mature 30+ appearance, artificial beauty,",
    "same wavy medium hair across slots, sibling appearance, four Mediterranean male-model clones,",
    "dominant / seductive / rugged / heroic / alpha-male casting.",
    "Do NOT beautify. Do NOT airbrush. Do NOT symmetrize. Do NOT add cinematic glow.",
    "Do NOT copy any prior Candidate D face — quality bar only, never identity match.",
    "Keep clear male identity — never feminine-coded face on a male hero role.",
    "",
    `Wardrobe vibe inspired by (never copy identity): ${PREMIUM_CASTING_QUALITY_REFERENCE.join(", ")}.`,
    "Simple premium basics · neutral colors · oversized · no luxury logos · no flashy accessories.",
    "International commercial premium streetwear casting — photorealistic, campaign-ready later —",
    "not passport, not LinkedIn, not Midjourney fashion, not Instagram model aesthetic.",
  ].join("\n");
}

/**
 * Photographic realism director — shared quality bar for all slots.
 * Slot-specific lens/light/crop lives in slotCastingCameraBlock / per-lane cameraRules.
 */
export function premiumPhotographyBlock(): string {
  return [
    "PREMIUM CASTING PHOTOGRAPHY — Official Brand Face A1",
    "Soft natural daylight commercial streetwear energy — soft even shadows, real skin.",
    "Shoot like a real European streetwear casting photographer — not an AI image generator.",
    "Simple real casting environment: neutral plaster or concrete wall only.",
    "Natural daylight preferred; simple soft studio fill only if needed — never perfume-campaign lighting.",
    "Reduce dramatic facial shadows — soft commercial falloff only, never Rembrandt drama or perfume-ad contrast.",
    "No cinematic color grading. No editorial fashion-week styling. No orange/teal grade.",
    "Real high-end digital camera capture with authentic lens rendering and natural photographic depth.",
    "Avoid extreme bokeh, heavy haze, excessive cinematic glow.",
    "Real unretouched human skin: visible natural pores, subtle texture, pigmentation variation,",
    "small imperfections welcome — youthful healthy texture, never beauty-filter wipe.",
    "Reduce model perfection ~10% — preserve natural skin texture and authentic Mediterranean identity.",
    "Slight facial asymmetry and slight eye asymmetry required — never perfect mirror symmetry.",
    "Realistic under-eye texture. Natural medium lips. Realistic ears. Imperfect natural hair strands.",
    "Hair feels natural contemporary streetwear — never perfectly styled editorial hair.",
    "Subtle beard density variation when facial hair is present — never stamped CGI beard.",
    "Believable fabric texture and soft oversized garment drape — clothing supports evaluation.",
    "Natural shadows with soft even falloff. Slight real-camera micro-imperfections welcome.",
    "Natural neutral color grading — no orange skin, no teal grade, no oversaturation, no overexposure.",
    "Premium commercial casting clarity — controlled casting set, NOT a finished advertising campaign.",
    "NOT passport lighting. NOT harsh ID photo flash. NOT over-sharpened AI polish.",
    "NOT plastic skin, NOT wax skin, NOT airbrushed, NOT beauty filters, NOT CGI, NOT 3D render.",
    "NOT Midjourney fashion. NOT Instagram AI model. NOT Instagram model aesthetic.",
    "NOT oversized jaw. NOT aggressive hunter eyes. NOT hyper-masculine. NOT bodybuilder.",
    "NOT luxury runway casting. NOT perfume advertisement. NOT Dolce & Gabbana campaign drama.",
    "NOT movie hero. NOT cinematic hero look. NOT high-fashion editorial intensity.",
  ].join("\n");
}

/** Candidate-specific A1 photography set — studio variation without campaign scenes. */
export function a1CastingPhotographyBlock(
  blueprint: ArchetypeCandidateBlueprint,
): string {
  return [
    "A1 PREMIUM CASTING SET (candidate-specific)",
    `Background: ${blueprint.backgroundDirection}.`,
    `Lighting: ${blueprint.lightingDirection}.`,
    "Still controlled casting photography — premium agency test shoot energy, not a finished campaign ad.",
    "Do NOT generate full campaign locations, streets, cafés, parking garages, shops, or product sets.",
  ].join("\n");
}

/**
 * Per-slot camera / lighting / crop director.
 * Each board slot must feel shot on a different setup — never four identical editorial frames.
 * Pass archetypeSlug so Urban uses per-run hair lanes instead of Mediterranean wave locks.
 */
export function slotCastingCameraBlock(
  slot: DiscoverySlot,
  archetypeSlug?: string | null,
  options?: {
    urbanHairLabel?: string | null;
    urbanFaceMood?: string | null;
  },
): string {
  const urban = archetypeSlug === "urban-community-hero";
  const hairFallback = urban
    ? URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES
    : CASTING_DIVERSITY_HAIR_SILHOUETTES;
  const faceFallback = urban
    ? URBAN_CASTING_DIVERSITY_FACE_GEOMETRY
    : CASTING_DIVERSITY_FACE_GEOMETRY;
  const phaseLock = urban ? "PHASE 2.5B.5 URBAN SLOT" : "PHASE 2.2L SLOT";
  const hair = {
    A: urban && options?.urbanHairLabel ? options.urbanHairLabel : hairFallback.A,
    B: urban && options?.urbanHairLabel ? options.urbanHairLabel : hairFallback.B,
    C: urban && options?.urbanHairLabel ? options.urbanHairLabel : hairFallback.C,
    D: urban && options?.urbanHairLabel ? options.urbanHairLabel : hairFallback.D,
  };
  const face = {
    A: urban
      ? options?.urbanFaceMood ?? "natural commercial face impression"
      : faceFallback.A,
    B: urban
      ? options?.urbanFaceMood ?? "natural commercial face impression"
      : faceFallback.B,
    C: urban
      ? options?.urbanFaceMood ?? "natural commercial face impression"
      : faceFallback.C,
    D: urban
      ? options?.urbanFaceMood ?? "natural commercial face impression"
      : faceFallback.D,
  };

  switch (slot) {
    case "A":
      return [
        "CAMERA DIRECTION — SLOT A (independent setup)",
        "Lens: ~85mm portrait prime feel, intimate quiet casting distance.",
        "Camera height: slightly above eye level — soft refined casting angle.",
        "Distance: closer beauty-to-chest casting crop; mid-chest upward. Face clearly visible.",
        "Depth of field: natural portrait falloff — avoid extreme bokeh.",
        "Head angle: gentle 8–12° turn toward camera-left with soft tilt.",
        "Lighting: large soft window daylight from camera-left, gentle fill — simple casting light.",
        "Background: warm grey mineral plaster — soft, even, low-contrast casting wall.",
        "Micro-expression: friendly quiet confidence — warmer almost-smile, soft relaxed eyes with effortless smile potential.",
        `${phaseLock} A CASTING LOCK:`,
        `Hair: ${hair.A}`,
        urban
          ? `Mood: approachable lifestyle — ${face.A}`
          : `Face geometry: ${face.A}`,
        "Do NOT reuse Slot B/C/D lens, height, lighting side, or crop.",
      ].join("\n");
    case "B":
      return [
        "CAMERA DIRECTION — SLOT B (independent setup)",
        "Lens: ~50mm documentary-fashion feel, slightly more environmental presence.",
        "Camera height: eye-level to slightly below — natural streetwear stance.",
        "Distance: slightly wider upper-torso crop — more shoulder/garment mass visible. Face clearly visible.",
        "Depth of field: natural documentary falloff — avoid extreme bokeh or cinematic haze.",
        "Head angle: firmer 15–20° body rotation, chin level, direct hold.",
        "Lighting: clearer directional key from camera-right with soft commercial cheek dimension — still simple studio/daylight, never dramatic facial shadows.",
        "Background: cooler charcoal / stone casting wall — denser tonal weight.",
        "Micro-expression: warmer urban calm — relaxed eyes, soft mouth with effortless smile potential, no toughness.",
        `${phaseLock} B CASTING LOCK:`,
        `Hair: ${hair.B}`,
        urban
          ? `Mood: clean street — ${face.B}`
          : `Face geometry: ${face.B}`,
        "Do NOT reuse Slot A/C/D lens, height, lighting side, or crop.",
      ].join("\n");
    case "C":
      return [
        "CAMERA DIRECTION — SLOT C (independent setup)",
        "Lens: ~70mm commercial portrait feel with airy creative negative space.",
        "Camera height: slightly below eye level — longer creative neck read.",
        "Distance: mid-torso framing with more headroom and open composition. Face clearly visible.",
        "Depth of field: gentle commercial falloff — avoid extreme bokeh.",
        "Head angle: soft three-quarter turn toward camera-right, thoughtful tilt.",
        "Lighting: soft high-window wrap with lighter open shadows — simple casting light, no dramatic facial shadows.",
        "Background: pale off-white / soft mineral plaster — airy casting wall.",
        "Micro-expression: creative commercial calm — relaxed warm eyes, composed mouth with effortless smile potential.",
        `${phaseLock} C CASTING LOCK:`,
        `Hair: ${hair.C}`,
        urban
          ? `Mood: creative fashion — ${face.C}`
          : `Face geometry: ${face.C}`,
        urban
          ? "Creative fashion mood — hair follows this run’s lane (short, twists, braids, locs, or afro all allowed)."
          : "This is the ONLY slot that strongly prefers medium-length relaxed waves.",
        "Do NOT reuse Slot A/B/D lens, height, lighting side, or crop.",
      ].join("\n");
    case "D":
      return [
        "CAMERA DIRECTION — SLOT D (independent setup)",
        "Lens: ~58–65mm commercial streetwear casting feel — balanced premium presence.",
        "Camera height: true eye-level — steady casting hold.",
        "Distance: classic agency test distance, chest-up with balanced crop. Face clearly visible.",
        "Depth of field: natural portrait falloff — avoid extreme bokeh and cinematic glow.",
        "Head angle: subtle 5–10° turn, soft frontal presence, minimal tilt.",
        "Lighting: warm soft even key with gentle cheek dimension — natural daylight/studio, no Rembrandt drama, no teal/orange grade.",
        "Background: warm stone-grey concrete — casting-neutral wall.",
        "Micro-expression: warmer approachable confidence — relaxed eyes, quiet trustworthiness, effortless smile potential without a grin.",
        `${phaseLock} D CASTING LOCK:`,
        `Hair: ${hair.D}`,
        urban
          ? `Mood: confident campaign — ${face.D}`
          : `Face geometry: ${face.D}`,
        urban
          ? "Confident campaign mood — fresh face for this run, not a copy of prior Urban discoveries."
          : "QUALITY BAR exemplar for youth / approachability / soft masculinity — NEVER the anatomy template for A/B/C.",
        "Do NOT reuse Slot A/B/C lens, height, lighting side, or crop.",
      ].join("\n");
  }
}

/** Required A1 framing — replaces passport / headshot composition. */
export function a1CastingCompositionBlock(): string {
  return [
    "CAMERA — Official Brand Face A1 Premium Casting Composition",
    "Portrait orientation or fashion-card crop.",
    "Upper torso visible — frame from approximately mid-torso or chest upward.",
    "Shoulders FULLY visible. Enough garment visible to evaluate streetwear suitability.",
    "Slight body rotation — subtle weight shift (exact angle comes from slot camera direction).",
    "Face directed naturally toward camera; head may be slightly tilted or turned. Face clearly visible.",
    "Relaxed hands may remain outside frame.",
    "Natural negative space around the model.",
    "Realistic fashion-photography lenses only (~50 / 58–65 / 70 / 85mm) — no extreme bokeh, no cinematic ad lighting.",
    "NO perfectly centered passport symmetry.",
    "NO head-only crop. NO cropped shoulders. NO ID-card / LinkedIn / employee headshot framing.",
    "This is a premium agency casting test — controlled casting set, not a finished advertising campaign.",
    "Each slot must look like a different photographer's setup — never identical lighting/crop across the board.",
  ].join("\n");
}

export function a1PresenceRulesBlock(options?: { compact?: boolean }): string {
  if (options?.compact) {
    return [
      "CASTING PRESENCE — CALM FRIENDLY QUIET CONFIDENCE — YOUTHFUL — NOT AGGRESSION",
      "Approachable confident natural, quiet youthful confidence — never aggressive.",
      "Target: looks good in the outfit — customers want to wear what he is wearing.",
      "Never hyper-masculine, perfume-campaign, runway-extreme, or forced smile.",
      "Micro-expression follows THIS slot's identity — not a shared board expression.",
    ].join("\n");
  }
  return [
    "CASTING PRESENCE — CALM FRIENDLY QUIET CONFIDENCE — YOUTHFUL — NOT AGGRESSION",
    "Emotional range: apparent age ~22–25, quiet confidence, calm friendly warmth,",
    "approachable, youthful, effortless, trustworthy, modern, authentic,",
    "commercial premium streetwear presence without arrogance, runway severity, or movie-hero intensity.",
    "Target: “He looks good in that outfit.” / “I want to dress like him.” / “He naturally belongs in Milaene.”",
    "Never: extremely masculine/model face · rugged · overbearing · intimidating · seductive · heroic · alpha-male.",
    "Approachable neutral expression with quiet youthful confidence — never forced smile, never aggressive.",
    "Soft masculine without hyper-masculinity. Keep clear male identity — never feminine-coded.",
    "Natural masculine presence that never looks intimidating — never aggressive.",
    "Micro-expression must follow THIS slot's identity + camera direction — not a shared board smile,",
    "and never four copies of one prior Candidate D expression.",
    "Avoid: angry eyebrows, aggressive stare, hard confrontation, gangster energy,",
    "military posture, CEO authority, luxury realtor, blank lifeless expression,",
    "forced smile, frightened expression, tired eyes, sad expression,",
    "exaggerated pout, runway severity, fashion-week stare, influencer duck-face,",
    "beauty-campaign glamour, cinematic / movie hero intensity, hyper-masculine toughness,",
    "luxury-fashion hero posing, high-fashion editorial intensity, older-looking hardness,",
    "perfume-campaign coolness, rugged Mediterranean hero energy, beard-heavy masculinity.",
  ].join("\n");
}

/** Photographic realism rules injected into OBF appearance block. */
export function photographicRealismBlock(options?: { compact?: boolean }): string {
  if (options?.compact) {
    return [
      "PHOTOGRAPHIC REALISM — DO NOT BEAUTIFY",
      "Require real unretouched human skin with visible natural pores and subtle texture.",
      "Require slight facial asymmetry and slight eye asymmetry — never perfect mirror symmetry.",
      "Require realistic under-eye texture, natural lips, individual imperfect hair strands,",
      "and believable fabric texture with soft garment wrinkles.",
      "Soft natural daylight. Correct exposure. No plastic AI skin, beauty filter, or orange cast.",
      "Skin must look photographed — not porcelain, not waxy, not an idealized AI beauty clone.",
      "Agency casting clarity — NOT a finished advertising campaign.",
    ].join("\n");
  }
  return [
    "PHOTOGRAPHIC REALISM — DO NOT BEAUTIFY",
    "Require real unretouched human skin with visible natural pores and subtle texture.",
    "Require subtle pigmentation variation across cheeks/forehead — not flat digital skin.",
    "Require slight facial asymmetry and slight eye asymmetry — never perfect mirror symmetry.",
    "Require realistic under-eye texture, natural lips, realistic ears, realistic hairline,",
    "individual imperfect hair strands, and subtle beard density variation when facial hair is present.",
    "Allow occasional subtle mole/freckles when L3 micro-marks specify them.",
    "Require believable fabric texture and soft garment wrinkles.",
    "Require real eye reflections that look photographed — not glassy CGI eyes.",
    "Skin must look photographed, not generated — no wax, no plastic, no airbrush, no beauty filter.",
    "No perfect jawlines, no hyper-polished fashion avatar, no excessive cinematic glow.",
    "Reduce model perfection ~10% — preserve natural skin texture and imperfections.",
    "Slight real-camera imperfections are desirable. Perfect AI symmetry is forbidden.",
  ].join("\n");
}

/** Compact photography director for OBF discovery (avoids duplicating realism essays). */
export function compactObfPhotographyBlock(): string {
  return [
    "CASTING PHOTOGRAPHY — soft natural daylight, soft even shadows, real camera (~50mm–85mm feel).",
    "Neutral plaster/concrete casting wall only. Soft commercial falloff — never Rembrandt drama or perfume-ad contrast.",
    "No cinematic color grading. Real pores and fabric texture — never plastic AI skin or beauty-filter wipe.",
    "Premium European streetwear casting test / fashion agency photography energy — controlled casting set.",
  ].join("\n");
}

export function premiumNegativePromptAdditions(): string {
  return [
    // Identity diversity
    "cloned faces",
    "repetitive facial anatomy",
    "same jawline across candidates",
    "same eye shape across candidates",
    "same skull proportions across candidates",
    "same nose template across candidates",
    "same lighting across candidates",
    "same styling across candidates",
    "identical editorial crop across candidates",
    "four brothers",
    "generic AI handsome male",
    "similar relatives",
    "brothers",
    "cousins",
    "twins",
    "family resemblance across candidates",
    "sibling appearance across candidates",
    "same wavy medium-length hair across candidates",
    "same middle-part hairstyle across candidates",
    "same haircut silhouette across candidates",
    "same jaw shape across candidates",
    "same eyebrow shape across candidates",
    "same eye shape across candidates",
    "same beard pattern across candidates",
    "four Mediterranean male-model variants",
    "duplicate person",
    "same identity",
    "duplicate identity",
    // AI / CGI / beauty look
    "AI generated",
    "AI face",
    "generic AI face",
    "Instagram AI model",
    "Instagram AI look",
    "Midjourney fashion",
    "Midjourney aesthetic",
    "CGI",
    "3D",
    "3d render",
    "render",
    "digital art",
    "digital-art appearance",
    "perfect face",
    "perfectly symmetrical face",
    "symmetrical face",
    "perfect symmetry",
    "perfect jawlines",
    "perfect jawline",
    "plastic skin",
    "wax skin",
    "waxy skin",
    "beauty filter",
    "beauty filters",
    "airbrushed",
    "airbrushed skin",
    "glassy eyes",
    "artificial eyes",
    "overly perfect hair",
    "hyper-polished fashion avatar",
    "excessive cinematic glow",
    "cinematic glow",
    "extreme bokeh",
    "orange teal grading",
    "orange and teal grade",
    "teal orange grade",
    "oversaturated",
    "anime",
    "fashion illustration",
    "cartoon",
    "unreal beauty",
    "porcelain skin",
    "over-smoothed",
    "beauty-filter skin",
    "finished advertising campaign look",
    // Passport / stock
    "passport photo",
    "ID-card portrait",
    "ID photo",
    "identity photo",
    "employee headshot",
    "employee photo",
    "LinkedIn profile photo",
    "LinkedIn portrait",
    "corporate portrait",
    "corporate headshot",
    "office portrait",
    "casting-database mugshot",
    "police mugshot",
    "mugshot",
    "driver license photo",
    "flat centered framing",
    "stiff squared shoulders",
    "lifeless expression",
    "ordinary random person",
    "bland stock-model face",
    "repeated facial template",
    "cloned face",
    "identical eye spacing across candidates",
    "identical jawline across candidates",
    "identical nose across candidates",
    "orange skin",
    "oversharpened skin",
    "over-sharpened",
    "fake beard texture",
    "artificial hairline",
    "overstyled hair",
    "runway severity",
    "fashion-week styling",
    "fashion week runway model",
    "high-fashion costume",
    "luxury perfume campaign",
    "perfume campaign face",
    "Dolce and Gabbana campaign look",
    "dramatic facial shadows",
    "Rembrandt face lighting drama",
    "high-fashion editorial intensity",
    "editorial beauty casting",
    "superhero facial structure",
    "unreal fashion model",
    "hyper masculine face",
    "hyper-masculine",
    "bodybuilder appearance",
    "bodybuilder face",
    "overly sharp jawline",
    "overly sharp jawlines",
    "pronounced square jaw",
    "square oversized jaw",
    "extremely sharp jawline",
    "oversized facial width",
    "heavy beard styling",
    "full designer beard",
    "dense beard shadow",
    "sharply lined beard",
    "heavy moustache",
    "rugged Mediterranean hero",
    "rugged male model",
    "alpha-male casting",
    "dominant masculine stare",
    "seductive perfume stare",
    "visually 27+",
    "mature masculine hardness",
    "brow heaviness",
    "wide jaw casting",
    "luxury-fashion hero posing",
    "cinematic hero lighting",
    "mature 30+ appearance",
    "artificial beauty",
    "copy of prior Candidate D face",
    "four versions of one Candidate D",
    "face matching to previous board Candidate D",
    "reference embedding from Candidate D",
    "movie hero appearance",
    "movie hero look",
    "perfect male model symmetry",
    "fashion influencer aesthetics",
    "fashion influencer look",
    "Instagram model aesthetics",
    "older looking man",
    "older looking men",
    "looking older than 27",
    "CEO portrait",
    "business headshot",
    "luxury realtor",
    "intimidating expression",
    "intimidating eyes",
    "aggressive stare",
    "gangster styling",
    "military stance",
    "forced smile",
    "wide commercial grin",
    "random logo",
    "third-party branding",
    "jewelry focus",
    "invented product",
    "wrong gender",
    "female subject in male archetype",
    "cropped shoulders",
    "head-only crop",
    "distorted ears",
    "asymmetric eyes caused by generation error",
    "malformed neck",
    "unrealistic body proportions",
    "selfie",
    "tourist photo",
    "snapshot",
    "child face",
    "teenager",
    "teen",
    "underage",
    "elderly",
    "over smiling",
    "grinning stock photo",
    "cheesy smile",
    "celebrity resemblance",
    "lookalike",
    "famous person",
    "supermodel",
    "professional supermodel",
    "fashion copy",
    "influencer selfie",
    "ring light influencer",
    "webcam",
    "dating app photo",
  ].join(", ");
}

/** Appended on internal technical-regeneration attempts only (corrupt image). */
export function buildPremiumRetryPromptSuffix(attempt: number): string {
  return [
    "",
    `PREMIUM STREETWEAR CASTING QUALITY RETRY (${attempt})`,
    "Elevate immediately to a real unretouched human commercial streetwear casting photograph.",
    "Apparent age ~22–25 (avoid 27+). Soft-masculine youthful proportions within THIS slot’s geometry family.",
    "Natural medium jaw · softer lower face · youthful cheeks · relaxed open eyes · balanced brows.",
    "Clean shave OR very light natural stubble. Hair silhouette MUST follow THIS slot’s casting lock — never board-wide identical waves.",
    "Calm friendly quiet confidence — soft masculine, never rugged / beard-heavy / alpha-male.",
    "Target: “He looks good in that outfit.” / “I want to dress like him.” — not extremely masculine/model face.",
    "Balance: ~70% approachable commercial · ~20% premium polish · ~10% masculine edge.",
    "Visible pores, natural asymmetry, slight individuality — reduce model perfection ~10%.",
    "Soft even shadows — no dramatic facial shadows, no cinematic hero lighting.",
    "NOT runway, perfume ad, rugged hero, hyper-masculine, square oversized jaw, hunter eyes,",
    "full beard, dense beard shadow, bodybuilder, Instagram model, movie hero, or mature 27+ look.",
    "Do NOT copy any prior Candidate D face — quality bar only; keep THIS slot’s unique biology and haircut.",
    "Keep clear male identity — never feminine-coded.",
    "Natural daylight + soft even shadows + real skin — NOT a finished advertising campaign.",
    "NOT passport, NOT LinkedIn, NOT Midjourney fashion, NOT plastic AI skin.",
  ].join("\n");
}

/** Tokens that must appear in premium discovery prompts for official archetypes. */
export const PREMIUM_PROMPT_REQUIRED_TOKENS = [
  "PREMIUM CASTING",
  "campaign-ready",
  "editorial",
  "photorealistic",
  "STRICT CASTING ROLE",
] as const;

/**
 * Cues that indicate sub-premium casting direction in the POSITIVE prompt.
 * Used for honesty flags only — Phase 1.9 does NOT paid-regenerate on these.
 */
export const SUBPREMIUM_CASTING_CUES = [
  "passport photo composition",
  "linkedin headshot framing",
  "corporate headshot framing",
  "office portrait framing",
  "selfie framing",
  "tourist snapshot",
  "generic ai face subject",
  "stock photo smile subject",
  "id photo framing",
  "mugshot framing",
] as const;
