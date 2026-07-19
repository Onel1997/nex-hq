import "server-only";

import { DataSourceManager } from "@/lib/data-source-platform/manager";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { runBrandIntelligenceEngine } from "../brand-intelligence";
import { runCreativeBriefEngine } from "../creative-brief";
import {
  runCollectionCreatorEngine,
  runWeeklyDesignIdeasEngine,
  DEFAULT_PROVIDER_MODE,
  parseProviderMode,
  parseResearchMode,
  shouldRunFullFusionPipeline,
  shouldRunPatternIntelligence,
  shouldSyncProviders,
  type CollectionCreatorInput,
  type CreativeResearchReportSection,
  type ProviderMode,
  type ResearchMode,
  type WeeklyDesignIdeasInput,
} from "../creative-research";
import { runResearchIntelligencePipeline } from "../fusion/pipeline";
import { runPatternIntelligenceEngine } from "../pattern-intelligence";
import { buildResearchReport } from "./build-report";
import { syncResultsToEnvelopes } from "./envelopes";
import { emptyResearchStudioReport } from "./types";
import type { ResearchStudioReport } from "./types";

export interface LoadResearchStudioReportOptions {
  title?: string;
  force?: boolean;
  workspaceId?: string;
  researchMode?: ResearchMode;
  providerMode?: ProviderMode;
  weeklyInput?: WeeklyDesignIdeasInput;
  collectionInput?: CollectionCreatorInput;
}

function parseCreativeIntent(title?: string): {
  researchMode: ResearchMode;
  weeklyInput: WeeklyDesignIdeasInput;
  collectionInput: CollectionCreatorInput | null;
} {
  const text = title?.trim() ?? "";
  const lower = text.toLowerCase();

  if (
    /kollektion|collection|kapsel|capsule/.test(lower) ||
    lower.includes("mode=collection")
  ) {
    const countMatch = text.match(/(\d+)\s*(?:designs?|ideen?)/i);
    return {
      researchMode: "collection_creator",
      weeklyInput: { count: 4 },
      collectionInput: {
        collectionTheme:
          text.replace(/kollektion|collection|planen|planen:/gi, "").trim() ||
          "Quiet Continuum",
        designCount: countMatch ? Number(countMatch[1]) : 8,
        inspiration: text,
      },
    };
  }

  if (/trend_intelligence|trend-intelligence|voller intelligence/.test(lower)) {
    return {
      researchMode: "trend_intelligence",
      weeklyInput: { count: 4 },
      collectionInput: null,
    };
  }

  const countMatch = text.match(/(\d+)\s*(?:wochenideen|designideen|ideen|ideas)/i);
  const single = /einzel|single|eine designidee/.test(lower);

  return {
    researchMode: "weekly_design_ideas",
    weeklyInput: {
      count: single ? 1 : countMatch ? Number(countMatch[1]) : 4,
      freeformDescription: text || undefined,
    },
    collectionInput: null,
  };
}

function buildCreativeSection(params: {
  researchMode: ResearchMode;
  providerMode: ProviderMode;
  weeklyResult?: ReturnType<typeof runWeeklyDesignIdeasEngine>;
  collectionResult?: ReturnType<typeof runCollectionCreatorEngine>;
}): CreativeResearchReportSection {
  if (params.researchMode === "collection_creator" && params.collectionResult) {
    const result = params.collectionResult;
    return {
      creativeDirectionSummary: result.creativeDirectionSummary,
      designIdeas: result.collection.designIdeas,
      collection: result.collection,
      supportingIntelligenceCollapsed: true,
      nextStep: result.nextStep,
      researchMode: "collection_creator",
      providerMode: params.providerMode,
      generatorSource: result.generatorSource,
      diversityScore: result.diversityScore,
      handoff: null,
      selectedIdeaId: null,
      estimatedProviderCost: result.estimatedProviderCost,
      providerUsage: result.providerUsage,
    };
  }

  const weekly = params.weeklyResult!;
  return {
    creativeDirectionSummary: weekly.creativeDirectionSummary,
    designIdeas: weekly.designIdeas,
    collection: null,
    supportingIntelligenceCollapsed: true,
    nextStep: weekly.nextStep,
    researchMode: "weekly_design_ideas",
    providerMode: params.providerMode,
    generatorSource: weekly.generatorSource,
    diversityScore: weekly.diversityScore,
    handoff: null,
    selectedIdeaId: null,
    estimatedProviderCost: weekly.estimatedProviderCost,
    providerUsage: weekly.providerUsage,
  };
}

