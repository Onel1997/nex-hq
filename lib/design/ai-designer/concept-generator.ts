import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { CreativeDirectorDecision } from "@/lib/design/design-knowledge/art-direction/creative-director";
import type { EmotionalDirectorDecision } from "@/lib/design/design-knowledge/emotional-language/types";
import type {
  CommercialIntentionSpec,
  DesignConcept,
  HeroFocusSpec,
  NegativeSpaceProfileSpec,
  ProductionNotesSpec,
} from "@/lib/design/ai-designer/types";
import { buildBrandDnaProfile } from "@/lib/design/ai-designer/brand-dna";
import { buildCompositionLanguage } from "@/lib/design/ai-designer/composition-builder";
import { buildFashionLanguage } from "@/lib/design/ai-designer/fashion-language";
import {
  buildCreativeDirection,
  buildOrnamentLanguage,
  buildSymbolLanguage,
  buildTypographyLanguage,
} from "@/lib/design/ai-designer/style-builder";
import { getEmotionalLanguage } from "@/lib/design/design-knowledge/emotional-language/emotion-library";
import type { HeroTypographyDirectorDecision } from "@/lib/design/design-knowledge/hero-typography/types";
import type { WearabilityDirectorDecision } from "@/lib/design/design-knowledge/wearability";
import type { CommercialDirectionInput } from "@/lib/design/ai-designer/types";

function buildNegativeSpaceProfile(
  brief: DesignStudioBrief,
  creativeDirector: CreativeDirectorDecision,
  emotion?: EmotionalDirectorDecision,
): NegativeSpaceProfileSpec {
  const emotional = emotion ? getEmotionalLanguage(emotion.primary) : null;
  const profile = emotional?.negativeSpaceProfile ?? "elevated";
  const minVoid = creativeDirector.composition.negativeSpaceMin;

  return {
    profile,
    targetRatio: `${Math.round(minVoid * 100)}% minimum void around focal system`,
    rules: [
      brief.negativeSpaceRules,
      "luxury lives in what you do not fill",
      "one focal relationship — not competing heroes",
    ],
    breathingZones: [
      "perimeter safe zone on garment",
      "between headline and symbol frame",
      "below micro subline / coordinates",
    ],
  };
}

function buildHeroFocus(
  brief: DesignStudioBrief,
  creativeDirector: CreativeDirectorDecision,
  heroDirection?: HeroTypographyDirectorDecision,
): HeroFocusSpec {
  const isStatement =
    brief.role.toLowerCase().includes("statement") ||
    brief.role.toLowerCase().includes("hero");

  const scrollHook = isStatement
    ? "cropped hero typography with premium tension — feed scroll-stop"
    : "quiet emblem focal with premium whitespace";

  return {
    focalPoint: brief.designDescription.split(".")[0] ?? brief.title,
    scrollStopHook: scrollHook,
    dominantElement: heroDirection
      ? `${heroDirection.direction} typography system`
      : "editorial headline typography",
    supportingElements: [
      ...brief.visualElements.slice(0, 4),
      brief.geometry.split(",")[0]?.trim() ?? "structural symbol frame",
    ].filter(Boolean),
  };
}

function buildDesignStory(
  brief: DesignStudioBrief,
  creativeDirector: CreativeDirectorDecision,
  brandDna: ReturnType<typeof buildBrandDnaProfile>,
): string {
  const lines = [
    `${brief.title} belongs to ${creativeDirector.collection.name}.`,
    brief.visualConcept,
    brief.designDescription,
    `Brand alignment: ${brandDna.emotionalGoals.join(" · ")}.`,
    `The piece reads as premium streetwear at garment scale — not a logo mark.`,
  ];
  return lines.join(" ");
}

