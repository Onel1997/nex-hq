import type { LibraryArtworkSpec, TypographyPlacement } from "@/lib/design/design-library/types";
import type { HierarchyPlan } from "@/lib/design/design-library/composition/premium/hierarchy";
import type { NegativeSpaceField } from "@/lib/design/design-library/composition/premium/negative-space";
import type { RhythmGrid } from "@/lib/design/design-library/composition/premium/rhythm";
import type { CompositionType } from "@/lib/design/design-library/composition/premium/apparel-composer";
import { extractHeadline, formatCoordinates, toRomanNumeral } from "@/lib/design/vector-engine/typography";
import { range } from "@/lib/design/vector-engine/hash";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";

export type TypographyLayoutMode =
  | "oversized-title"
  | "stacked-editorial"
  | "split-typography"
  | "broken-alignment"
  | "vertical-rail"
  | "offset-captions";

export interface PremiumTypographyPlan {
  placements: TypographyPlacement[];
  /** Y band where type intersects symbol geometry. */
  intersectionBand: { y: number; height: number };
  layoutMode: TypographyLayoutMode;
}

function layoutModeForComposition(type: CompositionType): TypographyLayoutMode {
  const map: Record<CompositionType, TypographyLayoutMode> = {
    "luxury-editorial": "stacked-editorial",
    "gallery-poster": "oversized-title",
    "museum-label": "offset-captions",
    architectural: "broken-alignment",
    "faith-collection": "vertical-rail",
    "modern-minimal": "split-typography",
    "fashion-campaign": "oversized-title",
    "technical-luxury": "offset-captions",
    "silent-collection": "split-typography",
    "oversized-graphic": "oversized-title",
  };
  return map[type];
}

function splitHeadline(headline: string, mode: TypographyLayoutMode): string[] {
  const words = headline.trim().split(/\s+/);
  if (mode === "split-typography" && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }
  if (mode === "stacked-editorial" && words.length > 1) {
    return words.slice(0, Math.min(3, words.length));
  }
  return [headline];
}

