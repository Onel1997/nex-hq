/**
 * Phase 1.8A — Premium international luxury streetwear casting direction.
 *
 * Quality inspiration only (Represent, Fear of God Essentials, Cole Buxton, etc.).
 * Never copy identities, real people, or existing models.
 *
 * Prompt / generation quality layer only — no business-logic changes.
 */

import type { BrandArchetype } from "@/lib/brand-archetypes";

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

function mediterraneanPremiumBlock(): string {
  return [
    "PREMIUM CASTING — Mediterranean Premium Hero",
    "Cast an agency-level premium Mediterranean male for international luxury streetwear campaigns.",
    "",
    "Age feel: 24–31. Height impression: 185–190 cm. Build: lean athletic.",
    "Jaw: strong. Cheekbones: defined. Nose: natural. Eyes: deep, expressive.",
    "Skin: healthy olive tone with natural texture and visible pores — premium, not plastic.",
    "Hair: dark brown or black. Haircut: premium modern fashion cut.",
    "Facial hair: none, OR very short designer stubble only — never heavy beard.",
    "",
    "Expression: calm, confident, luxury. Quiet editorial self-assurance.",
    "NOT passport photo. NOT LinkedIn. NOT office portrait. NOT average random person.",
    "",
    "Photography: editorial high-fashion casting, soft luxury lighting, premium skin texture,",
    "studio campaign quality, photorealistic, campaign-ready for homepage and luxury drops.",
    "Feels comparable to modern Represent / Cole Buxton / Zara Studio campaign portraits.",
  ].join("\n");
}

function urbanCommunityBlock(): string {
  return [
    "PREMIUM CASTING — Urban Community Hero",
    "Cast an agency-level premium Black male for luxury streetwear community campaigns.",
    "",
    "Age feel: 23–30. Body: lean athletic. Face: symmetrical, strong facial harmony.",
    "Skin: deep natural tone with realistic texture — premium, not waxy.",
    "Hair: modern short curls OR premium braids — groomed, fashion-forward.",
    "",
    "Expression: relaxed confidence, fashion energy, community leader presence.",
    "No exaggerated smiling. No influencer selfie energy. No gangster stereotype.",
    "",
    "Photography: luxury campaign editorial — soft premium lighting, photorealistic,",
    "campaign-ready for TikTok, Instagram, and community hero placements.",
    "NOT passport photo. NOT corporate headshot. NOT tourist snapshot.",
  ].join("\n");
}

function femaleLifestyleBlock(): string {
  return [
    "PREMIUM CASTING — Female Lifestyle Hero",
    "Cast an agency-level premium female lifestyle model for luxury casual campaigns.",
    "",
    "Age feel: 22–29. Natural beauty. No heavy makeup. Healthy realistic skin with texture.",
    "Luxury casual styling direction. Editorial bone structure and fashion presence.",
    "",
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
        "Agency model presence — editorial bone structure, fashion campaign readiness,",
        "premium skin texture, photorealistic luxury streetwear casting.",
      ].join("\n");
  }
}

export function premiumFashionPresenceBlock(): string {
  return [
    "FASHION MODEL QUALITY BAR",
    "Every candidate must resemble a professional fashion agency model — not an average attractive person.",
    "",
    "Required: strong facial harmony, editorial bone structure, fashion presence, premium skin texture,",
    "realistic eyes and lips, natural imperfections, natural lighting, professional photography,",
    "luxury campaign feeling, photorealistic, modern, authentic, campaign-ready.",
    "",
    `Quality bar inspired by (never copy): ${PREMIUM_CASTING_QUALITY_REFERENCE.slice(0, 5).join(", ")}.`,
    "International premium streetwear editorial — not passport, not LinkedIn, not stock photo.",
  ].join("\n");
}

export function premiumPhotographyBlock(): string {
  return [
    "PREMIUM EDITORIAL PHOTOGRAPHY",
    "Luxury streetwear campaign portrait — editorial fashion casting frame.",
    "Soft luxury lighting with natural falloff, premium skin texture, mild natural shadows.",
    "Studio-quality campaign photography — photorealistic, high-end commercial fashion.",
    "Controlled neutral casting set — warm grey plaster, soft daylight or diffused softbox.",
    "NOT flat passport lighting. NOT harsh ID photo flash. NOT over-sharpened AI polish.",
    "NOT plastic skin, NOT waxy retouch, NOT cartoon, NOT beauty-filter smoothing.",
  ].join("\n");
}

export function premiumNegativePromptAdditions(): string {
  return [
    "passport photo",
    "ID photo",
    "identity photo",
    "corporate headshot",
    "LinkedIn portrait",
    "office portrait",
    "employee photo",
    "selfie",
    "tourist photo",
    "snapshot",
    "AI face",
    "generic AI face",
    "plastic skin",
    "waxy skin",
    "over sharpened",
    "over-sharpened",
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
    "mugshot",
    "driver license photo",
  ].join(", ");
}

/** Appended on internal quality-regeneration attempts. */
export function buildPremiumRetryPromptSuffix(attempt: number): string {
  return [
    "",
    `PREMIUM CASTING QUALITY RETRY (${attempt})`,
    "Elevate to international luxury streetwear editorial campaign model immediately.",
    "Agency bone structure, fashion presence, premium skin texture, campaign-ready portrait.",
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

/** Cues that indicate sub-premium casting direction — triggers internal regeneration. */
export const SUBPREMIUM_CASTING_CUES = [
  "passport photo",
  "linkedin",
  "corporate headshot",
  "office portrait",
  "selfie",
  "tourist",
  "generic ai face",
  "stock photo smile",
  "id photo",
  "mugshot",
] as const;
