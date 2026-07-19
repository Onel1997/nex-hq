/**
 * Creative Research engine — weekly ideas + collection creator orchestration.
 */

import {
  creativeDirectionSummaryFromIdeas,
  draftNextStepForCount,
  emptyPatternEvidence,
  generateWeeklyDesignIdeas,
  buildPatternEvidenceFromTraits,
  selectedNextStep,
} from "./idea-generator";
import { generateCollectionPlan } from "./collection-generator";
import {
  DEFAULT_PROVIDER_MODE,
  buildProviderUsage,
  estimateProviderCost,
  shouldRunPatternIntelligence,
} from "./provider-mode";
import type {
  CollectionCreatorInput,
  CollectionCreatorResult,
  CreativeDirectionHandoff,
  DesignIdea,
  OptionalPatternEvidence,
  WeeklyDesignIdeasInput,
  WeeklyDesignIdeasResult,
} from "./types";
import { CREATIVE_DIRECTION_HANDOFF_MISSION } from "./types";
import type { PatternIntelligenceSection } from "../pattern-intelligence/types";
import { recordCreativeRunIdeas } from "./history-store";

export function patternEvidenceFromSection(
  section: PatternIntelligenceSection | null | undefined,
): OptionalPatternEvidence {
  if (!section || section.analyzedProductCount <= 0) {
    return emptyPatternEvidence();
  }

  const language = section.designLanguage;
  const traits = {
    colorWorld: language.colorWorld,
    placements: language.placement,
    printTechniques: language.printTechnique,
    materials: language.material,
    visualStructures: [
      ...language.graphicStyle,
      ...language.negativeSpace,
      ...language.lineWork,
    ],
    historicalNotes: section.successReasons.slice(0, 3),
  };

  const hasAny =
    traits.colorWorld.length +
      traits.placements.length +
      traits.printTechniques.length +
      traits.materials.length +
      traits.visualStructures.length +
      traits.historicalNotes.length >
    0;

  if (!hasAny) return emptyPatternEvidence();
  return buildPatternEvidenceFromTraits(traits);
}

export function runWeeklyDesignIdeasEngine(
  input: WeeklyDesignIdeasInput = {},
  options: {
    createdAt?: string;
    patternIntelligence?: PatternIntelligenceSection | null;
    connectedProviders?: string[];
    llmCalled?: boolean;
  } = {},
): WeeklyDesignIdeasResult {
  const providerMode = input.providerMode ?? DEFAULT_PROVIDER_MODE;
  const patternEvidence = shouldRunPatternIntelligence(providerMode)
    ? patternEvidenceFromSection(options.patternIntelligence)
    : emptyPatternEvidence();

  const generated = generateWeeklyDesignIdeas(input, {
    createdAt: options.createdAt,
    patternEvidence,
  });

  return {
    mode: "weekly_design_ideas",
    providerMode,
    generatorSource: generated.generatorSource,
    creativeDirectionSummary: creativeDirectionSummaryFromIdeas(generated.ideas, {
      generatorSource: generated.generatorSource,
    }),
    designIdeas: generated.ideas,
    nextStep: draftNextStepForCount(generated.ideas.length),
    diversityScore: generated.diversityScore,
    estimatedProviderCost: estimateProviderCost(providerMode, {
      llmCalled: options.llmCalled ?? false,
    }),
    providerUsage: buildProviderUsage(providerMode, {
      usedProviders: shouldRunPatternIntelligence(providerMode) ? ["shopify"] : [],
      connectedProviders: options.connectedProviders,
    }),
    selectedIdeaId: null,
  };
}

export function runCollectionCreatorEngine(
  input: CollectionCreatorInput,
  options: {
    createdAt?: string;
    patternIntelligence?: PatternIntelligenceSection | null;
    connectedProviders?: string[];
    llmCalled?: boolean;
  } = {},
): CollectionCreatorResult {
  const providerMode = input.providerMode ?? DEFAULT_PROVIDER_MODE;
  const patternEvidence = shouldRunPatternIntelligence(providerMode)
    ? patternEvidenceFromSection(options.patternIntelligence)
    : emptyPatternEvidence();

  return generateCollectionPlan(input, {
    createdAt: options.createdAt,
    patternEvidence,
    connectedProviders: options.connectedProviders,
    llmCalled: options.llmCalled,
  });
}

export function buildCreativeDirectionHandoff(
  idea: DesignIdea,
  sourceResearchRunId: string,
): CreativeDirectionHandoff {
  return {
    selectedIdeaId: idea.id,
    selectedPhrase: idea.primaryPhrase,
    designConcept: idea.designConcept,
    typographyDirection: idea.typographyDirection,
    placement: idea.placement,
    colorDirection: [
      ...idea.artworkColors,
      ...idea.recommendedGarmentColors,
    ].slice(0, 6),
    recommendedProductType: idea.recommendedProductType,
    guardrails: [
      "Nutzer erstellt finales Artwork selbst — keine Designgenerierung im Design Studio",
      "Keine Kopie bestehender Milaene-Produkte",
      idea.whyItFitsMilaene,
    ],
    forbiddenElements: [
      "Generische Motivationssprüche",
      "Überladene Full-Coverage Graphics",
      "Fremde Markenmotive",
    ],
    sourceResearchRunId,
    missionStatement: CREATIVE_DIRECTION_HANDOFF_MISSION,
    status: "awaiting_artwork_upload",
  };
}

export function selectDesignIdea(
  ideas: DesignIdea[],
  ideaId: string,
): DesignIdea[] {
  return ideas.map((idea) => ({
    ...idea,
    status:
      idea.id === ideaId
        ? "selected"
        : idea.status === "shortlisted"
          ? "shortlisted"
          : idea.status === "rejected"
            ? "rejected"
            : "draft",
  }));
}

export function applySelectionToCreativeCopy(params: {
  ideas: DesignIdea[];
  selectedIdeaId: string | null;
  generatorSource?: WeeklyDesignIdeasResult["generatorSource"];
}): {
  ideas: DesignIdea[];
  selectedIdeaId: string | null;
  creativeDirectionSummary: string;
  nextStep: string;
  handoff: CreativeDirectionHandoff | null;
} {
  const ideas = params.selectedIdeaId
    ? selectDesignIdea(params.ideas, params.selectedIdeaId)
    : params.ideas.map((idea) =>
        idea.status === "selected" ? { ...idea, status: "draft" as const } : idea,
      );
  const selected = ideas.find((idea) => idea.status === "selected") ?? null;

  if (selected) {
    recordCreativeRunIdeas(ideas, { selectedIdeaId: selected.id });
  }

  return {
    ideas,
    selectedIdeaId: selected?.id ?? null,
    creativeDirectionSummary: creativeDirectionSummaryFromIdeas(ideas, {
      selectedIdeaId: selected?.id ?? null,
      generatorSource: params.generatorSource,
    }),
    nextStep: selected
      ? selectedNextStep(selected)
      : draftNextStepForCount(ideas.length),
    handoff: null,
  };
}

export function rejectDesignIdea(ideas: DesignIdea[], ideaId: string): DesignIdea[] {
  return ideas.map((idea) =>
    idea.id === ideaId ? { ...idea, status: "rejected" as const } : idea,
  );
}

export function shortlistDesignIdea(
  ideas: DesignIdea[],
  ideaId: string,
): DesignIdea[] {
  return ideas.map((idea) =>
    idea.id === ideaId ? { ...idea, status: "shortlisted" as const } : idea,
  );
}
