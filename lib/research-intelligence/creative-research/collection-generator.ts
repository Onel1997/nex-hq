/**
 * Collection Creator — coherent but non-identical design sets (6–12).
 */

import {
  generateWeeklyDesignIdeas,
  emptyPatternEvidence,
  draftNextStepForCount,
  creativeDirectionSummaryFromIdeas,
} from "./idea-generator";
import type {
  CollectionCreatorInput,
  CollectionCreatorResult,
  CollectionPlan,
  DesignIdea,
  OptionalPatternEvidence,
} from "./types";
import {
  buildProviderUsage,
  estimateProviderCost,
  DEFAULT_PROVIDER_MODE,
} from "./provider-mode";

function clampDesignCount(count?: number): number {
  const value = count ?? 8;
  return Math.max(6, Math.min(12, value));
}

function buildCollectionFrame(input: CollectionCreatorInput): Omit<CollectionPlan, "designIdeas"> {
  const theme = input.collectionTheme.trim() || "Quiet Continuum";
  const season = input.season?.trim() || "SS";
  const style = input.styleDirection?.trim() || "Quiet Luxury Minimal";
  const audience = input.audience?.trim() || "18–30 Premium Streetwear";

  return {
    collectionName: `${theme} ${season}`.trim(),
    collectionTagline: `${theme} — worn quietly.`,
    collectionStory:
      `Eine zusammenhängende Kapsel um „${theme}“: emotionale Klarheit, tragbare Typografie und differenzierte Visual Structures. ` +
      `Jedes Stück teilt die Farb-/Typo-Sprache, bleibt aber als einzelnes Design lesbar. ` +
      (input.inspiration ? `Inspiration: ${input.inspiration}. ` : "") +
      `Zielgruppe: ${audience}. Stilrichtung: ${style}.`,
    emotionalWorld: `Ruhige Intensität · ${theme} · kontrollierte Distanz`,
    visualLanguage:
      "Wechselnde Visual Structures, gemeinsame Farbfamilie, kein Copy-Paste derselben Front/Back-Formel",
    colorSystem: ["Black", "Stone", "Cream", "Soft Graphite", "Bone"],
    typographySystem: ["Editorial Serif", "Micro Caps", "Schmale Grotesk", "Mono Annotation"],
    recurringSymbols: ["Horizontlinie", "Archiv-Rahmen", "Geometrie-Mark"],
    recommendedProductMix:
      input.desiredProducts && input.desiredProducts.length > 0
        ? input.desiredProducts.slice(0, 6)
        : ["Oversized T-Shirt", "Heavyweight Hoodie", "Crewneck", "Longsleeve"],
    campaignDirection:
      "Kampagne als ruhige Sequenz: eine Idee pro Frame, viel Raum, keine Produktkopie bestehender Drops.",
    photographyDirection:
      "Natürliches Licht, steinerne/neutrale Hintergründe, Fokus auf Stoff und Typo.",
    videoDirection:
      "1–2 kurze Loops pro Woche: Detail der Typografie, Stoffbewegung, dann Phrase als Endkarte.",
    launchNarrative:
      `Launch von „${theme}“: zuerst 2 Hero-Ideen, dann unterstützende Varianten. Artwork kommt vom Nutzer.`,
    socialContentThemes: [
      "Behind the phrase",
      "Placement close-ups",
      "Colorway quiet cuts",
      "Collection story chapters",
    ],
    consistencyRules: [
      "Gleiche Farbfamilie über alle Designs",
      "Jede Idee braucht eigene Visual Structure und eigenen Spruch",
      "Max. zwei Serif-Hauptstile in der Kollektion",
      "Keine Katalogprodukt-Namen als neue Designtitel",
    ],
    forbiddenElements: [
      ...(input.excludedDirections ?? []),
      "Generische Motivationssprüche",
      "Bestehende Milaene-Produktrepliken",
      "Überladene Full-Front Graphics",
      "Neon / Maximalism / Cartoon",
    ],
    collectionStatus: "draft",
  };
}

function alignIdeasToCollection(
  ideas: DesignIdea[],
  frame: Omit<CollectionPlan, "designIdeas">,
  patternEvidence: OptionalPatternEvidence | null,
): DesignIdea[] {
  return ideas.map((idea, index) => ({
    ...idea,
    recommendedGarmentColors:
      idea.recommendedGarmentColors.length > 0
        ? idea.recommendedGarmentColors
        : frame.colorSystem.slice(0, 3),
    recommendedProductType:
      frame.recommendedProductMix[index % frame.recommendedProductMix.length] ??
      idea.recommendedProductType,
    optionalPatternEvidence: patternEvidence ?? idea.optionalPatternEvidence,
    originalityNotes: `${idea.originalityNotes} · Kollektion „${frame.collectionName}“ — Variante ${index + 1}`,
    whyItFitsMilaene: `${idea.whyItFitsMilaene} · Teilt Visual Language der Kollektion, bleibt eigenständig.`,
  }));
}

export function generateCollectionPlan(
  input: CollectionCreatorInput,
  options: {
    createdAt?: string;
    patternEvidence?: OptionalPatternEvidence | null;
    connectedProviders?: string[];
    llmCalled?: boolean;
  } = {},
): CollectionCreatorResult {
  const providerMode = input.providerMode ?? DEFAULT_PROVIDER_MODE;
  const designCount = clampDesignCount(input.designCount);
  const createdAt = options.createdAt ?? new Date().toISOString();
  const patternEvidence = options.patternEvidence ?? emptyPatternEvidence();
  const frame = buildCollectionFrame(input);

  const generated = generateWeeklyDesignIdeas(
    {
      count: designCount,
      theme: input.collectionTheme,
      style: input.styleDirection,
      audience: input.audience,
      season: input.season,
      phraseLanguage: input.phraseLanguage,
      exclusions: [...(input.excludedDirections ?? []), ...frame.forbiddenElements],
      freeformDescription: input.inspiration,
      catalogProductTitles: input.catalogProductTitles,
      productType: input.desiredProducts?.[0],
      providerMode,
    },
    { createdAt, patternEvidence },
  );

  const aligned = alignIdeasToCollection(generated.ideas, frame, patternEvidence);
  const collection: CollectionPlan = {
    ...frame,
    designIdeas: aligned,
  };

  return {
    mode: "collection_creator",
    providerMode,
    generatorSource: generated.generatorSource,
    creativeDirectionSummary: creativeDirectionSummaryFromIdeas(aligned, {
      generatorSource: generated.generatorSource,
    }),
    collection,
    nextStep: draftNextStepForCount(aligned.length),
    diversityScore: generated.diversityScore,
    estimatedProviderCost: estimateProviderCost(providerMode, {
      llmCalled: options.llmCalled ?? false,
    }),
    providerUsage: buildProviderUsage(providerMode, {
      connectedProviders: options.connectedProviders,
    }),
    selectedIdeaId: null,
  };
}
