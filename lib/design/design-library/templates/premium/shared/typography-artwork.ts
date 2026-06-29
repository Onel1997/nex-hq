import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type {
  PremiumRenderContext,
  PremiumTemplateLayoutConfig,
} from "@/lib/design/design-library/templates/premium/types";
import { formatCoordinates, toRomanNumeral } from "@/lib/design/vector-engine/typography";
import { range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";

export type PremiumTypeLayoutId = "editorial-stack" | "oversized-wordmark" | "split-axis-type";

export function isPremiumTypographyRole(role: string): boolean {
  const r = role.toLowerCase();
  return r.includes("hero") || r.includes("statement");
}

/** @deprecated use isPremiumTypographyRole */
export function isHeroTypographyArtwork(ctx: PremiumRenderContext): boolean {
  return isPremiumTypographyRole(ctx.spec.brief.role);
}

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

function boxesOverlapRatio(a: TypographyPlacement, b: TypographyPlacement): number {
  const boxA = estimateTextBox(a);
  const boxB = estimateTextBox(b);
  const overlapX = Math.max(0, Math.min(boxA.left + boxA.width, boxB.left + boxB.width) - Math.max(boxA.left, boxB.left));
  const overlapY = Math.max(0, Math.min(boxA.top + boxA.height, boxB.top + boxB.height) - Math.max(boxA.top, boxB.top));
  const overlapArea = overlapX * overlapY;
  const minArea = Math.min(boxA.width * boxA.height, boxB.width * boxB.height);
  return minArea > 0 ? overlapArea / minArea : 0;
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
      const box = estimateTextBox(p);
      const nearX = focal.x >= box.left - focalR * 0.2 && focal.x <= box.left + box.width + focalR * 0.2;
      const nearY = focal.y >= box.top - focalR * 0.2 && focal.y <= box.top + box.height + focalR * 0.2;
      const dist = Math.hypot(p.x - focal.x, p.y - focal.y);
      return (nearX && nearY) || dist < focalR * 1.1;
    });
}

function isSingleStraightLine(placements: TypographyPlacement[]): boolean {
  const headlines = placements.filter(
    (p) => p.layer === "typography" && (p.role === "headline" || p.role === "stacked-headline"),
  );
  if (headlines.length <= 1) return headlines.length === 1 && Math.abs(headlines[0]!.rotation) < 2;
  const ys = headlines.map((p) => p.y);
  const spread = Math.max(...ys) - Math.min(...ys);
  return spread < 8 && headlines.every((p) => Math.abs(p.rotation) < 2);
}

function hasScatteredLetterLayers(placements: TypographyPlacement[]): boolean {
  const scattered = placements.filter(
    (p) =>
      p.layer === "typography" &&
      p.variant !== "micro" &&
      p.variant !== "ghost" &&
      p.text.replace(/\s/g, "").length === 1,
  );
  return scattered.length >= 2;
}

function hasIllegibleOverlap(placements: TypographyPlacement[]): boolean {
  const dominant = placements.filter(
    (p) => p.layer === "typography" && p.variant !== "ghost" && p.variant !== "micro",
  );
  for (let i = 0; i < dominant.length; i++) {
    for (let j = i + 1; j < dominant.length; j++) {
      if (boxesOverlapRatio(dominant[i]!, dominant[j]!) > 0.48) return true;
    }
  }
  return false;
}

function splitTitleWords(title: string): string[] {
  return title.trim().split(/\s+/).filter(Boolean);
}

export function selectPremiumTypeLayout(ctx: PremiumRenderContext, words: string[]): PremiumTypeLayoutId {
  if (words.length >= 3) return "split-axis-type";
  if (words.length === 2) {
    return range(ctx.seed, 90, 0, 1) === 0 ? "editorial-stack" : "oversized-wordmark";
  }
  return "oversized-wordmark";
}

/** Reject weak premium typography compositions before render. */
export function validateTypographyArtworkRules(
  placements: TypographyPlacement[],
  safeZone: { width: number; height: number },
  focal: { x: number; y: number },
  heroScale: number,
  isPremium: boolean,
): string | undefined {
  if (!isPremium) return undefined;

  const typeGroups = placements.filter((p) => p.id.startsWith("premium-type-"));
  if (typeGroups.length < 4) {
    return `typography groups < 4 (${typeGroups.length})`;
  }

  if (hasScatteredLetterLayers(placements)) {
    return "words split into scattered single letters";
  }

  if (hasIllegibleOverlap(placements)) {
    return "main title layers overlap into illegibility";
  }

  if (isSingleStraightLine(placements)) {
    return "title rendered as one straight line only";
  }

  const dominant = placements.filter((p) => p.layer === "typography" && p.variant !== "ghost");
  if (dominant.length === 0) {
    return "no readable dominant typography layer";
  }

  const largest = dominant.reduce((a, b) => (a.size >= b.size ? a : b));
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

  const requiredRoles = new Set(["premium-type-ghost-bg", "premium-type-dominant", "premium-type-secondary"]);
  for (const id of requiredRoles) {
    if (!placements.some((p) => p.id === id)) {
      return `missing required typography role: ${id}`;
    }
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
      rotation: range(seed, 81, -6, 6),
      opacity: 0.48,
      layer: "decorative",
      variant: "capsule",
      zOrder: 53,
    },
  ];
}

