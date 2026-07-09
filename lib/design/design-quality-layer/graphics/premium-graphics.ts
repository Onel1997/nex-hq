import { circle, group, line, path, rect } from "@/lib/design/vector-engine/xml";
import type { GraphicSpec, LayoutSpec } from "@/lib/design/fashion-design-engine/types";
import type { PanelLayout } from "@/lib/design/fashion-design-engine/types";
import type { CompositionTemplateId } from "../types";

export interface PremiumGraphicsInput {
  templateId: CompositionTemplateId;
  graphicSpec: GraphicSpec;
  layoutSpec: LayoutSpec;
  panel: PanelLayout;
  artboard: { widthMm: number; heightMm: number };
}

function resolveInk(spec: GraphicSpec, index = 0): string {
  const entry = spec.colorApplication[index];
  if (entry?.hex) return entry.hex;
  const name = entry?.color?.toLowerCase() ?? "";
  if (name.includes("grey") || name.includes("gray") || name.includes("concrete")) return "#8A8A8A";
  if (name.includes("black")) return "#141414";
  return "#ECEAE4";
}

function renderRegistrationMarks(
  panel: PanelLayout,
  artboard: PremiumGraphicsInput["artboard"],
  ink: string,
): string {
  const corners = [
    { x: 6, y: 6 },
    { x: artboard.widthMm - 6, y: 6 },
    { x: 6, y: artboard.heightMm - 6 },
    { x: artboard.widthMm - 6, y: artboard.heightMm - 6 },
  ];

  return corners
    .map((corner, index) => {
      const cross = [
        line(corner.x - 2.5, corner.y, corner.x + 2.5, corner.y, {
          stroke: ink,
          "stroke-width": "0.35mm",
          opacity: 0.45,
        }),
        line(corner.x, corner.y - 2.5, corner.x, corner.y + 2.5, {
          stroke: ink,
          "stroke-width": "0.35mm",
          opacity: 0.45,
        }),
      ].join("");
      return group(`registration-mark-${index}`, cross, { "data-registration": "true" });
    })
    .join("");
}

function renderThinGrid(panel: PanelLayout, ink: string): string {
  const left = panel.safeMarginMm;
  const top = panel.offsetFromCollarMm;
  const right = panel.boundingBoxMm.width - panel.safeMarginMm;
  const bottom = top + panel.boundingBoxMm.height * 0.7;
  const midX = panel.boundingBoxMm.width / 2 + panel.offsetFromCenterMm;
  const midY = top + (bottom - top) / 2;

  const lines = [
    line(left, top, right, top, { stroke: ink, "stroke-width": "0.25mm", opacity: 0.25 }),
    line(left, bottom, right, bottom, { stroke: ink, "stroke-width": "0.25mm", opacity: 0.25 }),
    line(midX, top, midX, bottom, { stroke: ink, "stroke-width": "0.2mm", opacity: 0.2 }),
    line(left, midY, right, midY, { stroke: ink, "stroke-width": "0.2mm", opacity: 0.2 }),
  ];

  return group("quality-thin-grid", lines.join(""), { "data-grid": "true" });
}

function renderPerimeterFrame(panel: PanelLayout, ink: string, inset = 10): string {
  const x = panel.safeMarginMm + inset;
  const y = panel.offsetFromCollarMm + inset;
  const w = panel.boundingBoxMm.width - (panel.safeMarginMm + inset) * 2;
  const h = panel.boundingBoxMm.height * 0.62 - inset;

  return rect(x, y, w, h, {
    fill: "none",
    stroke: ink,
    "stroke-width": "0.7mm",
    opacity: 0.5,
    rx: 2,
  });
}

function renderSubtleArcs(panel: PanelLayout, ink: string, count: number): string {
  const cx = panel.boundingBoxMm.width / 2 + panel.offsetFromCenterMm;
  const cy = panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.38;
  const arcs: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const r = 28 + i * 14;
    arcs.push(
      path(`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`, {
        fill: "none",
        stroke: ink,
        "stroke-width": "0.55mm",
        opacity: 0.35 + i * 0.05,
      }),
    );
  }

  return group("quality-subtle-arcs", arcs.join(""), { "data-arcs": "true" });
}

function renderLuxuryLabelBlock(panel: PanelLayout, ink: string): string {
  const cx = panel.boundingBoxMm.width / 2 + panel.offsetFromCenterMm;
  const cy = panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.4;
  const w = Math.min(panel.boundingBoxMm.width * 0.55, 120);
  const h = panel.boundingBoxMm.height * 0.28;

  const frame = rect(cx - w / 2, cy - h / 2, w, h, {
    fill: "none",
    stroke: ink,
    "stroke-width": "0.9mm",
    opacity: 0.6,
    rx: 1.5,
  });

  const corners = [
    line(cx - w / 2, cy - h / 2, cx - w / 2 + 6, cy - h / 2, {
      stroke: ink,
      "stroke-width": "1.2mm",
      opacity: 0.75,
    }),
    line(cx + w / 2 - 6, cy + h / 2, cx + w / 2, cy + h / 2, {
      stroke: ink,
      "stroke-width": "1.2mm",
      opacity: 0.75,
    }),
  ];

  return group("luxury-label-block", frame + corners.join(""), { "data-label": "luxury" });
}

