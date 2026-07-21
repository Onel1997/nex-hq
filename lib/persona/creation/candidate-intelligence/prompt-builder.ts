/**
 * Modular prompt composition for Persona Stage-A casting.
 *
 * Priority order:
 * 1. Candidate-specific Identity Lock
 * 2. Authentic Human Appearance
 * 3. Calm / Friendly Commercial Presence
 * 4. Milaene Premium Streetwear Brand DNA
 * 5. Wardrobe and Fit
 * 6. Camera Angle
 * 7. Controlled Neutral Casting Environment
 * 8. Natural Lighting
 * 9. Editorial Support
 * 10. Negative Constraints
 *
 * Identity lock is PER CANDIDATE (shared across that candidate's camera angles).
 * Candidates do NOT share a global face recipe.
 *
 * Persona Studio = casting studio (face / presence / identity).
 * Image Studio later = campaigns, locations, social scenes.
 */

import type { CandidateAssetType, PersonaCreationProject } from "../../domain/creation-types";
import {
  resolveCandidateVariation,
  type CandidateVariationProfile,
} from "./variations";

export interface PromptBlocks {
  /** 1 — Candidate-specific identity lock */
  identity: string;
  /** 2 — Authentic human appearance / skin */
  appearance: string;
  /** 3 — Calm / friendly commercial presence */
  presence: string;
  /** 4 — Brand DNA */
  brandDna: string;
  /** 5 — Wardrobe and fit */
  wardrobe: string;
  /** 6 — Camera angle */
  camera: string;
  /** 7+8 — Neutral casting environment + lighting */
  lighting: string;
  /** Candidate direction notes */
  variation: string;
  /** 9 — Supporting polish only */
  editorialRules: string;
  /** 10 — Negatives */
  negative: string;
  /** @deprecated Prefer presence — kept for older snapshot readers. */
  lifestyle: string;
}

export interface BuiltCandidatePrompt {
  blocks: PromptBlocks;
  /** Final OpenAI prompt (blocks joined with newlines). */
  prompt: string;
  negativePrompt: string;
  variation: CandidateVariationProfile;
  /** Identity lock text shared across all camera angles for THIS candidate only. */
  identityLock: string;
}

function framingForAsset(assetType: CandidateAssetType): string {
  switch (assetType) {
    case "portrait_front":
      return [
        "CAMERA — Stage A Front Portrait",
        "Natural front head-and-shoulders casting portrait.",
        "Soft natural eye contact, shoulders slightly relaxed — not stiff passport-front.",
        "Friendly or calm-neutral facial muscles. No forced smile. No mugshot blankness.",
        "Same identity as THIS candidate's Three Quarter and Half Body frames.",
      ].join("\n");
    case "portrait_three_quarter":
      return [
        "CAMERA — Stage A Three Quarter Portrait",
        "True 30–45 degree body/face turn — not a near-copy of the front frame.",
        "Same person as THIS candidate's front portrait. Natural gaze. Slight posture variation.",
        "Keep identity locked. Change only angle and subtle stance.",
      ].join("\n");
    case "portrait_profile":
      return [
        "CAMERA — Soft profile casting portrait",
        "Ear visible, same person as THIS candidate's front frame.",
      ].join("\n");
    case "half_body":
      return [
        "CAMERA — Stage A Half Body",
        "Waist-up casting frame showing oversized premium streetwear fit.",
        "Natural shoulder line, relaxed arms, slight weight shift — never runway or military stance.",
        "Same face, hair, skin, and proportions as THIS candidate's front portrait.",
      ].join("\n");
    case "full_body":
      return [
        "CAMERA — Full-body casting standing frame",
        "Natural stance, same person as THIS candidate.",
      ].join("\n");
    case "expression_variant":
      return [
        "CAMERA — Close casting portrait with calm friendly expression",
        "Identical person to THIS candidate.",
      ].join("\n");
    case "outfit_variant":
      return [
        "CAMERA — Half-body casting frame in premium streetwear basics",
        "Identical face and hair to THIS candidate.",
      ].join("\n");
    default:
      return "CAMERA — Premium streetwear casting portrait, identity-locked to THIS candidate only.";
  }
}

/**
 * Per-candidate identity lock — biological uniqueness only.
 * Project brief supplies age band + gender envelope; no global olive-face recipe.
 */
