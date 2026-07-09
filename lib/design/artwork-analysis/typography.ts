import type { TypographyAnalysis, TypographyBlock, TypographyStyle } from "./types";

function inferStyleFromFonts(fonts: string[], sizes: number[]): TypographyStyle {
  const corpus = fonts.join(" ").toLowerCase();
  if (/mono|courier|technical|industrial/i.test(corpus)) return "Industrial";
  if (/serif|didot|baskerville|times/i.test(corpus)) return "Editorial";
  if (/script|vintage|retro|western/i.test(corpus)) return "Vintage";
  if (/condensed|impact|heavy|black|bold/i.test(corpus) || Math.max(...sizes, 0) > 72) {
    return "Bold";
  }
  if (/grotesk|helvetica|inter|sans/i.test(corpus) && Math.max(...sizes, 0) < 36) {
    return "Minimal";
  }
  if (/street|graffiti|urban/i.test(corpus)) return "Streetwear";
  if (/luxury|fashion|editorial/i.test(corpus)) return "Luxury";
  return sizes.length > 0 && Math.max(...sizes) > 48 ? "Bold" : "Minimal";
}

function parseSvgTypography(svgMarkup: string): TypographyAnalysis {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
  const textNodes = [...doc.querySelectorAll("text, tspan")];

  const blocks: TypographyBlock[] = [];
  for (const node of textNodes) {
    const content = (node.textContent ?? "").trim();
    if (!content) continue;
    blocks.push({
      role: "unknown",
      content,
      fontSize: parseFloat(node.getAttribute("font-size") || "0") || undefined,
      fontFamily: node.getAttribute("font-family") || undefined,
      letterSpacing: node.getAttribute("letter-spacing") || undefined,
      alignment: node.getAttribute("text-anchor") || undefined,
    });
  }

  const sizes = blocks.map((b) => b.fontSize ?? 0).filter((s) => s > 0);
  const sorted = [...blocks].sort((a, b) => (b.fontSize ?? 0) - (a.fontSize ?? 0));

  if (sorted[0]) sorted[0].role = "headline";
  if (sorted[1]) sorted[1].role = "subheadline";
  sorted.slice(2).forEach((b) => {
    b.role = "supporting";
  });

  const fonts = blocks.map((b) => b.fontFamily ?? "").filter(Boolean);
  const style = inferStyleFromFonts(fonts, sizes);

  const anchors = blocks.map((b) => b.alignment).filter(Boolean);
  const alignment =
    anchors.every((a) => a === "middle") ? "Center"
    : anchors.every((a) => a === "end") ? "Right"
    : anchors.every((a) => a === "start") ? "Left"
    : anchors.length > 0 ? "Mixed"
    : "Unknown";

  const spacingValues = blocks
    .map((b) => b.letterSpacing)
    .filter((s): s is string => Boolean(s));
  const letterSpacing =
    spacingValues.some((s) => parseFloat(s) > 2) ? "Wide"
    : spacingValues.some((s) => parseFloat(s) < -0.5) ? "Tight"
    : spacingValues.length > 0 ? "Normal"
    : "Unknown";

  const hierarchyScore = sizes.length >= 2
    ? Math.min(100, Math.round(((sizes[0] ?? 1) / (sizes[sizes.length - 1] ?? 1)) * 20))
    : blocks.length > 0 ? 55 : 0;

  return {
    detected: blocks.length > 0,
    style,
    blocks: sorted,
    hierarchyScore,
    letterSpacing,
    alignment,
    summary:
      blocks.length > 0
        ? `${blocks.length} text layer${blocks.length > 1 ? "s" : ""} — ${style} typography with ${alignment.toLowerCase()} alignment.`
        : "No editable text layers found in SVG.",
  };
}

function inferRasterTypography(
  edgeDensity: number,
  contrastScore: number,
): TypographyAnalysis {
  const typographyLikely = edgeDensity > 0.08 && contrastScore > 45;
  const style: TypographyStyle =
    edgeDensity > 0.14 ? "Bold" : edgeDensity > 0.1 ? "Streetwear" : "Minimal";

  return {
    detected: typographyLikely,
    style,
    blocks: typographyLikely
      ? [{ role: "headline", content: "Raster typeforms detected" }]
      : [],
    hierarchyScore: typographyLikely ? 62 : 30,
    letterSpacing: "Unknown",
    alignment: "Unknown",
    summary: typographyLikely
      ? `Raster artwork shows ${style.toLowerCase()} type characteristics — outline text not editable.`
      : "No distinct typography detected — likely illustration or symbol-driven artwork.",
  };
}

export function analyzeTypography(input: {
  fileKind: string;
  svgMarkup?: string;
  edgeDensity?: number;
  contrastScore?: number;
}): TypographyAnalysis {
  if (input.fileKind === "svg" && input.svgMarkup) {
    return parseSvgTypography(input.svgMarkup);
  }

  return inferRasterTypography(input.edgeDensity ?? 0, input.contrastScore ?? 0);
}
