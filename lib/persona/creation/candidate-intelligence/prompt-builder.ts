/**
 * Modular prompt composition for Persona candidate generation.
 * Blocks are composed deliberately — not one opaque string.
 *
 * Priority order:
 * 1. Brand DNA → 2. Lifestyle → 3. Authenticity (identity/appearance)
 * 4. Commercial appeal → 5. Editorial (supporting only)
 *
 * Identity lock is PER CANDIDATE (shared across that candidate's camera angles).
 * Candidates do NOT share a global face identity.
 */

import type { CandidateAssetType, PersonaCreationProject } from "../../domain/creation-types";
import {
  resolveCandidateVariation,
  type CandidateVariationProfile,
} from "./variations";

export interface PromptBlocks {
  brandDna: string;
  lifestyle: string;
  identity: string;
  appearance: string;
  variation: string;
  lighting: string;
  camera: string;
  /** Supporting polish only — never the dominant creative driver. */
  editorialRules: string;
  negative: string;
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
      return "Camera: natural front head-and-shoulders lifestyle portrait, soft eye contact, relaxed framing — not a passport photo.";
    case "portrait_three_quarter":
      return "Camera: easy three-quarter lifestyle portrait, clear face, same person as THIS candidate's front frame.";
    case "portrait_profile":
      return "Camera: clean soft profile lifestyle portrait, ear visible, same person as THIS candidate's front frame.";
    case "half_body":
      return "Camera: waist-up lifestyle portrait, relaxed streetwear posture, loose arms, same face as THIS candidate's front frame.";
    case "full_body":
      return "Camera: full-body lifestyle standing frame, natural stance, same person as THIS candidate.";
    case "expression_variant":
      return "Camera: close lifestyle portrait with a calm friendly expression, identical person to THIS candidate.";
    case "outfit_variant":
      return "Camera: half-body lifestyle frame in premium streetwear basics, identical face and hair to THIS candidate.";
    default:
      return "Camera: premium streetwear lifestyle portrait, identity-locked to THIS candidate only.";
  }
}

