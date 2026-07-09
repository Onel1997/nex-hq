import type { ArtworkSpec, PlacedAsset, RenderedLayers, TypeElement } from "@/lib/design/engine/types";
import {
  capsuleText,
  renderArchitecturalFrame,
  renderBrokenCircle,
  renderCapsuleCode,
  renderCoordinateMarks,
  renderDualInterruptedArc,
  renderEditorialLines,
  renderFlankStrikes,
  renderGridSystem,
  renderHalftoneField,
  renderLuxuryDivider,
  renderMinimalCross,
  renderMinimalSymbol,
  renderMissingCenterVoid,
  renderNoiseMask,
  renderSacredGeometry,
  renderTechnicalSchematic,
  renderTexturedFrame,
  renderVerticalRules,
  renderVintageDistress,
  type AssetRenderContext,
} from "@/lib/design/engine/assets/library";
import { DESIGN_TOKENS } from "@/lib/design/vector-engine/tokens";
import { escapeXml, group, rect } from "@/lib/design/vector-engine/xml";

function renderAsset(spec: ArtworkSpec, placed: PlacedAsset): string {
  const ctx: AssetRenderContext = {
    cx: placed.cx,
    cy: placed.cy,
    scale: placed.scale,
    rotation: placed.rotation,
    opacity: placed.opacity,
    colors: spec.colors,
    strokeWidth: spec.style.strokeThin,
    seed: spec.composition.seed,
    safeZone: spec.layout.safeZone,
  };

  const renderers: Record<string, () => string> = {
    "dual-interrupted-arc": () => renderDualInterruptedArc(ctx),
    "missing-center-void": () => renderMissingCenterVoid(ctx),
    "broken-circle": () => renderBrokenCircle(ctx),
    "architectural-frame": () => renderArchitecturalFrame(ctx),
    "editorial-lines": () => renderEditorialLines(ctx),
    "flank-strikes": () => renderFlankStrikes(ctx),
    "minimal-cross": () => renderMinimalCross(ctx),
    "luxury-divider": () => renderLuxuryDivider(ctx),
    "coordinate-marks": () => renderCoordinateMarks(ctx),
    "capsule-code": () => renderCapsuleCode(ctx, capsuleText(spec.composition.seed)),
    "sacred-geometry": () => renderSacredGeometry(ctx),
    "grid-system": () => renderGridSystem(ctx),
    "noise-mask": () => renderNoiseMask(ctx),
    "halftone-field": () => renderHalftoneField(ctx),
    "vintage-distress": () => renderVintageDistress(ctx),
    "textured-frame": () => renderTexturedFrame(ctx),
    "minimal-symbol": () => renderMinimalSymbol(ctx),
    "technical-schematic": () => renderTechnicalSchematic(ctx),
    "vertical-rules": () => renderVerticalRules(ctx),
  };

  return group(placed.id, renderers[placed.asset]?.() ?? "");
}

function renderTypeElement(el: TypeElement, ink: string): string {
  const ls = (el.size * el.tracking).toFixed(2);
  const anchor =
    el.align === "middle" ? "middle" : el.align === "end" ? "end" : "start";

  if (el.curved && el.curveRadius) {
    const pathId = el.id;
    const pathD = `M ${el.x - el.curveRadius} ${el.y} A ${el.curveRadius} ${el.curveRadius} 0 0 1 ${el.x + el.curveRadius} ${el.y}`;
    return [
      `<defs><path id="${pathId}" d="${pathD}"/></defs>`,
      `<text fill="${ink}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" opacity="${el.opacity}">`,
      `<textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${escapeXml(el.text.toUpperCase())}</textPath>`,
      `</text>`,
    ].join("");
  }

  if (el.role === "vertical") {
    const chars = el.text.toUpperCase().split("");
    const dy = el.size * el.lineHeight;
    const tspans = chars
      .map((ch, i) => `<tspan x="${el.x}" dy="${i === 0 ? 0 : dy}">${escapeXml(ch)}</tspan>`)
      .join("");
    return `<text fill="${ink}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" opacity="${el.opacity}">${tspans}</text>`;
  }

  const transform =
    el.rotation !== 0 ? ` transform="rotate(${el.rotation} ${el.x} ${el.y})"` : "";

  return `<text x="${el.x}" y="${el.y}" fill="${ink}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="${el.size}" font-weight="${el.weight}" letter-spacing="${ls}" text-anchor="${anchor}" opacity="${el.opacity}" dominant-baseline="alphabetic"${transform}>${escapeXml(el.text.toUpperCase())}</text>`;
}

/** Assembles fully composed artwork layers from specification — no primitives. */
export function composeVectorArtwork(spec: ArtworkSpec): RenderedLayers {
  const heroAssets = spec.assets.filter((a) => a.zone === "hero");
  const secondaryAssets = spec.assets.filter((a) => a.zone === "secondary");
  const accentAssets = spec.assets.filter((a) => a.zone === "accent" || a.zone === "decorative");

  const baseGeometry = group(
    "layer-base-geometry",
    heroAssets.map((a) => renderAsset(spec, a)).join(""),
  );

  const secondaryShapes = group(
    "layer-secondary-shapes",
    secondaryAssets.map((a) => renderAsset(spec, a)).join(""),
  );

  const typeBlocks = spec.typography.filter((t) => t.layer === "typography");
  const decorType = spec.typography.filter((t) => t.layer === "decorative");

  const typography = group(
    "layer-typography",
    typeBlocks.map((t) => group(t.id, renderTypeElement(t, spec.colors.ink))).join(""),
  );

  const decorativeDetails = group(
    "layer-decorative-details",
    [
      accentAssets.map((a) => renderAsset(spec, a)).join(""),
      decorType.map((t) => group(t.id, renderTypeElement(t, spec.colors.ink))).join(""),
    ].join(""),
  );

  const productionGuides = group(
    "print-area",
    rect(
      spec.layout.safeZone.x,
      spec.layout.safeZone.y,
      spec.layout.safeZone.width,
      spec.layout.safeZone.height,
      {
        fill: "none",
        stroke: spec.colors.secondary,
        "stroke-width": 0.5,
        "stroke-dasharray": "4 3",
        opacity: 0.28,
      },
    ),
  );

  return {
    background: group("layer-background", ""),
    baseGeometry,
    secondaryShapes,
    typography,
    decorativeDetails,
    productionGuides,
  };
}
