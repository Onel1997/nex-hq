/**
 * Optional Milaene Brand Cast creation presets — templates only, never auto-submit.
 */

import type { CreationProjectPreset } from "../domain/creation-types";

export const PERSONA_CREATION_PRESETS: CreationProjectPreset[] = [
  {
    id: "milaene_street_luxury",
    label: "Milaene Street Luxury",
    brand_role: "primary_male",
    gender_presentation: "Male",
    age_range: "23-30",
    height_range: "175-187 cm",
    body_type: "Lean-normal to lean-athletic — never bodybuilder",
    skin_tone_direction:
      "Diverse European / Mediterranean / mixed / Afro-European casting range — candidate-specific, not one olive recipe",
    face_shape_direction:
      "Four distinct face geometries — approachable, never razor-sharp high-fashion",
    hair_direction:
      "Candidate-specific: textured crop, natural curls, controlled taper/buzz, natural coils/twists",
    facial_hair_direction: "Candidate-specific light stubble to clean-shaven — never over-groomed",
    eye_direction: "Friendly / calm-neutral eyes, relaxed brows — never aggressive stare",
    expression_direction:
      "Relaxed confidence, soft neutral expression, approachable calm — never arrogant or aggressive",
    personality: "Modern, sympathisch, authentic premium streetwear Brand Face presence",
    fashion_style: "Premium Streetwear Lifestyle Casting",
    visual_keywords:
      "premium streetwear casting, authentic Brand Face, calm commercial presence, Instagram TikTok website lookbook ready, community credibility",
    excluded_features:
      "fashion week, runway, Vogue, severe high-fashion face, CEO portrait, corporate headshot, luxury realtor, aggressive expression, angry eyes, intimidating stare, gangster styling, bodybuilder, glossy beauty skin, plastic skin, waxy skin, turtleneck, blazer, suit, flashy jewelry, identical beige background, campaign street scenes",
    preferred_brand_looks: "Milaene Premium Streetwear Lifestyle Casting",
    preferred_outfits:
      "Washed black / charcoal / off-white heavyweight oversized tee, faded grey or muted taupe hoodie, black zip hoodie — no logos, Stage A casting wardrobe only",
    intended_usage: "image_and_video",
    candidate_count: 4,
  },
  {
    id: "primary_male_quiet_luxury",
    label: "Primary Male / Everyday Premium",
    brand_role: "primary_male",
    gender_presentation: "Male",
    age_range: "24-29",
    height_range: "176-186 cm",
    body_type: "Lean-normal everyday",
    skin_tone_direction: "Warm light-medium olive with real texture",
    face_shape_direction: "Balanced oval-rectangle, approachable jaw, natural features",
    hair_direction: "Dark textured soft crop, slightly messy",
    facial_hair_direction: "Natural 2–3 day stubble",
    eye_direction: "Friendly almond eyes, soft neutral gaze",
    expression_direction: "Calm authentic confidence, relaxed facial muscles",
    personality: "Approachable warmth, versatile Brand Face presence",
    fashion_style: "Everyday premium streetwear casting",
    visual_keywords: "authentic, premium casual, approachable, community Brand Face",
    excluded_features:
      "fashion week, CEO look, glossy beauty skin, aggressive stare, flashy jewelry, cartoonish features",
    preferred_brand_looks: "Everyday Premium",
    preferred_outfits: "Washed black heavyweight oversized tee",
    intended_usage: "image_and_video",
    candidate_count: 4,
  },
  {
    id: "secondary_male_street_editorial",
    label: "Secondary Male / Urban Creator",
    brand_role: "secondary_male",
    gender_presentation: "Male",
    age_range: "23-27",
    height_range: "174-184 cm",
    body_type: "Slim lean casual",
    skin_tone_direction: "Warm medium brown to medium olive",
    face_shape_direction: "Longer narrower creative face, open expressive eyes",
    hair_direction: "Natural soft curls / structured curl crop with taper",
    facial_hair_direction: "Very light uneven stubble or clean-shaven",
    eye_direction: "Larger open friendly eyes",
    expression_direction: "Relaxed creator energy, soft friendly interest",
    personality: "Social-first, approachable urban creative presence",
    fashion_style: "Urban creator streetwear casting",
    visual_keywords: "creator, urban, authentic, social-first Brand Face",
    excluded_features:
      "runway pose, logos, neon, aggressive rebel look, corporate look, sunken fashion cheeks",
    preferred_brand_looks: "Urban Creator",
    preferred_outfits: "Black zip hoodie over dark heavyweight tee",
    intended_usage: "image_and_video",
    candidate_count: 4,
  },
  {
    id: "primary_female_minimal_editorial",
    label: "Primary Female / Minimal Editorial",
    brand_role: "primary_female",
    gender_presentation: "Female",
    age_range: "23-30",
    height_range: "168-178 cm",
    body_type: "Athletic lean",
    skin_tone_direction: "Light olive to medium — candidate-specific",
    face_shape_direction: "Soft jawline, balanced features",
    hair_direction: "Dark brown straight or soft wave",
    facial_hair_direction: "None",
    eye_direction: "Hazel or brown, calm friendly",
    expression_direction: "Calm, authentic lifestyle ease",
    personality: "Quiet presence, approachable",
    fashion_style: "Minimal premium lifestyle casting",
    visual_keywords: "clean, refined, lifestyle, brand-forward",
    excluded_features: "heavy glam, plastic look, over-retouching, fashion-week drama",
    preferred_brand_looks: "Minimal Lifestyle",
    preferred_outfits: "Premium basics, soft structure neutrals",
    intended_usage: "image_and_video",
    candidate_count: 4,
  },
];

export function getCreationPreset(id: string): CreationProjectPreset | null {
  return PERSONA_CREATION_PRESETS.find((p) => p.id === id) ?? null;
}