function ghostLayer(
  ctx: PremiumRenderContext,
  text: string,
  size: number,
  x: number,
  y: number,
  rotation: number,
): TypographyPlacement {
  return {
    id: "premium-type-ghost-bg",
    role: "headline",
    text,
    x: snap(x),
    y: snap(y),
    size: snap(size),
    tracking: 0.24,
    lineHeight: 1.02,
    weight: 400,
    align: "middle",
    rotation,
    opacity: 0.09,
    layer: "decorative",
    variant: "ghost",
    zOrder: 0,
  };
}

function dominantLayer(
  ctx: PremiumRenderContext,
  text: string,
  size: number,
  x: number,
  y: number,
  align: TypographyPlacement["align"],
  rotation: number,
): TypographyPlacement {
  const { safeZone } = ctx;
  return {
    id: "premium-type-dominant",
    role: "stacked-headline",
    text,
    x: snap(x),
    y: snap(y),
    size: snap(size),
    tracking: 0.1 + range(ctx.seed, 11, 0, 0.06),
    lineHeight: 0.92,
    weight: 500,
    align,
    rotation,
    opacity: 0.97,
    layer: "typography",
    variant: "cropped",
    clipPathId: "premium-type-clip-dominant",
    clipRect: {
      x: safeZone.x,
      y: safeZone.y + safeZone.height * 0.1,
      width: safeZone.width * 0.92,
      height: size * 1.2,
    },
    zOrder: 10,
  };
}

function secondaryLayer(
  ctx: PremiumRenderContext,
  text: string,
  size: number,
  x: number,
  y: number,
  align: TypographyPlacement["align"],
  rotation: number,
  stretch?: number,
): TypographyPlacement {
  const { focal, heroScale } = ctx;
  return {
    id: "premium-type-secondary",
    role: "headline",
    text,
    x: snap(x),
    y: snap(y),
    size: snap(size),
    tracking: 0.34,
    lineHeight: 1.05,
    weight: 450,
    align,
    rotation,
    opacity: 0.9,
    layer: "typography",
    variant: stretch ? "stretched" : "offset",
    textLength: stretch ? snap(stretch) : undefined,
    maskId: stretch ? "premium-type-mask-secondary" : undefined,
    maskCircle: stretch ? { cx: focal.x, cy: focal.y, r: heroScale * 0.34 } : undefined,
    zOrder: 20,
  };
}

function microLayer(
  ctx: PremiumRenderContext,
  text: string,
  x: number,
  y: number,
  rotation: number,
): TypographyPlacement {
  const { safeZone } = ctx;
  return {
    id: "premium-type-micro",
    role: "subheadline",
    text,
    x: snap(x),
    y: snap(y),
    size: snap(safeZone.width * 0.042),
    tracking: 0.44,
    lineHeight: 1.15,
    weight: 400,
    align: "start",
    rotation,
    opacity: 0.55,
    layer: "typography",
    variant: "micro",
    zOrder: 25,
  };
}

function verticalCapsuleLayer(
  ctx: PremiumRenderContext,
  text: string,
  x: number,
  y: number,
): TypographyPlacement {
  const { safeZone } = ctx;
  const capsule = text.length <= 4 ? text : text.slice(0, 4);
  return {
    id: "premium-type-vertical-micro",
    role: "vertical-text",
    text: capsule,
    x: snap(x),
    y: snap(y),
    size: snap(safeZone.width * 0.046),
    tracking: 0.42,
    lineHeight: 0.92,
    weight: 400,
    align: "start",
    rotation: -90,
    opacity: 0.68,
    layer: "typography",
    variant: "capsule",
    zOrder: 30,
  };
}

/** split-axis-type — dominant / secondary / micro on separate axes (ONLY BETWEEN US). */
function buildSplitAxisType(ctx: PremiumRenderContext, words: string[]): TypographyPlacement[] {
  const { safeZone, focal, heroScale, seed } = ctx;
  const [w0, w1, w2] = words;
  const dominantSize = snap(safeZone.width * 0.22);
  const secondarySize = snap(safeZone.width * 0.1);
  const baseY = snap(focal.y + heroScale * 0.02);
  const edition = String(2020 + (seed % 6));

  return [
    ghostLayer(ctx, words.join(" "), dominantSize * 1.3, safeZone.x + safeZone.width * 0.5, safeZone.y + safeZone.height * 0.36, range(seed, 10, -3, 3)),
    dominantLayer(ctx, w0!, dominantSize, safeZone.x + safeZone.width * 0.05, baseY - dominantSize * 0.2, "start", range(seed, 12, -2, 4)),
    secondaryLayer(
      ctx,
      w1!,
      secondarySize,
      focal.x + range(seed, 13, -heroScale * 0.06, heroScale * 0.1),
      focal.y + dominantSize * 0.22,
      "middle",
      range(seed, 14, -4, 6),
      safeZone.width * 0.55,
    ),
    microLayer(ctx, w2!, focal.x - heroScale * 0.32, focal.y - heroScale * 0.08, range(seed, 15, -10, -4)),
    verticalCapsuleLayer(ctx, w2!, safeZone.x + safeZone.width * 0.9, safeZone.y + safeZone.height * 0.52),
    {
      id: "premium-type-frame-cross",
      role: "caption",
      text: `${w1} / ${edition}`,
      x: snap(safeZone.x + safeZone.width * 0.72),
      y: snap(baseY + dominantSize * 0.52),
      size: snap(secondarySize * 0.5),
      tracking: 0.44,
      lineHeight: 1.2,
      weight: 400,
      align: "end",
      rotation: range(seed, 16, -8, -3),
      opacity: 0.42,
      layer: "typography",
      variant: "offset",
      zOrder: 15,
    },
  ];
}

