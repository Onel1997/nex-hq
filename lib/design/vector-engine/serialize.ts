import type { ComposedLayers, Rect } from "@/lib/design/vector-engine/types";
import { escapeXml } from "@/lib/design/vector-engine/xml";

export interface SerializeInput {
  title: string;
  designId: string;
  artboard: Rect;
  layers: ComposedLayers;
  defs: string;
  includeProductionGuides: boolean;
}

/** Assemble Illustrator-compatible SVG document from composed layers. */
export function serializeVectorSvg(input: SerializeInput): string {
  const { artboard, layers, defs, includeProductionGuides } = input;
  const title = escapeXml(input.title);
  const w = artboard.width;
  const h = artboard.height;

  const widthMm = (w / 36) * 10;
  const heightMm = (h / 36) * 10;

  const guideLayer = includeProductionGuides
    ? layers.productionGuides
    : "";

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${widthMm}mm" height="${heightMm}mm" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    defs ? `<defs>${defs}</defs>` : "",
    layers.background,
    layers.baseGeometry,
    layers.secondaryShapes,
    layers.typography,
    layers.decorativeDetails,
    guideLayer,
    `</svg>`,
  ].join("");
}
