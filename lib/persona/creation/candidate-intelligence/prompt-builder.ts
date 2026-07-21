/**
 * Modular prompt composition for Persona Stage-A casting.
 *
 * Priority order (Phase 1.7D):
 * 1. Identity DNA (Brand Archetype — permanent)
 * 2. Brand Memory
 * 3. Product Intelligence wardrobe constraints
 * 4. Approved Persona Casting Reference descriptors (optional)
 * 5. Camera angle
 * 6. Stage-A environment + lighting
 * 7. Archetype direction + editorial support
 * 8. Negative constraints
 *
 * Identity DNA replaces legacy random face recipes.
 * Archetypes behave like a professional casting agency.
 */

import {
  formatBrandMemoryEditorialForPersona,
  formatBrandMemoryForPersona,
  formatBrandMemoryWardrobeForPersona,
  loadBrandMemory,
  type BrandMemory,
} from "@/lib/brand-memory";
import {
  createBrandArchetypeSnapshot,
  formatArchetypeAppearancePrompt,
  formatArchetypeDirectionPrompt,
  formatArchetypePresencePrompt,
  formatIdentityDnaPrompt,
  getIdentityDnaForArchetype,
  loadBrandArchetypeCatalog,
  resolveArchetypeForCandidate,
  type BrandArchetype,
  type BrandArchetypeCatalog,
  type BrandArchetypeSnapshot,
  type IdentityDna,
} from "@/lib/brand-archetypes";
import {
  formatProductWardrobeConstraintsForPersona,
  createProductIntelligenceSnapshot,
  loadProductCatalog,
  type ProductCatalog,
  type ProductIntelligenceSnapshot,
} from "@/lib/product-intelligence";
import {
  createReferenceIntelligenceSnapshot,
  formatPersonaReferenceDirection,
  loadReferenceCatalog,
  type ReferenceIntelligenceSnapshot,
  type ReferenceWorkspaceCatalog,
} from "@/lib/reference-intelligence";
import type { CandidateAssetType, PersonaCreationProject } from "../../domain/creation-types";
import { variationProfileFromArchetype } from "./archetype-bridge";
import {
  resolveCandidateVariation,
  type CandidateVariationProfile,
} from "./variations";

export interface PromptBlocks {
  /** 1 — Identity DNA (Brand Archetype) */
  identity: string;
  /** 2 — Authentic human appearance from Identity DNA */
  appearance: string;
  /** 3 — Commercial presence from Identity DNA */
  presence: string;
  /** 4 — Brand DNA */
  brandDna: string;
  /** 5 — Wardrobe and fit (Product Intelligence constraints) */
  wardrobe: string;
  /** Optional approved persona casting reference direction */
  referenceDirection: string;
  /** 6 — Camera angle */
  camera: string;
  /** 7+8 — Neutral casting environment + lighting */
  lighting: string;
  /** Archetype direction notes */
  variation: string;
  /** Supporting polish only */
  editorialRules: string;
  /** Negatives */
  negative: string;
  /** @deprecated Prefer presence — kept for older snapshot readers. */
  lifestyle: string;
}

export interface BuiltCandidatePrompt {
  blocks: PromptBlocks;
  prompt: string;
  negativePrompt: string;
  variation: CandidateVariationProfile;
  identityLock: string;
  brandMemory: BrandMemory;
  productIntelligence: ProductIntelligenceSnapshot;
  referenceIntelligence: ReferenceIntelligenceSnapshot;
  /** Official Brand Archetype used for Identity DNA. */
  brandArchetype: BrandArchetype;
  identityDna: IdentityDna;
  brandArchetypeSnapshot: BrandArchetypeSnapshot;
}

function framingForAsset(
  assetType: CandidateAssetType,
  memory: BrandMemory,
): string {
  const fitLabel = memory.fit.labels[0] ?? "premium";
  const brandFit = `${fitLabel.toLowerCase()} ${memory.brandName} streetwear fit`;

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
        `Waist-up casting frame showing ${brandFit}.`,
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
      return `CAMERA — ${memory.brandName} streetwear casting portrait, identity-locked to THIS candidate only.`;
  }
}

