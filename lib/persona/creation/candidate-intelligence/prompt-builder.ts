/**
 * Modular prompt composition for Persona Stage-A casting.
 *
 * Official Brand Face discovery priority (Phase 1.8E):
 * 1. strict archetype and gender lock
 * 2. candidate-specific biological identity blueprint
 * 3. age and body structure
 * 4. expression and presence
 * 5. Brand Memory
 * 6. Product Intelligence wardrobe constraints
 * 7. reference direction
 * 8. camera and framing
 * 9. lighting and background
 * 10. negative constraints
 *
 * Legacy generic Persona Creator may still use variation recipes.
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
  assertBlueprintGenderMatchesArchetype,
  assertDiscoveryCastBlueprintsUnique,
  discoveryRunVariationToken,
  formatBlueprintIdentityPrompt,
  listDiscoveryBlueprintsForArchetype,
  logDiscoveryBlueprintTrace,
  promptFingerprint,
  requiredGenderForArchetype,
  resolveDiscoveryBlueprint,
  variationProfileFromBlueprint,
  type ArchetypeCandidateBlueprint,
  type BrandArchetype,
  type BrandArchetypeCatalog,
  type BrandArchetypeSnapshot,
  type IdentityDna,
} from "@/lib/brand-archetypes";
import { parseArchetypeIdFromProjectDescription } from "@/lib/brand-face-selection/creation-project-mapper";
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
import {
  genderEnforcementBlock,
  premiumArchetypeCastingBlock,
  premiumFashionPresenceBlock,
  premiumNegativePromptAdditions,
  premiumPhotographyBlock,
} from "./premium-casting-direction";

export interface PromptBlocks {
  /** 1 — Identity DNA (Brand Archetype) */
  identity: string;
  /** 2 — Authentic human appearance from Identity DNA / blueprint */
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
  /** Premium editorial casting direction (Phase 1.8A) */
  premiumCasting: string;
  /** Strict gender role enforcement */
  genderEnforcement: string;
  /** Candidate-specific biological blueprint (OBF) */
  biologicalIdentity: string;
  /** Age / body from blueprint */
  ageBody: string;
  /** Run-specific non-identity variation token block (OBF) */
  runVariation: string;
  /** @deprecated Prefer presence — kept for older snapshot readers. */
  lifestyle: string;
  /** Negatives */
  negative: string;
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
  /** Present for Official Brand Face discovery. */
  discoveryBlueprint: ArchetypeCandidateBlueprint | null;
  promptFingerprint: string;
  runVariationToken: string | null;
  officialBrandFace: boolean;
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
        "CAMERA — Premium Editorial Front Portrait (Stage A Discovery)",
        "Luxury streetwear campaign casting frame — head-and-shoulders to upper chest.",
        "Fashion agency model presence: editorial bone structure, strong facial harmony, campaign-ready.",
        "Soft natural eye contact, relaxed shoulders — confident calm luxury energy.",
        "NOT passport photo, NOT LinkedIn headshot, NOT ID mugshot, NOT flat stock portrait.",
        "Photorealistic premium skin texture with natural pores. Same identity across all angles.",
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
    premiumPhotographyBlock(),
    "",
    "7–8. CONTROLLED NEUTRAL CASTING ENVIRONMENT",
    `Background (candidate-specific): ${variation.background}.`,
    `Light: ${archetype?.lightingDirection ?? variation.lighting}.`,
    "Keep Stage A controlled and neutral — not a campaign location.",
    "No streets, cafés, parking garages, shops, clothing racks, cars, or product sets.",
    `Photography direction: ${archetype?.photographyDirection ?? memory.photographyStyle}`,
    "Soft luxury editorial lighting — premium skin texture, mild natural shadows.",
    "Consistent lighting family across all angles of THIS candidate only.",
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
    premiumNegativePromptAdditions(),
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Build a modular OpenAI prompt for one candidate × one Stage-A camera asset.
 * Official Brand Face: archetype-scoped blueprints own biology (Phase 1.8E).
 * Legacy Creator: may still use global variation recipes when not OBF.
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
  discoveryBlueprint?: ArchetypeCandidateBlueprint;
  /** When false, fall back to legacy variation recipes (tests only). Default true. */
  useBrandArchetypes?: boolean;
  /** Internal quality-regeneration suffix (Phase 1.8A). */
  premiumRetrySuffix?: string;
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

  const officialArchetypeId = parseArchetypeIdFromProjectDescription(
    params.project.description,
  );
  const officialBrandFace = Boolean(officialArchetypeId);

  let brandArchetype: BrandArchetype;
  let discoveryBlueprint: ArchetypeCandidateBlueprint | null = null;
  let runVariationToken: string | null = null;

  if (officialBrandFace && officialArchetypeId) {
    const found = archetypeCatalog.archetypes.find((a) => a.id === officialArchetypeId);
    if (!found) {
      throw new Error(
        `Official Brand Face archetype not found for project: ${officialArchetypeId}`,
      );
    }
    brandArchetype = found;
    const cast = listDiscoveryBlueprintsForArchetype(brandArchetype.id);
    assertDiscoveryCastBlueprintsUnique(cast);
    discoveryBlueprint =
      params.discoveryBlueprint ??
      resolveDiscoveryBlueprint({
        archetypeId: brandArchetype.id,
        candidateNumber: params.candidateNumber,
      });
    assertBlueprintGenderMatchesArchetype(discoveryBlueprint, brandArchetype);
    runVariationToken = discoveryRunVariationToken(params.project.id);
  } else if (useArchetypes) {
    // Legacy multi-archetype slot mapping (non-OBF Creator only).
    brandArchetype = resolveArchetypeForCandidate(
      archetypeCatalog,
      params.candidateNumber,
    );
  } else {
    brandArchetype = resolveArchetypeForCandidate(archetypeCatalog, 1);
  }

  const identityDna = getIdentityDnaForArchetype(archetypeCatalog, brandArchetype);
  const brandArchetypeSnapshot = createBrandArchetypeSnapshot({
    archetype: brandArchetype,
    dna: identityDna,
    brandFaceMemory:
      archetypeCatalog.brandFaceMemoryByArchetypeId[brandArchetype.id],
  });

  const variation =
    params.variation ??
    (discoveryBlueprint
      ? variationProfileFromBlueprint(discoveryBlueprint, brandArchetype)
      : useArchetypes
        ? variationProfileFromArchetype(brandArchetype, identityDna)
        : resolveCandidateVariation(params.candidateNumber));

  // When a caller still passes a global variation into an OBF project, replace biology.
  const effectiveVariation =
    discoveryBlueprint &&
    params.variation &&
    !params.variation.id.startsWith("med-") &&
    !params.variation.id.startsWith("urban-") &&
    !params.variation.id.startsWith("female-")
      ? variationProfileFromBlueprint(discoveryBlueprint, brandArchetype)
      : variation;

  const identity = useArchetypes
    ? formatIdentityDnaPrompt(brandArchetype, identityDna)
    : buildIdentityLockBlock(
        params.project,
        effectiveVariation,
        params.candidateNumber,
      );

  const genderEnforcement = useArchetypes
    ? genderEnforcementBlock(brandArchetype)
    : `Gender presentation: ${params.project.gender_presentation || "Male"}.`;

  const biologicalIdentity = discoveryBlueprint
    ? formatBlueprintIdentityPrompt(discoveryBlueprint)
    : "";

  const ageBody = discoveryBlueprint
    ? [
        "3. AGE AND BODY STRUCTURE",
        `Age feel: ${discoveryBlueprint.ageRange}.`,
        `Body: ${discoveryBlueprint.bodyStructure}.`,
        "Photoreal adult proportions only — never childlike, never bodybuilder.",
      ].join("\n")
    : "";

  const appearance = discoveryBlueprint
    ? [
        "AUTHENTIC HUMAN APPEARANCE (from candidate blueprint)",
        `Skin: ${discoveryBlueprint.skinTone}.`,
        "Allow visible but subtle skin texture, natural pores, slight under-eye detail, mild asymmetry.",
        "Photoreal adult human — not porcelain beauty skin.",
      ].join("\n")
    : useArchetypes
      ? formatArchetypeAppearancePrompt(identityDna)
      : [
          "2. AUTHENTIC HUMAN APPEARANCE",
          `Skin: ${effectiveVariation.skinTone}.`,
          "Allow visible but subtle skin texture, natural pores, slight under-eye detail, minor asymmetry.",
          "Photoreal adult human — not porcelain beauty skin.",
        ].join("\n");

  const presence = discoveryBlueprint
    ? [
        "4. EXPRESSION AND PRESENCE",
        `Expression: ${discoveryBlueprint.expression}.`,
        `Styling presence: ${discoveryBlueprint.stylingDirection}.`,
        formatArchetypePresencePrompt(identityDna),
      ].join("\n")
    : useArchetypes
      ? formatArchetypePresencePrompt(identityDna)
      : [
          "3. CALM / FRIENDLY COMMERCIAL PRESENCE",
          `Expression: ${effectiveVariation.expression}.`,
          `Posture: ${effectiveVariation.posture}.`,
          `Social presence: ${effectiveVariation.socialPresence}.`,
        ].join("\n");

  const brandDna = formatBrandMemoryForPersona(brandMemory, {
    lifestyleDirection: params.project.fashion_style,
    brandRole: params.project.brand_role,
    visualKeywords: params.project.visual_keywords,
    preferredBrandLooks: params.project.preferred_brand_looks,
    creativeNotes: params.project.additional_description,
  });
  const wardrobe = formatBrandMemoryWardrobeForPersona(brandMemory, {
    candidateWardrobe: effectiveVariation.wardrobe,
    briefOutfitCue: params.project.preferred_outfits,
    productWardrobeConstraints:
      formatProductWardrobeConstraintsForPersona(productCatalog),
  });
  const referenceDirection = formatPersonaReferenceDirection(referenceCatalog);
  const camera = framingForAsset(params.assetType, brandMemory);
  const lighting = buildEnvironmentLightingBlock(
    effectiveVariation,
    brandMemory,
    useArchetypes ? brandArchetype : undefined,
  );
  const variationBlock = discoveryBlueprint
    ? [
        `CANDIDATE BLUEPRINT — ${discoveryBlueprint.name} (Slot ${discoveryBlueprint.slot})`,
        `Aesthetic: ${effectiveVariation.aesthetic}.`,
        ...effectiveVariation.promptLines,
        formatArchetypeDirectionPrompt(brandArchetype),
      ].join("\n")
    : useArchetypes
      ? formatArchetypeDirectionPrompt(brandArchetype)
      : [
          `CANDIDATE DIRECTION — Candidate ${params.candidateNumber}: ${effectiveVariation.label}`,
          `Aesthetic: ${effectiveVariation.aesthetic}.`,
          ...effectiveVariation.promptLines,
        ].join("\n");
  const editorialRules = formatBrandMemoryEditorialForPersona(brandMemory);
  const premiumCasting = useArchetypes
    ? [
        premiumArchetypeCastingBlock(brandArchetype),
        "",
        premiumFashionPresenceBlock(),
      ].join("\n")
    : premiumFashionPresenceBlock();
  const negative = buildNegativePrompt(
    params.project,
    brandMemory,
    useArchetypes ? brandArchetype : undefined,
  );

  const runVariation = runVariationToken
    ? [
        "DISCOVERY RUN VARIATION",
        `Discovery variation token: ${runVariationToken}`,
        "Keep identity requirements fixed. Allow only small non-identity styling/light nuance for this run.",
      ].join("\n")
    : "";

  const lifestyle = [
    "LUXURY CAMPAIGN CASTING CONTEXT",
    `Archetype: ${brandArchetype.name}.`,
    `Aesthetic: ${effectiveVariation.aesthetic}.`,
    `${brandMemory.brandName} — premium international streetwear editorial — campaign-ready Brand Face.`,
    `Campaign role: ${brandArchetype.campaignRole}.`,
    "Editorial fashion presence with authentic modern energy — reusable across Image, Video, Shopify and campaigns for years.",
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
    premiumCasting,
    genderEnforcement,
    biologicalIdentity,
    ageBody,
    runVariation,
    negative,
    lifestyle,
  };

  const prompt = officialBrandFace
    ? [
        // 1. strict archetype + gender lock
        blocks.identity,
        blocks.genderEnforcement,
        blocks.premiumCasting,
        // 2. candidate-specific biological identity blueprint
        blocks.biologicalIdentity,
        blocks.appearance,
        // 3. age and body
        blocks.ageBody,
        // 4. expression and presence
        blocks.presence,
        // 5. Brand Memory
        blocks.brandDna,
        // 6. Product Intelligence wardrobe
        blocks.wardrobe,
        // 7. reference direction
        blocks.referenceDirection,
        // 8. camera
        blocks.camera,
        // 9. lighting / background
        blocks.lighting,
        blocks.variation,
        blocks.editorialRules,
        // run token (non-identity)
        blocks.runVariation,
        // 10. negatives appended via composeProviderPrompt
        params.premiumRetrySuffix ?? "",
      ]
        .filter((block) => block.trim().length > 0)
        .join("\n\n")
    : [
        blocks.identity,
        blocks.genderEnforcement,
        blocks.premiumCasting,
        blocks.appearance,
        blocks.presence,
        blocks.brandDna,
        blocks.wardrobe,
        blocks.referenceDirection,
        blocks.camera,
        blocks.lighting,
        blocks.variation,
        blocks.editorialRules,
        params.premiumRetrySuffix ?? "",
      ]
        .filter((block) => block.trim().length > 0)
        .join("\n\n");

  const fingerprint = promptFingerprint(prompt);
  if (discoveryBlueprint && runVariationToken) {
    logDiscoveryBlueprintTrace({
      archetypeId: brandArchetype.id,
      blueprintId: discoveryBlueprint.id,
      promptFingerprint: fingerprint,
      creationProjectId: params.project.id,
      requiredGender: requiredGenderForArchetype(brandArchetype),
    });
  }

  return {
    blocks,
    prompt,
    negativePrompt: negative,
    variation: effectiveVariation,
    identityLock: identity,
    brandMemory,
    productIntelligence,
    referenceIntelligence,
    brandArchetype,
    identityDna,
    brandArchetypeSnapshot,
    discoveryBlueprint,
    promptFingerprint: fingerprint,
    runVariationToken,
    officialBrandFace,
  };
}