function buildIdentityLockBlock(
  project: PersonaCreationProject,
  variation: CandidateVariationProfile,
  candidateNumber: number,
): string {
  return [
    `1. CANDIDATE IDENTITY LOCK — Candidate ${candidateNumber} only (${variation.label}).`,
    variation.identityDescriptor,
    `Adult age feel band: ${project.age_range || "23-30"} (target casting age ≈23–30).`,
    `Gender presentation: ${project.gender_presentation || "Male"}.`,
    `Face geometry: ${variation.faceGeometry}.`,
    `Jaw: ${variation.jawShape}.`,
    `Chin: ${variation.chinShape}.`,
    `Eyes: ${variation.eyeShape}; spacing: ${variation.eyeSpacing}.`,
    `Nose: ${variation.noseShape}.`,
    `Lips: ${variation.lipShape}.`,
    `Cheekbones: ${variation.cheekbones}.`,
    `Hair texture: ${variation.hairTexture}.`,
    `Haircut: ${variation.haircut}.`,
    `Facial hair: ${variation.facialHair}.`,
    `Skin tone: ${variation.skinTone}.`,
    `Body build: ${variation.bodyBuild}; shoulders: ${variation.shoulderProfile}.`,
    "Across Front / Three Quarter / Half Body of THIS candidate: face, hair, eyes, skin, and proportions stay identical.",
    "Do not invent a different person between camera angles of THIS candidate.",
    "Do NOT reuse facial geometry, skin tone recipe, haircut, jaw, nose, or eye shape from any other candidate.",
  ].join("\n");
}

function buildAuthenticAppearanceBlock(
  variation: CandidateVariationProfile,
): string {
  return [
    "2. AUTHENTIC HUMAN APPEARANCE",
    `Skin: ${variation.skinTone}.`,
    "Allow visible but subtle skin texture, natural pores, slight under-eye detail, minor asymmetry.",
    "Allow real beard density variation and a natural hairline.",
    "Realistic complexion variation — photoreal adult human, not porcelain beauty skin.",
    "Still groomed, premium, and commercially usable — authentic does not mean unkempt.",
    "No airbrushed texture, no waxy / plastic AI finish, no unreal facial symmetry.",
  ].join("\n");
}

function buildPresenceBlock(variation: CandidateVariationProfile): string {
  return [
    "3. CALM / FRIENDLY COMMERCIAL PRESENCE",
    `Expression: ${variation.expression}.`,
    `Posture: ${variation.posture}.`,
    `Social presence: ${variation.socialPresence}.`,
    `Styling direction: ${variation.stylingDirection}.`,
    "Relaxed confidence. Approachable. Quiet self-assurance. Natural charisma.",
    "Friendly eyes. Soft neutral expression. Effortless streetwear presence.",
    "Contemporary social presence — casually memorable and camera-ready.",
    "No angry eyes, no tough-guy stare, no hostile energy, no gangster styling.",
  ].join("\n");
}

