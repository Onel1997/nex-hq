import { applyCollectionEngine } from "./collection-engine";
import type { CollectionEngineContext } from "./collection-engine";
import {
  applyCollectionIntelligence,
  enrichDesignRelationships,
} from "./collection-intelligence";
import { applyCeoConsistency } from "./ceo-consistency";
import { computeDynamicCollectionScore } from "./collection-scoring";
import { normalizeDesignPrintArea } from "./design-concept";
import { applyHeroEngine } from "./hero-engine";
import { applyHeroRegeneration } from "./hero-regeneration";
import type { DesignConcept, ResearchCollection } from "./types";

/** Keep only the final approved hero — drop stale pre-regeneration hero entries. */
export function finalizeCollectionDesigns(
  designs: DesignConcept[],
  collection: ResearchCollection,
): DesignConcept[] {
  const heroId = collection.heroDesignId;
  const previousHeroId = collection.heroRegeneration?.previousHeroId;

  const filtered = designs.filter((design) => {
    if (previousHeroId && design.designId === previousHeroId && design.designId !== heroId) {
      return false;
    }
    return true;
  });

  return filtered.map((design) => ({
    ...design,
    collectionRole:
      design.designId === heroId
        ? "Hero Piece"
        : design.collectionRole === "Hero Piece"
          ? "Supporting Piece"
          : design.collectionRole,
  }));
}

export interface CollectionPipelineResult {
  designs: DesignConcept[];
  collection: ResearchCollection;
}

/** Ensure hero is root — every other design supports collection.heroDesignId. */
export function breakRelationshipCycles(
  designs: DesignConcept[],
  heroDesignId: string,
): DesignConcept[] {
  return designs.map((design) => {
    if (design.designId === heroDesignId) {
      return { ...design, supportsDesignId: undefined };
    }

    return { ...design, supportsDesignId: heroDesignId };
  });
}

/**
 * Linear research collection pipeline — each stage runs exactly once.
 *
 * Brand DNA (upstream) → Collection Engine → Collection Intelligence → Hero Engine
 */
export function applyCollectionPipeline(
  designs: DesignConcept[],
  context: CollectionEngineContext = {},
  adjustments: string[] = [],
): CollectionPipelineResult {
  console.log("COLLECTION");
  const engineResult = applyCollectionEngine(designs, context, adjustments);
  console.log("COLLECTION done");

  console.log("INTELLIGENCE");
  const intelligenceResult = applyCollectionIntelligence(
    engineResult.designs,
    engineResult.collection,
    adjustments,
  );
  console.log("INTELLIGENCE done");

  console.log("HERO");
  let heroResult = applyHeroEngine(
    intelligenceResult.designs,
    intelligenceResult.collection,
    adjustments,
  );
  console.log("HERO done");

  if (heroResult.collection.heroRegenerationRequired) {
    console.log("HERO REGENERATION");
    const regenResult = applyHeroRegeneration(
      heroResult.designs,
      heroResult.collection,
      adjustments,
    );
    heroResult = {
      designs: regenResult.designs,
      collection: regenResult.collection,
    };
    console.log("HERO REGENERATION done");
  }

  let finalDesigns = enrichDesignRelationships(
    heroResult.designs,
    heroResult.collection.heroDesignId,
  );
  finalDesigns = breakRelationshipCycles(
    finalDesigns,
    heroResult.collection.heroDesignId,
  );
  finalDesigns = finalDesigns.map((design) => normalizeDesignPrintArea(design));
  finalDesigns = finalizeCollectionDesigns(finalDesigns, heroResult.collection);

  const hero = finalDesigns.find(
    (d) => d.designId === heroResult.collection.heroDesignId,
  );
  const heroAnalysis = heroResult.collection.heroAnalysis;

  const scoreBreakdown = computeDynamicCollectionScore(
    finalDesigns,
    heroResult.collection,
  );

  const ceoSynced =
    hero && heroAnalysis
      ? applyCeoConsistency(
          {
            ...heroResult.collection,
            collectionArc: intelligenceResult.collection.collectionArc,
            emotionalNarrative: intelligenceResult.collection.emotionalNarrative,
          },
          hero,
          heroAnalysis,
          finalDesigns,
          scoreBreakdown.collectionScore,
        )
      : null;

  const intelligenceCeo = intelligenceResult.collection.ceoAnalysis;
  const heroCeo = ceoSynced?.collection.ceoAnalysis ?? heroResult.collection.ceoAnalysis;

  const collection: ResearchCollection = ceoSynced
    ? {
        ...ceoSynced.collection,
        ceoAnalysis:
          intelligenceCeo && heroCeo
            ? {
                strongestProduct: heroCeo.strongestProduct,
                weakestProduct: intelligenceCeo.weakestProduct,
                recommendedLaunchOrder: intelligenceCeo.recommendedLaunchOrder,
                productionRisk: intelligenceCeo.productionRisk,
                commercialConfidence: heroCeo.commercialConfidence,
                adPotential: heroCeo.adPotential,
                launchApproval: heroCeo.launchApproval,
              }
            : heroCeo,
      }
    : {
        ...heroResult.collection,
        collectionArc: intelligenceResult.collection.collectionArc,
        emotionalNarrative: intelligenceResult.collection.emotionalNarrative,
        collectionScore: Math.min(scoreBreakdown.collectionScore, 69),
        ceoRecommendation: "Do not launch yet — refine or regenerate Hero Piece.",
      };

  const syncedDesigns = ceoSynced
    ? finalDesigns.map((d) =>
        d.designId === ceoSynced.hero.designId ? ceoSynced.hero : d,
      )
    : finalDesigns;

  return { designs: syncedDesigns, collection };
}
