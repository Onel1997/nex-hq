import { applyCollectionEngine } from "./collection-engine";
import type { CollectionEngineContext } from "./collection-engine";
import {
  applyCollectionIntelligence,
  enrichDesignRelationships,
} from "./collection-intelligence";
import { applyHeroEngine } from "./hero-engine";
import type { DesignConcept, ResearchCollection } from "./types";

export interface CollectionPipelineResult {
  designs: DesignConcept[];
  collection: ResearchCollection;
}

/** Break supportsDesignId cycles — hero never supports another piece. */
export function breakRelationshipCycles(
  designs: DesignConcept[],
  heroDesignId: string,
): DesignConcept[] {
  const byId = new Map(designs.map((d) => [d.designId, d]));

  return designs.map((design) => {
    if (design.designId === heroDesignId) {
      return { ...design, supportsDesignId: undefined };
    }

    let supports = design.supportsDesignId?.trim();
    if (!supports || supports === design.designId) {
      supports = undefined;
    }

    // Hero must never be listed as supporting another design
    if (supports && supports !== heroDesignId) {
      const target = byId.get(supports);
      if (target?.supportsDesignId === design.designId) {
        supports = heroDesignId;
      }
    }

    // Non-core pieces should anchor to hero, not create chains back to hero
    if (
      supports &&
      supports !== heroDesignId &&
      design.collectionRole !== "Core Essential"
    ) {
      supports = heroDesignId;
    }

    return { ...design, supportsDesignId: supports };
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
  const heroResult = applyHeroEngine(
    intelligenceResult.designs,
    intelligenceResult.collection,
    adjustments,
  );
  console.log("HERO done");

  let finalDesigns = enrichDesignRelationships(
    heroResult.designs,
    heroResult.collection.heroDesignId,
  );
  finalDesigns = breakRelationshipCycles(
    finalDesigns,
    heroResult.collection.heroDesignId,
  );

  const intelligenceCeo = intelligenceResult.collection.ceoAnalysis;
  const heroCeo = heroResult.collection.ceoAnalysis;

  const collection: ResearchCollection = {
    ...heroResult.collection,
    collectionArc: intelligenceResult.collection.collectionArc,
    emotionalNarrative: intelligenceResult.collection.emotionalNarrative,
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
        : heroCeo ?? intelligenceCeo,
    ceoRecommendation: heroCeo?.launchApproval?.approved
      ? "Proceed to Design Studio — CEO approves hero as launch piece."
      : heroResult.collection.ceoRecommendation ??
        intelligenceResult.collection.ceoRecommendation,
  };

  return { designs: finalDesigns, collection };
}
