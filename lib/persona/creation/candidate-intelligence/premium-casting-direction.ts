/**
 * Phase 2.2B / 2.2C / 2.2H — Primary Brand Face direction (creative only).
 *
 * Mediterranean Premium Hero = primary face of a premium modern streetwear brand.
 * Customers must instantly believe he could genuinely represent the brand.
 * Attractiveness from harmony, confidence, authenticity — NOT extreme masculinity
 * or “most handsome man” casting.
 *
 * Quality inspiration (casting bar / wardrobe vibe only, never identity copy):
 * Aimé Leon Dore, Fear of God ESSENTIALS, Our Legacy, COS, ARKET, Zara Studio.
 */

import type { ArchetypeCandidateBlueprint, BrandArchetype } from "@/lib/brand-archetypes";
import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";

/** Quality reference brands — casting bar only, never identity copy. */
export const PREMIUM_CASTING_QUALITY_REFERENCE = [
  "Aimé Leon Dore",
  "Fear of God ESSENTIALS",
  "Our Legacy",
  "COS",
  "ARKET",
  "Zara Studio",
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
    "Output must read as a real unretouched commercial streetwear casting photograph,",
    "shot on a real camera by a real photographer — not an AI fashion model, not a CGI avatar,",
    "not Midjourney fashion, not an Instagram AI face, not a hyper-polished campaign still.",
    "PRIMARY BRAND FACE: premium modern streetwear brand ambassador — NOT a luxury fashion house.",
    "Naturally attractive Mediterranean male ~22–27 — effortlessly stylish, approachable, memorable.",
    "Someone you could realistically discover through premium streetwear casting in Milan, Barcelona, or Berlin.",
    "Attractiveness from harmony, quiet confidence, and authenticity — not extreme masculine features.",
    "Real premium brand ambassador energy — not fashion-week runway, not perfume campaign, not celebrity.",
    "Emotional target: viewers think “he looks cool” — trustworthy, approachable, premium, modern, effortless, timeless.",
    "NOT “the most handsome / most masculine man I’ve ever seen.”",
    "Identity and human realism matter more than beauty, glamour, or cinematic polish.",
  ].join("\n");
}

/**
 * Mediterranean quality bar — NO shared biology recipe.
 * Slot-specific face/hair/skin live only in discovery blueprints / L3.
 */
function mediterraneanPremiumBlock(): string {
  return [
    "PREMIUM CASTING — Mediterranean Premium Hero / PRIMARY BRAND FACE (quality bar only)",
    "Cast the primary face of a premium modern streetwear brand — not a luxury fashion house.",
    "Review four completely different naturally attractive Mediterranean males aged about 22–27",
    "on a simple commercial casting board for Milaene premium streetwear.",
    "Each face should look like someone you could realistically discover through premium streetwear",
    "casting in Milan, Barcelona, or Berlin — effortlessly stylish, approachable, and memorable.",
    "Biology and fashion presence come ONLY from each candidate's Discovery Identity Instance — do not homogenize faces.",
    "Each candidate must own permanent unique facial anatomy — different face width/length, jaw, chin, cheekbones,",
    "eyes and eye spacing, nose shape/width, eyebrows, lips, forehead, ears, hairline, hair texture,",
    "facial hair, exact age feel, and expression.",
    "Sample four different Mediterranean regional appearance clusters — never four men from the same cluster.",
    "Four different real people from the same brand universe — never brothers, cousins, twins, or variations of one face.",
    "",
    "PRIMARY BRAND FACE — FACIAL CHARACTER:",
    "Soft masculine facial structure. Balanced proportions. Expressive but relaxed eyes.",
    "Slightly thicker natural eyebrows. Subtle jawline. Defined but not exaggerated cheekbones.",
    "Medium lips. Youthful healthy skin with natural texture — small imperfections welcome.",
    "Slight stubble or clean shave. Friendly calm expression. Quiet confidence. Authentic charisma.",
    "Attractiveness from harmony and authenticity — never extreme masculine features.",
    "",
    "BODY: lean athletic — not muscular, not bodybuilder. Normal proportions. Healthy.",
    "Looks wearable in oversized clothing.",
    "",
    "HAIR (premium contemporary streetwear): short textured curls, natural curly crop, clean taper fade,",
    "low fade, relaxed wavy medium hair, or effortless messy curls — natural, never perfectly styled editorial hair.",
    "",
    "STYLING vibe (wardrobe references only): Fear of God ESSENTIALS, Aimé Leon Dore, Our Legacy, COS, ARKET, Zara Studio.",
    "Simple premium basics. Neutral colors. Oversized silhouettes. No luxury logos. No flashy accessories.",
    "",
    "Quality bar: premium European streetwear casting test inspired by Aimé Leon Dore,",
    "Fear of God ESSENTIALS, Our Legacy, COS, ARKET, Zara Studio — photorealistic, campaign-ready later,",
    "commercially memorable — but THIS A1 frame is casting, not finished ads.",
    "Fashion agency photography energy with natural daylight commercial campaign clarity.",
    "",
    "EMOTIONAL IMPRESSION: “He looks cool.” Trustworthy. Approachable. Premium. Modern. Effortless. Timeless.",
    "NOT: “He is the most handsome man I’ve ever seen.”",
    "",
    "AVOID: hyper masculine faces, oversized jaw, bodybuilder face, aggressive hunter eyes,",
    "perfume advertisement look, movie hero appearance, luxury runway model, overly sculpted cheekbones,",
    "perfect symmetry, influencer aesthetic, intimidating expressions, looking older than 28,",
    "beauty filters, plastic skin, CGI, Instagram model aesthetic, cinematic hero look.",
    "NOT passport / ID / LinkedIn / casting-database headshots.",
    "",
    "Photography: natural daylight commercial fashion campaign energy — soft shadows, real skin,",
    "no cinematic color grading, no perfume campaign lighting, no editorial fashion-week styling.",
    "Simple casting wall, real camera (~50mm–85mm feel), restrained streetwear basics, face clearly visible.",
  ].join("\n");
}