function buildCommercialIntention(
  brief: DesignStudioBrief,
  commercial?: CommercialDirectionInput,
): CommercialIntentionSpec {
  const role = commercial?.role ?? brief.role;
  const isHero = role.toLowerCase().includes("hero") || role.toLowerCase().includes("statement");

  return {
    role,
    priceBand: commercial?.priceBand ?? "€44.90–64.90 premium streetwear",
    campaignPotential: commercial?.campaignPotential ?? brief.campaignPotential ?? "medium",
    buyerHook: isHero
      ? "scroll-stop identity piece — I need this hoodie"
      : "quiet daily rotation with premium restraint",
    wouldBuySignals: [
      "premium fashion feel",
      "editorial typography hierarchy",
      "garment-scale artwork",
      isHero ? "feed scroll-stop hook" : "weekly wearable restraint",
    ],
  };
}

function buildProductionNotes(brief: DesignStudioBrief): ProductionNotesSpec {
  return {
    method: brief.productionMethod,
    placement: `${brief.printArea} — ${brief.placement}`,
    dimensions: brief.dimensions,
    colorCount: `${brief.colorPalette.length}-color`,
    materialEffects: brief.materialEffects,
    printReadiness: [
      `Print readiness score: ${brief.printReadinessScore}/100`,
      brief.negativeSpaceRules,
    ],
    qualityGates: [
      "Commercial Director approval ≥ 90",
      "Premium restraint — no visual noise",
      "Garment-scale readability at 2m distance",
    ],
  };
}

function computeConfidence(
  creativeDirector: CreativeDirectorDecision,
  brief: DesignStudioBrief,
): number {
  let score = 58;
  if (creativeDirector.artDirection.feelsLuxury) score += 12;
  if (creativeDirector.artDirection.wouldStopScrolling) score += 10;
  if (brief.designerInstructions.length >= 2) score += 8;
  if (brief.visualElements.length >= 3) score += 6;
  if (brief.dnaScore !== undefined && brief.dnaScore >= 75) score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Synthesize a complete DesignConcept from upstream intelligence. */
export function generateDesignConcept(input: {
  brief: DesignStudioBrief;
  creativeDirector: CreativeDirectorDecision;
  emotion?: EmotionalDirectorDecision;
  wearability?: WearabilityDirectorDecision;
  typographyDirection?: HeroTypographyDirectorDecision;
  commercialDirection?: CommercialDirectionInput;
  collectionMood?: string;
}): DesignConcept {
  const {
    brief,
    creativeDirector,
    emotion,
    wearability,
    typographyDirection,
    commercialDirection,
    collectionMood,
  } = input;

  const brandDna = buildBrandDnaProfile(brief, creativeDirector);

  return {
    designId: brief.designId,
    title: brief.title,
    collection: creativeDirector.collection.name,
    product: brief.product,
    color: brief.color,
    printArea: brief.printArea,
    creativeDirection: buildCreativeDirection(
      brief,
      creativeDirector,
      emotion,
      collectionMood,
    ),
    fashionLanguage: buildFashionLanguage(brief, creativeDirector, collectionMood),
    compositionLanguage: buildCompositionLanguage(brief, creativeDirector, wearability),
    typographyLanguage: buildTypographyLanguage(brief, creativeDirector, typographyDirection),
    symbolLanguage: buildSymbolLanguage(creativeDirector, brief),
    ornamentLanguage: buildOrnamentLanguage(creativeDirector, emotion),
    negativeSpaceProfile: buildNegativeSpaceProfile(brief, creativeDirector, emotion),
    heroFocus: buildHeroFocus(brief, creativeDirector, typographyDirection),
    designStory: buildDesignStory(brief, creativeDirector, brandDna),
    commercialIntention: buildCommercialIntention(brief, commercialDirection),
    imagePrompt: { primary: "", social: "", campaign: "", tags: [] },
    mockupPrompt: { primary: "", flatLay: "", onModel: "", tags: [] },
    productionNotes: buildProductionNotes(brief),
    confidence: computeConfidence(creativeDirector, brief),
    generatedAt: new Date().toISOString(),
  };
}

/** Attach image and mockup prompts after concept skeleton is built. */
export function attachPromptsToConcept(
  concept: DesignConcept,
  imagePrompt: DesignConcept["imagePrompt"],
  mockupPrompt: DesignConcept["mockupPrompt"],
): DesignConcept {
  return { ...concept, imagePrompt, mockupPrompt };
}