/** Typography that interacts with artwork — not sitting passively underneath. */
export function buildPremiumTypography(
  spec: LibraryArtworkSpec,
  plan: HierarchyPlan,
  rhythm: RhythmGrid,
  space: NegativeSpaceField,
  compositionType: CompositionType,
): PremiumTypographyPlan {
  const { safeZone } = spec.layoutZones;
  const seed = spec.seed;
  const headline = extractHeadline(spec.brief.title);
  const mode = layoutModeForComposition(compositionType);
  const tokens = DESIGN_TOKENS.typography;
  const parts = splitHeadline(headline, mode);

  const headlineScale =
    mode === "oversized-title"
      ? 1.35
      : mode === "stacked-editorial"
        ? 1.12
        : mode === "split-typography"
          ? 0.95
          : 1.05;

  const baseY = snap(plan.primary.y + plan.primary.scale * range(seed, 401, 0.18, 0.32));
  const intersectionBand = {
    y: snap(plan.primary.y - plan.primary.scale * 0.08),
    height: plan.primary.scale * 0.42,
  };

  const placements: TypographyPlacement[] = [];
  const tracking = spec.style.trackingWide * 0.85 + 0.18;

  if (mode === "split-typography" && parts.length >= 2) {
    placements.push({
      id: "premium-type-primary",
      role: "stacked-headline",
      text: parts[0]!,
      x: snap(safeZone.x + safeZone.width * 0.18 + rhythm.tensionX),
      y: snap(baseY - tokens.headline.size * 0.4),
      size: tokens.headline.size * headlineScale * 1.1,
      tracking: tracking + 0.08,
      lineHeight: 1.02,
      weight: 500,
      align: "start",
      rotation: range(seed, 410, -2, 2),
      opacity: 0.96,
      layer: "typography",
    });
    placements.push({
      id: "premium-type-secondary",
      role: "headline",
      text: parts[1]!,
      x: snap(safeZone.x + safeZone.width * 0.52 + rhythm.tensionX * 0.5),
      y: snap(baseY + tokens.headline.size * 0.55),
      size: tokens.headline.size * headlineScale * 0.72,
      tracking: tracking + 0.14,
      lineHeight: 1.05,
      weight: 450,
      align: "start",
      rotation: range(seed, 411, -4, 4),
      opacity: 0.88,
      layer: "typography",
    });
  } else if (mode === "stacked-editorial") {
    parts.forEach((word, i) => {
      placements.push({
        id: `premium-type-stack-${i}`,
        role: i === 0 ? "stacked-headline" : "headline",
        text: word,
        x: snap(plan.primary.x + rhythm.tensionX + range(seed, 420 + i, -8, 8)),
        y: snap(baseY + i * tokens.headline.size * headlineScale * 1.08),
        size: tokens.headline.size * headlineScale * (i === 0 ? 1 : 0.82 - i * 0.08),
        tracking: tracking + i * 0.04,
        lineHeight: 1.04,
        weight: i === 0 ? 500 : 450,
        align: "middle",
        rotation: 0,
        opacity: 0.94 - i * 0.08,
        layer: "typography",
      });
    });
  } else if (mode === "vertical-rail") {
    const railWord = parts[0]!.replace(/\s/g, "").slice(0, 6);
    placements.push({
      id: "premium-type-vertical",
      role: "vertical-text",
      text: railWord,
      x: snap(safeZone.x + safeZone.width * 0.1),
      y: snap(safeZone.y + safeZone.height * 0.28),
      size: tokens.vertical.size * 1.15,
      tracking: tokens.vertical.tracking,
      lineHeight: tokens.vertical.lineHeight,
      weight: 400,
      align: "start",
      rotation: 0,
      opacity: 0.58,
      layer: "typography",
    });
    placements.push({
      id: "premium-type-headline",
      role: "headline",
      text: headline,
      x: snap(plan.primary.x + rhythm.tensionX),
      y: baseY,
      size: tokens.headline.size * headlineScale,
      tracking,
      lineHeight: tokens.headline.lineHeight,
      weight: 500,
      align: "middle",
      rotation: 0,
      opacity: 0.94,
      layer: "typography",
    });
  } else {
    placements.push({
      id: "premium-type-headline",
      role: mode === "oversized-title" ? "stacked-headline" : "headline",
      text: headline,
      x: snap(plan.primary.x + rhythm.tensionX + range(seed, 430, -12, 12)),
      y: snap(
        mode === "broken-alignment"
          ? baseY + range(seed, 431, 6, 18)
          : baseY,
      ),
      size: tokens.headline.size * headlineScale,
      tracking,
      lineHeight: tokens.headline.lineHeight,
      weight: 500,
      align: mode === "broken-alignment" ? "start" : "middle",
      rotation: mode === "broken-alignment" ? range(seed, 432, -3, 3) : 0,
      opacity: 0.96,
      layer: "typography",
    });
  }

  const editionYear = String(2020 + (seed % 6));
  placements.push({
    id: "premium-type-sub",
    role: "subheadline",
    text: `${spec.brief.product.split(" ")[0]?.toUpperCase() ?? "STUDIO"} · ${editionYear}`,
    x: snap(placements[0]!.x + range(seed, 440, 0, safeZone.width * 0.06)),
    y: snap((placements[placements.length - 1]?.y ?? baseY) + tokens.headline.size * 0.95),
    size: tokens.subHeadline.size,
    tracking: tokens.subHeadline.tracking,
    lineHeight: tokens.subHeadline.lineHeight,
    weight: 400,
    align: placements[0]!.align,
    rotation: 0,
    opacity: 0.48,
    layer: "typography",
  });

  const decorBaseX = snap(safeZone.x + safeZone.width * (0.08 + space.lateralBias * 0.04));
  placements.push({
    id: "premium-roman",
    role: "roman-numeral",
    text: toRomanNumeral(seed),
    x: decorBaseX,
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
    id: "premium-coordinates",
    role: "coordinates",
    text: formatCoordinates(seed).replace("° N", "°").replace("° W", ""),
    x: snap(safeZone.x + safeZone.width * 0.86),
    y: snap(safeZone.y + safeZone.height * 0.9),
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
    id: "premium-collection-id",
    role: "collection-code",
    text: `${toRomanNumeral(seed + 2)} · ${editionYear.slice(-2)}`,
    x: snap(plan.primary.x + plan.primary.scale * 0.22),
    y: snap(intersectionBand.y + intersectionBand.height * 0.85),
    size: tokens.caption.size,
    tracking: tokens.caption.tracking,
    lineHeight: tokens.caption.lineHeight,
    weight: 400,
    align: "start",
    rotation: range(seed, 450, -6, 6),
    opacity: 0.52,
    layer: "decorative",
  });

  if (compositionType === "faith-collection") {
    placements.push({
      id: "premium-faith-verse",
      role: "caption",
      text: "GRACE · MERCY · TRUTH",
      x: snap(safeZone.x + safeZone.width * 0.72),
      y: snap(safeZone.y + safeZone.height * 0.14),
      size: tokens.quote.size,
      tracking: tokens.quote.tracking,
      lineHeight: tokens.quote.lineHeight,
      weight: 300,
      align: "end",
      rotation: 0,
      opacity: 0.4,
      layer: "decorative",
    });
  }

  return { placements, intersectionBand, layoutMode: mode };
}
