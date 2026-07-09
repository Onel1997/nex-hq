import type { ArtworkSpec, EngineOptions, RenderedLayers } from "@/lib/design/engine/types";
import { escapeXml } from "@/lib/design/vector-engine/xml";

/** Final rendering step — serializes composed artwork to production SVG. */
export function renderSvg(
  spec: ArtworkSpec,
  layers: RenderedLayers,
  options: EngineOptions = {},
): string {
  const { artboard } = spec.layout;
  const title = escapeXml(spec.brief.title);
  const w = artboard.width;
  const h = artboard.height;
  const widthMm = (w / 36) * 10;
  const heightMm = (h / 36) * 10;
  const guides =
    options.includeProductionGuides !== false ? layers.productionGuides : "";

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${widthMm}mm" height="${heightMm}mm" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    spec.defs ? `<defs>${spec.defs}</defs>` : "",
    layers.background,
    layers.baseGeometry,
    layers.secondaryShapes,
    layers.typography,
    layers.decorativeDetails,
    guides,
    `</svg>`,
  ].join("");
}
