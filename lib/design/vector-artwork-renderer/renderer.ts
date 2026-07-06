import { escapeXml, group } from "@/lib/design/vector-engine/xml";
import type { PanelLayout } from "@/lib/design/fashion-design-engine/types";
import { exportVectorArtworkState } from "./export-state";
import { renderGraphicElements } from "./graphics";
import { renderLayoutGuides } from "./layout-guides";
import { renderTypographyBlocks } from "./typography";
import type {
  VectorArtworkRenderInput,
  VectorArtworkRenderResult,
  VectorCommercialMetadata,
} from "./types";
import { validateVectorArtwork } from "./validate";

const RENDERER_VERSION = "1.0.0";

function resolvePanel(layoutSpec: VectorArtworkRenderInput["layoutSpec"]): PanelLayout {
  const panel = layoutSpec.backLayout ?? layoutSpec.frontLayout;
  if (!panel) {
    throw new Error(
      "Vector artwork rendering failed: LayoutSpec has no front or back panel layout",
    );
  }
  return panel;
}

function resolveArtboard(
  printSpec: VectorArtworkRenderInput["printSpec"],
  panel: PanelLayout,
): { widthMm: number; heightMm: number } {
  const margin = printSpec.safeMarginsMm;
  const widthMm = Math.max(
    printSpec.printDimensionsMm.width + margin.left + margin.right,
    panel.boundingBoxMm.width + panel.safeMarginMm * 2,
  );
  const heightMm = Math.max(
    printSpec.printDimensionsMm.height + margin.top + margin.bottom,
    panel.boundingBoxMm.height + panel.offsetFromCollarMm + panel.safeMarginMm,
  );
  return { widthMm, heightMm };
}

function buildCommercialMetadata(
  input: VectorArtworkRenderInput,
): VectorCommercialMetadata {
  const assessment = input.commercialAssessment;
  return {
    overallScore: assessment?.overall ?? input.compositionSpec.score,
    approved: assessment?.approved ?? false,
    compositionScore: input.compositionSpec.score,
    explanations: assessment?.explanations ?? input.compositionSpec.recommendations,
    inkColors: input.printSpec.metadata.inkColors,
    productionMethod: input.printSpec.productionMethod,
    kittlBenchmarkScore: input.compositionSpec.score,
    qualityLayerTemplate: input.qualityLayerMarkup ? "design-quality-layer" : undefined,
  };
}

function buildSvgDocument(input: {
  title: string;
  designId: string;
  artboard: { widthMm: number; heightMm: number };
  typographyMarkup: string;
  graphicMarkup: string;
  qualityLayerMarkup: string;
  guideMarkup: string;
  premium?: boolean;
}): string {
  const { title, designId, artboard } = input;
  const w = artboard.widthMm;
  const h = artboard.heightMm;
  const qualityTag = input.premium ? "DESIGN_QUALITY_LAYER" : "VECTOR_ARTWORK_RENDERER";

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- ${qualityTag} v${RENDERER_VERSION} -->`,
    `<!-- DESIGN_STUDIO_V2_TEXT_SAFE -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm" role="img" aria-label="${escapeXml(title)}">`,
    `<title>${escapeXml(title)}</title>`,
    `<metadata><desc>designId:${escapeXml(designId)}; text-safe:true; renderer:vector-artwork-renderer${input.premium ? "; premium:true" : ""}</desc></metadata>`,
    group(
      "vector-artwork-root",
      `${input.qualityLayerMarkup}${input.graphicMarkup}${input.typographyMarkup}`,
      {
        "data-design-id": designId,
        "data-text-safe": "true",
        ...(input.premium ? { "data-premium-vector": "true" } : {}),
      },
    ),
    input.guideMarkup,
    `</svg>`,
  ].join("");
}

function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return `data:image/svg+xml,${encoded}`;
}

/**
 * Render clean, editable, print-ready vector artwork from Fashion Design Engine specs.
 * All typography is real SVG text — never image-generated.
 */
export function renderVectorArtwork(
  input: VectorArtworkRenderInput,
): VectorArtworkRenderResult {
  const panel = resolvePanel(input.layoutSpec);
  const artboard = resolveArtboard(input.printSpec, panel);

  const { markup: typographyMarkup, renderedTexts } = renderTypographyBlocks(
    input.typographySpec,
    panel,
  );
  const graphicMarkup = renderGraphicElements(input.graphicSpec, panel);
  const guideMarkup = input.includeLayoutGuides
    ? renderLayoutGuides(input.layoutSpec, panel, artboard)
    : "";
  const qualityLayerMarkup = input.qualityLayerMarkup ?? "";
  const isPremium = Boolean(qualityLayerMarkup.trim());

  const svgString = buildSvgDocument({
    title: input.title,
    designId: input.designId,
    artboard,
    typographyMarkup,
    graphicMarkup,
    qualityLayerMarkup,
    guideMarkup,
    premium: isPremium,
  });

  const validation = validateVectorArtwork(
    svgString,
    input.typographySpec,
    renderedTexts,
  );

  if (!validation.valid) {
    const detail = validation.issues.join("; ") || "Typography validation failed";
    throw new Error(`Vector artwork rendering failed: ${detail}`);
  }

  const exportState = exportVectorArtworkState({
    designId: input.designId,
    printSpec: input.printSpec,
    svgString,
    dpi: input.printSpec.dpi,
    label: input.exportLabel,
    kittlBenchmarkScore: input.compositionSpec.score,
    textSafe: true,
    printReadyDraft: input.exportLabel === "Premium Vector Artwork",
  });

  return {
    svgString,
    transparentPngPreview: svgToDataUrl(svgString),
    width: artboard.widthMm,
    height: artboard.heightMm,
    printDimensions: {
      widthMm: input.printSpec.printDimensionsMm.width,
      heightMm: input.printSpec.printDimensionsMm.height,
    },
    typographyValidation: validation.typography,
    commercialMetadata: buildCommercialMetadata(input),
    exportState,
  };
}
