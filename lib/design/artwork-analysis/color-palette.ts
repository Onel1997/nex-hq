import {
  forEachOpaquePixel,
  luminance,
  rgbToHex,
  saturation,
} from "./pixel-source";
import type { ArtworkPixelData, ColorPaletteAnalysis, ColorSwatch } from "./types";

interface RgbBucket {
  r: number;
  g: number;
  b: number;
  count: number;
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function bucketKey(r: number, g: number, b: number): string {
  const qr = quantize(r, 24);
  const qg = quantize(g, 24);
  const qb = quantize(b, 24);
  return `${qr},${qg},${qb}`;
}

function classifyColorRole(
  r: number,
  g: number,
  b: number,
  lum: number,
  sat: number,
): ColorSwatch["role"] {
  if (lum > 0.88 && sat < 0.12) return "background";
  if (sat < 0.15) return "neutral";
  if (sat > 0.45 && lum > 0.35 && lum < 0.75) return "accent";
  if (lum < 0.35) return "primary";
  return "secondary";
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function analyzeColorPalette(pixels: ArtworkPixelData): ColorPaletteAnalysis {
  const buckets = new Map<string, RgbBucket>();
  let total = 0;

  forEachOpaquePixel(pixels.imageData, (x, y, r, g, b) => {
    void x;
    void y;
    const key = bucketKey(r, g, b);
    const existing = buckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
    total += 1;
  });

  if (total === 0) {
    return {
      swatches: [],
      contrastScore: 0,
      printFriendliness: 0,
      summary: "No visible ink detected for palette extraction.",
    };
  }

  const sorted = [...buckets.values()]
    .map((b) => ({
      r: Math.round(b.r / b.count),
      g: Math.round(b.g / b.count),
      b: Math.round(b.b / b.count),
      count: b.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const roleUsed = new Set<ColorSwatch["role"]>();
  const swatches: ColorSwatch[] = sorted.map((color) => {
    const lum = luminance(color.r, color.g, color.b);
    const sat = saturation(color.r, color.g, color.b);
    let role = classifyColorRole(color.r, color.g, color.b, lum, sat);
    if (roleUsed.has(role)) {
      role = role === "primary" ? "secondary" : role;
    }
    roleUsed.add(role);
    return {
      hex: rgbToHex(color.r, color.g, color.b),
      rgb: [color.r, color.g, color.b],
      role,
      percentage: Math.round((color.count / total) * 100),
    };
  });

  const lumValues = swatches.map((s) => luminance(...s.rgb));
  const maxContrast = lumValues.length >= 2
    ? Math.max(...lumValues.flatMap((l1, i) => lumValues.slice(i + 1).map((l2) => contrastRatio(l1, l2))))
    : 1;

  const contrastScore = Math.min(100, Math.round(maxContrast * 22));
  const inkCount = swatches.filter((s) => s.role !== "background").length;
  const printFriendliness = Math.min(
    100,
    Math.round(contrastScore * 0.5 + (inkCount <= 4 ? 35 : 15) + (inkCount <= 2 ? 20 : 0)),
  );

  const primary = swatches.find((s) => s.role === "primary");
  const summary = primary
    ? `Dominant ${primary.hex} with ${inkCount} ink families — ${printFriendliness >= 70 ? "print-friendly" : "review contrast for production"}.`
    : `Muted palette with ${inkCount} ink families detected.`;

  return { swatches, contrastScore, printFriendliness, summary };
}