/**
 * Loads creative research (default) or legacy fusion stack based on mode.
 * Creative Only skips provider sync entirely.
 */
export async function loadResearchStudioReport(
  options: LoadResearchStudioReportOptions = {},
): Promise<ResearchStudioReport> {
  const parsed = parseCreativeIntent(options.title);
  const researchMode =
    options.researchMode ??
    parseResearchMode(parsed.researchMode);
  const providerMode =
    options.providerMode ??
    parseProviderMode(DEFAULT_PROVIDER_MODE);
  const generatedAt = new Date().toISOString();

  // Creative-first modes: generate ideas without requiring full provider sync.
  if (researchMode === "weekly_design_ideas" || researchMode === "collection_creator") {
    let patternIntelligence = null;

    if (shouldSyncProviders(providerMode)) {
      const { results } = await DataSourceManager.syncAll({ force: options.force });
      // Shopify-assisted / full still sync; creative path only uses pattern section optionally.
      void results;
    }

    if (shouldRunPatternIntelligence(providerMode)) {
      patternIntelligence = await runPatternIntelligenceEngine({
        generatedAt,
        userRequest: options.title,
      });
    }

    if (shouldRunFullFusionPipeline(providerMode)) {
      const { results } = await DataSourceManager.syncAll({ force: options.force });
      const envelopes = syncResultsToEnvelopes(results);
      const pipeline = runResearchIntelligencePipeline({
        envelopes,
        context: {
          workspaceId: options.workspaceId,
          locale: DEFAULT_LOCALE,
          generatedAt,
        },
      });
      const brandResult = await runBrandIntelligenceEngine({
        intelligence: pipeline.intelligence,
        reasoning: pipeline.reasoning,
        generatedAt,
      });
      const briefResult = runCreativeBriefEngine({
        intelligence: brandResult.intelligence,
        reasoning: pipeline.reasoning,
        brandIntelligence: brandResult.brandIntelligence,
        patternIntelligence,
        generatedAt,
        userRequest: options.title,
      });

      const weeklyResult =
        researchMode === "weekly_design_ideas"
          ? runWeeklyDesignIdeasEngine(
              { ...parsed.weeklyInput, ...options.weeklyInput, providerMode },
              { createdAt: generatedAt, patternIntelligence },
            )
          : undefined;
      const collectionResult =
        researchMode === "collection_creator" && (options.collectionInput || parsed.collectionInput)
          ? runCollectionCreatorEngine(
              {
                collectionTheme: "Quiet Continuum",
                ...parsed.collectionInput,
                ...options.collectionInput,
                providerMode,
              },
              { createdAt: generatedAt, patternIntelligence },
            )
          : researchMode === "collection_creator"
            ? runCollectionCreatorEngine(
                {
                  collectionTheme: options.title || "Quiet Continuum",
                  providerMode,
                },
                { createdAt: generatedAt, patternIntelligence },
              )
            : undefined;

      const creativeResearch = buildCreativeSection({
        researchMode,
        providerMode,
        weeklyResult,
        collectionResult,
      });

      return buildResearchReport({
        intelligence: brandResult.intelligence,
        reasoning: pipeline.reasoning,
        brandIntelligence: brandResult.brandIntelligence,
        creativeBrief: briefResult.creativeBrief,
        patternIntelligence,
        title: options.title,
        userRequest: options.title,
        researchMode,
        providerMode,
        creativeResearch,
      });
    }

    // Creative Only / Shopify Assisted without full fusion shell
    const weeklyResult =
      researchMode === "weekly_design_ideas"
        ? runWeeklyDesignIdeasEngine(
            { ...parsed.weeklyInput, ...options.weeklyInput, providerMode },
            { createdAt: generatedAt, patternIntelligence },
          )
        : undefined;
    const collectionResult =
      researchMode === "collection_creator"
        ? runCollectionCreatorEngine(
            {
              collectionTheme: options.title || "Quiet Continuum",
              ...parsed.collectionInput,
              ...options.collectionInput,
              providerMode,
            },
            { createdAt: generatedAt, patternIntelligence },
          )
        : undefined;

    const creativeResearch = buildCreativeSection({
      researchMode,
      providerMode,
      weeklyResult,
      collectionResult,
    });

    const report = emptyResearchStudioReport(generatedAt);
    return {
      ...report,
      title:
        options.title?.trim() ||
        (researchMode === "collection_creator"
          ? "Kollektion — Creative Direction"
          : "Wochenideen — Creative Direction"),
      researchMode,
      providerMode,
      overallConfidence: 72,
      overallTier: "medium",
      intelligenceWeak: false,
      caveats:
        providerMode === "creative_only"
          ? [
              "Creative Only: keine externen Provider-Syncs in diesem Lauf. Verbundene Provider erscheinen nicht als Run-Coverage.",
              `Generator: ${creativeResearch.generatorSource}`,
            ]
          : [`Generator: ${creativeResearch.generatorSource}`],
      executiveSummary: creativeResearch.creativeDirectionSummary,
      creativeResearch,
      // Hide legacy source coverage for Creative Only — connected ≠ used.
      sourceCoverage: null,
      sourceTrust: [],
      suggestedNextActions: [
        {
          id: "select-idea",
          title: "Idee auswählen",
          why: creativeResearch.nextStep,
          priority: "act",
          suggestedNextStep: creativeResearch.nextStep,
        },
      ],
      patternIntelligence:
        providerMode !== "creative_only" && patternIntelligence
          ? {
              loaded: patternIntelligence.analyzedProductCount > 0,
              analyzedProductCount: patternIntelligence.analyzedProductCount,
              patterns: patternIntelligence.patterns.slice(0, 8).map((pattern) => ({
                dimension: pattern.dimension,
                dimensionLabel: pattern.dimensionLabel,
                traits: pattern.traits,
                evidence: pattern.evidence,
              })),
              successReasons: patternIntelligence.successReasons,
              recommendedSilhouette: patternIntelligence.recommendedSilhouette,
              alternativeSilhouettes: patternIntelligence.alternativeSilhouettes,
            }
          : null,
    };
  }

  // Legacy trend intelligence path — full fusion stack preserved.
  const { results } = await DataSourceManager.syncAll({ force: options.force });
  const envelopes = syncResultsToEnvelopes(results);

  const pipeline = runResearchIntelligencePipeline({
    envelopes,
    context: {
      workspaceId: options.workspaceId,
      locale: DEFAULT_LOCALE,
      generatedAt,
    },
  });

  const brandResult = await runBrandIntelligenceEngine({
    intelligence: pipeline.intelligence,
    reasoning: pipeline.reasoning,
    generatedAt,
  });

  const patternIntelligence = await runPatternIntelligenceEngine({
    generatedAt,
    userRequest: options.title,
  });

  const briefResult = runCreativeBriefEngine({
    intelligence: brandResult.intelligence,
    reasoning: pipeline.reasoning,
    brandIntelligence: brandResult.brandIntelligence,
    patternIntelligence,
    generatedAt,
    userRequest: options.title,
  });

  return buildResearchReport({
    intelligence: brandResult.intelligence,
    reasoning: pipeline.reasoning,
    brandIntelligence: brandResult.brandIntelligence,
    creativeBrief: briefResult.creativeBrief,
    patternIntelligence,
    title: options.title,
    userRequest: options.title,
    researchMode: "trend_intelligence",
    providerMode: "full_intelligence",
    creativeResearch: null,
  });
}

export { buildResearchReport } from "./build-report";
export type { BuildResearchReportInput } from "./build-report";
export {
  adaptLegacyResearchStudioReport,
  isCreativeResearchReport,
  isLegacyTrendReport,
} from "./legacy-adapter";