/** editorial-stack — stacked full words, apparel-scale hierarchy. */
function buildEditorialStack(ctx: PremiumRenderContext, words: string[]): TypographyPlacement[] {
  const { safeZone, focal, heroScale, seed } = ctx;
  const stack = words.slice(0, Math.min(3, words.length));
  const dominantSize = snap(safeZone.width * 0.2);
  const lineGap = dominantSize * 0.92;
  const startY = snap(focal.y - ((stack.length - 1) * lineGap) / 2);

  const layers: TypographyPlacement[] = [
    ghostLayer(
      ctx,
      stack.join(" "),
      dominantSize * 1.25,
      focal.x,
      startY - dominantSize * 0.35,
      0,
    ),
  ];

  stack.forEach((word, i) => {
    const size = snap(dominantSize * (1 - i * 0.18));
    const y = snap(startY + i * lineGap);
    const x = snap(safeZone.x + safeZone.width * (0.08 + i * 0.06));
    if (i === 0) {
      layers.push(dominantLayer(ctx, word, size, x, y, "start", range(seed, 20 + i, -2, 3)));
    } else if (i === 1) {
      layers.push(secondaryLayer(ctx, word, size, x + heroScale * 0.08, y, "start", range(seed, 21 + i, -3, 4)));
    } else {
      layers.push(microLayer(ctx, word, x + heroScale * 0.12, y, range(seed, 22 + i, -4, 4)));
    }
  });

  if (stack.length >= 2) {
    layers.push(verticalCapsuleLayer(ctx, stack[stack.length - 1]!, safeZone.x + safeZone.width * 0.91, safeZone.y + safeZone.height * 0.45));
  }

  return layers;
}

/** oversized-wordmark — single dominant wordmark with offset secondary. */
function buildOversizedWordmark(ctx: PremiumRenderContext, words: string[]): TypographyPlacement[] {
  const { safeZone, focal, heroScale, seed } = ctx;
  const primary = words[0] ?? "STUDIO";
  const secondary = words.slice(1).join(" ") || primary;
  const dominantSize = snap(safeZone.width * 0.24);
  const baseY = snap(focal.y);

  return [
    ghostLayer(ctx, words.join(" "), dominantSize * 1.35, focal.x, baseY - dominantSize * 0.45, range(seed, 30, -3, 3)),
    dominantLayer(ctx, primary, dominantSize, safeZone.x + safeZone.width * 0.06, baseY, "start", range(seed, 31, -3, 4)),
    secondaryLayer(
      ctx,
      secondary,
      snap(dominantSize * 0.44),
      focal.x + heroScale * 0.12,
      baseY + dominantSize * 0.38,
      "middle",
      range(seed, 32, -5, 7),
    ),
    microLayer(ctx, `${primary.slice(0, 3)} · ${secondary.slice(0, 6)}`, safeZone.x + safeZone.width * 0.08, baseY + dominantSize * 0.72, 0),
    verticalCapsuleLayer(ctx, primary.slice(0, 3), safeZone.x + safeZone.width * 0.9, safeZone.y + safeZone.height * 0.5),
  ];
}

function buildLayoutPlacements(ctx: PremiumRenderContext, layoutId: PremiumTypeLayoutId, words: string[]): TypographyPlacement[] {
  switch (layoutId) {
    case "split-axis-type":
      return buildSplitAxisType(ctx, words);
    case "editorial-stack":
      return buildEditorialStack(ctx, words);
    case "oversized-wordmark":
      return buildOversizedWordmark(ctx, words);
  }
}

/** Hero / Statement typography as layered fashion artwork — not scattered letters. */
export function buildHeroTypographyArtwork(
  ctx: PremiumRenderContext,
  _layout: PremiumTemplateLayoutConfig,
): TypographyPlacement[] {
  const words = splitTitleWords(ctx.spec.brief.title);
  const layoutId = selectPremiumTypeLayout(ctx, words);
  const core = buildLayoutPlacements(ctx, layoutId, words);
  const baseY = core.find((p) => p.id === "premium-type-dominant")?.y ?? ctx.focal.y;
  return [...core, ...buildDecorativeMetadata(ctx, baseY)];
}
