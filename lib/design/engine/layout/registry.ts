import type { LayoutFamily, LayoutZones, Point, Rect } from "@/lib/design/engine/types";
import { snap } from "@/lib/design/vector-engine/tokens";

const CM = 36;

export function parseArtboard(dimensions: string): Rect {
  const numbers = dimensions.match(/(\d+(?:\.\d+)?)/g)?.map(Number) ?? [];
  const w = numbers.length >= 2 ? Math.max(2, numbers[0]) : numbers[0] ?? 28;
  const h = numbers.length >= 2 ? Math.max(2, numbers[1]) : w * 1.15;
  return { x: 0, y: 0, width: snap(w * CM), height: snap(h * CM) };
}

function safeZone(artboard: Rect, margin = 0.08): Rect {
  return {
    x: artboard.x + artboard.width * margin,
    y: artboard.y + artboard.height * margin,
    width: artboard.width * (1 - margin * 2),
    height: artboard.height * (1 - margin * 2),
  };
}

interface LayoutRecipe {
  focal: (sz: Rect) => Point;
  heroHeight: number;
  typeOffset: number;
  marginTop: number;
  marginBottom: number;
}

const RECIPES: Record<LayoutFamily, LayoutRecipe> = {
  "center-chest": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.38) }),
    heroHeight: 0.48,
    typeOffset: 0.52,
    marginTop: 0.1,
    marginBottom: 0.12,
  },
  "oversized-front": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.44) }),
    heroHeight: 0.58,
    typeOffset: 0.58,
    marginTop: 0.06,
    marginBottom: 0.08,
  },
  "oversized-back": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.42) }),
    heroHeight: 0.62,
    typeOffset: 0.6,
    marginTop: 0.05,
    marginBottom: 0.07,
  },
  "small-chest-large-back": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.4) }),
    heroHeight: 0.55,
    typeOffset: 0.56,
    marginTop: 0.08,
    marginBottom: 0.1,
  },
  "dual-print": {
    focal: (sz) => ({ x: snap(sz.x + sz.width * 0.32), y: snap(sz.y + sz.height * 0.4) }),
    heroHeight: 0.4,
    typeOffset: 0.5,
    marginTop: 0.1,
    marginBottom: 0.12,
  },
  "corner-placement": {
    focal: (sz) => ({ x: snap(sz.x + sz.width * 0.72), y: snap(sz.y + sz.height * 0.28) }),
    heroHeight: 0.35,
    typeOffset: 0.42,
    marginTop: 0.12,
    marginBottom: 0.14,
  },
  "wrap-composition": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.36) }),
    heroHeight: 0.5,
    typeOffset: 0.54,
    marginTop: 0.08,
    marginBottom: 0.1,
  },
  "vertical-layout": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.35) }),
    heroHeight: 0.45,
    typeOffset: 0.48,
    marginTop: 0.1,
    marginBottom: 0.12,
  },
  "editorial-layout": {
    focal: (sz) => ({ x: snap(sz.x + sz.width * 0.5), y: snap(sz.y + sz.height * 0.32) }),
    heroHeight: 0.42,
    typeOffset: 0.5,
    marginTop: 0.14,
    marginBottom: 0.16,
  },
  "split-layout": {
    focal: (sz) => ({ x: snap(sz.x + sz.width * 0.38), y: snap(sz.y + sz.height * 0.42) }),
    heroHeight: 0.46,
    typeOffset: 0.54,
    marginTop: 0.1,
    marginBottom: 0.12,
  },
  "stacked-layout": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.3) }),
    heroHeight: 0.38,
    typeOffset: 0.44,
    marginTop: 0.12,
    marginBottom: 0.14,
  },
  "gallery-layout": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.4) }),
    heroHeight: 0.44,
    typeOffset: 0.52,
    marginTop: 0.1,
    marginBottom: 0.12,
  },
};

export function resolveLayoutZones(
  family: LayoutFamily,
  artboard: Rect,
  negativeSpaceBias: number,
): LayoutZones {
  const margin = 0.08 + negativeSpaceBias * 0.04;
  const safe = safeZone(artboard, margin);
  const recipe = RECIPES[family] ?? RECIPES["center-chest"];
  const focal = recipe.focal(safe);
  const heroH = safe.height * recipe.heroHeight;
  const typeH = safe.height * (1 - recipe.typeOffset);

  return {
    artboard,
    safeZone: safe,
    heroZone: {
      x: safe.x,
      y: focal.y - heroH * 0.45,
      width: safe.width,
      height: heroH,
    },
    typeZone: {
      x: safe.x + safe.width * 0.1,
      y: focal.y + heroH * 0.35,
      width: safe.width * 0.8,
      height: typeH,
    },
    accentZone: {
      x: safe.x,
      y: safe.y,
      width: safe.width,
      height: safe.height,
    },
    marginTop: safe.height * recipe.marginTop,
    marginBottom: safe.height * recipe.marginBottom,
    baselineGrid: 4,
  };
}

export function detectLayoutFamily(
  placement: string,
  printArea: string,
  role: string,
): LayoutFamily {
  const t = `${placement} ${printArea} ${role}`.toLowerCase();
  if (t.includes("dual") || t.includes("split print")) return "dual-print";
  if (t.includes("corner")) return "corner-placement";
  if (t.includes("wrap")) return "wrap-composition";
  if (t.includes("editorial") || t.includes("magazine")) return "editorial-layout";
  if (t.includes("gallery")) return "gallery-layout";
  if (t.includes("stacked") || t.includes("vertical stack")) return "stacked-layout";
  if (t.includes("vertical") || t.includes("column")) return "vertical-layout";
  if (t.includes("split") || t.includes("asym")) return "split-layout";
  if (t.includes("small chest") && t.includes("back")) return "small-chest-large-back";
  if (t.includes("oversized") && t.includes("back")) return "oversized-back";
  if (t.includes("oversized") || t.includes("statement")) return "oversized-front";
  if (t.includes("back")) return "oversized-back";
  if (t.includes("chest") || t.includes("center")) return "center-chest";
  return "center-chest";
}
