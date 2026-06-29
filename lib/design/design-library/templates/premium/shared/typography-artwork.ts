import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type {
  PremiumRenderContext,
  PremiumTemplateLayoutConfig,
} from "@/lib/design/design-library/templates/premium/types";
import { formatCoordinates, toRomanNumeral } from "@/lib/design/vector-engine/typography";
import { range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";

export function isHeroTypographyArtwork(ctx: PremiumRenderContext): boolean {
  return ctx.spec.brief.role.toLowerCase().includes("hero");
}

export function estimateTextWidth(text: string, size: number, tracking: number): number {
  const chars = Math.max(1, text.replace(/\s/g, "").length);
  return chars * size * (0.54 + tracking * 0.32);
}

function typographyIntersectsFocal(
  placements: TypographyPlacement[],
  focal: { x: number; y: number },
  heroScale: number,
): boolean {
  const focalR = heroScale * 0.42;
  return placements
    .filter((p) => p.layer === "typography")
    .some((p) => {
      const halfW = estimateTextWidth(p.text, p.size, p.tracking) / 2;
      const halfH = p.size * 0.55;
      const left = p.x - (p.align === "end" ? halfW * 2 : p.align === "middle" ? halfW : 0);
      const right = left + halfW * 2;
      const top = p.y - halfH;
      const bottom = p.y + halfH;
      const nearX = focal.x >= left - focalR * 0.2 && focal.x <= right + focalR * 0.2;
      const nearY = focal.y >= top - focalR * 0.2 && focal.y <= bottom + focalR * 0.2;
      const dist = Math.hypot(p.x - focal.x, p.y - focal.y);
      return (nearX && nearY) || dist < focalR * 1.1;
    });
}

function isSingleStraightLine(placements: TypographyPlacement[]): boolean {
  const headlines = placements.filter(
    (p) => p.layer === "typography" && (p.role === "headline" || p.role === "stacked-headline"),
  );
  if (headlines.length <= 1) return headlines.length === 1 && headlines[0]!.rotation === 0;
  const ys = headlines.map((p) => p.y);
  const spread = Math.max(...ys) - Math.min(...ys);
  const sameLine = spread < 8 && headlines.every((p) => Math.abs(p.rotation) < 2);
  return sameLine && headlines.length >= 1;
}

/** Reject weak hero typography compositions before render. */
export function validateTypographyArtworkRules(
  placements: TypographyPlacement[],
  safeZone: { width: number; height: number },
  focal: { x: number; y: number },
  heroScale: number,
  isHero: boolean,
): string | undefined {
  if (!isHero) return undefined;

  const typeLayers = placements.filter((p) => p.id.startsWith("premium-type-"));
  if (typeLayers.length < 4) {
    return `typography groups < 4 (${typeLayers.length})`;
  }

  if (isSingleStraightLine(placements)) {
    return "title rendered as one straight line only";
  }

  const dominant = placements.filter((p) => p.layer === "typography" && p.variant !== "ghost");
  const largest = dominant.reduce((a, b) => (a.size >= b.size ? a : b), dominant[0]!);
  const estWidth = estimateTextWidth(largest.text, largest.size, largest.tracking);
  if (estWidth < safeZone.width * 0.35) {
    return "largest typography < 35% of artwork width";
  }

  const hasCroppedOrOffset = placements.some(
    (p) =>
      p.variant === "cropped" ||
      p.variant === "offset" ||
      p.variant === "stretched" ||
      p.clipPathId ||
      Math.abs(p.rotation) > 2.5 ||
      (p.textLength && p.textLength > 0),
  );
  if (!hasCroppedOrOffset) {
    return "no cropped or offset typography";
  }

  if (!typographyIntersectsFocal(placements, focal, heroScale)) {
    return "typography does not overlap symbol/frame";
  }

  return undefined;
}

function buildDecorativeMetadata(ctx: PremiumRenderContext, baseY: number): TypographyPlacement[] {
  const { spec, seed, safeZone, focal, heroScale } = ctx;
  const tokens = DESIGN_TOKENS.typography;
  const edition = String(2020 + (seed % 6));
  const product = spec.brief.product.split(" ")[0]?.toUpperCase() ?? "STUDIO";

  return [
    {
      id: "premium-type-coordinates",
      role: "coordinates",
      text: formatCoordinates(seed).replace("° N", "°").replace("° W", ""),
      x: snap(safeZone.x + safeZone.width * 0.9),
      y: snap(safeZone.y + safeZone.height * 0.92),
      size: tokens.coordinates.size,
      tracking: tokens.coordinates.tracking,
      lineHeight: tokens.coordinates.lineHeight,
      weight: 400,
      align: "end",
      rotation: 0,
      opacity: 0.3,
      layer: "decorative",
      variant: "micro",
      zOrder: 50,
    },
    {
      id: "premium-type-roman",
      role: "roman-numeral",
      text: toRomanNumeral(seed),
      x: snap(safeZone.x + safeZone.width * 0.06),
      y: snap(safeZone.y + safeZone.height * 0.08),
      size: tokens.romanNumeral.size,
      tracking: tokens.romanNumeral.tracking,
      lineHeight: tokens.romanNumeral.lineHeight,
      weight: 400,
      align: "start",
      rotation: 0,
      opacity: 0.34,
      layer: "decorative",
      variant: "micro",
      zOrder: 51,
    },
    {
      id: "premium-type-production",
      role: "micro-label",
      text: `PROD · ${spec.brief.designId.slice(0, 8).toUpperCase()}`,
      x: snap(safeZone.x + safeZone.width * 0.08),
      y: snap(safeZone.y + safeZone.height * 0.94),
      size: tokens.minimalLabel.size,
      tracking: tokens.minimalLabel.tracking,
      lineHeight: tokens.minimalLabel.lineHeight,
      weight: 400,
      align: "start",
      rotation: 0,
      opacity: 0.32,
      layer: "decorative",
      variant: "micro",
      zOrder: 52,
    },
    {
      id: "premium-type-capsule",
      role: "collection-code",
      text: `CAP · ${toRomanNumeral(seed)}${edition.slice(-2)} · ${product.slice(0, 4)}`,
      x: snap(focal.x + heroScale * 0.28),
      y: snap(baseY + heroScale * 0.42),
      size: tokens.caption.size,
      tracking: tokens.caption.tracking + 0.14,
      lineHeight: tokens.caption.lineHeight,
      weight: 400,
      align: "start",
      rotation: range(seed, 81, -8, 8),
      opacity: 0.48,
      layer: "decorative",
      variant: "capsule",
      zOrder: 53,
    },
  ];
}

/** Tri-word editorial composition — ONLY / BETWEEN / US style. */
function buildTriWordEditorial(
  ctx: PremiumRenderContext,
  words: [string, string, string],
): TypographyPlacement[] {
  const { safeZone, focal, heroScale, seed } = ctx;
  const [w0, w1, w2] = words;
  const edition = String(2020 + (seed % 6));
  const dominantSize = snap(safeZone.width * 0.2);
  const betweenSize = snap(safeZone.width * 0.09);
  const microSize = snap(safeZone.width * 0.048);
  const baseY = snap(focal.y + heroScale * 0.02);

  const clipId = "premium-type-clip-dominant";
  const maskId = "premium-type-mask-secondary";

  return [
    {
      id: "premium-type-ghost-bg",
      role: "headline",
      text: words.join(" "),
      x: snap(safeZone.x + safeZone.width * 0.52),
      y: snap(safeZone.y + safeZone.height * 0.36),
      size: snap(dominantSize * 1.28),
      tracking: 0.26,
      lineHeight: 1.02,
      weight: 400,
      align: "middle",
      rotation: range(seed, 10, -3, 3),
      opacity: 0.09,
      layer: "decorative",
      variant: "ghost",
      zOrder: 0,
    },
    {
      id: "premium-type-dominant",
      role: "stacked-headline",
      text: w0,
      x: snap(safeZone.x + safeZone.width * 0.04),
      y: snap(baseY - dominantSize * 0.22),
      size: dominantSize,
      tracking: 0.1 + range(seed, 11, 0, 0.06),
      lineHeight: 0.92,
      weight: 500,
      align: "start",
      rotation: range(seed, 12, -2, 4),
      opacity: 0.97,
      layer: "typography",
      variant: "cropped",
      clipPathId: clipId,
      clipRect: {
        x: safeZone.x,
        y: safeZone.y + safeZone.height * 0.12,
        width: safeZone.width * 0.92,
        height: dominantSize * 1.15,
      },
      zOrder: 10,
    },
    {
      id: "premium-type-secondary",
      role: "headline",
      text: w1,
      x: snap(focal.x + range(seed, 13, -heroScale * 0.08, heroScale * 0.12)),
      y: snap(focal.y + dominantSize * 0.28),
      size: betweenSize,
      tracking: 0.38,
      lineHeight: 1.05,
      weight: 450,
      align: "middle",
      rotation: range(seed, 14, -5, 7),
      opacity: 0.9,
      layer: "typography",
      variant: "stretched",
      textLength: snap(safeZone.width * 0.58),
      maskId,
      maskCircle: { cx: focal.x, cy: focal.y, r: heroScale * 0.34 },
      zOrder: 20,
    },
    {
      id: "premium-type-vertical-micro",
      role: "vertical-text",
      text: w2.slice(0, 6),
      x: snap(safeZone.x + safeZone.width * 0.9),
      y: snap(safeZone.y + safeZone.height * 0.48),
      size: microSize,
      tracking: 0.52,
      lineHeight: 0.88,
      weight: 400,
      align: "start",
      rotation: 0,
      opacity: 0.72,
      layer: "typography",
      variant: "micro",
      zOrder: 30,
    },
    {
      id: "premium-type-offset-accent",
      role: "caption",
      text: w2,
      x: snap(safeZone.x + safeZone.width * 0.78),
      y: snap(baseY + dominantSize * 0.55),
      size: snap(microSize * 1.15),
      tracking: 0.48,
      lineHeight: 1.1,
      weight: 400,
      align: "end",
      rotation: 90,
      opacity: 0.55,
      layer: "typography",
      variant: "offset",
      zOrder: 31,
    },
    {
      id: "premium-type-frame-cross",
      role: "subheadline",
      text: `${w1} / ${edition}`,
      x: snap(focal.x - heroScale * 0.35),
      y: snap(focal.y - heroScale * 0.05),
      size: snap(betweenSize * 0.55),
      tracking: 0.44,
      lineHeight: 1.2,
      weight: 400,
      align: "start",
      rotation: range(seed, 15, -12, -4),
      opacity: 0.42,
      layer: "typography",
      variant: "offset",
      zOrder: 15,
    },
  ];
}

function buildDualWordEditorial(ctx: PremiumRenderContext, words: [string, string]): TypographyPlacement[] {
  const { safeZone, focal, heroScale, seed } = ctx;
  const dominantSize = snap(safeZone.width * 0.18);
  const secondarySize = snap(safeZone.width * 0.1);
  const baseY = snap(focal.y);

  return [
    {
      id: "premium-type-ghost-bg",
      role: "headline",
      text: words.join(" "),
      x: snap(safeZone.x + safeZone.width * 0.5),
      y: snap(safeZone.y + safeZone.height * 0.4),
      size: snap(dominantSize * 1.2),
      tracking: 0.24,
      lineHeight: 1.02,
      weight: 400,
      align: "middle",
      rotation: 0,
      opacity: 0.08,
      layer: "decorative",
      variant: "ghost",
      zOrder: 0,
    },
    {
      id: "premium-type-dominant",
      role: "stacked-headline",
      text: words[0]!,
      x: snap(safeZone.x + safeZone.width * 0.06),
      y: snap(baseY - dominantSize * 0.35),
      size: dominantSize,
      tracking: 0.08,
      lineHeight: 0.95,
      weight: 500,
      align: "start",
      rotation: range(seed, 20, -3, 3),
      opacity: 0.96,
      layer: "typography",
      variant: "cropped",
      clipPathId: "premium-type-clip-dominant",
      clipRect: {
        x: safeZone.x,
        y: safeZone.y + safeZone.height * 0.1,
        width: safeZone.width * 0.9,
        height: dominantSize * 1.1,
      },
      zOrder: 10,
    },
    {
      id: "premium-type-secondary",
      role: "headline",
      text: words[1]!,
      x: snap(focal.x + heroScale * 0.1),
      y: snap(focal.y + dominantSize * 0.2),
      size: secondarySize,
      tracking: 0.36,
      lineHeight: 1.05,
      weight: 450,
      align: "middle",
      rotation: range(seed, 21, -6, 8),
      opacity: 0.88,
      layer: "typography",
      variant: "stretched",
      textLength: snap(safeZone.width * 0.5),
      zOrder: 20,
    },
    {
      id: "premium-type-vertical-micro",
      role: "vertical-text",
      text: words[1]!.slice(0, 4),
      x: snap(safeZone.x + safeZone.width * 0.92),
      y: snap(safeZone.y + safeZone.height * 0.5),
      size: snap(safeZone.width * 0.042),
      tracking: 0.5,
      lineHeight: 0.9,
      weight: 400,
      align: "start",
      rotation: 0,
      opacity: 0.6,
      layer: "typography",
      variant: "micro",
      zOrder: 30,
    },
  ];
}

function buildSingleWordEditorial(ctx: PremiumRenderContext, word: string): TypographyPlacement[] {
  const { safeZone, focal, heroScale, seed } = ctx;
  const dominantSize = snap(safeZone.width * 0.22);
  const baseY = snap(focal.y);

  return [
    {
      id: "premium-type-ghost-bg",
      role: "headline",
      text: word,
      x: snap(focal.x),
      y: snap(baseY - dominantSize * 0.5),
      size: snap(dominantSize * 1.4),
      tracking: 0.3,
      lineHeight: 1,
      weight: 400,
      align: "middle",
      rotation: range(seed, 30, -4, 4),
      opacity: 0.07,
      layer: "decorative",
      variant: "ghost",
      zOrder: 0,
    },
    {
      id: "premium-type-dominant",
      role: "stacked-headline",
      text: word,
      x: snap(safeZone.x + safeZone.width * 0.08),
      y: baseY,
      size: dominantSize,
      tracking: 0.14,
      lineHeight: 0.92,
      weight: 500,
      align: "start",
      rotation: range(seed, 31, -4, 5),
      opacity: 0.95,
      layer: "typography",
      variant: "cropped",
      clipPathId: "premium-type-clip-dominant",
      clipRect: {
        x: safeZone.x,
        y: safeZone.y + safeZone.height * 0.15,
        width: safeZone.width * 0.88,
        height: dominantSize * 1.05,
      },
      zOrder: 10,
    },
    {
      id: "premium-type-offset-split",
      role: "headline",
      text: word,
      x: snap(focal.x + heroScale * 0.15),
      y: snap(baseY + dominantSize * 0.35),
      size: snap(dominantSize * 0.42),
      tracking: 0.4,
      lineHeight: 1.05,
      weight: 450,
      align: "middle",
      rotation: range(seed, 32, -8, 8),
      opacity: 0.55,
      layer: "typography",
      variant: "masked",
      maskId: "premium-type-mask-secondary",
      maskCircle: { cx: focal.x, cy: focal.y, r: heroScale * 0.36 },
      zOrder: 20,
    },
  ];
}

/** Hero typography as layered fashion artwork — not a single text label. */
export function buildHeroTypographyArtwork(
  ctx: PremiumRenderContext,
  _layout: PremiumTemplateLayoutConfig,
): TypographyPlacement[] {
  const title = ctx.spec.brief.title.trim();
  const words = title.split(/\s+/).filter(Boolean);

  let core: TypographyPlacement[];
  if (words.length >= 3) {
    core = buildTriWordEditorial(ctx, [words[0]!, words[1]!, words[2]!]);
  } else if (words.length === 2) {
    core = buildDualWordEditorial(ctx, [words[0]!, words[1]!]);
  } else {
    core = buildSingleWordEditorial(ctx, words[0] ?? title);
  }

  const baseY = core.find((p) => p.id === "premium-type-dominant")?.y ?? ctx.focal.y;
  return [...core, ...buildDecorativeMetadata(ctx, baseY)];
}
