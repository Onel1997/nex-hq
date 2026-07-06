import { circle, group, line, path } from "@/lib/design/vector-engine/xml";
import type { GraphicSpec } from "@/lib/design/fashion-design-engine/types";
import type { PanelLayout } from "@/lib/design/fashion-design-engine/types";

function resolveInkColor(spec: GraphicSpec, index = 0): string {
  const entry = spec.colorApplication[index];
  if (entry?.hex) return entry.hex;
  const name = entry?.color?.toLowerCase() ?? "";
  if (name.includes("off-white") || name.includes("white")) return "#ECEAE4";
  if (name.includes("grey") || name.includes("gray") || name.includes("concrete")) return "#8A8A8A";
  if (name.includes("black")) return "#141414";
  return "#ECEAE4";
}

function renderLineSystem(
  system: GraphicSpec["lineSystems"][number],
  panel: PanelLayout,
  ink: string,
): string {
  const cx = panel.boundingBoxMm.width / 2 + panel.offsetFromCenterMm;
  const cy = panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.35;
  const opacity = system.opacity;

  if (system.type === "axis") {
    const top = panel.offsetFromCollarMm + 8;
    const bottom = top + panel.boundingBoxMm.height * 0.65;
    return line(cx, top, cx, bottom, {
      stroke: ink,
      "stroke-width": `${system.strokeWidthMm}mm`,
      opacity,
      "stroke-linecap": "square",
    });
  }

  if (system.type === "perimeter") {
    const rx = panel.boundingBoxMm.width * 0.22;
    const ry = panel.boundingBoxMm.height * 0.18;
    return path(
      `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} Z`,
      {
        fill: "none",
        stroke: ink,
        "stroke-width": `${system.strokeWidthMm}mm`,
        opacity,
      },
    );
  }

  if (system.type === "arc") {
    const arcs: string[] = [];
    for (let i = 0; i < system.count; i += 1) {
      const r = 20 + i * (system.spacingMm || 15);
      arcs.push(
        path(`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`, {
          fill: "none",
          stroke: ink,
          "stroke-width": `${system.strokeWidthMm}mm`,
          opacity: i === system.count - 1 ? opacity * 0.85 : opacity,
        }),
      );
    }
    return arcs.join("");
  }

  if (system.type === "grid") {
    const left = panel.safeMarginMm + 6;
    const top = panel.offsetFromCollarMm + 6;
    const right = panel.boundingBoxMm.width - panel.safeMarginMm - 6;
    const bottom = top + panel.boundingBoxMm.height * 0.65;
    const lines: string[] = [];
    const rows = Math.min(system.count, 4);
    for (let i = 0; i <= rows; i += 1) {
      const y = top + ((bottom - top) / rows) * i;
      lines.push(
        line(left, y, right, y, {
          stroke: ink,
          "stroke-width": `${system.strokeWidthMm}mm`,
          opacity: system.opacity * 0.8,
        }),
      );
    }
    return lines.join("");
  }

  const w = panel.boundingBoxMm.width * 0.5;
  const h = panel.boundingBoxMm.height * 0.35;
  return path(`M ${cx - w / 2} ${cy} H ${cx + w / 2}`, {
    stroke: ink,
    "stroke-width": `${system.strokeWidthMm}mm`,
    opacity,
  });
}

function renderSymbol(
  symbol: GraphicSpec["symbols"][number],
  panel: PanelLayout,
  ink: string,
): string {
  const cx = panel.boundingBoxMm.width / 2 + panel.offsetFromCenterMm;
  const cy = panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.4;
  const w = symbol.dimensionsMm.width;
  const h = symbol.dimensionsMm.height;

  if (symbol.abstraction === "organic" || symbol.name.toLowerCase().includes("loop")) {
    return path(
      `M ${cx - w / 2} ${cy} A ${w / 2} ${h / 2} 0 1 1 ${cx + w / 2} ${cy} A ${w / 2} ${h / 2} 0 1 1 ${cx - w / 2} ${cy}`,
      {
        fill: "none",
        stroke: ink,
        "stroke-width": `${symbol.strokeWidthMm}mm`,
      },
    );
  }

  return circle(cx, cy, Math.min(w, h) / 4, {
    fill: "none",
    stroke: ink,
    "stroke-width": `${symbol.strokeWidthMm}mm`,
  });
}

/**
 * Render graphic language as vector paths — no raster image text.
 */
export function renderGraphicElements(
  spec: GraphicSpec,
  panel: PanelLayout,
): string {
  const ink = resolveInkColor(spec);
  const secondaryInk = resolveInkColor(spec, 1);

  const parts: string[] = [];

  for (const system of spec.lineSystems) {
    parts.push(
      group(`graphic-line-${system.id}`, renderLineSystem(system, panel, ink), {
        "data-graphic": system.type,
      }),
    );
  }

  for (const symbol of spec.symbols) {
    parts.push(
      group(`graphic-symbol-${symbol.id}`, renderSymbol(symbol, panel, secondaryInk), {
        "data-symbol": symbol.name,
      }),
    );
  }

  for (const element of spec.abstractElements.slice(0, 3)) {
    const cx = panel.boundingBoxMm.width / 2;
    const cy = panel.offsetFromCollarMm + 20;
    parts.push(
      group(
        element.id,
        line(cx - 30, cy + element.layerOrder * 8, cx + 30, cy + element.layerOrder * 8, {
          stroke: secondaryInk,
          "stroke-width": "1mm",
          opacity: 0.6,
        }),
        { "data-abstract": element.geometry },
      ),
    );
  }

  if (parts.length === 0) {
    return "";
  }

  return group("vector-graphics", parts.join(""), { "data-vector-graphics": "true" });
}
