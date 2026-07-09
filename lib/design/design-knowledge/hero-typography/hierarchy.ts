import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type {
  HeroTypographyAudit,
  HeroTypographyBuildContext,
  HeroTypographyDirectionId,
} from "@/lib/design/design-knowledge/hero-typography/types";
import { buildBackgroundLetterform, buildOversizedLayer } from "@/lib/design/design-knowledge/hero-typography/overscale";
import { buildCroppedLayer } from "@/lib/design/design-knowledge/hero-typography/cropping";
import { buildGhostLayer } from "@/lib/design/design-knowledge/hero-typography/ghost-layer";
import { buildLayeredStack, buildBrokenTypeLayer, buildVerticalSecondary } from "@/lib/design/design-knowledge/hero-typography/layering";
import { buildMicroCaption, buildMuseumLabel } from "@/lib/design/design-knowledge/hero-typography/editorial-spacing";
import { buildOffsetLayer } from "@/lib/design/design-knowledge/hero-typography/offset";
import { buildSplitHeadline } from "@/lib/design/design-knowledge/hero-typography/split-type";
import { formatCoordinates, toRomanNumeral } from "@/lib/design/vector-engine/typography";
import { range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";
import type { LayoutZones } from "@/lib/design/design-library/types";

export function estimateTextWidth(text: string, size: number, tracking: number): number {
  const chars = Math.max(1, text.replace(/\s/g, "").length);
  return chars * size * (0.54 + tracking * 0.32);
}

function estimateTextBox(p: TypographyPlacement): { left: number; top: number; width: number; height: number } {
  const width = estimateTextWidth(p.text, p.size, p.tracking);
  const height = p.size * 1.1;
  let left = p.x;
  if (p.align === "middle") left -= width / 2;
  if (p.align === "end") left -= width;
  return { left, top: p.y - height * 0.85, width, height };
}

export function estimateTypographyCompositionShare(
  placements: TypographyPlacement[],
  safeZone: { width: number; height: number },
): number {
  const artboardArea = safeZone.width * safeZone.height;
  if (artboardArea <= 0) return 0;

  let covered = 0;
  for (const p of placements.filter((t) => t.layer === "typography" || t.variant === "ghost")) {
    const box = estimateTextBox(p);
    covered += box.width * box.height;
  }
  return Math.min(1, covered / artboardArea);
}

export function buildDecorativeMetadata(
  ctx: HeroTypographyBuildContext,
  baseY: number,
  product: string,
): TypographyPlacement[] {
  const { safeZone, focal, heroScale, seed } = ctx;
  const tokens = DESIGN_TOKENS.typography;
  const edition = String(2020 + (seed % 6));
  const productLabel = product.split(" ")[0]?.toUpperCase() ?? "STUDIO";

  return [
    {
      id: "hero-type-coordinates",
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
      id: "hero-type-roman",
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
      id: "hero-type-production",
      role: "micro-label",
      text: `PROD · ${ctx.designId.slice(0, 8).toUpperCase()}`,
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
      id: "hero-type-capsule",
      role: "collection-code",
      text: `CAP · ${toRomanNumeral(seed)}${edition.slice(-2)} · ${productLabel.slice(0, 4)}`,
      x: snap(focal.x + heroScale * 0.28),
      y: snap(baseY + heroScale * 0.42),
      size: tokens.caption.size,
      tracking: tokens.caption.tracking + 0.14,
      lineHeight: tokens.caption.lineHeight,
      weight: 400,
      align: "start",
      rotation: range(seed, 81, -6, 6),
      opacity: 0.48,
      layer: "decorative",
      variant: "capsule",
      zOrder: 53,
    },
  ];
}

function productLabel(ctx: HeroTypographyBuildContext): string {
  return ctx.product.split(" ")[0]?.slice(0, 6).toUpperCase() ?? "STUDIO";
}

function buildSilentLuxury(ctx: HeroTypographyBuildContext, words: string[]): TypographyPlacement[] {
  const { safeZone, focal, seed } = ctx;
  const primary = words.slice(0, 2).join(" ") || ctx.title;
  const dominantSize = snap(safeZone.width * 0.19);
  const baseY = snap(focal.y);

  return [
    buildGhostLayer(ctx, primary, dominantSize * 1.4, focal.x, baseY - dominantSize * 0.5, range(seed, 1, -2, 2)),
    buildCroppedLayer(ctx, primary, dominantSize, safeZone.x + safeZone.width * 0.1, baseY, "start", range(seed, 2, -2, 3)),
    buildMuseumLabel(ctx, `${ctx.title.toUpperCase()} · SILENT`, baseY + dominantSize * 0.55),
    buildMicroCaption(ctx, words[2] ?? productLabel(ctx), safeZone.x + safeZone.width * 0.12, baseY + dominantSize * 0.85),
  ];
}

function buildFaithTypography(ctx: HeroTypographyBuildContext, words: string[]): TypographyPlacement[] {
  const { safeZone, focal, seed } = ctx;
  const scripture = words.join(" ").toUpperCase();
  const dominantSize = snap(safeZone.width * 0.17);

  return [
    buildBackgroundLetterform(ctx, scripture),
    buildGhostLayer(ctx, scripture, dominantSize * 1.2, focal.x, focal.y - dominantSize * 0.3, 0),
    ...buildLayeredStack(ctx, words),
    buildMuseumLabel(ctx, `FAITH · ${toRomanNumeral(seed)}`, focal.y + dominantSize * 0.6),
  ];
}

function buildStatementTypography(ctx: HeroTypographyBuildContext, words: string[]): TypographyPlacement[] {
  const { safeZone, focal, seed } = ctx;
  if (words.length >= 3) return buildSplitHeadline(ctx, words);

  const primary = words[0] ?? ctx.title;
  const secondary = words.slice(1).join(" ") || primary;
  const dominantSize = snap(safeZone.width * 0.23);
  const baseY = snap(focal.y);

  return [
    buildGhostLayer(ctx, words.join(" "), dominantSize * 1.35, focal.x, baseY - dominantSize * 0.45, range(seed, 30, -3, 3)),
    buildBrokenTypeLayer(ctx, primary, safeZone.x + safeZone.width * 0.06, baseY),
    buildOffsetLayer(
      ctx,
      secondary,
      snap(dominantSize * 0.44),
      focal.x + ctx.heroScale * 0.12,
      baseY + dominantSize * 0.38,
      "middle",
      range(seed, 32, -5, 7),
      safeZone.width * 0.55,
    ),
    buildMicroCaption(ctx, `${primary.slice(0, 3)} · ${secondary.slice(0, 6)}`, safeZone.x + safeZone.width * 0.08, baseY + dominantSize * 0.72),
    buildVerticalSecondary(ctx, primary.slice(0, 3)),
  ];
}

function buildHeroBackPrint(ctx: HeroTypographyBuildContext, words: string[]): TypographyPlacement[] {
  const { safeZone, focal, seed } = ctx;
  const primary = words.slice(0, 2).join(" ") || ctx.title;
  const secondary = words.slice(2).join(" ") || (words[1] ?? "");
  const dominantSize = snap(safeZone.width * 0.24);
  const baseY = snap(focal.y);

  return [
    buildGhostLayer(ctx, words.join(" "), dominantSize * 1.35, focal.x, baseY - dominantSize * 0.45, range(seed, 30, -3, 3)),
    buildOversizedLayer(ctx, primary, safeZone.x + safeZone.width * 0.06, baseY, "start", 0.24, "hero-type-dominant"),
    buildOffsetLayer(
      ctx,
      secondary || primary,
      snap(dominantSize * 0.44),
      focal.x + ctx.heroScale * 0.12,
      baseY + dominantSize * 0.38,
      "middle",
      range(seed, 32, -5, 7),
    ),
    buildMicroCaption(ctx, ctx.title, safeZone.x + safeZone.width * 0.08, baseY + dominantSize * 0.72),
    buildVerticalSecondary(ctx, primary.slice(0, 3)),
  ];
}

function buildCoreEssentialTypography(ctx: HeroTypographyBuildContext, words: string[]): TypographyPlacement[] {
  const { focal, seed } = ctx;
  const primary = words.slice(0, 2).join(" ") || ctx.title;
  const size = snap(ctx.safeZone.width * 0.11);

  return [
    buildGhostLayer(ctx, primary, size * 1.8, focal.x, focal.y - size * 0.2, 0, "hero-type-quiet-ghost"),
    buildCroppedLayer(ctx, primary, size, focal.x - ctx.heroScale * 0.15, focal.y, "start", range(seed, 60, -1, 2), "hero-type-quiet-dominant"),
    buildMuseumLabel(ctx, `${ctx.title.toUpperCase()} · ESSENTIAL`, focal.y + size * 0.9),
  ];
}

export function buildHeroTypographyForDirection(
  directionId: HeroTypographyDirectionId,
  ctx: HeroTypographyBuildContext,
  words: string[],
): TypographyPlacement[] {
  switch (directionId) {
    case "silent-luxury":
      return buildSilentLuxury(ctx, words);
    case "faith":
      return buildFaithTypography(ctx, words);
    case "statement-piece":
      return buildStatementTypography(ctx, words);
    case "core-essential":
      return buildCoreEssentialTypography(ctx, words);
    case "hero-back-print":
      return buildHeroBackPrint(ctx, words);
  }
}

export function auditHeroTypography(
  placements: TypographyPlacement[],
  zones: LayoutZones,
  role: string,
): HeroTypographyAudit {
  const reasons: string[] = [];
  let score = 40;

  const typeBlocks = placements.filter((t) => t.layer === "typography");
  const decorBlocks = placements.filter((t) => t.layer === "decorative");
  const isPremiumRole = role.toLowerCase().includes("hero") || role.toLowerCase().includes("statement");

  if (typeBlocks.length >= 2) score += 14;
  if (typeBlocks.length >= 3) score += 8;
  if (decorBlocks.length >= 2) score += 6;
  if (placements.some((t) => t.variant === "ghost")) score += 12;
  if (placements.some((t) => t.variant === "cropped" || t.clipPathId)) score += 10;
  if (placements.some((t) => t.variant === "offset" || t.variant === "stretched")) score += 8;
  if (placements.some((t) => t.role === "vertical-text")) score += 6;

  const sizes = typeBlocks.map((t) => t.size);
  const uniqueScales = new Set(sizes.map((s) => Math.round(s / 5)));
  if (uniqueScales.size >= 3) score += 14;
  else if (uniqueScales.size >= 2) score += 6;
  else reasons.push("flat typography — insufficient scale hierarchy");

  const share = estimateTypographyCompositionShare(placements, zones.safeZone);
  const isCoreEssential = role.toLowerCase().includes("core essential") || role.toLowerCase().includes("essential");
  if (isPremiumRole && !isCoreEssential && share < 0.45) {
    reasons.push(`typography share ${Math.round(share * 100)}% below hero minimum`);
  } else if (isPremiumRole && !isCoreEssential && share >= 0.55) score += 12;
  else if (isCoreEssential && share >= 0.2 && share <= 0.5) score += 10;
  else if (share >= 0.35) score += 6;

  if (typeBlocks.length <= 1) reasons.push("single text block");
  if (typeBlocks.length === 1 && typeBlocks[0]!.align === "middle" && !placements.some((t) => t.variant === "ghost")) {
    reasons.push("centered title only");
  }

  const heroGroups = placements.filter((t) => t.id.startsWith("hero-type-") || t.id.startsWith("premium-type-"));
  if (isPremiumRole && heroGroups.length < 4) reasons.push(`hero typography groups < 4 (${heroGroups.length})`);

  score = Math.max(0, Math.min(100, score));
  const passed = reasons.length === 0 || (reasons.length <= 1 && score >= 62);

  return { passed, score, reasons, placements };
}