/**
 * Legacy variation-based identity lock — only used when archetype inject is disabled.
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

function buildEnvironmentLightingBlock(
  variation: CandidateVariationProfile,
  memory: BrandMemory,
  archetype?: BrandArchetype,
): string {
  return [
    "7–8. CONTROLLED NEUTRAL CASTING ENVIRONMENT + NATURAL LIGHTING",
    `Background (candidate-specific): ${variation.background}.`,
    `Light: ${archetype?.lightingDirection ?? variation.lighting}.`,
    "Keep Stage A controlled and neutral — not a campaign location.",
    "No streets, cafés, parking garages, shops, clothing racks, cars, or product sets.",
    "Soft natural daylight / diffused window light / subtle studio softbox.",
    `Photography direction: ${archetype?.photographyDirection ?? memory.photographyStyle}`,
    "Realistic skin tones, mild natural shadows — no beauty lighting, no dramatic fashion lighting, no harsh intimidation shadows.",
    "Consistent lighting family across all angles of THIS candidate only.",
    "Do not reuse the exact same beige wall recipe for every candidate.",
  ].join("\n");
}

function buildNegativePrompt(
  project: PersonaCreationProject,
  memory: BrandMemory,
  archetype?: BrandArchetype,
): string {
  const forbiddenProducts = memory.forbiddenProductTypes
    .slice(0, 6)
    .join(", ");
  const forbiddenFits = memory.fit.forbidden.join(", ");
  const forbiddenAesthetics = memory.visualIdentity.forbiddenAesthetics
    .slice(0, 6)
    .join(", ");
  const archetypeAvoid = archetype?.avoid.join(", ") ?? "";

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
    `${forbiddenProducts},`,
    `${forbiddenFits},`,
    `${forbiddenAesthetics},`,
    archetypeAvoid,
    project.excluded_features || "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Build a modular OpenAI prompt for one candidate × one Stage-A camera asset.
 * Identity DNA from Brand Archetypes is the primary identity source.
 */
