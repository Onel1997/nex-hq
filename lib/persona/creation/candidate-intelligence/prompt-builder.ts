/**
 * Modular prompt composition for Persona Stage-A casting.
 *
 * Official Brand Face A1 discovery priority (Phase 2.1B):
 * 1. archetype and gender constraints
 * 2. L3 Discovery Identity Instance anatomy (only exact person source)
 * 3. age and body direction
 * 4. presence / expression family
 * 5. Brand Memory
 * 6. Product Intelligence wardrobe constraints
 * 7. reference direction
 * 8. camera and framing
 * 9. lighting and background
 * 10. negative constraints
 *
 * Legacy generic Persona Creator may still use variation recipes.
 * OBF must never inject legacy absolute biology.
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
  formatBlueprintGarmentPrompt,
  formatBlueprintIdentityPrompt,
  formatDiscoveryDiversityBrief,
  formatFashionCastingProfilePrompt,
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
  IdentityBlueprintError,
  type DiscoveryIdentityInstance,
  type SlotBlueprint,
} from "@/lib/persona/identity-blueprints";
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
  assertObfPromptHasNoLegacyBiology,
  formatObfAgeBodyDirectionPrompt,
  formatObfArchetypeConstraintsPrompt,
  formatObfCastingSetPrompt,
  formatObfGarmentDirectionPrompt,
  formatObfPresenceFamilyPrompt,
  isObfL3DebugEnabled,
  resolveObfDiscoveryIdentity,
  type DiscoveryIdentityL3Debug,
  type DiscoveryIdentityL3Metadata,
} from "./obf-l3-integration";
import {
  resolveCandidateVariation,
  type CandidateVariationProfile,
} from "./variations";
import {
  a1CastingCompositionBlock,
  a1CastingPhotographyBlock,
  a1PresenceRulesBlock,
  genderEnforcementBlock,
  premiumArchetypeCastingBlock,
  premiumFashionPresenceBlock,
  premiumNegativePromptAdditions,
  premiumPhotographyBlock,
} from "./premium-casting-direction";

export interface PromptBlocks {
  /** 1 — Identity DNA / archetype constraints */
  identity: string;
  /** 2 — Authentic human appearance (legacy / non-OBF) */
  appearance: string;
  /** 3 — Commercial presence */
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
  /** Premium editorial casting direction */
  premiumCasting: string;
  /** Strict gender role enforcement */
  genderEnforcement: string;
  /** L3 Discovery Identity Instance anatomy (OBF) — only exact person source */
  biologicalIdentity: string;
  /** @deprecated Phase 2.1B — empty for OBF live prompts */
  diversityBrief: string;
  /** Age / body lane constraints */
  ageBody: string;
  /** Presence / fashion casting (non-anatomy for OBF) */
  fashionCasting: string;
  /** Per-candidate Product Intelligence garment */
  garmentDirection: string;
  /** A1 presence / anti-aggression rules */
  presenceRules: string;
  /** @deprecated Phase 2.1B — empty for OBF (no identity-lock run token) */
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
  brandArchetype: BrandArchetype;
  identityDna: IdentityDna;
  brandArchetypeSnapshot: BrandArchetypeSnapshot;
  /** Legacy blueprint bridge / metadata for OBF. */
  discoveryBlueprint: ArchetypeCandidateBlueprint | null;
  /** Phase 2.1B — L2 casting lane for OBF. */
  slotBlueprint: SlotBlueprint | null;
  /** Phase 2.1B — sampled L3 person for this run/attempt. */
  discoveryIdentityInstance: DiscoveryIdentityInstance | null;
  /** Phase 2.1B — safe L3 metadata for persistence. */
  discoveryIdentityMetadata: DiscoveryIdentityL3Metadata | null;
  /** Phase 2.1B — development-only L3 debug (never full prompt). */
  discoveryIdentityDebug: DiscoveryIdentityL3Debug | null;
  promptFingerprint: string;
  runVariationToken: string | null;
  officialBrandFace: boolean;
  /** Identity attempt used for L3 sampling (OBF). */
  identityAttemptNumber: number;
}

