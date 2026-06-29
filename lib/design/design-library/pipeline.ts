import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { renderArtwork } from "@/lib/design/design-library/composition";
import { selectBestArtwork } from "@/lib/design/design-library/quality";
import type { LibraryEngineOptions } from "@/lib/design/design-library/types";
import { serializeVectorSvg } from "@/lib/design/vector-engine/serialize";

/**
 * Milaene Design Library pipeline.
 * Brief → Candidate Generation → Quality Scoring → Best Selection → SVG Renderer
 */
export function runDesignLibrary(
  brief: DesignStudioBrief,
  options: LibraryEngineOptions = {},
): string {
  const artwork = selectBestArtwork(brief);
  const { layers, defs } = renderArtwork(artwork);

  return serializeVectorSvg({
    title: brief.title,
    designId: brief.designId,
    artboard: artwork.artboard,
    layers,
    defs,
    includeProductionGuides: options.includeProductionGuides ?? true,
  });
}

export { composeFromBrief } from "@/lib/design/design-library/composition";
export type { LibraryArtworkSpec, LibraryEngineOptions } from "@/lib/design/design-library/types";
