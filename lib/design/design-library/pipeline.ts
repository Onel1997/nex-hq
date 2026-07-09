import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { renderArtwork } from "@/lib/design/design-library/composition";
import { selectBestArtwork } from "@/lib/design/design-library/quality";
import { composeFromBrief, enrichArtworkSpec } from "@/lib/design/design-library/composition/engine";
import type { CompositionOverrides, LibraryArtworkSpec, LibraryEngineOptions } from "@/lib/design/design-library/types";
import { serializeVectorSvg } from "@/lib/design/vector-engine/serialize";
import {
  decideBuyerCuriosityDirection,
  evaluateBuyerCuriosityMatch,
} from "@/lib/design/design-knowledge/buyer-curiosity";
import {
  runCommercialDesignPipeline,
  runCommercialDesignReview,
  buildImageStudioBlueprint,
  type CommercialPipelineResult,
} from "@/lib/design/commercial-design-director";

/**
 * Milaene Design Library pipeline.
 * Brief → Candidate Generation → Quality Scoring → Best Selection → SVG Renderer
 * → Commercial Design Director (critique + revision loop)
 */
export function resolveArtworkSpec(
  brief: DesignStudioBrief,
  overrides?: CompositionOverrides,
): LibraryArtworkSpec {
  const spec = overrides
    ? enrichArtworkSpec(composeFromBrief(brief, overrides))
    : selectBestArtwork(brief);

  const curiosityDecision = decideBuyerCuriosityDirection(brief, spec.seed);
  const curiosityMatch = evaluateBuyerCuriosityMatch(brief, spec);
  console.log(
    `[DESIGN LIBRARY] Buyer curiosity: ${curiosityDecision.pattern} · scrollStop=${curiosityMatch.scrollStopPotential} · aligned=${curiosityMatch.aligned}`,
  );

  return spec;
}

export function runDesignLibraryPipeline(
  brief: DesignStudioBrief,
  options: LibraryEngineOptions = {},
): CommercialPipelineResult {
  if (options.skipCommercialGate) {
    const spec = resolveArtworkSpec(brief, options.compositionOverrides);
    const { layers, defs } = renderArtwork(spec);
    const svg = serializeVectorSvg({
      title: brief.title,
      designId: brief.designId,
      artboard: spec.artboard,
      layers,
      defs,
      includeProductionGuides: options.includeProductionGuides ?? true,
    });
    const review = runCommercialDesignReview({ brief, spec, svg, iteration: 1 });
    return {
      svg,
      spec,
      review,
      iterations: 1,
      approved: review.approved,
      imageStudioBlueprint: buildImageStudioBlueprint(brief, review),
    };
  }

  return runCommercialDesignPipeline(brief, options);
}

export function runDesignLibrary(
  brief: DesignStudioBrief,
  options: LibraryEngineOptions = {},
): string {
  return runDesignLibraryPipeline(brief, options).svg;
}

export { composeFromBrief } from "@/lib/design/design-library/composition";
export type { LibraryArtworkSpec, LibraryEngineOptions } from "@/lib/design/design-library/types";
export type { CommercialPipelineResult } from "@/lib/design/commercial-design-director";