function renderBoundarySymbols(panel: PanelLayout, ink: string): string {
  const cx = panel.boundingBoxMm.width / 2 + panel.offsetFromCenterMm;
  const top = panel.offsetFromCollarMm + 12;
  const bottom = panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.62;

  const marks = [
    path(`M ${cx} ${top} l 3 5 l -6 0 z`, { fill: ink, opacity: 0.5 }),
    path(`M ${cx} ${bottom} l 3 -5 l -6 0 z`, { fill: ink, opacity: 0.5 }),
    circle(panel.safeMarginMm + 4, top, 1.2, { fill: "none", stroke: ink, "stroke-width": "0.4mm", opacity: 0.45 }),
    circle(panel.boundingBoxMm.width - panel.safeMarginMm - 4, top, 1.2, {
      fill: "none",
      stroke: ink,
      "stroke-width": "0.4mm",
      opacity: 0.45,
    }),
  ];

  return group("boundary-symbols", marks.join(""), { "data-boundary": "true" });
}

function renderDistressedTexture(artboard: PremiumGraphicsInput["artboard"], intensity: number): string {
  const opacity = Math.min(0.12, intensity / 1000);
  return [
    `<defs>`,
    `<filter id="quality-distress" x="0" y="0" width="100%" height="100%">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="42" result="noise"/>`,
    `<feColorMatrix type="saturate" values="0" in="noise" result="mono"/>`,
    `<feBlend in="SourceGraphic" in2="mono" mode="multiply"/>`,
    `</filter>`,
    `<rect x="0" y="0" width="${artboard.widthMm}" height="${artboard.heightMm}" fill="#ECEAE4" opacity="${opacity}" filter="url(#quality-distress)" pointer-events="none"/>`,
    `</defs>`,
  ].join("");
}

function renderConcreteGrain(artboard: PremiumGraphicsInput["artboard"]): string {
  return [
    `<defs>`,
    `<pattern id="concrete-grain" width="4" height="4" patternUnits="userSpaceOnUse">`,
    `<circle cx="1" cy="1" r="0.25" fill="#8A8A8A" opacity="0.08"/>`,
    `<circle cx="3" cy="3" r="0.2" fill="#8A8A8A" opacity="0.06"/>`,
    `</pattern>`,
    `<rect x="0" y="0" width="${artboard.widthMm}" height="${artboard.heightMm}" fill="url(#concrete-grain)" opacity="0.35" pointer-events="none"/>`,
    `</defs>`,
  ].join("");
}

function renderCoordinateMark(panel: PanelLayout, ink: string): string {
  const x = panel.boundingBoxMm.width - panel.safeMarginMm - 4;
  const y = panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.62;
  const tick = line(x - 8, y, x, y, { stroke: ink, "stroke-width": "0.3mm", opacity: 0.35 });
  return group("coordinate-mark", tick, { "data-coordinates": "registration" });
}

/**
 * Render premium graphic systems as vector SVG — textures, frames, marks, arcs.
 * Typography remains in TypographySpec / vector-artwork-renderer only.
 */
export function renderPremiumGraphicSystems(input: PremiumGraphicsInput): string {
  const { templateId, graphicSpec, panel, artboard } = input;
  const ink = resolveInk(graphicSpec);
  const secondaryInk = resolveInk(graphicSpec, 1);
  const parts: string[] = [];

  const hasGrain = graphicSpec.textures.some((t) => t.type === "grain");
  const hasDistress = graphicSpec.textures.some((t) => t.type === "distress");
  const distressIntensity = graphicSpec.textures.find((t) => t.type === "distress")?.intensityPercent ?? 0;

  if (hasGrain) {
    parts.push(renderConcreteGrain(artboard));
  }
  if (hasDistress && distressIntensity > 0) {
    parts.push(renderDistressedTexture(artboard, distressIntensity));
  }

  parts.push(renderRegistrationMarks(panel, artboard, secondaryInk));
  parts.push(renderThinGrid(panel, secondaryInk));

  if (templateId !== "minimal-front-chest") {
    parts.push(renderPerimeterFrame(panel, ink));
    parts.push(renderSubtleArcs(panel, ink, templateId === "abstract-perimeter" ? 4 : 2));
    parts.push(renderBoundarySymbols(panel, secondaryInk));
  }

  if (templateId === "luxury-badge" || templateId === "vintage-label") {
    parts.push(renderLuxuryLabelBlock(panel, ink));
  }

  if (templateId === "vintage-label") {
    parts.push(renderCoordinateMark(panel, secondaryInk));
  }

  if (parts.length === 0) {
    return "";
  }

  return group("design-quality-graphics", parts.join(""), {
    "data-quality-layer": "true",
    "data-template": templateId,
  });
}

export function countGraphicElements(graphicSpec: GraphicSpec): number {
  return (
    graphicSpec.symbols.length +
    graphicSpec.lineSystems.length +
    graphicSpec.abstractElements.length +
    graphicSpec.textures.filter((t) => t.type !== "none").length
  );
}
