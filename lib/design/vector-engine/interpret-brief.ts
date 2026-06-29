import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { buildColorScheme } from "@/lib/design/vector-engine/color";
import { hashString, pick, range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";
import type {
  CompositionId,
  DesignSpec,
  Point,
  PrimitiveKind,
  PrintEffect,
  Rect,
  ShapePlacement,
  TypographyBlock,
} from "@/lib/design/vector-engine/types";
import {
  extractHeadline,
  formatCoordinates,
} from "@/lib/design/vector-engine/typography";

const KEYWORD_MAP: Array<{ keys: string[]; kind: PrimitiveKind }> = [
  { keys: ["ring", "halo", "orbital"], kind: "ring" },
  { keys: ["circle", "orb", "dot", "sphere"], kind: "circle" },
  { keys: ["arc", "crescent", "curve"], kind: "arc" },
  { keys: ["half", "semicircle", "dome"], kind: "half-circle" },
  { keys: ["broken", "segment", "incomplete", "interrupted"], kind: "broken-circle" },
  { keys: ["parallel", "bars", "lines", "stroke", "bar"], kind: "parallel-lines" },
  { keys: ["radial", "spoke", "sunburst"], kind: "radial-lines" },
  { keys: ["cross", "plus", "intersect"], kind: "cross" },
  { keys: ["grid", "matrix", "woven"], kind: "grid" },
  { keys: ["dot", "speckle", "stipple"], kind: "dots" },
  { keys: ["organic", "blob", "fluid"], kind: "organic-blob" },
  { keys: ["bezier", "swoosh", "flow"], kind: "bezier-curve" },
  { keys: ["noise", "grain", "texture"], kind: "noise-pattern" },
  { keys: ["frame", "border", "box"], kind: "frame" },
  { keys: ["rounded", "pill", "soft rect"], kind: "rounded-rectangle" },
  { keys: ["rect", "block", "plaque"], kind: "rectangle" },
  { keys: ["diamond", "rhombus", "lozenge"], kind: "diamond" },
  { keys: ["star", "asterisk"], kind: "star" },
  { keys: ["symbol", "mark", "glyph", "icon"], kind: "minimal-symbol" },
];

function parsePrintSizeCm(dimensions: string): { width: number; height: number } {
  const numbers = dimensions.match(/(\d+(?:\.\d+)?)/g)?.map(Number) ?? [];
  if (numbers.length >= 2) return { width: Math.max(2, numbers[0]), height: Math.max(2, numbers[1]) };
  if (numbers.length === 1) return { width: numbers[0], height: numbers[0] * 1.15 };
  return { width: 28, height: 32 };
}

function detectComposition(placement: string, printArea: string, role: string): CompositionId {
  const text = `${placement} ${printArea} ${role}`.toLowerCase();
  if (text.includes("dual") || text.includes("split") || text.includes("two placement")) return "dual-print";
  if (text.includes("left chest") || text.includes("left-chest")) return "left-chest";
  if (text.includes("upper chest") || text.includes("high chest")) return "upper-chest";
  if (text.includes("oversized") && text.includes("back")) return "oversized-back";
  if (text.includes("oversized") || text.includes("full front") || text.includes("statement front")) return "oversized-front";
  if (text.includes("shoulder") || text.includes("nape")) return "back-shoulder";
  if (text.includes("hem") || text.includes("bottom")) return "bottom-hem";
  if (text.includes("vertical") || text.includes("stacked") || text.includes("column")) return "vertical";
  if (text.includes("asym") || text.includes("offset") || text.includes("off-center")) return "asymmetrical";
  if (text.includes("minimal") || text.includes("subtle") || text.includes("micro")) return "minimal";
  if (text.includes("center") || text.includes("chest")) return "center-chest";
  return "center-chest";
}

function matchPrimitive(text: string, seed: number, fallbackIndex: number): PrimitiveKind {
  const lower = text.toLowerCase();
  const ranked = [...KEYWORD_MAP].sort((a, b) => {
    const lenA = Math.max(...a.keys.map((k) => k.length));
    const lenB = Math.max(...b.keys.map((k) => k.length));
    return lenB - lenA;
  });
  for (const entry of ranked) {
    if (entry.keys.some((k) => lower.includes(k))) return entry.kind;
  }
  const fallbacks: PrimitiveKind[] = ["ring", "parallel-lines", "arc", "minimal-symbol", "frame", "cross"];
  return pick(seed, fallbackIndex, fallbacks);
}

function detectEffects(material: string, production: string): PrintEffect[] {
  const text = `${material} ${production}`.toLowerCase();
  const effects: PrintEffect[] = [];
  if (text.includes("distress") || text.includes("worn")) effects.push("distressed");
  if (text.includes("grain") || text.includes("texture")) effects.push("grain");
  if (text.includes("halftone") || text.includes("screen tone")) effects.push("halftone");
  if (text.includes("fade") || text.includes("washed") || text.includes("vintage")) effects.push("faded");
  if (text.includes("split") || text.includes("strike")) effects.push("split-lines");
  if (text.includes("outline") || text.includes("stroke only")) effects.push("outline");
  else effects.push("filled");
  if (text.includes("mask") || text.includes("texture mask")) effects.push("texture-mask");
  return effects;
}

function layoutFrame(
  composition: CompositionId,
  artboard: Rect,
): { safeZone: Rect; focal: Point; secondary?: Point } {
  const m = DESIGN_TOKENS.margins.safe;
  const safeZone: Rect = {
    x: artboard.x + artboard.width * m,
    y: artboard.y + artboard.height * m,
    width: artboard.width * (1 - m * 2),
    height: artboard.height * (1 - m * 2),
  };

  const center: Point = {
    x: snap(safeZone.x + safeZone.width / 2),
    y: snap(safeZone.y + safeZone.height / 2),
  };

  switch (composition) {
    case "upper-chest":
      return { safeZone, focal: { x: center.x, y: snap(safeZone.y + safeZone.height * 0.34) } };
    case "left-chest":
      return { safeZone, focal: { x: snap(safeZone.x + safeZone.width * 0.34), y: snap(safeZone.y + safeZone.height * 0.32) } };
    case "oversized-front":
    case "oversized-back":
      return { safeZone, focal: center };
    case "back-shoulder":
      return { safeZone, focal: { x: center.x, y: snap(safeZone.y + safeZone.height * 0.22) } };
    case "bottom-hem":
      return { safeZone, focal: { x: center.x, y: snap(safeZone.y + safeZone.height * 0.78) } };
    case "vertical":
      return { safeZone, focal: { x: center.x, y: snap(safeZone.y + safeZone.height * 0.42) } };
    case "asymmetrical":
      return {
        safeZone,
        focal: { x: snap(safeZone.x + safeZone.width * 0.58), y: snap(safeZone.y + safeZone.height * 0.44) },
        secondary: { x: snap(safeZone.x + safeZone.width * 0.28), y: snap(safeZone.y + safeZone.height * 0.62) },
      };
    case "dual-print":
      return {
        safeZone,
        focal: { x: snap(safeZone.x + safeZone.width * 0.32), y: center.y },
        secondary: { x: snap(safeZone.x + safeZone.width * 0.68), y: center.y },
      };
    case "minimal":
      return { safeZone, focal: { x: center.x, y: snap(safeZone.y + safeZone.height * 0.46) } };
  default:
      return { safeZone, focal: center };
  }
}

function buildTypography(
  brief: DesignStudioBrief,
  layout: { focal: Point; safeZone: Rect; composition: CompositionId },
  seed: number,
): TypographyBlock[] {
  const blocks: TypographyBlock[] = [];
  const typeText = brief.typography.toLowerCase();
  const headline = extractHeadline(brief.title);
  const tokens = DESIGN_TOKENS.typography;

  const heroR = layout.safeZone.width * (layout.composition.includes("oversized") ? 0.62 : 0.56) * 0.42;
  const typeAnchorY = snap(layout.focal.y + heroR * 0.82 + layout.safeZone.height * 0.1);
  const isHero =
    brief.role.toLowerCase().includes("hero") ||
    layout.composition.includes("oversized") ||
    !typeText.includes("graphic only");

  const headlineScale =
    layout.composition === "minimal" ? 0.88 : layout.composition.includes("oversized") ? 1.08 : 1;

  if (!typeText.includes("no type") && !typeText.includes("graphic only")) {
    const headlineWords = headline.trim().split(/\s+/);
    const displayHeadline =
      headlineWords.length > 2 ? headlineWords.slice(0, 2).join(" ") : headline;

    blocks.push({
      role: "headline",
      text: displayHeadline,
      x: layout.focal.x,
      y: typeAnchorY,
      size: tokens.headline.size * headlineScale,
      tracking: tokens.headline.tracking + 0.06,
      lineHeight: tokens.headline.lineHeight,
      align: "middle",
      rotation: 0,
      opacity: 0.94,
      weight: 500,
    });

    if (isHero && layout.composition !== "minimal") {
      const editionYear = String(2020 + (seed % 6));
      blocks.push({
        role: "sub-headline",
        text: `${brief.product.split(" ")[0]?.toUpperCase() ?? "STUDIO"} · ${editionYear}`,
        x: layout.focal.x,
        y: snap(typeAnchorY + tokens.headline.size * headlineScale * 1.15),
        size: tokens.subHeadline.size,
        tracking: tokens.subHeadline.tracking + 0.12,
        lineHeight: tokens.subHeadline.lineHeight,
        align: "middle",
        rotation: 0,
        opacity: 0.58,
        weight: 400,
      });
    }
  }

  const coordCount = 2 + (seed % 3);
  const coordPositions = [
    { x: layout.safeZone.x + layout.safeZone.width * 0.14, y: layout.safeZone.y + layout.safeZone.height * 0.88, align: "start" as const },
    { x: layout.safeZone.x + layout.safeZone.width * 0.86, y: layout.safeZone.y + layout.safeZone.height * 0.88, align: "end" as const },
    { x: layout.safeZone.x + layout.safeZone.width * 0.86, y: layout.safeZone.y + layout.safeZone.height * 0.12, align: "end" as const },
    { x: layout.safeZone.x + layout.safeZone.width * 0.14, y: layout.safeZone.y + layout.safeZone.height * 0.12, align: "start" as const },
  ].slice(0, coordCount);

  coordPositions.forEach((pos, i) => {
    blocks.push({
      role: "coordinates",
      text: formatCoordinates(seed + i * 17).replace("° N", "°").replace("° W", ""),
      x: snap(pos.x),
      y: snap(pos.y),
      size: tokens.coordinates.size,
      tracking: tokens.coordinates.tracking + 0.08,
      lineHeight: tokens.coordinates.lineHeight,
      align: pos.align,
      rotation: 0,
      opacity: 0.36 + (i % 2) * 0.06,
      weight: 400,
    });
  });

  if (typeText.includes("quote") || typeText.includes("\"")) {
    const quoteMatch = brief.typography.match(/"([^"]+)"/);
    const quote = quoteMatch?.[1] ?? "";
    if (quote) {
      blocks.push({
        role: "quote",
        text: quote.slice(0, 36),
        x: layout.focal.x,
        y: snap(layout.focal.y - heroR * 0.55),
        size: tokens.quote.size,
        tracking: tokens.quote.tracking,
        lineHeight: tokens.quote.lineHeight,
        align: "middle",
        rotation: 0,
        opacity: 0.44,
        weight: 300,
        curved: typeText.includes("curve"),
        curveRadius: layout.safeZone.width * 0.2,
      });
    }
  }

  if (layout.composition === "vertical") {
    const verticalWord =
      headline.split(" ").find((w) => w.length >= 4 && w.length <= 5)?.slice(0, 5) ??
      headline.replace(/\s/g, "").slice(0, 4);
    blocks.push({
      role: "vertical",
      text: verticalWord,
      x: snap(layout.safeZone.x + layout.safeZone.width * 0.09),
      y: snap(layout.safeZone.y + layout.safeZone.height * 0.3),
      size: tokens.vertical.size,
      tracking: tokens.vertical.tracking,
      lineHeight: tokens.vertical.lineHeight * 1.1,
      align: "start",
      rotation: 0,
      opacity: 0.55,
      weight: 400,
    });
  }

  return blocks;
}