/** Compose final provider string (prompt + negative). */
export function composeProviderPrompt(built: BuiltCandidatePrompt): string {
  return `${built.prompt}\n\nAvoid: ${built.negativePrompt}`;
}

/**
 * Resolve casting identities for an Official Brand Face A1 batch.
 * Replaces global CANDIDATE_VARIATION_PROFILES for OBF projects.
 */
export function resolveOfficialDiscoveryVariations(input: {
  project: PersonaCreationProject;
  candidateNumbers: number[];
  archetypeCatalog?: BrandArchetypeCatalog;
}): {
  officialBrandFace: boolean;
  archetype: BrandArchetype | null;
  blueprints: ArchetypeCandidateBlueprint[];
  variations: CandidateVariationProfile[];
  runVariationToken: string | null;
} {
  const catalog =
    input.archetypeCatalog ??
    loadBrandArchetypeCatalog(input.project.workspace_id);
  const archetypeId = parseArchetypeIdFromProjectDescription(
    input.project.description,
  );
  if (!archetypeId) {
    return {
      officialBrandFace: false,
      archetype: null,
      blueprints: [],
      variations: input.candidateNumbers.map((n) => resolveCandidateVariation(n)),
      runVariationToken: null,
    };
  }
  const archetype = catalog.archetypes.find((a) => a.id === archetypeId) ?? null;
  if (!archetype) {
    throw new Error(`Official Brand Face archetype missing: ${archetypeId}`);
  }
  const blueprints = input.candidateNumbers.map((n) => {
    const blueprint = resolveDiscoveryBlueprint({
      archetypeId: archetype.id,
      candidateNumber: n,
    });
    assertBlueprintGenderMatchesArchetype(blueprint, archetype);
    return blueprint;
  });
  assertDiscoveryCastBlueprintsUnique(
    listDiscoveryBlueprintsForArchetype(archetype.id),
  );
  return {
    officialBrandFace: true,
    archetype,
    blueprints,
    variations: blueprints.map((b) =>
      variationProfileFromBlueprint(b, archetype),
    ),
    runVariationToken: discoveryRunVariationToken(input.project.id),
  };
}