export function buildCandidatePrompt(params: {
  project: PersonaCreationProject;
  assetType: CandidateAssetType;
  candidateNumber: number;
  variation?: CandidateVariationProfile;
  brandMemory?: BrandMemory;
  productCatalog?: ProductCatalog;
  referenceCatalog?: ReferenceWorkspaceCatalog;
  archetypeCatalog?: BrandArchetypeCatalog;
  /** When false, fall back to legacy variation recipes (tests only). Default true. */
  useBrandArchetypes?: boolean;
}): BuiltCandidatePrompt {
  const brandMemory =
    params.brandMemory ?? loadBrandMemory(params.project.workspace_id);
  const productCatalog =
    params.productCatalog ?? loadProductCatalog(params.project.workspace_id);
  const productIntelligence =
    createProductIntelligenceSnapshot(productCatalog);
  const referenceCatalog =
    params.referenceCatalog ?? loadReferenceCatalog(params.project.workspace_id);
  const referenceIntelligence = createReferenceIntelligenceSnapshot(
    referenceCatalog,
    { usageFilter: "persona_casting" },
  );

  const archetypeCatalog =
    params.archetypeCatalog ??
    loadBrandArchetypeCatalog(params.project.workspace_id);
  const useArchetypes = params.useBrandArchetypes !== false;
  const brandArchetype = useArchetypes
    ? resolveArchetypeForCandidate(archetypeCatalog, params.candidateNumber)
    : resolveArchetypeForCandidate(archetypeCatalog, 1);
  const identityDna = getIdentityDnaForArchetype(archetypeCatalog, brandArchetype);
  const brandArchetypeSnapshot = createBrandArchetypeSnapshot({
    archetype: brandArchetype,
    dna: identityDna,
    brandFaceMemory:
      archetypeCatalog.brandFaceMemoryByArchetypeId[brandArchetype.id],
  });

  const variation =
    params.variation ??
    (useArchetypes
      ? variationProfileFromArchetype(brandArchetype, identityDna)
      : resolveCandidateVariation(params.candidateNumber));

  const identity = useArchetypes
    ? formatIdentityDnaPrompt(brandArchetype, identityDna)
    : buildIdentityLockBlock(params.project, variation, params.candidateNumber);
  const appearance = useArchetypes
    ? formatArchetypeAppearancePrompt(identityDna)
    : [
        "2. AUTHENTIC HUMAN APPEARANCE",
        `Skin: ${variation.skinTone}.`,
        "Allow visible but subtle skin texture, natural pores, slight under-eye detail, minor asymmetry.",
        "Photoreal adult human — not porcelain beauty skin.",
      ].join("\n");
  const presence = useArchetypes
    ? formatArchetypePresencePrompt(identityDna)
    : [
        "3. CALM / FRIENDLY COMMERCIAL PRESENCE",
        `Expression: ${variation.expression}.`,
        `Posture: ${variation.posture}.`,
        `Social presence: ${variation.socialPresence}.`,
      ].join("\n");

  const brandDna = formatBrandMemoryForPersona(brandMemory, {
    lifestyleDirection: params.project.fashion_style,
    brandRole: params.project.brand_role,
    visualKeywords: params.project.visual_keywords,
    preferredBrandLooks: params.project.preferred_brand_looks,
    creativeNotes: params.project.additional_description,
  });
  const wardrobe = formatBrandMemoryWardrobeForPersona(brandMemory, {
    candidateWardrobe: variation.wardrobe,
    briefOutfitCue: params.project.preferred_outfits,
    productWardrobeConstraints:
      formatProductWardrobeConstraintsForPersona(productCatalog),
  });
  const referenceDirection = formatPersonaReferenceDirection(referenceCatalog);
  const camera = framingForAsset(params.assetType, brandMemory);
  const lighting = buildEnvironmentLightingBlock(
    variation,
    brandMemory,
    useArchetypes ? brandArchetype : undefined,
  );
  const variationBlock = useArchetypes
    ? formatArchetypeDirectionPrompt(brandArchetype)
    : [
        `CANDIDATE DIRECTION — Candidate ${params.candidateNumber}: ${variation.label}`,
        `Aesthetic: ${variation.aesthetic}.`,
        ...variation.promptLines,
      ].join("\n");
  const editorialRules = formatBrandMemoryEditorialForPersona(brandMemory);
  const negative = buildNegativePrompt(
    params.project,
    brandMemory,
    useArchetypes ? brandArchetype : undefined,
  );

  const lifestyle = [
    "LIFESTYLE CASTING CONTEXT",
    `Archetype: ${brandArchetype.name}.`,
    `Aesthetic: ${variation.aesthetic}.`,
    `${brandMemory.brandName} — ${brandMemory.lifestyleKeywords[0] ?? brandMemory.positioning} — controlled Stage A, not a campaign location.`,
    `Campaign role: ${brandArchetype.campaignRole}.`,
    "More community and identification. Less polished high-fashion model energy.",
  ].join("\n");

  const blocks: PromptBlocks = {
    identity,
    appearance,
    presence,
    brandDna,
    wardrobe,
    referenceDirection,
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
    blocks.referenceDirection,
    blocks.camera,
    blocks.lighting,
    blocks.variation,
    blocks.editorialRules,
  ]
    .filter((block) => block.trim().length > 0)
    .join("\n\n");

  return {
    blocks,
    prompt,
    negativePrompt: negative,
    variation,
    identityLock: identity,
    brandMemory,
    productIntelligence,
    referenceIntelligence,
    brandArchetype,
    identityDna,
    brandArchetypeSnapshot,
  };
}

/** Compose final provider string (prompt + negative). */
export function composeProviderPrompt(built: BuiltCandidatePrompt): string {
  return `${built.prompt}\n\nAvoid: ${built.negativePrompt}`;
}
