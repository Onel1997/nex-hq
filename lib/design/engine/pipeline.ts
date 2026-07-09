import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { buildCreativeComposition } from "@/lib/design/engine/composition/creative-composition";
import { buildDesignIntelligence } from "@/lib/design/engine/composition/design-intelligence";
import { parseArtboard, resolveLayoutZones } from "@/lib/design/engine/layout/registry";
import { renderSvg } from "@/lib/design/engine/render/svg-renderer";
import { resolveStyleProfile } from "@/lib/design/engine/styles/registry";
import { buildTypographySystem } from "@/lib/design/engine/typography/engine";
import type { ArtworkSpec, EngineOptions } from "@/lib/design/engine/types";
import { buildAssetPlacement } from "@/lib/design/engine/vector/asset-placement";
import { composeVectorArtwork } from "@/lib/design/engine/vector/composition";

/**
 * Milaene apparel design pipeline:
 * Brief → Creative Composition → Layout → Typography → Vector Composition → SVG
 */
export function runDesignEngine(
  brief: DesignStudioBrief,
  options: EngineOptions = {},
): string {
  const composition = buildCreativeComposition(brief);
  const intelligence = buildDesignIntelligence(brief, composition);
  const style = resolveStyleProfile(composition.styleFamily, brief.productionMethod);
  const artboard = parseArtboard(brief.dimensions);
  const layout = resolveLayoutZones(
    composition.layoutFamily,
    artboard,
    style.negativeSpaceBias + composition.negativeSpaceRatio,
  );

  composition.focalPoint = {
    x: layout.heroZone.x + layout.heroZone.width / 2,
    y: layout.heroZone.y + layout.heroZone.height / 2,
  };

  const typography = buildTypographySystem(brief, composition, intelligence, style, layout);
  const { assets, colors } = buildAssetPlacement(brief, composition, intelligence, style, layout);

  const artwork: ArtworkSpec = {
    brief,
    composition,
    intelligence,
    style,
    layout,
    typography,
    assets,
    colors,
    defs: "",
  };

  const layers = composeVectorArtwork(artwork);
  return renderSvg(artwork, layers, options);
}
