import type { ComposedLayers } from "@/lib/design/vector-engine/types";
import { escapeXml, group, rect } from "@/lib/design/vector-engine/xml";
import { renderHeroRichLayers } from "@/lib/design/design-library/composition/render-hero";
import { renderEditorialRules, renderOrnament } from "@/lib/design/design-library/ornaments/render";
import { isHeroRole } from "@/lib/design/design-library/quality/score";
import { renderSymbol, renderSymbolAccent } from "@/lib/design/design-library/symbols/render";
import type { LibraryArtworkSpec, TypographyPlacement } from "@/lib/design/design-library/types";

function letterSpacingPx(size: number, tracking: number): number {
  return size * tracking;
}

function renderTypographyPlacement(el: TypographyPlacement, ink: string, fontFamily: string): string {
  const ls = letterSpacingPx(el.size, el.tracking).toFixed(2);
  const anchor = el.align === "middle" ? "middle" : el.align === "end" ? "end" : "start";

  if (el.curved && el.curveRadius) {
    const pathId = el.id;
    const pathD = `M ${el.x - el.curveRadius} ${el.y} A ${el.curveRadius} ${el.curveRadius} 0 0 1 ${el.x + el.curveRadius} ${el.y}`;
    return [
      `<defs><path id="${pathId}" d="${pathD}"/></defs>`,
      `<text fill="${ink}" font-family="${fontFamily}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" opacity="${el.opacity}">`,
      `<textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${escapeXml(el.text.toUpperCase())}</textPath>`,
      `</text>`,
    ].join("");
  }

  if (el.role === "vertical-text") {
    const chars = el.text.toUpperCase().split("");
    const dy = el.size * el.lineHeight;
    const tspans = chars
      .map((ch, i) => `<tspan x="${el.x}" dy="${i === 0 ? 0 : dy}">${escapeXml(ch)}</tspan>`)
      .join("");
    return `<text fill="${ink}" font-family="${fontFamily}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" opacity="${el.opacity}">${tspans}</text>`;
  }

  const transform = el.rotation !== 0 ? ` transform="rotate(${el.rotation} ${el.x} ${el.y})"` : "";
  return `<text x="${el.x}" y="${el.y}" fill="${ink}" font-family="${fontFamily}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" text-anchor="${anchor}" opacity="${el.opacity}" dominant-baseline="alphabetic"${transform}>${escapeXml(el.text.toUpperCase())}</text>`;
}

/** Renders a LibraryArtworkSpec into SVG layer groups for the vector serializer. */
export function renderArtwork(spec: LibraryArtworkSpec): { layers: ComposedLayers; defs: string } {
  const { colors, layoutZones, style, layout, seed } = spec;
  const strokeWidth =
    style.preferredPrintScale === "micro"
      ? style.strokeHairline
      : style.preferredPrintScale === "oversized"
        ? style.strokeRegular
        : style.strokeThin;

  const symbolCtx = {
    colors,
    strokeWidth,
    seed,
    safeZone: layoutZones.safeZone,
  };

  const heroSymbols = spec.symbols.filter((s) => s.zone === "hero");
  const secondarySymbols = spec.symbols.filter((s) => s.zone === "secondary");
  const accentSymbols = spec.symbols.filter((s) => s.zone === "accent");

  const heroRich = isHeroRole(spec.brief.role)
    ? renderHeroRichLayers(spec, strokeWidth)
    : null;

  const baseGeometry = heroRich
    ? heroRich.baseGeometry
    : group(
        "layer-base-geometry",
        heroSymbols.map((placement) => renderSymbol({ ...symbolCtx, placement })).join(""),
      );

  const secondaryShapes = heroRich
    ? heroRich.secondaryShapes
    : group(
        "layer-secondary-shapes",
        [
          ...secondarySymbols.map((placement) => renderSymbol({ ...symbolCtx, placement })),
          ...accentSymbols.map((placement) => renderSymbol({ ...symbolCtx, placement })),
          ...heroSymbols.flatMap((placement, i) =>
            Array.from({ length: 3 }, (_, j) =>
              renderSymbolAccent({ ...symbolCtx, placement }, i * 3 + j),
            ),
          ),
        ].join(""),
      );

  const typeBlocks = spec.typography.filter((t) => t.layer === "typography");
  const decorType = spec.typography.filter((t) => t.layer === "decorative");
  const fontFamily = spec.typographySystem.fontFamily;

  const typography = heroRich
    ? heroRich.typography
    : group(
        "layer-typography",
        typeBlocks.map((t) => group(t.id, renderTypographyPlacement(t, colors.ink, fontFamily))).join(""),
      );

  const decorativeDetails = group(
    "layer-decorative-details",
    [
      heroRich?.decorativeDetails ?? "",
      ...(heroRich
        ? []
        : [
            spec.ornaments.map((placement) => renderOrnament({ ...symbolCtx, placement })).join(""),
            decorType.map((t) => group(t.id, renderTypographyPlacement(t, colors.ink, fontFamily))).join(""),
          ]),
      renderEditorialRules(
        layoutZones.safeZone,
        layoutZones.anchors.focal.y,
        colors,
        layout.id.includes("oversized"),
      ),
    ].join(""),
  );

  const productionGuides = group(
    "print-area",
    rect(layoutZones.safeZone.x, layoutZones.safeZone.y, layoutZones.safeZone.width, layoutZones.safeZone.height, {
      fill: "none",
      stroke: colors.secondary,
      "stroke-width": 0.5,
      "stroke-dasharray": "4 3",
      opacity: 0.28,
    }),
  );

  return {
    layers: {
      background: heroRich?.background ?? group("layer-background", ""),
      baseGeometry,
      secondaryShapes,
      typography,
      decorativeDetails,
      productionGuides,
    },
    defs: heroRich?.defs ?? "",
  };
}