function framingForAsset(
  assetType: CandidateAssetType,
  memory: BrandMemory,
  options?: {
    discoveryBlueprint?: ArchetypeCandidateBlueprint | null;
    officialBrandFace?: boolean;
  },
): string {
  const fitLabel = memory.fit.labels[0] ?? "premium";
  const brandFit = `${fitLabel.toLowerCase()} ${memory.brandName} streetwear fit`;
  const discoveryBlueprint = options?.discoveryBlueprint;
  const officialBrandFace = options?.officialBrandFace === true;

  switch (assetType) {
    case "portrait_front":
      return [
        a1CastingCompositionBlock(),
        discoveryBlueprint
          ? `Posture for this slot: ${discoveryBlueprint.fashionCasting.postureDirection}.`
          : "Relaxed shoulders, slight body rotation — never passport-square.",
        officialBrandFace
          ? "Photorealistic premium skin texture with natural pores."
          : "Photorealistic premium skin texture with natural pores. Same identity across all angles.",
      ].join("\n");
    case "portrait_three_quarter":
      return [
        "CAMERA — Stage A Three Quarter Portrait",
        "True 30–45 degree body/face turn — not a near-copy of the front frame.",
        "Upper torso and shoulders still fully visible — same casting-editorial crop family.",
        "Same person as THIS candidate's front portrait. Natural gaze. Slight posture variation.",
        officialBrandFace
          ? "Change only angle and subtle stance for THIS candidate."
          : "Keep identity locked. Change only angle and subtle stance.",
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
      return `CAMERA — ${memory.brandName} streetwear casting portrait for THIS candidate only.`;
  }
}

/**
 * Legacy variation-based identity lock — only used when archetype inject is disabled.
 * Must never be used for Official Brand Face discovery.
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
  options?: {
    discoveryBlueprint?: ArchetypeCandidateBlueprint | null;
    obfCastingSet?: string;
  },
): string {
  const castingSet =
    options?.obfCastingSet ??
    (options?.discoveryBlueprint
      ? a1CastingPhotographyBlock(options.discoveryBlueprint)
      : [
          "7–8. CONTROLLED NEUTRAL CASTING ENVIRONMENT",
          `Background (candidate-specific): ${variation.background}.`,
          `Light: ${archetype?.lightingDirection ?? variation.lighting}.`,
        ].join("\n"));

  return [
    premiumPhotographyBlock(),
    "",
    castingSet,
    "Keep Stage A controlled and neutral — not a campaign location.",
    "No streets, cafés, parking garages, shops, clothing racks, cars, or product sets.",
    `Photography direction: ${archetype?.photographyDirection ?? memory.photographyStyle}`,
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
    "passport photo, ID-card portrait, employee headshot, LinkedIn profile photo,",
    "casting-database mugshot, expressionless mugshot, flat centered framing, stiff squared shoulders,",
    "head-only crop, cropped shoulders, ordinary random person, bland stock-model face,",
    "bodybuilder physique, fitness influencer, over-groomed hair, perfectly combed slick business hair,",
    "identical beige background, beauty ring light, dramatic fashion lighting, harsh intimidation shadows,",
    "street cafe campaign scene, parking garage, clothing rack set, product mockup, group shot,",
    "broad commercial smile, flashy jewelry, visible brand logos, loud prints, luxury watch,",
    "invented product, third-party branding, jewelry focus, wrong gender,",
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
 * Official Brand Face: L3 DiscoveryIdentityInstance is the only exact anatomy source (Phase 2.1B).
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
  /** Phase 2.1B — durable generation run id (defaults to project.id for tests). */
  generationRunId?: string;
  /** Phase 2.1B — L3 sampling attempt (novelty-block retry increments). Default 1. */
  attemptNumber?: number;
  /** Phase 2.1E — prior attempt anatomy for anti-repeat. */
  previousAttemptSample?: Partial<
    Record<import("@/lib/persona/identity-blueprints").ControlledPoolKey, string>
  > | null;
  /** Phase 2.1E — same-run matched slot anatomy to avoid. */
  avoidSameRunSample?: Partial<
    Record<import("@/lib/persona/identity-blueprints").ControlledPoolKey, string>
  > | null;
  /** Phase 2.1B — optional pre-sampled L3 instance. */
  discoveryIdentityInstance?: DiscoveryIdentityInstance;
  /** Phase 2.1B — optional pre-resolved L2 lane. */
  slotBlueprint?: SlotBlueprint;
  /** When false, fall back to legacy variation recipes (tests only). Default true. */
  useBrandArchetypes?: boolean;
  /** Internal quality-regeneration suffix (Phase 1.8A). */
  premiumRetrySuffix?: string;
  /** Optional fixed timestamp for reproducible L3 sampling in tests. */
  identitySampledAt?: string;
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
  const identityAttemptNumber = params.attemptNumber ?? 1;
  const generationRunId =
    params.generationRunId?.trim() || params.project.id;

  let brandArchetype: BrandArchetype;
  let discoveryBlueprint: ArchetypeCandidateBlueprint | null = null;
  let runVariationToken: string | null = null;
  let slotBlueprint: SlotBlueprint | null = null;
  let discoveryIdentityInstance: DiscoveryIdentityInstance | null = null;
  let discoveryIdentityMetadata: DiscoveryIdentityL3Metadata | null = null;
  let discoveryIdentityDebug: DiscoveryIdentityL3Debug | null = null;
  let obfAnatomyBlock = "";
  let obfAgeBody = "";
  let obfPresence = "";
  let obfGarment = "";
  let obfCastingSet = "";
  let obfIdentityConstraints = "";

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

    const resolved = resolveObfDiscoveryIdentity({
      archetypeId: brandArchetype.id,
      candidateNumber: params.candidateNumber,
      creationProjectId: params.project.id,
      generationRunId,
      attemptNumber: identityAttemptNumber,
      discoveryIdentityInstance: params.discoveryIdentityInstance,
      slotBlueprint: params.slotBlueprint,
      sampledAt: params.identitySampledAt,
      previousAttemptSample: params.previousAttemptSample,
      avoidSameRunSample: params.avoidSameRunSample,
    });
    slotBlueprint = resolved.slotBlueprint;
    discoveryIdentityInstance = resolved.discoveryIdentityInstance;
    discoveryIdentityMetadata = resolved.metadata;
    discoveryIdentityDebug = isObfL3DebugEnabled() ? resolved.debug : null;
    obfAnatomyBlock = resolved.anatomyPromptBlock;
    obfAgeBody = formatObfAgeBodyDirectionPrompt(
      resolved.slotBlueprint,
      resolved.discoveryIdentityInstance,
    );
    obfPresence = formatObfPresenceFamilyPrompt(
      getIdentityDnaForArchetype(archetypeCatalog, brandArchetype),
      resolved.slotBlueprint,
      resolved.discoveryIdentityInstance,
    );
    obfGarment = formatObfGarmentDirectionPrompt(
      resolved.slotBlueprint,
      resolved.discoveryIdentityInstance,
    );
    obfCastingSet = formatObfCastingSetPrompt(
      resolved.slotBlueprint,
      resolved.discoveryIdentityInstance,
    );
    obfIdentityConstraints = formatObfArchetypeConstraintsPrompt(
      brandArchetype,
      getIdentityDnaForArchetype(archetypeCatalog, brandArchetype),
      resolved.slotBlueprint,
    );
  } else if (useArchetypes) {
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

  if (officialBrandFace && !discoveryIdentityInstance) {
    throw new IdentityBlueprintError(
      "Official Brand Face discovery requires an L3 DiscoveryIdentityInstance before provider prompt composition",
    );
  }

  // Guard: OBF must never use legacy absolute identity-lock biology as the anatomy source.
  if (officialBrandFace && params.useBrandArchetypes === false) {
    throw new IdentityBlueprintError(
      "Official Brand Face cannot use legacy variation biology (useBrandArchetypes=false)",
    );
  }

  const identity = officialBrandFace
    ? obfIdentityConstraints
    : useArchetypes
      ? formatIdentityDnaPrompt(brandArchetype, identityDna)
      : buildIdentityLockBlock(
          params.project,
          effectiveVariation,
          params.candidateNumber,
        );

  if (officialBrandFace && /Lock this Identity DNA|do not invent a different person/i.test(identity)) {
    throw new IdentityBlueprintError(
      "Official Brand Face identity constraints unexpectedly contain legacy identity-lock wording",
    );
  }

  const genderEnforcement = useArchetypes
    ? genderEnforcementBlock(brandArchetype)
    : `Gender presentation: ${params.project.gender_presentation || "Male"}.`;

  // Phase 2.1B: OBF uses L3 anatomy only — legacy blueprint biology / diversity brief bypassed.
  const biologicalIdentity = officialBrandFace
    ? obfAnatomyBlock
    : discoveryBlueprint
      ? formatBlueprintIdentityPrompt(discoveryBlueprint)
      : "";

  const diversityBrief =
    officialBrandFace
      ? ""
      : discoveryBlueprint
        ? formatDiscoveryDiversityBrief({
            archetypeId: brandArchetype.id,
            slot: discoveryBlueprint.slot,
          })
        : "";

  const ageBody = officialBrandFace
    ? obfAgeBody
    : discoveryBlueprint
      ? [
          "3. AGE AND BODY STRUCTURE",
          `Age feel: ${discoveryBlueprint.ageRange}.`,
          `Body: ${discoveryBlueprint.bodyStructure}.`,
          `Height / build direction: ${discoveryBlueprint.fashionCasting.modelHeightDirection}; ${discoveryBlueprint.fashionCasting.modelBuild}.`,
          "Photoreal adult fashion-model proportions only — never childlike, never bodybuilder, never ordinary desk-job frame.",
        ].join("\n")
      : "";

  const fashionCasting = officialBrandFace
    ? ""
    : discoveryBlueprint
      ? formatFashionCastingProfilePrompt(discoveryBlueprint)
      : "";

  const garmentDirection = officialBrandFace
    ? obfGarment
    : discoveryBlueprint
      ? formatBlueprintGarmentPrompt(discoveryBlueprint)
      : "";

  const presenceRules = a1PresenceRulesBlock();

  // OBF: exact skin/anatomy lives in L3 only — do not restate blueprint skin.
  const appearance = officialBrandFace
    ? [
        "AUTHENTIC HUMAN APPEARANCE",
        "Allow visible but subtle skin texture, natural pores, slight under-eye detail, mild asymmetry.",
        "Realistic facial hair texture when specified — never fake beard, never beauty-filter skin.",
        "Photoreal adult human — not porcelain beauty skin, not waxy AI clone.",
        "Exact facial anatomy is defined only in the Discovery Identity Instance (L3) block.",
      ].join("\n")
    : discoveryBlueprint
      ? [
          "AUTHENTIC HUMAN APPEARANCE (from candidate blueprint)",
          `Skin: ${discoveryBlueprint.skinTone}.`,
          "Allow visible but subtle skin texture, natural pores, slight under-eye detail, mild asymmetry.",
          "Realistic facial hair texture when specified — never fake beard, never beauty-filter skin.",
          "Photoreal adult human — not porcelain beauty skin, not waxy AI clone.",
        ].join("\n")
      : useArchetypes
        ? formatArchetypeAppearancePrompt(identityDna)
        : [
            "2. AUTHENTIC HUMAN APPEARANCE",
            `Skin: ${effectiveVariation.skinTone}.`,
            "Allow visible but subtle skin texture, natural pores, slight under-eye detail, minor asymmetry.",
            "Photoreal adult human — not porcelain beauty skin.",
          ].join("\n");

  const presence = officialBrandFace
    ? obfPresence
    : discoveryBlueprint
      ? [
          "4. EXPRESSION AND PRESENCE",
          `Expression: ${discoveryBlueprint.expression}.`,
          `Fashion presence: ${discoveryBlueprint.fashionCasting.fashionPresence}.`,
          `Micro-expression: ${discoveryBlueprint.fashionCasting.microExpression}.`,
          `Camera presence: ${discoveryBlueprint.fashionCasting.cameraPresence}.`,
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
  const camera = framingForAsset(params.assetType, brandMemory, {
    discoveryBlueprint,
    officialBrandFace,
  });
  const lighting = buildEnvironmentLightingBlock(
    effectiveVariation,
    brandMemory,
    useArchetypes ? brandArchetype : undefined,
    officialBrandFace
      ? { obfCastingSet }
      : { discoveryBlueprint },
  );

  // OBF: do not inject legacy identityDescriptor / permanent anatomy promptLines.
  const variationBlock = officialBrandFace
    ? [
        `CASTING LANE — ${slotBlueprint!.name} (Slot ${slotBlueprint!.slot})`,
        `Fashion direction: ${slotBlueprint!.fashionDirection}.`,
        `Brand role: ${slotBlueprint!.brandRole}.`,
        formatArchetypeDirectionPrompt(brandArchetype),
        "Exact facial anatomy is defined only in the Discovery Identity Instance (L3) block.",
      ].join("\n")
    : discoveryBlueprint
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

  // Phase 2.1B: remove identity-lock run token from OBF discovery.
  const runVariation = "";

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
    diversityBrief,
    ageBody,
    fashionCasting,
    garmentDirection,
    presenceRules,
    runVariation,
    negative,
    lifestyle,
  };

  const prompt = officialBrandFace
    ? [
        // 1. archetype + gender constraints
        blocks.identity,
        blocks.genderEnforcement,
        blocks.premiumCasting,
        // 2. L3 Discovery Identity Instance — only exact anatomy source
        blocks.biologicalIdentity,
        blocks.appearance,
        // 3. age and body direction
        blocks.ageBody,
        // 4. presence / expression family
        blocks.presence,
        blocks.presenceRules,
        // 5. Brand Memory
        blocks.brandDna,
        // 6. Product Intelligence wardrobe + garment
        blocks.wardrobe,
        blocks.garmentDirection,
        // 7. reference direction (optional)
        blocks.referenceDirection,
        // 8. camera
        blocks.camera,
        // 9. lighting / background
        blocks.lighting,
        blocks.variation,
        blocks.editorialRules,
        params.premiumRetrySuffix ?? "",
      ]
        .filter((block) => block.trim().length > 0)
        .join("\n\n")
    : [
        blocks.identity,
        blocks.genderEnforcement,
        blocks.premiumCasting,
        blocks.diversityBrief,
        blocks.biologicalIdentity,
        blocks.appearance,
        blocks.ageBody,
        blocks.fashionCasting,
        blocks.presence,
        blocks.presenceRules,
        blocks.brandDna,
        blocks.wardrobe,
        blocks.garmentDirection,
        blocks.referenceDirection,
        blocks.camera,
        blocks.lighting,
        blocks.variation,
        blocks.editorialRules,
        blocks.runVariation,
        params.premiumRetrySuffix ?? "",
      ]
        .filter((block) => block.trim().length > 0)
        .join("\n\n");

  if (officialBrandFace) {
    assertObfPromptHasNoLegacyBiology(prompt, "OBF discovery prompt");
    if (!/Generate a new individual inside this casting lane\./i.test(prompt)) {
      throw new IdentityBlueprintError(
        "OBF discovery prompt missing required L3 new-individual wording",
      );
    }
    if (!discoveryIdentityInstance) {
      throw new IdentityBlueprintError(
        "Missing L3 DiscoveryIdentityInstance — refusing provider prompt",
      );
    }
  }

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
    slotBlueprint,
    discoveryIdentityInstance,
    discoveryIdentityMetadata,
    discoveryIdentityDebug,
    promptFingerprint: fingerprint,
    runVariationToken,
    officialBrandFace,
    identityAttemptNumber,
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
