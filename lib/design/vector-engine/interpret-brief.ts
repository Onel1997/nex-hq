import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { selectBestCompositionCandidate } from "@/lib/design/vector-engine/composition-candidates";
import { buildColorScheme } from "@/lib/design/vector-engine/color";
import { hashString, range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";
import type {
  CompositionCandidate,
  CompositionId,
  DesignSpec,
  Point,
  PrintEffect,
  Rect,
  ShapePlacement,
  TypographyBlock,
} from "@/lib/design/vector-engine/types";
import {
  extractHeadline,
  formatCoordinates,
  toRomanNumeral,
} from "@/lib/design/vector-engine/typography";

function parsePrintSizeCm(dimensions: string): { width: number; height: number } {
  const numbers = dimensions.match(/(\d+(?:\.\d+)?)/g)?.map(Number) ?? [];
  if (numbers.length >= 2) return { width: Math.max(2, numbers[0]), height: Math.max(2, numbers[1]) };
  if (numbers.length === 1) return { width: numbers[0], height: numbers[0] * 1.15 };
  return { width: 28, height: 32 };
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
  candidate: CompositionCandidate,
): { safeZone: Rect; focal: Point; secondary?: Point } {
  const marginBias = candidate.negativeSpaceRatio * 0.12 + DESIGN_TOKENS.margins.safe;
  const safeZone: Rect = {
    x: artboard.x + artboard.width * marginBias,
    y: artboard.y + artboard.height * marginBias,
    width: artboard.width * (1 - marginBias * 2),
    height: artboard.height * (1 - marginBias * 2),
  };

  const center: Point = {
    x: snap(safeZone.x + safeZone.width / 2),
    y: snap(safeZone.y + safeZone.height / 2),
  };

  switch (composition) {
    case "upper-chest":
      return { safeZone, focal: { x: center.x, y: snap(safeZone.y + safeZone.height * 0.34) } };
    case "left-chest":
      return {
        safeZone,
        focal: {
          x: snap(safeZone.x + safeZone.width * 0.34),
          y: snap(safeZone.y + safeZone.height * 0.32),
        },
      };
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
        focal: {
          x: snap(safeZone.x + safeZone.width * 0.58),
          y: snap(safeZone.y + safeZone.height * 0.44),
        },
        secondary: {
          x: snap(safeZone.x + safeZone.width * 0.28),
          y: snap(safeZone.y + safeZone.height * 0.62),
        },
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
  layout: { focal: Point; safeZone: Rect; composition: CompositionId; secondary?: Point },
  seed: number,
  candidate: CompositionCandidate,
): TypographyBlock[] {
  const blocks: TypographyBlock[] = [];
  const typeText = brief.typography.toLowerCase();
  const headline = extractHeadline(brief.title);
  const tokens = DESIGN_TOKENS.typography;
  const typeSys = candidate.typographySystem;
  const geoSys = candidate.geometrySystem;

  const heroR = layout.safeZone.width * geoSys.scale * 0.82;
  const typeAnchorX =
    typeSys.alignment === "asymmetric"
      ? snap(layout.focal.x - layout.safeZone.width * 0.06)
      : typeSys.alignment === "left"
        ? snap(layout.safeZone.x + layout.safeZone.width * 0.14)
        : layout.focal.x;
  const typeAnchorY = snap(
    layout.focal.y +
      heroR * 0.72 +
      layout.safeZone.height * typeSys.headlineYOffset,
  );

  const headlineScale =
    typeSys.headlineScale *
    (candidate.printScale === "micro" ? 0.82 : candidate.printScale === "oversized" ? 1.06 : 1);

  if (!typeText.includes("no type") && !typeText.includes("graphic only")) {
    const headlineWords = headline.trim().split(/\s+/);
    const displayHeadline =
      candidate.printScale === "oversized" && headlineWords.length > 1
        ? headlineWords.slice(0, 2).join(" ")
        : headlineWords.length > 2
          ? headlineWords.slice(0, 2).join(" ")
          : headline;

    const typeOpacity =
      typeSys.hierarchy === "type-first" ? 0.96 : typeSys.hierarchy === "geometry-first" ? 0.82 : 0.9;

    blocks.push({
      role: "headline",
      text: displayHeadline,
      x: typeAnchorX,
      y: typeAnchorY,
      size: tokens.headline.size * headlineScale,
      tracking: tokens.headline.tracking + typeSys.trackingBoost,
      lineHeight: tokens.headline.lineHeight,
      align: typeSys.alignment === "left" ? "start" : "middle",
      rotation: 0,
      opacity: typeOpacity,
      weight: typeSys.hierarchy === "type-first" ? 500 : 450,
    });

    if (typeSys.includeSubHeadline) {
      const editionYear = String(2020 + (seed % 6));
      blocks.push({
        role: "sub-headline",
        text: `${brief.product.split(" ")[0]?.toUpperCase() ?? "STUDIO"} · ${editionYear}`,
        x: typeAnchorX,
        y: snap(typeAnchorY + tokens.headline.size * headlineScale * 1.12),
        size: tokens.subHeadline.size * (candidate.printScale === "micro" ? 0.9 : 1),
        tracking: tokens.subHeadline.tracking + typeSys.trackingBoost * 0.6,
        lineHeight: tokens.subHeadline.lineHeight,
        align: typeSys.alignment === "left" ? "start" : "middle",
        rotation: 0,
        opacity: 0.52,
        weight: 400,
      });
    }
  }

  if (typeSys.includeCoordinates) {
    const coordCount = 2 + Math.min(2, candidate.detailSystem.microDetailCount - 2);
    const coordPositions = [
      {
        x: layout.safeZone.x + layout.safeZone.width * 0.12,
        y: layout.safeZone.y + layout.safeZone.height * 0.9,
        align: "start" as const,
      },
      {
        x: layout.safeZone.x + layout.safeZone.width * 0.88,
        y: layout.safeZone.y + layout.safeZone.height * 0.9,
        align: "end" as const,
      },
      {
        x: layout.safeZone.x + layout.safeZone.width * 0.88,
        y: layout.safeZone.y + layout.safeZone.height * 0.1,
        align: "end" as const,
      },
      {
        x: layout.safeZone.x + layout.safeZone.width * 0.12,
        y: layout.safeZone.y + layout.safeZone.height * 0.1,
        align: "start" as const,
      },
    ].slice(0, coordCount);

    coordPositions.forEach((pos, i) => {
      blocks.push({
        role: "coordinates",
        text: formatCoordinates(seed + i * 17).replace("° N", "°").replace("° W", ""),
        x: snap(pos.x),
        y: snap(pos.y),
        size: tokens.coordinates.size,
        tracking: tokens.coordinates.tracking + typeSys.trackingBoost * 0.4,
        lineHeight: tokens.coordinates.lineHeight,
        align: pos.align,
        rotation: 0,
        opacity: 0.32 + (i % 2) * 0.08,
        weight: 400,
      });
    });
  }

  if (typeSys.includeRomanNumeral || candidate.detailSystem.includeSideRoman) {
    blocks.push({
      role: "roman-numeral",
      text: toRomanNumeral(seed),
      x: snap(layout.safeZone.x + layout.safeZone.width * 0.08),
      y: snap(layout.safeZone.y + layout.safeZone.height * 0.11),
      size: tokens.romanNumeral.size,
      tracking: tokens.romanNumeral.tracking + 0.08,
      lineHeight: tokens.romanNumeral.lineHeight,
      align: "start",
      rotation: 0,
      opacity: 0.38,
      weight: 400,
    });
  }

  if (typeSys.includeCapsuleCode || candidate.detailSystem.includeCapsuleCode) {
    const roman = toRomanNumeral(seed);
    blocks.push({
      role: "caption",
      text: `${roman} · ${String(2020 + (seed % 6)).slice(-2)}`,
      x: layout.focal.x,
      y: snap(typeAnchorY + heroR * 0.42),
      size: tokens.caption.size,
      tracking: tokens.caption.tracking + 0.1,
      lineHeight: tokens.caption.lineHeight,
      align: "middle",
      rotation: 0,
      opacity: 0.55,
      weight: 400,
    });
  }

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

function buildShapes(
  brief: DesignStudioBrief,
  layout: { focal: Point; safeZone: Rect; secondary?: Point },
  seed: number,
  candidate: CompositionCandidate,
  strokeWidth: number,
  outlineOnly: boolean,
): { primaryShape: ShapePlacement; secondaryShapes: ShapePlacement[] } {
  const geo = candidate.geometrySystem;
  const geoCx = layout.focal.x;
  const geoCy = snap(layout.focal.y + layout.safeZone.height * geo.yOffset);
  const primaryScale = layout.safeZone.width * geo.scale * candidate.visualWeight;

  const primaryShape: ShapePlacement = {
    kind: geo.primaryKind,
    cx: geoCx,
    cy: geoCy,
    scale: primaryScale,
    rotation: range(seed, 1, -5, 5),
    opacity: geo.includeDualArcs ? 0.95 : 0.88,
    strokeWidth,
    fillMode:
      outlineOnly || geo.primaryKind === "ring" || geo.primaryKind === "arc" ? "outline" : "both",
  };

  const detailCount = Math.min(geo.secondaryKinds.length, candidate.detailSystem.microDetailCount - 2);
  const secondaryShapes: ShapePlacement[] = geo.secondaryKinds.slice(0, Math.max(1, detailCount)).map(
    (kind, index) => {
      const anchor = index === 0 && layout.secondary ? layout.secondary : layout.focal;
      const offsetX =
        candidate.symmetry === "asymmetric"
          ? range(seed, index + 10, -layout.safeZone.width * 0.1, layout.safeZone.width * 0.1)
          : 0;
      const offsetY = snap(layout.safeZone.height * (0.12 + index * 0.08));
      return {
        kind,
        cx: snap(anchor.x + offsetX),
        cy: snap(anchor.y + offsetY),
        scale: primaryScale * range(seed, index + 5, 0.18, 0.32),
        rotation: range(seed, index + 12, -10, 10),
        opacity: range(seed, index + 13, 0.42, 0.72),
        strokeWidth: strokeWidth * 0.85,
        fillMode: kind === "ring" || kind === "arc" || kind === "broken-circle" ? "outline" : "both",
      };
    },
  );

  brief.visualElements.slice(0, 2).forEach((element, index) => {
    const lower = element.toLowerCase();
    if (lower.includes("line") || lower.includes("bar")) {
      secondaryShapes.push({
        kind: "parallel-lines",
        cx: layout.focal.x,
        cy: snap(geoCy + primaryScale * 0.22),
        scale: primaryScale * 0.28,
        rotation: range(seed, index + 20, -4, 4),
        opacity: 0.5,
        strokeWidth: strokeWidth * 0.7,
        fillMode: "outline",
      });
    }
  });

  return { primaryShape, secondaryShapes };
}

export function interpretBrief(brief: DesignStudioBrief): DesignSpec {
  const compositionCandidate = selectBestCompositionCandidate(brief);
  const seed = hashString(
    [brief.designId, brief.geometry, ...brief.visualElements, brief.placement, compositionCandidate.id].join(
      "|",
    ),
  );
  const printCm = parsePrintSizeCm(brief.dimensions);
  const artboard: Rect = {
    x: 0,
    y: 0,
    width: snap(printCm.width * DESIGN_TOKENS.cm),
    height: snap(printCm.height * DESIGN_TOKENS.cm),
  };

  const composition = compositionCandidate.layoutFamily;
  const { safeZone, focal, secondary } = layoutFrame(composition, artboard, compositionCandidate);
  const colors = buildColorScheme(brief.colorPalette, brief.color, brief.materialEffects, seed);
  const effects = detectEffects(brief.materialEffects, brief.productionMethod);
  const strokeWidth =
    composition === "minimal" || compositionCandidate.printScale === "micro"
      ? DESIGN_TOKENS.stroke.hairline
      : composition.includes("oversized") || compositionCandidate.printScale === "oversized"
        ? DESIGN_TOKENS.stroke.medium
        : DESIGN_TOKENS.stroke.thin;
  const outlineOnly = effects.includes("outline");

  const { primaryShape, secondaryShapes } = buildShapes(
    brief,
    { focal, safeZone, secondary },
    seed,
    compositionCandidate,
    strokeWidth,
    outlineOnly,
  );

  const typography = buildTypography(
    brief,
    { focal, safeZone, composition, secondary },
    seed,
    compositionCandidate,
  );

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
    compositionCandidate,
  };
}
