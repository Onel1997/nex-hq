/**
 * Phase 1.8A / 1.9 — Premium international luxury streetwear casting direction.
 *
 * Quality inspiration only (Represent, Fear of God Essentials, Cole Buxton, etc.).
 * Never copy identities, real people, or existing models.
 *
 * Phase 1.9: archetype premium blocks must NOT homogenize biology across slots.
 * Per-candidate identity lives in discovery blueprints + FashionCastingProfile.
 */

import type { ArchetypeCandidateBlueprint, BrandArchetype } from "@/lib/brand-archetypes";

/** Quality reference brands — inspiration for casting bar only, never identity copy. */
export const PREMIUM_CASTING_QUALITY_REFERENCE = [
  "Represent",
  "Fear of God Essentials",
  "Cole Buxton",
  "Axel Arigato",
  "COS",
  "Aime Leon Dore",
  "Zara Studio",
  "ARKET",
  "Entire Studios",
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
 * Mediterranean quality bar — NO shared biology recipe.
 * Slot-specific face/hair/skin live only in discovery blueprints.
 */
function mediterraneanPremiumBlock(): string {
  return [
    "PREMIUM CASTING — Mediterranean Premium Hero (quality bar only)",
    "Cast four DISTINCT adult male premium streetwear agency models for international campaigns.",
    "Biology and fashion presence come ONLY from each candidate's discovery blueprint — do not homogenize faces.",
    "Each candidate must own permanent unique facial anatomy — different face shape, jaw, forehead, brows, eyes, nose, lips, ears, hairline, and proportions.",
    "Sample four different Mediterranean regional appearance clusters — never four men from the same cluster.",
    "No brothers. No cousins. No twins. No recolored clones. No repetitive Mediterranean template. No generic handsome AI man.",
    "",
    "Quality bar: agency-signed streetwear campaign models — photogenic, commercially memorable,",
    "instantly recognizable, suitable for homepage hero, Shopify, Instagram, campaign stills, and future video.",
    "NOT ordinary men. NOT passport / ID / LinkedIn / casting-database headshots.",
    "",
    "Photography: premium European streetwear casting test — modern fashion agency photography,",
    "realistic high-end digital camera, 50mm–85mm portrait lens direction,",
    "shallow but not artificial depth of field, dimensional facial lighting, natural neutral grade.",
    "Feels comparable to modern Represent / Cole Buxton / Zara Studio casting tests — never copy faces.",
  ].join("\n");
}

function urbanCommunityBlock(): string {
  return [
    "PREMIUM CASTING — Urban Community Hero (quality bar only)",
    "Cast DISTINCT adult male premium Black / Afro-European community streetwear models.",
    "Biology and fashion presence come ONLY from each candidate's discovery blueprint.",
    "",
    "Expression: relaxed confidence, fashion energy, community leader presence.",
    "No exaggerated smiling. No influencer selfie energy. No gangster stereotype.",
    "",
    "Photography: luxury campaign editorial casting test — soft premium lighting, photorealistic,",
    "campaign-ready for TikTok, Instagram, and community hero placements.",
    "NOT passport photo. NOT corporate headshot. NOT tourist snapshot.",
  ].join("\n");
}

function femaleLifestyleBlock(): string {
  return [
    "PREMIUM CASTING — Female Lifestyle Hero (quality bar only)",
    "Cast DISTINCT adult female premium lifestyle models for luxury casual campaigns.",
    "Biology and fashion presence come ONLY from each candidate's discovery blueprint.",
    "",
    "Natural beauty. No heavy makeup. Healthy realistic skin with texture.",
    "Expression: authentic warmth when appropriate — never forced stock smile.",
    "Pinterest + Zara Studio campaign quality. Photorealistic, campaign-ready.",
    "",
    "NOT passport photo. NOT beauty-pageant glam. NOT plastic AI face.",
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
        "Agency model presence — fashion campaign readiness,",
        "premium skin texture, photorealistic luxury streetwear casting.",
        "Per-candidate biology comes from discovery blueprints only.",
      ].join("\n");
  }
}

