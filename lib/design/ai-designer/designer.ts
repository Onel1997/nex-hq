import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import {
  decideFromKnowledge,
  queryFromBrief,
  type CreativeDirectorDecision,
} from "@/lib/design/design-knowledge/art-direction/creative-director";
import { decideEmotionalDirection } from "@/lib/design/design-knowledge/emotional-language";
import { decideHeroTypographyDirection } from "@/lib/design/design-knowledge/hero-typography";
import { decideWearabilityDirection } from "@/lib/design/design-knowledge/wearability";
import {
  attachPromptsToConcept,
  generateDesignConcept,
} from "@/lib/design/ai-designer/concept-generator";
import { buildAllPrompts } from "@/lib/design/ai-designer/prompt-builder";
import { buildRenderPlan } from "@/lib/design/ai-designer/render-plan";
import { reviewDesignConcept } from "@/lib/design/ai-designer/review";
import type {
  AiDesignerInput,
  AiDesignerResult,
  CommercialDirectionInput,
  DesignConcept,
} from "@/lib/design/ai-designer/types";
import { hashString } from "@/lib/design/vector-engine/hash";

function resolveSeed(input: AiDesignerInput, brief: DesignStudioBrief): number {
  if (input.seed !== undefined) return input.seed;
  return hashString(brief.designId) % 10000;
}

function resolveBrief(input: AiDesignerInput): DesignStudioBrief {
  if (input.brief) return input.brief;
  throw new Error("AiDesignerInput requires a DesignStudioBrief");
}

function resolveCreativeDirector(
  input: AiDesignerInput,
  brief: DesignStudioBrief,
  seed: number,
): CreativeDirectorDecision {
  if (input.creativeDirector) return input.creativeDirector;
  return decideFromKnowledge(queryFromBrief(brief, seed));
}

function resolveCommercialDirection(
  brief: DesignStudioBrief,
  input?: CommercialDirectionInput,
): CommercialDirectionInput {
  return (
    input ?? {
      role: brief.role,
      intention: brief.campaignPotential ?? "premium streetwear drop",
      campaignPotential: brief.campaignPotential,
    }
  );
}

/**
 * AI Designer — primary creative engine.
 *
 * Creates premium design concepts (blueprints), NOT SVG or images.
 * Image Studio, Commercial Director, and SVG pipeline consume downstream.
 */
export function runAiDesigner(input: AiDesignerInput): AiDesignerResult {
  const brief = input.brief ?? resolveBrief(input);
  const seed = resolveSeed(input, brief);

  const creativeDirector = resolveCreativeDirector(input, brief, seed);
  const emotion = input.emotion ?? decideEmotionalDirection(brief, seed);
  const wearability = input.wearability ?? decideWearabilityDirection(brief, seed);
  const typographyDirection =
    input.typographyDirection ?? decideHeroTypographyDirection(brief, seed, wearability);
  const commercialDirection = resolveCommercialDirection(brief, input.commercialDirection);
  const collectionMood = input.mood ?? input.collection?.mood ?? creativeDirector.collection.name;

  let concept: DesignConcept = generateDesignConcept({
    brief,
    creativeDirector,
    emotion,
    wearability,
    typographyDirection,
    commercialDirection,
    collectionMood,
  });

  const prompts = buildAllPrompts(concept);
  concept = attachPromptsToConcept(concept, prompts.imagePrompt, prompts.mockupPrompt);

  const renderPlan = buildRenderPlan(concept);
  const review = reviewDesignConcept(concept);

  console.log(
    `[AI DESIGNER] Concept "${concept.title}" — confidence ${concept.confidence} · review ${review.score}/100 · imageStudio=${review.readyForImageStudio}`,
  );

  return {
    concept,
    renderPlan,
    review,
    resolved: {
      creativeDirector,
      emotion,
      wearability,
      typographyDirection,
    },
  };
}

/** Generate concept only — without render plan or review. */
export function createDesignConcept(input: AiDesignerInput): DesignConcept {
  return runAiDesigner(input).concept;
}

/** Convert DesignConcept to a DesignStudioBrief for legacy SVG pipeline compatibility. */
export function conceptToStudioBrief(concept: DesignConcept): DesignStudioBrief {
  return {
    designId: concept.designId,
    title: concept.title,
    role: concept.commercialIntention.role,
    product: concept.product,
    color: concept.color,
    printArea: concept.printArea,
    placement: concept.compositionLanguage.placement,
    dimensions: concept.productionNotes.dimensions,
    visualConcept: concept.creativeDirection.summary,
    designDescription: concept.creativeDirection.visualIntent,
    geometry: concept.symbolLanguage.secondaryGeometry.join(", "),
    visualElements: [
      ...concept.symbolLanguage.primarySymbols,
      ...concept.typographyLanguage.behaviors,
    ],
    typography: concept.typographyLanguage.headlineTreatment,
    colorPalette: concept.productionNotes.colorCount.includes("2")
      ? [
          { name: concept.color, usage: "base garment" },
          { name: "Print ink", usage: "print ink" },
        ]
      : [{ name: concept.color, usage: "base garment" }],
    productionMethod: concept.productionNotes.method,
    materialEffects: concept.productionNotes.materialEffects,
    negativeSpaceRules: concept.negativeSpaceProfile.rules.join("; "),
    designerInstructions: concept.productionNotes.qualityGates,
    svgPrompt: concept.imagePrompt.primary.slice(0, 200),
    mockupPrompt: concept.mockupPrompt.primary,
    imagePrompt: concept.imagePrompt.primary,
    printReadinessScore: 80,
    dnaScore: concept.confidence,
    commercialScore: concept.confidence,
    campaignPotential: concept.commercialIntention.campaignPotential,
  };
}