function urbanCommunityBlock(): string {
  return [
    "PREMIUM CASTING — Urban Community Hero (quality bar only)",
    "Cast DISTINCT adult male premium Black / Afro-European community streetwear faces (~22–28).",
    "Biology and fashion presence come ONLY from each candidate's discovery blueprint / L3.",
    "Real people from the same brand universe — never brothers or face variations of one man.",
    "",
    "Expression: effortless confidence, approachable, relaxed — editorial streetwear energy.",
    "No exaggerated smiling. No influencer selfie energy. No gangster stereotype.",
    "No hyper-masculine, runway, perfume-campaign, or cinematic-hero look.",
    "",
    "Photography: real agency casting test — soft natural or simple studio light, photorealistic,",
    "campaign-ready potential later; THIS frame is casting, not a finished ad.",
    "Natural pores, micro skin texture, real eye reflections — never plastic AI skin.",
    "Authenticity is more important than beauty.",
    "NOT passport photo. NOT corporate headshot. NOT tourist snapshot.",
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
    "PRIMARY BRAND FACE — COMMERCIAL STREETWEAR CASTING (not luxury fashion house)",
    "Cast a naturally attractive Mediterranean male ~22–27 customers instantly believe could represent the brand.",
    "Believable as someone discovered through premium streetwear casting in Milan, Barcelona, or Berlin.",
    "Soft masculine structure · balanced proportions · expressive relaxed eyes · slightly thicker natural brows.",
    "Subtle jawline · defined-not-exaggerated cheekbones · medium lips · youthful skin with natural texture.",
    "Slight stubble or clean shave · friendly calm expression · quiet confidence · authentic charisma.",
    "Lean athletic body — not muscular. Looks healthy and wearable in oversized basics.",
    "Effortlessly stylish, approachable, memorable — real brand ambassador, not fashion-week runway.",
    "Agency-castable, commercially memorable, biologically distinct from other board slots.",
    "Emotional target: “He looks cool.” Trustworthy · approachable · premium · modern · effortless · timeless.",
    "NOT the most handsome or most masculine man possible — harmony over extreme features.",
    "Attractive in a lived-in commercial way — realistic, imperfect, not an idealized AI beauty clone.",
    "Skin must look photographed — not porcelain, not waxy, not plastic beauty-filter skin.",
    "",
    "Do NOT cast: hyper masculine faces, oversized jaw, bodybuilder face, aggressive hunter eyes,",
    "perfume advertisement look, movie hero, luxury runway model, overly sculpted cheekbones,",
    "perfect symmetry, influencer aesthetic, intimidating expressions, looking older than 28.",
    "Do NOT beautify. Do NOT airbrush. Do NOT symmetrize. Do NOT add cinematic glow.",
    "",
    `Wardrobe vibe inspired by (never copy identity): ${PREMIUM_CASTING_QUALITY_REFERENCE.join(", ")}.`,
    "Simple premium basics · neutral colors · oversized · no luxury logos · no flashy accessories.",
    "International premium streetwear casting — photorealistic, campaign-ready later —",
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
    "Natural daylight commercial fashion campaign energy — soft shadows, real skin.",
    "Shoot like a real European streetwear casting photographer — not an AI image generator.",
    "Simple real casting environment: neutral plaster or concrete wall only.",
    "Natural daylight preferred; simple soft studio fill only if needed — never perfume-campaign lighting.",
    "No cinematic color grading. No editorial fashion-week styling. No orange/teal grade.",
    "Real high-end digital camera capture with authentic lens rendering and natural photographic depth.",
    "Avoid extreme bokeh, heavy haze, excessive cinematic glow.",
    "Real unretouched human skin: visible natural pores, subtle texture, pigmentation variation,",
    "small imperfections welcome — youthful healthy texture, never beauty-filter wipe.",
    "Slight facial asymmetry and slight eye asymmetry required — never perfect mirror symmetry.",
    "Realistic under-eye texture. Natural medium lips. Realistic ears. Imperfect natural hair strands.",
    "Hair feels natural contemporary streetwear — never perfectly styled editorial hair.",
    "Subtle beard density variation when facial hair is present — never stamped CGI beard.",
    "Believable fabric texture and soft oversized garment drape — clothing supports evaluation.",
    "Natural shadows with soft falloff. Slight real-camera micro-imperfections welcome.",
    "Natural neutral color grading — no orange skin, no teal grade, no oversaturation, no overexposure.",
    "Premium casting clarity — controlled casting set, NOT a finished advertising campaign.",
    "NOT passport lighting. NOT harsh ID photo flash. NOT over-sharpened AI polish.",
    "NOT plastic skin, NOT wax skin, NOT airbrushed, NOT beauty filters, NOT CGI, NOT 3D render.",
    "NOT Midjourney fashion. NOT Instagram AI model. NOT Instagram model aesthetic.",
    "NOT oversized jaw. NOT aggressive hunter eyes. NOT hyper-masculine. NOT bodybuilder.",
    "NOT luxury runway model. NOT perfume advertisement. NOT movie hero. NOT cinematic hero look.",
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
        "Micro-expression: friendly quiet confidence — calm almost-smile, soft approachable eyes.",
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
        "Lighting: clearer directional key from camera-right with natural cheek shadow — still simple studio/daylight.",
        "Background: cooler charcoal / stone casting wall — denser tonal weight.",
        "Micro-expression: effortless urban calm — cooler gaze, relaxed mouth, no smile, no toughness.",
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
        "Micro-expression: creative editorial calm — soft focused eyes, composed relaxed mouth.",
        "Do NOT reuse Slot A/B/D lens, height, lighting side, or crop.",
      ].join("\n");
    case "D":
      return [
        "CAMERA DIRECTION — SLOT D (independent setup)",
        "Lens: ~58–65mm campaign portrait feel — balanced streetwear casting presence.",
        "Camera height: true eye-level — steady Mediterranean casting hold.",
        "Distance: classic agency test distance, chest-up with balanced crop. Face clearly visible.",
        "Depth of field: natural portrait falloff — avoid extreme bokeh and cinematic glow.",
        "Head angle: subtle 5–10° turn, strong frontal presence, minimal tilt.",
        "Lighting: warm soft key with gentle cheek dimension — natural daylight/studio, not teal/orange grade.",
        "Background: warm stone-grey concrete — casting-neutral wall.",
        "Micro-expression: relaxed approachable confidence — warm attentive eyes, quiet authority without arrogance.",
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
    "CASTING PRESENCE — QUIET CONFIDENCE — EFFORTLESS CHARISMA — NOT AGGRESSION",
    "Emotional range: youthful energy, quiet confidence, effortless charisma, approachable,",
    "confident but relaxed, modern, authentic, socially believable,",
    "premium streetwear presence without arrogance, runway severity, or movie-hero intensity.",
    "Natural masculine presence that never looks intimidating — never aggressive.",
    "Micro-expression must follow THIS slot's identity + camera direction — not a shared board smile.",
    "Avoid: angry eyebrows, aggressive stare, hard confrontation, gangster energy,",
    "military posture, CEO authority, luxury realtor, blank lifeless expression,",
    "forced smile, frightened expression, tired eyes, sad expression,",
    "exaggerated pout, runway severity, fashion-week stare, influencer duck-face,",
    "beauty-campaign glamour, cinematic / movie hero intensity, hyper-masculine toughness,",
    "older-looking hardness, perfume-campaign coolness.",
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
    "fashion week runway model",
    "high-fashion costume",
    "luxury perfume campaign",
    "perfume campaign face",
    "hyper masculine face",
    "hyper-masculine",
    "bodybuilder appearance",
    "bodybuilder face",
    "overly sharp jawline",
    "overly sharp jawlines",
    "movie hero appearance",
    "movie hero look",
    "perfect male model symmetry",
    "fashion influencer aesthetics",
    "fashion influencer look",
    "older looking man",
    "older looking men",
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
    "Elevate immediately to a real unretouched human streetwear casting photograph.",
    "Age ~22–27, soft masculine harmony, quiet confidence, approachable calm expression.",
    "Visible pores, natural asymmetry, small imperfections welcome, imperfect natural hair.",
    "Distinct human identity for THIS slot only — “he looks cool,” not most-handsome casting.",
    "NOT runway, perfume ad, hyper-masculine, oversized jaw, hunter eyes, bodybuilder,",
    "Instagram model, movie hero, or cinematic grading.",
    "Natural daylight + soft shadows + real skin — NOT a finished advertising campaign.",
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