function buildBrandDnaBlock(project: PersonaCreationProject): string {
  return [
    "4. MILAENE PREMIUM STREETWEAR BRAND DNA",
    "Milaene is a modern premium streetwear lifestyle brand — casting studio for official Brand Faces.",
    "Stage A judges face, presence, identity strength, streetwear credibility, and multi-angle consistency.",
    "Not a campaign shoot. No streets, cafés, cars, product sets, or social-media scene builds here.",
    `Lifestyle direction: ${project.fashion_style || "Premium Streetwear Lifestyle Casting"}.`,
    `Brand role: ${project.brand_role}.`,
    project.visual_keywords ? `Visual keywords: ${project.visual_keywords}.` : null,
    project.preferred_brand_looks ? `Brand look: ${project.preferred_brand_looks}.` : null,
    project.additional_description ? `Creative notes: ${project.additional_description}.` : null,
    "Shared cast DNA only: age band ≈23–30, Milaene premium streetwear context, calm commercial casting language.",
    "NOT shared across candidates: face geometry, jaw, nose, eyes, lips, skin tone, hair texture, haircut, body build.",
    "Goal: a person who could credibly represent Milaene on Instagram, TikTok, website, lookbook, and paid social.",
    "Not: a perfect AI model against a wall. Not a magazine cover. Not a classic luxury-fashion cast.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildWardrobeBlock(
  project: PersonaCreationProject,
  variation: CandidateVariationProfile,
): string {
  return [
    "5. WARDROBE AND FIT",
    `Candidate wardrobe: ${variation.wardrobe}.`,
    project.preferred_outfits ? `Brief outfit cue: ${project.preferred_outfits}.` : null,
    "Allowed family: washed black / charcoal / off-white heavyweight tee, faded grey or muted taupe hoodie, black zip hoodie.",
    "Relaxed sweatpants cue allowed only as silhouette hint in Half Body — never a fashion-week outfit.",
    "Oversized premium streetwear fit must read clearly in Half Body.",
    "No visible logos, fantasy brands, suits, shirts, turtlenecks, jewelry overload, or luxury watches.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEnvironmentLightingBlock(variation: CandidateVariationProfile): string {
  return [
    "7–8. CONTROLLED NEUTRAL CASTING ENVIRONMENT + NATURAL LIGHTING",
    `Background (candidate-specific): ${variation.background}.`,
    `Light: ${variation.lighting}.`,
    "Keep Stage A controlled and neutral — not a campaign location.",
    "No streets, cafés, parking garages, shops, clothing racks, cars, or product sets.",
    "Soft natural daylight / diffused window light / subtle studio softbox.",
    "Realistic skin tones, mild natural shadows — no beauty lighting, no dramatic fashion lighting, no harsh intimidation shadows.",
    "Consistent lighting family across all angles of THIS candidate only.",
    "Do not reuse the exact same beige wall recipe for every candidate.",
  ].join("\n");
}

function buildVariationBlock(
  variation: CandidateVariationProfile,
  candidateNumber: number,
): string {
  return [
    `CANDIDATE DIRECTION — Candidate ${candidateNumber}: ${variation.label}`,
    `Aesthetic: ${variation.aesthetic}.`,
    ...variation.promptLines,
  ].join("\n");
}

function buildEditorialSupportBlock(): string {
  return [
    "9. EDITORIAL SUPPORT (secondary only)",
    "Photorealistic adult casting photograph for a premium streetwear lifestyle brand.",
    "Editorial polish supports image quality only — never turn the face into high fashion.",
    "Commercial usable, clean, natural. Clearly an adult human.",
    "Natural facial asymmetry. Realistic hair strands. Correct anatomy.",
    "No over-retouching, no glossy beauty skin, no uncanny perfect symmetry.",
    "No brand logos, no copyrighted characters, no text, no watermark.",
    "Single adult person only. Suitable as an official Milaene Brand Face reference.",
  ].join("\n");
}

function buildNegativePrompt(project: PersonaCreationProject): string {
  return [
    "cartoon, anime, illustration, 3d render, plastic skin, waxy skin, glossy beauty retouching,",
    "over-smoothed, porcelain skin, airbrushed texture, exaggerated facial symmetry,",
    "deformed hands, extra fingers, bad anatomy, watermark, text, logo,",
    "collage, multiple people, child, minor, underage, age-ambiguous,",
    "sexualized pose, different person between angles, identity drift, hair color change, eye color change,",
    "identical candidates, cloned facial identity, generic AI face, same face as other candidates,",
    "aggressive expression, angry eyes, intimidating stare, deeply furrowed brows, hostile expression,",
    "criminal stereotype, gangster styling, piercing stare, confrontational gaze, hard authority,",
    "CEO portrait, corporate headshot, luxury realtor, businessman, suit, blazer, turtleneck, dress shirt,",
    "runway model, fashion week, severe high-fashion face, high-fashion intensity, sharp fashion face,",
    "extreme cheekbones, razor-sharp jawline, dominant body language, military stance, rigid posture,",
    "passport photo, expressionless mugshot, bodybuilder physique, fitness influencer,",
    "over-groomed hair, perfectly combed slick business hair,",
    "identical beige background, beauty ring light, dramatic fashion lighting, harsh intimidation shadows,",
    "street cafe campaign scene, parking garage, clothing rack set, product mockup, group shot,",
    "broad commercial smile, flashy jewelry, visible brand logos, loud prints, luxury watch,",
    project.excluded_features || "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Build a modular OpenAI prompt for one candidate × one Stage-A camera asset.
 * Identity is unique per candidate; only the camera block changes per asset.
 */
export function buildCandidatePrompt(params: {
  project: PersonaCreationProject;
  assetType: CandidateAssetType;
  candidateNumber: number;
  variation?: CandidateVariationProfile;
}): BuiltCandidatePrompt {
  const variation =
    params.variation ?? resolveCandidateVariation(params.candidateNumber);
  const identity = buildIdentityLockBlock(
    params.project,
    variation,
    params.candidateNumber,
  );
  const appearance = buildAuthenticAppearanceBlock(variation);
  const presence = buildPresenceBlock(variation);
  const brandDna = buildBrandDnaBlock(params.project);
  const wardrobe = buildWardrobeBlock(params.project, variation);
  const camera = framingForAsset(params.assetType);
  const lighting = buildEnvironmentLightingBlock(variation);
  const variationBlock = buildVariationBlock(variation, params.candidateNumber);
  const editorialRules = buildEditorialSupportBlock();
  const negative = buildNegativePrompt(params.project);

  // Legacy alias — older tests / readers looked for a lifestyle block.
  const lifestyle = [
    "LIFESTYLE CASTING CONTEXT",
    `Aesthetic: ${variation.aesthetic}.`,
    "Premium Streetwear Lifestyle Casting — controlled Stage A, not a campaign location.",
    "More community and identification. Less polished high-fashion model energy.",
  ].join("\n");

  const blocks: PromptBlocks = {
    identity,
    appearance,
    presence,
    brandDna,
    wardrobe,
    camera,
    lighting,
    variation: variationBlock,
    editorialRules,
    negative,
    lifestyle,
  };

  const prompt = [
    blocks.identity,
    blocks.appearance,
    blocks.presence,
    blocks.brandDna,
    blocks.wardrobe,
    blocks.camera,
    blocks.lighting,
    blocks.variation,
    blocks.editorialRules,
  ].join("\n\n");

  return {
    blocks,
    prompt,
    negativePrompt: negative,
    variation,
    identityLock: identity,
  };
}

/** Compose final provider string (prompt + negative). */
export function composeProviderPrompt(built: BuiltCandidatePrompt): string {
  return `${built.prompt}\n\nAvoid: ${built.negativePrompt}`;
}
