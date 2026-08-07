/**
 * Phase 2.2B / 2.2C — Premium Discovery Director (creative direction only).
 *
 * Phase 2.2C goal: remove AI fashion-model look from A1 discovery faces.
 * Prefer real unretouched human casting photography over polished campaign avatars.
 *
 * Quality inspiration: Zara / COS / Massimo Dutti / Mango Man / Fear of God /
 * Aime Leon Dore / Brunello Cucinelli / Jacquemus / Officine Générale.
 * Never copy identities, real people, or existing models.
 */

import type { ArchetypeCandidateBlueprint, BrandArchetype } from "@/lib/brand-archetypes";
import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";

/** Quality reference brands — casting bar only, never identity copy. */
export const PREMIUM_CASTING_QUALITY_REFERENCE = [
  "Zara campaign",
  "COS",
  "Massimo Dutti",
  "Mango Man",
  "Fear of God",
  "Aime Leon Dore",
  "Brunello Cucinelli",
  "Jacquemus",
  "Officine Générale",
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
 */
export function realHumanPhotographPriorityBlock(): string {
  return [
    "REAL HUMAN PHOTOGRAPH — A1 DISCOVERY PRIORITY",
    "Output must read as a real unretouched human fashion casting photograph,",
    "shot on a real camera by a real photographer — not an AI fashion model, not a CGI avatar,",
    "not Midjourney fashion, not an Instagram AI face, not a hyper-polished campaign still.",
    "Attractive and premium, but believable as a living person with natural skin and asymmetry.",
    "Identity and human realism matter more than fashion styling or cinematic polish.",
    "This is premium agency casting photography — NOT a finished advertising campaign image.",
  ].join("\n");
}

/**
 * Mediterranean quality bar — NO shared biology recipe.
 * Slot-specific face/hair/skin live only in discovery blueprints / L3.
 */
function mediterraneanPremiumBlock(): string {
  return [
    "PREMIUM CASTING — Mediterranean Premium Hero (quality bar only)",
    "You are a casting director reviewing four completely different real adult male models",
    "on a simple agency casting board for Milaene premium streetwear / quiet luxury.",
    "Biology and fashion presence come ONLY from each candidate's Discovery Identity Instance — do not homogenize faces.",
    "Each candidate must own permanent unique facial anatomy — different face width/length, jaw, chin, cheekbones,",
    "eyes and eye spacing, nose shape/width, eyebrows, lips, forehead, ears, hairline, hair texture,",
    "facial hair, exact age feel, and expression.",
    "Sample four different Mediterranean regional appearance clusters — never four men from the same cluster.",
    "No brothers. No cousins. No twins. No recolored clones. No repetitive Mediterranean template.",
    "No generic handsome AI man. No Instagram AI model. No Midjourney fashion face. No hyper-polished fashion avatar.",
    "",
    "Quality bar: real agency casting tests inspired by Zara / COS / Massimo Dutti / Mango Man /",
    "Fear of God / Aime Leon Dore / Brunello Cucinelli / Jacquemus / Officine Générale —",
    "photogenic, commercially memorable, instantly recognizable as distinct humans,",
    "photorealistic and campaign-ready as Brand Faces later — but THIS A1 frame is casting, not finished ads.",
    "NOT ordinary men. NOT passport / ID / LinkedIn / casting-database headshots.",
    "NOT unreal beauty. NOT perfect symmetry. NOT beauty-filter skin. NOT plastic or wax skin.",
    "",
    "Photography: simple real European casting studio — plaster/concrete wall, natural daylight or soft studio,",
    "real camera, restrained styling, minimal retouching, face clearly visible, believable fabric texture.",
  ].join("\n");
}

function urbanCommunityBlock(): string {
  return [
    "PREMIUM CASTING — Urban Community Hero (quality bar only)",
    "Cast DISTINCT adult male premium Black / Afro-European community streetwear models.",
    "Biology and fashion presence come ONLY from each candidate's discovery blueprint / L3.",
    "",
    "Expression: relaxed confidence, fashion energy, community leader presence.",
    "No exaggerated smiling. No influencer selfie energy. No gangster stereotype.",
    "",
    "Photography: real agency casting test — soft natural or simple studio light, photorealistic,",
    "campaign-ready potential later; THIS frame is casting, not a finished ad.",
    "Natural pores, micro skin texture, real eye reflections — never plastic AI skin.",
    "NOT passport photo. NOT corporate headshot. NOT tourist snapshot.",
  ].join("\n");
}

function femaleLifestyleBlock(): string {
  return [
    "PREMIUM CASTING — Female Lifestyle Hero (quality bar only)",
    "Cast DISTINCT adult female premium lifestyle models for luxury casual campaigns.",
    "Biology and fashion presence come ONLY from each candidate's discovery blueprint / L3.",
    "",
    "Natural beauty. No heavy makeup. Healthy realistic skin with visible texture.",
    "Expression: authentic warmth when appropriate — never forced stock smile.",
    "Zara / COS / Jacquemus casting quality. Photorealistic, campaign-ready potential — casting frame first.",
    "",
    "NOT passport photo. NOT beauty-pageant glam. NOT plastic AI face. NOT Instagram filter.",
  ].join("\n");
}

export function premiumArchetypeCastingBlock(
  archetype: BrandArchetype,
): string {
  switch (archetype.slug) {
    case "mediterranean-premium-hero":
      return mediterraneanPremiumBlock();
    case "urban-community-hero":
      return urbanCommunityBlock();
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
    "FASHION MODEL QUALITY BAR — REAL HUMAN CASTING",
    "The subject must appear as a real professional model a casting director would book —",
    "agency-castable, photogenic, commercially memorable, and biologically distinct from other board slots.",
    "Believable as a recurring brand ambassador for premium streetwear / quiet luxury.",
    "Capable of carrying both product and lifestyle imagery later.",
    "Visually distinctive without looking artificial.",
    "Attractive in a modern fashion-commercial way — realistic, lived-in, not an idealized AI beauty clone.",
    "Suitable for repeated image and video use.",
    "",
    "Prioritize: facial character, recognizability, strong camera presence, proportion,",
    "natural asymmetry, authentic unretouched skin, garment compatibility, long-term brand-face potential.",
    "Do NOT request conventional perfect beauty only.",
    "Do NOT beautify. Do NOT airbrush. Do NOT symmetrize. Do NOT add cinematic glow.",
    "",
    `Quality bar inspired by (never copy): ${PREMIUM_CASTING_QUALITY_REFERENCE.join(", ")}.`,
    "International premium editorial casting — photorealistic, campaign-ready later — not passport, not LinkedIn, not Midjourney fashion, not Instagram AI.",
  ].join("\n");
}

/**
 * Photographic realism director — shared quality bar for all slots.
 * Slot-specific lens/light/crop lives in slotCastingCameraBlock / per-lane cameraRules.
 */
export function premiumPhotographyBlock(): string {
  return [
    "PREMIUM CASTING PHOTOGRAPHY — Official Brand Face A1",
    "Shoot like a real European fashion casting photographer — not an AI image generator.",
    "Simple real casting environment: neutral plaster or concrete wall only.",
    "Natural daylight or simple soft studio light — restrained, not cinematic.",
    "Real high-end digital camera capture with authentic lens rendering and natural photographic depth.",
    "Avoid extreme bokeh, heavy haze, excessive cinematic glow, and orange/teal color grading.",
    "Real unretouched human skin: visible natural pores, subtle texture, pigmentation variation.",
    "Slight facial asymmetry and slight eye asymmetry required — never perfect mirror symmetry.",
    "Realistic under-eye texture. Natural lips. Realistic ears. Realistic hairline with individual imperfect strands.",
    "Subtle beard density variation when facial hair is present — never stamped CGI beard.",
    "Occasional subtle mole or freckles when L3 micro-marks allow — never beauty-filter wipe.",
    "Believable fabric texture and soft garment wrinkles — clothing supports evaluation, does not dominate.",
    "Natural shadows with soft falloff. Slight real-camera micro-imperfections welcome.",
    "Natural neutral color grading — no orange skin, no teal grade, no oversaturation, no overexposure.",
    "Premium casting clarity — controlled casting set, NOT a finished advertising campaign.",
    "NOT passport lighting. NOT harsh ID photo flash. NOT over-sharpened AI polish.",
    "NOT plastic skin, NOT wax skin, NOT airbrushed, NOT beauty filters, NOT CGI, NOT 3D render, NOT digital art.",
    "NOT Midjourney fashion. NOT Instagram AI model. NOT hyper-polished fashion avatar. NOT perfect jawlines.",
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
 */
export function slotCastingCameraBlock(slot: DiscoverySlot): string {
  switch (slot) {
    case "A":
      return [
        "CAMERA DIRECTION — SLOT A (independent setup)",
        "Lens: ~85mm portrait prime feel, intimate quiet-luxury casting distance.",
        "Camera height: slightly above eye level — soft refined casting angle.",
        "Distance: closer beauty-to-chest casting crop; mid-chest upward. Face clearly visible.",
        "Depth of field: natural portrait falloff — avoid extreme bokeh.",
        "Head angle: gentle 8–12° turn toward camera-left with soft tilt.",
        "Lighting: large soft window daylight from camera-left, gentle fill — simple casting light.",
        "Background: warm grey mineral plaster — soft, even, low-contrast casting wall.",
        "Micro-expression: friendly quiet luxury — calm almost-smile, soft eyes.",
        "Do NOT reuse Slot B/C/D lens, height, lighting side, or crop.",
      ].join("\n");
    case "B":
      return [
        "CAMERA DIRECTION — SLOT B (independent setup)",
        "Lens: ~50mm documentary-fashion feel, slightly more environmental presence.",
        "Camera height: eye-level to slightly below — athletic confident stance.",
        "Distance: slightly wider upper-torso crop — more shoulder/garment mass visible. Face clearly visible.",
        "Depth of field: natural documentary falloff — avoid extreme bokeh or cinematic haze.",
        "Head angle: firmer 15–20° body rotation, chin level, direct hold.",
        "Lighting: clearer directional key from camera-right with natural cheek shadow — still simple studio/daylight.",
        "Background: cooler charcoal / stone casting wall — denser tonal weight.",
        "Micro-expression: confident urban calm — cooler gaze, relaxed mouth, no smile.",
        "Do NOT reuse Slot A/C/D lens, height, lighting side, or crop.",
      ].join("\n");
    case "C":
      return [
        "CAMERA DIRECTION — SLOT C (independent setup)",
        "Lens: ~70mm editorial portrait feel with airy creative negative space.",
        "Camera height: slightly below eye level — longer creative neck read.",
        "Distance: mid-torso framing with more headroom and open composition. Face clearly visible.",
        "Depth of field: gentle editorial falloff — avoid extreme bokeh.",
        "Head angle: soft three-quarter turn toward camera-right, thoughtful tilt.",
        "Lighting: soft high-window wrap with lighter open shadows — simple casting light.",
        "Background: pale off-white / soft mineral plaster — airy casting wall.",
        "Micro-expression: creative editorial calm — soft focused eyes, composed mouth.",
        "Do NOT reuse Slot A/B/D lens, height, lighting side, or crop.",
      ].join("\n");
    case "D":
      return [
        "CAMERA DIRECTION — SLOT D (independent setup)",
        "Lens: ~58–65mm campaign portrait feel — balanced hero casting presence.",
        "Camera height: true eye-level — steady Mediterranean casting hold.",
        "Distance: classic agency test distance, chest-up with balanced crop. Face clearly visible.",
        "Depth of field: natural portrait falloff — avoid extreme bokeh and cinematic glow.",
        "Head angle: subtle 5–10° turn, strong frontal presence, minimal tilt.",
        "Lighting: warm soft key with gentle cheek dimension — natural daylight/studio, not teal/orange grade.",
        "Background: warm stone-grey concrete — casting-neutral wall.",
        "Micro-expression: relaxed luxury confidence — warm attentive eyes, quiet authority.",
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

export function a1PresenceRulesBlock(): string {
  return [
    "CASTING PRESENCE — NOT AGGRESSION — NOT INSTAGRAM PERFORMANCE",
    "Emotional range: calm, self-assured, approachable, modern, authentic,",
    "slightly cool, quietly confident, socially believable, premium without arrogance.",
    "Micro-expression must follow THIS slot's identity + camera direction — not a shared board smile.",
    "Avoid: angry eyebrows, aggressive stare, hard confrontation, gangster energy,",
    "military posture, CEO authority, luxury realtor, blank lifeless expression,",
    "forced smile, frightened expression, tired eyes, sad expression,",
    "exaggerated pout, runway severity, influencer duck-face, beauty-campaign glamour.",
  ].join("\n");
}

/** Photographic realism rules injected into OBF appearance block. */
export function photographicRealismBlock(): string {
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
    "Slight real-camera imperfections are desirable. Perfect AI symmetry is forbidden.",
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
    "high-fashion costume",
    "CEO portrait",
    "business headshot",
    "luxury realtor",
    "intimidating expression",
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
    `PREMIUM CASTING QUALITY RETRY (${attempt})`,
    "Elevate immediately to a real unretouched human agency casting photograph.",
    "Visible pores, natural asymmetry, realistic under-eye texture, photographic depth.",
    "Distinct human identity for THIS slot only — not AI plastic skin, not Midjourney fashion.",
    "Simple casting wall + soft daylight/studio — NOT a finished advertising campaign.",
    "NOT passport, NOT LinkedIn, NOT Instagram AI model, NOT hyper-polished fashion avatar.",
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
