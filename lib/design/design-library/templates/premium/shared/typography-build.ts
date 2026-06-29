import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type {
  PremiumRenderContext,
  PremiumTemplateLayoutConfig,
} from "@/lib/design/design-library/templates/premium/types";
import {
  buildHeroTypographyArtwork,
  isPremiumTypographyRole,
} from "@/lib/design/design-library/templates/premium/shared/typography-artwork";
import { assetPoint } from "@/lib/design/design-library/templates/premium/shared/context";
import { extractHeadline, formatCoordinates, toRomanNumeral } from "@/lib/design/vector-engine/typography";
import { range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";

export function buildPremiumTypographyPlacements(
  ctx: PremiumRenderContext,
  layout: PremiumTemplateLayoutConfig,
): TypographyPlacement[] {
  if (isPremiumTypographyRole(ctx.spec.brief.role)) {
    return buildHeroTypographyArtwork(ctx, layout);
  }

  const { spec, seed, colors, focal, heroScale } = ctx;
  const { safeZone } = ctx;
  const tokens = DESIGN_TOKENS.typography;
  const headline = extractHeadline(spec.brief.title);
  const words = headline.trim().split(/\s+/);
  const edition = String(2020 + (seed % 6));
  const product = spec.brief.product.split(" ")[0]?.toUpperCase() ?? "STUDIO";
  const placements: TypographyPlacement[] = [];
  const mode = layout.typographyMode;
  const tracking = spec.style.trackingWide * 0.8 + 0.16;

  const baseY = snap(focal.y + heroScale * layout.focalShift.y + range(seed, 50, 0.12, 0.28) * heroScale);
  const baseX = snap(focal.x + heroScale * layout.focalShift.x);

  if (mode === "split-typography" && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    placements.push({
      id: "premium-type-split-a",
      role: "stacked-headline",
      text: words.slice(0, mid).join(" "),
      x: snap(safeZone.x + safeZone.width * 0.16 + layout.asymmetry * 20),
      y: snap(baseY - tokens.headline.size * 0.5),
      size: tokens.headline.size * 1.15,
      tracking: tracking + 0.06,
      lineHeight: 1.02,
      weight: 500,
      align: "start",
      rotation: range(seed, 51, -2, 2),
      opacity: 0.96,
      layer: "typography",
    });
    placements.push({
      id: "premium-type-split-b",
      role: "headline",
      text: words.slice(mid).join(" "),
      x: snap(safeZone.x + safeZone.width * 0.48),
      y: snap(baseY + tokens.headline.size * 0.65),
      size: tokens.headline.size * 0.78,
      tracking: tracking + 0.12,
      lineHeight: 1.05,
      weight: 450,
      align: "start",
      rotation: range(seed, 52, -4, 4),
      opacity: 0.88,
      layer: "typography",
    });
  } else if (mode === "stacked-headline") {
    const stack = words.slice(0, Math.min(3, words.length));
    stack.forEach((word, i) => {
      placements.push({
        id: `premium-type-stack-${i}`,
        role: i === 0 ? "stacked-headline" : "headline",
        text: word,
        x: snap(baseX + range(seed, 60 + i, -10, 10)),
        y: snap(baseY + i * tokens.headline.size * 1.05),
        size: tokens.headline.size * (1.1 - i * 0.12),
        tracking: tracking + i * 0.04,
        lineHeight: 1.04,
        weight: i === 0 ? 500 : 450,
        align: "middle",
        rotation: 0,
        opacity: 0.94 - i * 0.06,
        layer: "typography",
      });
    });
  } else if (mode === "vertical-typography") {
    placements.push({
      id: "premium-type-vertical",
      role: "vertical-text",
      text: words[0]?.slice(0, 6) ?? headline.slice(0, 6),
      x: snap(safeZone.x + safeZone.width * 0.09),
      y: snap(safeZone.y + safeZone.height * 0.28),
      size: tokens.vertical.size * 1.2,
      tracking: tokens.vertical.tracking,
      lineHeight: tokens.vertical.lineHeight,
      weight: 400,
      align: "start",
      rotation: 0,
      opacity: 0.55,
      layer: "typography",
    });
    placements.push({
      id: "premium-type-headline",
      role: "headline",
      text: headline,
      x: baseX,
      y: baseY,
      size: tokens.headline.size * 1.05,
      tracking,
      lineHeight: tokens.headline.lineHeight,
      weight: 500,
      align: "middle",
      rotation: 0,
      opacity: 0.94,
      layer: "typography",
    });
  } else if (mode === "curved-typography") {
    placements.push({
      id: "premium-type-curved",
      role: "headline",
      text: headline,
      x: baseX,
      y: snap(baseY - heroScale * 0.08),
      size: tokens.headline.size * 0.95,
      tracking,
      lineHeight: tokens.headline.lineHeight,
      weight: 500,
      align: "middle",
      rotation: 0,
      opacity: 0.92,
      layer: "typography",
      curved: true,
      curveRadius: heroScale * 0.42,
    });
  } else if (mode === "museum-label") {
    placements.push({
      id: "premium-type-museum",
      role: "caption",
      text: headline,
      x: snap(safeZone.x + safeZone.width * 0.72),
      y: snap(safeZone.y + safeZone.height * 0.78),
      size: tokens.caption.size * 1.1,
      tracking: tokens.caption.tracking + 0.1,
      lineHeight: tokens.caption.lineHeight,
      weight: 400,
      align: "end",
      rotation: range(seed, 53, -3, 3),
      opacity: 0.72,
      layer: "typography",
    });
    placements.push({
      id: "premium-type-headline",
      role: "headline",
      text: words.slice(0, 2).join(" "),
      x: snap(baseX - heroScale * 0.06),
      y: baseY,
      size: tokens.headline.size * 0.88,
      tracking,
      lineHeight: tokens.headline.lineHeight,
      weight: 500,
      align: "start",
      rotation: 0,
      opacity: 0.9,
      layer: "typography",
    });
  } else if (mode === "broken-typography") {
    placements.push({
      id: "premium-type-broken",
      role: "stacked-headline",
      text: headline,
      x: snap(baseX + range(seed, 54, 8, 24)),
      y: baseY,
      size: tokens.headline.size * 1.08,
      tracking,
      lineHeight: tokens.headline.lineHeight,
      weight: 500,
      align: "start",
      rotation: range(seed, 55, -3, 3),
      opacity: 0.95,
      layer: "typography",
    });
  } else if (mode === "offset-typography") {
    placements.push({
      id: "premium-type-offset",
      role: "headline",
      text: headline,
      x: snap(baseX + heroScale * 0.08),
      y: snap(baseY + 6),
      size: tokens.headline.size,
      tracking,
      lineHeight: tokens.headline.lineHeight,
      weight: 500,
      align: "start",
      rotation: 0,
      opacity: 0.93,
      layer: "typography",
    });
  } else {
    placements.push({
      id: "premium-type-oversized",
      role: "stacked-headline",
      text: words.slice(0, 2).join(" ") || headline,
      x: baseX,
      y: snap(baseY - heroScale * 0.02),
      size: tokens.headline.size * 1.35,
      tracking: tracking + 0.04,
      lineHeight: 1.02,
      weight: 500,
      align: "middle",
      rotation: 0,
      opacity: 0.97,
      layer: "typography",
    });
  }

  placements.push({
    id: "premium-type-sub",
    role: "subheadline",
    text: `${product} · ${edition}`,
    x: snap((placements[0]?.x ?? baseX) + range(seed, 70, 0, 12)),
    y: snap(baseY + tokens.headline.size * 1.15),
    size: tokens.subHeadline.size,
    tracking: tokens.subHeadline.tracking,
    lineHeight: tokens.subHeadline.lineHeight,
    weight: 400,
    align: placements[0]?.align ?? "middle",
    rotation: 0,
    opacity: 0.48,
    layer: "typography",
  });

  const coordPos = assetPoint(ctx, 0.86, 0.9, 80);
  placements.push({
    id: "premium-type-coordinates",
    role: "coordinates",
    text: formatCoordinates(seed).replace("° N", "°").replace("° W", ""),
    x: coordPos.x,
    y: coordPos.y,
    size: tokens.coordinates.size,
    tracking: tokens.coordinates.tracking,
    lineHeight: tokens.coordinates.lineHeight,
    weight: 400,
    align: "end",
    rotation: 0,
    opacity: 0.32,
    layer: "decorative",
  });

  placements.push({
    id: "premium-type-roman",
    role: "roman-numeral",
    text: toRomanNumeral(seed),
    x: snap(safeZone.x + safeZone.width * 0.08),
    y: snap(safeZone.y + safeZone.height * 0.1),
    size: tokens.romanNumeral.size,
    tracking: tokens.romanNumeral.tracking,
    lineHeight: tokens.romanNumeral.lineHeight,
    weight: 400,
    align: "start",
    rotation: 0,
    opacity: 0.36,
    layer: "decorative",
  });

  placements.push({
    id: "premium-type-collection",
    role: "collection-code",
    text: `${toRomanNumeral(seed + 2)} · ${edition.slice(-2)}`,
    x: snap(focal.x + heroScale * 0.2),
    y: snap(baseY + heroScale * 0.22),
    size: tokens.caption.size,
    tracking: tokens.caption.tracking,
    lineHeight: tokens.caption.lineHeight,
    weight: 400,
    align: "start",
    rotation: range(seed, 81, -6, 6),
    opacity: 0.5,
    layer: "decorative",
  });

  placements.push({
    id: "premium-type-production",
    role: "micro-label",
    text: `PROD · ${spec.brief.designId.slice(0, 8).toUpperCase()}`,
    x: snap(safeZone.x + safeZone.width * 0.1),
    y: snap(safeZone.y + safeZone.height * 0.92),
    size: tokens.minimalLabel.size,
    tracking: tokens.minimalLabel.tracking,
    lineHeight: tokens.minimalLabel.lineHeight,
    weight: 400,
    align: "start",
    rotation: 0,
    opacity: 0.34,
    layer: "decorative",
  });

  placements.push({
    id: "premium-type-garment",
    role: "micro-label",
    text: `GARMENT · ${product.slice(0, 6)} · ${edition}`,
    x: snap(safeZone.x + safeZone.width * 0.55),
    y: snap(safeZone.y + safeZone.height * 0.06),
    size: tokens.minimalLabel.size,
    tracking: tokens.minimalLabel.tracking + 0.08,
    lineHeight: tokens.minimalLabel.lineHeight,
    weight: 400,
    align: "middle",
    rotation: 0,
    opacity: 0.3,
    layer: "decorative",
  });

  placements.push({
    id: "premium-type-capsule",
    role: "collection-code",
    text: `CAP · ${toRomanNumeral(seed)}${edition.slice(-2)}`,
    x: snap(focal.x),
    y: snap(baseY + heroScale * 0.38),
    size: tokens.caption.size * 0.95,
    tracking: tokens.caption.tracking + 0.12,
    lineHeight: tokens.caption.lineHeight,
    weight: 400,
    align: "middle",
    rotation: 0,
    opacity: 0.46,
    layer: "decorative",
  });

  return placements;
}