function shapeFromElement(
  element: string,
  index: number,
  point: Point,
  safeZone: Rect,
  seed: number,
  strokeWidth: number,
): ShapePlacement {
  const kind = matchPrimitive(element, seed, index + 2);
  const scale = safeZone.width * range(seed, index + 5, 0.22, 0.38);
  return {
    kind,
    cx: point.x + range(seed, index + 10, -safeZone.width * 0.08, safeZone.width * 0.08),
    cy: point.y + range(seed, index + 11, -safeZone.height * 0.06, safeZone.height * 0.06),
    scale,
    rotation: range(seed, index + 12, -12, 12),
    opacity: range(seed, index + 13, 0.45, 0.85),
    strokeWidth,
    fillMode: kind === "ring" || kind === "arc" || kind === "broken-circle" ? "outline" : "both",
  };
}

export function interpretBrief(brief: DesignStudioBrief): DesignSpec {
  const seed = hashString(
    [brief.designId, brief.geometry, ...brief.visualElements, brief.placement].join("|"),
  );
  const printCm = parsePrintSizeCm(brief.dimensions);
  const artboard: Rect = {
    x: 0,
    y: 0,
    width: snap(printCm.width * DESIGN_TOKENS.cm),
    height: snap(printCm.height * DESIGN_TOKENS.cm),
  };

  const composition = detectComposition(brief.placement, brief.printArea, brief.role);
  const { safeZone, focal, secondary } = layoutFrame(composition, artboard);
  const colors = buildColorScheme(brief.colorPalette, brief.color, brief.materialEffects, seed);
  const effects = detectEffects(brief.materialEffects, brief.productionMethod);
  const strokeWidth =
    composition === "minimal"
      ? DESIGN_TOKENS.stroke.hairline
      : composition.includes("oversized")
        ? DESIGN_TOKENS.stroke.medium
        : DESIGN_TOKENS.stroke.thin;

  const primaryKind = matchPrimitive(brief.geometry, seed, 0);
  const hasRadialAccent = brief.geometry.toLowerCase().includes("radial");
  const primaryScale =
    safeZone.width * (composition === "minimal" ? 0.38 : composition.includes("oversized") ? 0.62 : 0.56);
  const outlineOnly = effects.includes("outline");

  const primaryShape: ShapePlacement = {
    kind: primaryKind,
    cx: focal.x,
    cy: snap(focal.y - safeZone.height * (hasRadialAccent ? 0.1 : 0.06)),
    scale: primaryScale,
    rotation: range(seed, 1, -6, 6),
    opacity: 1,
    strokeWidth,
    fillMode: outlineOnly || primaryKind === "ring" || primaryKind === "arc" ? "outline" : "both",
  };

  const secondaryShapes: ShapePlacement[] = brief.visualElements
    .slice(0, composition === "dual-print" ? 2 : 4)
    .map((element, index) => {
      const anchor = index === 0 && secondary ? secondary : focal;
      const offsetY = snap(safeZone.height * (0.14 + index * 0.1));
      return shapeFromElement(
        element,
        index,
        { x: anchor.x, y: anchor.y + offsetY },
        safeZone,
        seed,
        strokeWidth * 0.85,
      );
    });

  const typography = buildTypography(brief, { focal, safeZone, composition }, seed);

  return {
    composition,
    artboard,
    safeZone,
    focalPoint: focal,
    secondaryFocal: secondary,
    primaryShape,
    secondaryShapes,
    typography,
    colors,
    effects,
    seed,
  };
}