function buildBrandDnaBlock(project: PersonaCreationProject): string {
  return [
    "BRAND DNA — Milaene Premium Streetwear Lifestyle",
    "Milaene is a modern premium streetwear lifestyle brand — not classic luxury fashion, not Vogue, not Fashion Week.",
    `Lifestyle direction: ${project.fashion_style || "premium streetwear lifestyle"}.`,
    `Brand role: ${project.brand_role}.`,
    project.visual_keywords ? `Visual keywords: ${project.visual_keywords}.` : null,
    project.preferred_outfits ? `Outfit direction: ${project.preferred_outfits}.` : null,
    project.preferred_brand_looks ? `Brand look: ${project.preferred_brand_looks}.` : null,
    project.additional_description ? `Creative notes: ${project.additional_description}.` : null,
    "Shared cast DNA: modern, sympathisch, authentic, urban, relaxed confidence, warm olive skin range, premium streetwear basics.",
    "NOT shared: face structure, jawline, eyes, nose, hair texture, stubble, body proportions.",
    "Goal: future Milaene Brand Faces people would voluntarily follow on Instagram.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildLifestyleBlock(variation: CandidateVariationProfile): string {
  return [
    "LIFESTYLE",
    `Aesthetic: ${variation.aesthetic}.`,
    "Feeling: seen on a street in Milan, Barcelona, or Copenhagen — not walking a runway tomorrow.",
    "More community and identification. Less polished high-fashion model energy.",
    "Premium streetwear campaign photography — soft daylight, real lifestyle presence.",
    "The viewer should believe this person actually wears Milaene.",
  ].join("\n");
}

/**
 * Per-candidate identity lock — biological uniqueness + authenticity.
 * Project brief only supplies age band + gender envelope.
 */
function buildIdentityBlock(
  project: PersonaCreationProject,
  variation: CandidateVariationProfile,
  candidateNumber: number,
): string {
  return [
    `AUTHENTICITY / IDENTITY LOCK — Candidate ${candidateNumber} only (${variation.label}).`,
    variation.identityDescriptor,
    `Adult age range band: ${project.age_range || "25-32"}.`,
    `Gender presentation: ${project.gender_presentation || "Male"}.`,
    `Face structure: ${variation.faceStructure}.`,
    `Jawline: ${variation.jawline}.`,
    `Cheekbones: ${variation.cheekbones}.`,
    `Eyes: ${variation.eyeShape}.`,
    `Nose: ${variation.nose}.`,
    `Hair: ${variation.hair}.`,
    `Facial hair: ${variation.stubble}.`,
    `Skin: ${variation.skinTone}.`,
    "Natural skin texture with subtle pores. Natural lips. Friendly modern masculine features.",
    "Across Front / Three Quarter / Half Body of THIS candidate: face, hair, eyes, skin, and proportions stay identical.",
    "Do not invent a different person between camera angles of THIS candidate.",
    "Do NOT reuse facial geometry from any other candidate in this cast.",
  ].join("\n");
}

function buildAppearanceBlock(
  project: PersonaCreationProject,
  variation: CandidateVariationProfile,
): string {
  return [
    "APPEARANCE & PRESENCE",
    `Height band: ${project.height_range || "178-187 cm"}.`,
    `Body: ${variation.body} (brief cue: ${project.body_type || "lean athletic"}).`,
    `Posture: ${variation.posture}.`,
    `Expression: ${variation.expression}.`,
    `Presence: ${variation.presence}.`,
    `Wardrobe (streetwear basics only): ${variation.wardrobe}.`,
    "Allowed clothing family: heavyweight oversized tee, hoodie, zip hoodie, sweatpants energy, minimal premium streetwear.",
    "No turtlenecks, no blazer, no suit, no business wear, no classic editorial luxury outfits.",
    "No visible logos, no loud prints, no fake brand marks, no flashy jewelry.",
  ].join("\n");
}

function buildVariationBlock(
  variation: CandidateVariationProfile,
  candidateNumber: number,
): string {
  return [
    `CANDIDATE DIRECTION — Candidate ${candidateNumber}: ${variation.label}`,
    ...variation.promptLines,
  ].join("\n");
}

function buildLightingBlock(variation: CandidateVariationProfile): string {
  return [
    "PHOTOGRAPHY — Premium Streetwear Campaign",
    `Light: ${variation.lighting}.`,
    `Background: ${variation.background}.`,
    "Prefer soft / warm daylight, neutral studio, concrete, minimal architecture, urban calm.",
    "No extreme dramatic shadows. No beauty ring light. No passport flat white default.",
    "Consistent lighting family across all angles of THIS candidate only.",
  ].join("\n");
}

function buildEditorialSupportBlock(): string {
  return [
    "EDITORIAL SUPPORT (secondary only)",
    "Photorealistic adult casting photograph for a premium streetwear lifestyle brand.",
    "Commercial usable, clean, natural — editorial polish supports, never dominates.",
    "Clearly an adult human. Natural facial asymmetry. Realistic hair strands. Correct anatomy.",
    "No over-retouching, no glossy beauty skin, no uncanny perfect symmetry.",
    "No brand logos, no copyrighted characters, no text, no watermark.",
    "Single adult person only. Suitable as an official Milaene brand face reference.",
  ].join("\n");
}

function buildNegativePrompt(project: PersonaCreationProject): string {
  return [
    "cartoon, anime, illustration, 3d render, plastic skin, over-smoothed, glossy beauty skin,",
    "deformed hands, extra fingers, bad anatomy, watermark, text, logo,",
    "collage, multiple people, child, minor, underage, age-ambiguous,",
    "sexualized pose, exaggerated beauty filter, uncanny symmetry,",
    "different person between angles, identity drift, hair color change, eye color change,",
    "same face as other candidates, cloned identity, identical twins look,",
    "fashion week, runway, luxury runway, Paris fashion week, Vogue, magazine cover,",
    "luxury fashion campaign, Calvin Klein campaign energy, high fashion editorial,",
    "fashion editorial pose, model catwalk pose, aggressive fashion pose, dominant body language,",
    "businessman, CEO portrait, corporate headshot, corporate, suit, blazer, turtleneck,",
    "intimidating expression, angry eyes, aggressive face, furrowed brows, scowl,",
    "exaggerated masculinity, overstyled hair, perfectly combed hair, slicked business hair,",
    "passport photo lighting, flat white backdrop as default, beauty ring light, heavy film-noir shadows,",
    "orange fake tan, extreme vacation tan, bodybuilder, fitness influencer,",
    "broad commercial smile, flashy jewelry, visible brand logos, loud prints,",
    project.excluded_features || "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Build a modular OpenAI prompt for one candidate × one camera asset.
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
  const brandDna = buildBrandDnaBlock(params.project);
  const lifestyle = buildLifestyleBlock(variation);
  const identity = buildIdentityBlock(
    params.project,
    variation,
    params.candidateNumber,
  );
  const appearance = buildAppearanceBlock(params.project, variation);
  const variationBlock = buildVariationBlock(variation, params.candidateNumber);
  const lighting = buildLightingBlock(variation);
  const camera = framingForAsset(params.assetType);
  const editorialRules = buildEditorialSupportBlock();
  const negative = buildNegativePrompt(params.project);

  const blocks: PromptBlocks = {
    brandDna,
    lifestyle,
    identity,
    appearance,
    variation: variationBlock,
    lighting,
    camera,
    editorialRules,
    negative,
  };

  // Priority: Brand DNA → Lifestyle → Authenticity → Commercial presence → Editorial support
  const prompt = [
    blocks.brandDna,
    blocks.lifestyle,
    blocks.identity,
    blocks.appearance,
    blocks.variation,
    blocks.lighting,
    blocks.camera,
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