export function premiumFashionPresenceBlock(): string {
  return [
    "FASHION MODEL QUALITY BAR",
    "The subject must appear agency-castable, photogenic, and commercially memorable.",
    "Believable as a recurring brand ambassador for premium streetwear.",
    "Capable of carrying both product and lifestyle imagery.",
    "Visually distinctive without looking artificial.",
    "Attractive in a modern fashion-commercial way — realistic, not an idealized AI beauty clone.",
    "Suitable for repeated image and video use.",
    "",
    "Prioritize: facial character, recognizability, strong camera presence, proportion,",
    "natural asymmetry, authentic skin, garment compatibility, long-term brand-face potential.",
    "Do NOT request conventional perfect beauty only.",
    "",
    `Quality bar inspired by (never copy): ${PREMIUM_CASTING_QUALITY_REFERENCE.slice(0, 5).join(", ")}.`,
    "International premium streetwear editorial — photorealistic, campaign-ready — not passport, not LinkedIn, not stock photo.",
  ].join("\n");
}

export function premiumPhotographyBlock(): string {
  return [
    "PREMIUM CASTING PHOTOGRAPHY — Official Brand Face A1",
    "Premium European streetwear casting test — modern fashion agency photography.",
    "Realistic high-end digital camera, 50mm–85mm portrait lens direction.",
    "Shallow but not artificial depth of field.",
    "Clean skin detail with realistic pores and facial hair — no beauty-retouch effect.",
    "Soft directional daylight or large diffused studio source.",
    "Dimensional facial lighting, controlled shadows, subtle contrast.",
    "Natural neutral color grading — no orange skin, no overexposure, no flat front flash.",
    "Premium editorial clarity — controlled casting set, NOT a campaign location.",
    "NOT passport lighting. NOT harsh ID photo flash. NOT over-sharpened AI polish.",
    "NOT plastic skin, NOT waxy retouch, NOT cartoon, NOT beauty-filter smoothing.",
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
    "Still controlled casting photography — premium agency test shoot energy.",
    "Do NOT generate full campaign locations, streets, cafés, parking garages, shops, or product sets.",
  ].join("\n");
}

/** Required A1 framing — replaces passport / headshot composition. */
export function a1CastingCompositionBlock(): string {
  return [
    "CAMERA — Official Brand Face A1 Premium Casting-Editorial Composition",
    "Portrait orientation or fashion-card crop.",
    "Upper torso visible — frame from approximately mid-torso or chest upward.",
    "Shoulders FULLY visible. Enough garment visible to evaluate streetwear suitability.",
    "Slight 10–20 degree body rotation — subtle weight shift.",
    "Face directed naturally toward camera; head may be slightly tilted or turned.",
    "Relaxed hands may remain outside frame.",
    "Natural negative space around the model.",
    "NO perfectly centered passport symmetry.",
    "NO head-only crop. NO cropped shoulders. NO ID-card / LinkedIn / employee headshot framing.",
    "This is a premium agency test shoot — still controlled casting, not a campaign location.",
  ].join("\n");
}

export function a1PresenceRulesBlock(): string {
  return [
    "FASHION PRESENCE — NOT AGGRESSION",
    "Emotional range: calm, self-assured, approachable, modern, authentic,",
    "slightly cool, quietly confident, socially believable, premium without arrogance.",
    "Micro-expression: relaxed mouth, soft focused eyes, subtle confidence,",
    "calm attentive gaze, almost-smile without visible teeth, naturally composed.",
    "Avoid: angry eyebrows, aggressive stare, hard confrontation, gangster energy,",
    "military posture, CEO authority, luxury realtor, blank lifeless expression,",
    "forced smile, frightened expression, tired eyes, sad expression,",
    "exaggerated pout, runway severity.",
  ].join("\n");
}

export function premiumNegativePromptAdditions(): string {
  return [
    "cloned faces",
    "repetitive facial anatomy",
    "same jawline across candidates",
    "same eye shape across candidates",
    "same skull proportions across candidates",
    "same nose template across candidates",
    "generic AI handsome male",
    "similar relatives",
    "brothers",
    "cousins",
    "twins",
    "family resemblance across candidates",
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
    "generic AI male face",
    "bland stock-model face",
    "repeated facial template",
    "cloned face",
    "identical eye spacing across candidates",
    "identical jawline across candidates",
    "identical nose across candidates",
    "perfectly symmetrical plastic face",
    "waxy skin",
    "airbrushed skin",
    "beauty-filter skin",
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
    "AI face",
    "generic AI face",
    "plastic skin",
    "cartoon",
    "anime",
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
    "duplicate identity",
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
    "Elevate to international luxury streetwear editorial campaign model immediately.",
    "Agency fashion presence, premium skin texture, upper-torso casting-editorial frame.",
    "NOT passport, NOT LinkedIn, NOT average person, NOT AI-looking face.",
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
