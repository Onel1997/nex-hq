import type { LayoutDefinition, LayoutId, LayoutZones, Point, Rect } from "@/lib/design/design-library/types";
import { snap } from "@/lib/design/vector-engine/tokens";

function safeZone(artboard: Rect, margin: number): Rect {
  return {
    x: artboard.x + artboard.width * margin,
    y: artboard.y + artboard.height * margin,
    width: artboard.width * (1 - margin * 2),
    height: artboard.height * (1 - margin * 2),
  };
}

interface LayoutRecipe {
  focal: (sz: Rect) => Point;
  typeAnchor: (sz: Rect, focal: Point) => Point;
  symbolAnchor: (sz: Rect, focal: Point) => Point;
  heroHeight: number;
  typeOffset: number;
  marginTop: number;
  marginBottom: number;
  paddingSides: number;
}

function buildZones(
  artboard: Rect,
  recipe: LayoutRecipe,
  margin: number,
  balance: LayoutDefinition["balance"],
  hierarchy: LayoutDefinition["hierarchy"],
): LayoutZones {
  const safe = safeZone(artboard, margin);
  const focal = recipe.focal(safe);
  const heroH = safe.height * recipe.heroHeight;
  const typeH = safe.height * (1 - recipe.typeOffset);
  const typeAnchor = recipe.typeAnchor(safe, focal);
  const symbolAnchor = recipe.symbolAnchor(safe, focal);

  return {
    artboard,
    safeZone: safe,
    heroZone: {
      x: safe.x + safe.width * recipe.paddingSides,
      y: focal.y - heroH * 0.45,
      width: safe.width * (1 - recipe.paddingSides * 2),
      height: heroH,
    },
    typeZone: {
      x: safe.x + safe.width * (0.1 + recipe.paddingSides),
      y: hierarchy === "type-first" ? typeAnchor.y - typeH * 0.2 : typeAnchor.y,
      width: safe.width * (0.8 - recipe.paddingSides),
      height: typeH,
    },
    accentZone: { x: safe.x, y: safe.y, width: safe.width, height: safe.height },
    anchors: {
      focal,
      type: typeAnchor,
      symbol: symbolAnchor,
      secondary:
        balance === "asymmetric"
          ? { x: snap(safe.x + safe.width * 0.28), y: snap(safe.y + safe.height * 0.62) }
          : undefined,
    },
    marginTop: safe.height * recipe.marginTop,
    marginBottom: safe.height * recipe.marginBottom,
    baselineGrid: 4,
  };
}

const centerFocal = (sz: Rect): Point => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.38) });
const centerType = (_sz: Rect, focal: Point): Point => ({ x: focal.x, y: snap(focal.y + _sz.height * 0.18) });
const centerSymbol = (_sz: Rect, focal: Point): Point => ({ x: focal.x, y: snap(focal.y - _sz.height * 0.06) });

const RECIPES: Record<LayoutId, LayoutRecipe> = {
  "center-chest": {
    focal: centerFocal,
    typeAnchor: centerType,
    symbolAnchor: centerSymbol,
    heroHeight: 0.48,
    typeOffset: 0.52,
    marginTop: 0.1,
    marginBottom: 0.12,
    paddingSides: 0,
  },
  "oversized-front": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.44) }),
    typeAnchor: (sz, f) => ({ x: f.x, y: snap(sz.y + sz.height * 0.58) }),
    symbolAnchor: (sz, f) => ({ x: f.x, y: snap(f.y - sz.height * 0.04) }),
    heroHeight: 0.58,
    typeOffset: 0.58,
    marginTop: 0.06,
    marginBottom: 0.08,
    paddingSides: 0.02,
  },
  "oversized-back": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.42) }),
    typeAnchor: (sz, f) => ({ x: f.x, y: snap(sz.y + sz.height * 0.6) }),
    symbolAnchor: centerSymbol,
    heroHeight: 0.62,
    typeOffset: 0.6,
    marginTop: 0.05,
    marginBottom: 0.07,
    paddingSides: 0.02,
  },
  "corner-print": {
    focal: (sz) => ({ x: snap(sz.x + sz.width * 0.72), y: snap(sz.y + sz.height * 0.28) }),
    typeAnchor: (sz, f) => ({ x: f.x, y: snap(f.y + sz.height * 0.14) }),
    symbolAnchor: (sz, f) => ({ x: f.x, y: snap(f.y - sz.height * 0.04) }),
    heroHeight: 0.35,
    typeOffset: 0.42,
    marginTop: 0.12,
    marginBottom: 0.14,
    paddingSides: 0.08,
  },
  "vertical-print": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.35) }),
    typeAnchor: (sz) => ({ x: snap(sz.x + sz.width * 0.12), y: snap(sz.y + sz.height * 0.3) }),
    symbolAnchor: centerSymbol,
    heroHeight: 0.45,
    typeOffset: 0.48,
    marginTop: 0.1,
    marginBottom: 0.12,
    paddingSides: 0.04,
  },
  "dual-print": {
    focal: (sz) => ({ x: snap(sz.x + sz.width * 0.32), y: snap(sz.y + sz.height * 0.4) }),
    typeAnchor: (sz, f) => ({ x: snap(sz.x + sz.width * 0.68), y: f.y }),
    symbolAnchor: centerSymbol,
    heroHeight: 0.4,
    typeOffset: 0.5,
    marginTop: 0.1,
    marginBottom: 0.12,
    paddingSides: 0,
  },
  "split-layout": {
    focal: (sz) => ({ x: snap(sz.x + sz.width * 0.38), y: snap(sz.y + sz.height * 0.42) }),
    typeAnchor: (sz, f) => ({ x: snap(sz.x + sz.width * 0.62), y: f.y }),
    symbolAnchor: centerSymbol,
    heroHeight: 0.46,
    typeOffset: 0.54,
    marginTop: 0.1,
    marginBottom: 0.12,
    paddingSides: 0.04,
  },
  "gallery-layout": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.4) }),
    typeAnchor: (sz, f) => ({ x: f.x, y: snap(sz.y + sz.height * 0.56) }),
    symbolAnchor: centerSymbol,
    heroHeight: 0.44,
    typeOffset: 0.52,
    marginTop: 0.1,
    marginBottom: 0.12,
    paddingSides: 0.06,
  },
  "editorial-layout": {
    focal: (sz) => ({ x: snap(sz.x + sz.width * 0.5), y: snap(sz.y + sz.height * 0.32) }),
    typeAnchor: (sz, f) => ({ x: f.x, y: snap(sz.y + sz.height * 0.54) }),
    symbolAnchor: (sz, f) => ({ x: f.x, y: snap(f.y - sz.height * 0.02) }),
    heroHeight: 0.42,
    typeOffset: 0.5,
    marginTop: 0.14,
    marginBottom: 0.16,
    paddingSides: 0.08,
  },
  "micro-chest": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.46) }),
    typeAnchor: centerType,
    symbolAnchor: centerSymbol,
    heroHeight: 0.32,
    typeOffset: 0.48,
    marginTop: 0.14,
    marginBottom: 0.16,
    paddingSides: 0.12,
  },
  "symbol-above-type": {
    focal: centerFocal,
    typeAnchor: (sz, f) => ({ x: f.x, y: snap(f.y + sz.height * 0.22) }),
    symbolAnchor: (sz, f) => ({ x: f.x, y: snap(f.y - sz.height * 0.1) }),
    heroHeight: 0.4,
    typeOffset: 0.5,
    marginTop: 0.1,
    marginBottom: 0.12,
    paddingSides: 0,
  },
  "type-above-symbol": {
    focal: centerFocal,
    typeAnchor: (sz, f) => ({ x: f.x, y: snap(f.y - sz.height * 0.04) }),
    symbolAnchor: (sz, f) => ({ x: f.x, y: snap(f.y + sz.height * 0.16) }),
    heroHeight: 0.4,
    typeOffset: 0.46,
    marginTop: 0.1,
    marginBottom: 0.12,
    paddingSides: 0,
  },
  "wrap-composition": {
    focal: (sz) => ({ x: snap(sz.x + sz.width / 2), y: snap(sz.y + sz.height * 0.36) }),
    typeAnchor: centerType,
    symbolAnchor: centerSymbol,
    heroHeight: 0.5,
    typeOffset: 0.54,
    marginTop: 0.08,
    marginBottom: 0.1,
    paddingSides: 0.04,
  },
  "diagonal-layout": {
    focal: (sz) => ({ x: snap(sz.x + sz.width * 0.58), y: snap(sz.y + sz.height * 0.36) }),
    typeAnchor: (sz) => ({ x: snap(sz.x + sz.width * 0.34), y: snap(sz.y + sz.height * 0.58) }),
    symbolAnchor: (sz, f) => ({ x: f.x, y: f.y }),
    heroHeight: 0.44,
    typeOffset: 0.52,
    marginTop: 0.1,
    marginBottom: 0.12,
    paddingSides: 0.06,
  },
  "floating-composition": {
    focal: (sz) => ({ x: snap(sz.x + sz.width * 0.52), y: snap(sz.y + sz.height * 0.44) }),
    typeAnchor: (sz, f) => ({ x: snap(f.x - sz.width * 0.04), y: snap(f.y + sz.height * 0.2) }),
    symbolAnchor: (sz, f) => ({ x: snap(f.x + sz.width * 0.03), y: snap(f.y - sz.height * 0.08) }),
    heroHeight: 0.38,
    typeOffset: 0.5,
    marginTop: 0.12,
    marginBottom: 0.14,
    paddingSides: 0.1,
  },
};

function makeLayout(
  id: LayoutId,
  name: string,
  balance: LayoutDefinition["balance"],
  hierarchy: LayoutDefinition["hierarchy"],
  alignment: LayoutDefinition["alignment"],
  scaling: LayoutDefinition["scaling"],
  safeZoneMargin: number,
): LayoutDefinition {
  const recipe = RECIPES[id];
  return {
    id,
    name,
    safeZoneMargin,
    padding: { top: recipe.marginTop, bottom: recipe.marginBottom, sides: recipe.paddingSides },
    balance,
    scaling,
    hierarchy,
    alignment,
    resolveZones: (artboard, negativeSpaceBias) =>
      buildZones(artboard, recipe, safeZoneMargin + negativeSpaceBias * 0.04, balance, hierarchy),
  };
}

export const LAYOUT_REGISTRY: Record<LayoutId, LayoutDefinition> = {
  "center-chest": makeLayout("center-chest", "Center Chest", "symmetric", "balanced", "center", { heroScale: 0.56, typeScale: 1, ornamentScale: 0.35, minScale: 0.28, maxScale: 0.72 }, 0.08),
  "oversized-front": makeLayout("oversized-front", "Oversized Front", "symmetric", "type-first", "center", { heroScale: 0.62, typeScale: 1.18, ornamentScale: 0.4, minScale: 0.4, maxScale: 0.85 }, 0.06),
  "oversized-back": makeLayout("oversized-back", "Oversized Back", "symmetric", "type-first", "center", { heroScale: 0.65, typeScale: 1.15, ornamentScale: 0.38, minScale: 0.42, maxScale: 0.88 }, 0.05),
  "corner-print": makeLayout("corner-print", "Corner Print", "asymmetric", "balanced", "asymmetric", { heroScale: 0.38, typeScale: 0.88, ornamentScale: 0.28, minScale: 0.22, maxScale: 0.5 }, 0.1),
  "vertical-print": makeLayout("vertical-print", "Vertical Print", "asymmetric", "balanced", "left", { heroScale: 0.48, typeScale: 0.92, ornamentScale: 0.32, minScale: 0.28, maxScale: 0.62 }, 0.08),
  "dual-print": makeLayout("dual-print", "Dual Print", "asymmetric", "balanced", "center", { heroScale: 0.42, typeScale: 0.9, ornamentScale: 0.3, minScale: 0.25, maxScale: 0.55 }, 0.08),
  "split-layout": makeLayout("split-layout", "Split Layout", "asymmetric", "balanced", "optical", { heroScale: 0.5, typeScale: 1, ornamentScale: 0.34, minScale: 0.3, maxScale: 0.68 }, 0.08),
  "gallery-layout": makeLayout("gallery-layout", "Gallery Layout", "optical", "type-first", "optical", { heroScale: 0.52, typeScale: 1.08, ornamentScale: 0.36, minScale: 0.32, maxScale: 0.7 }, 0.08),
  "editorial-layout": makeLayout("editorial-layout", "Editorial Layout", "symmetric", "type-first", "optical", { heroScale: 0.48, typeScale: 1.12, ornamentScale: 0.38, minScale: 0.3, maxScale: 0.72 }, 0.1),
  "micro-chest": makeLayout("micro-chest", "Micro Chest", "symmetric", "symbol-first", "center", { heroScale: 0.32, typeScale: 0.72, ornamentScale: 0.22, minScale: 0.18, maxScale: 0.42 }, 0.12),
  "symbol-above-type": makeLayout("symbol-above-type", "Symbol Above Type", "symmetric", "symbol-first", "center", { heroScale: 0.5, typeScale: 0.95, ornamentScale: 0.3, minScale: 0.28, maxScale: 0.65 }, 0.08),
  "type-above-symbol": makeLayout("type-above-symbol", "Type Above Symbol", "symmetric", "type-first", "center", { heroScale: 0.46, typeScale: 1.05, ornamentScale: 0.3, minScale: 0.28, maxScale: 0.65 }, 0.08),
  "wrap-composition": makeLayout("wrap-composition", "Wrap Composition", "optical", "balanced", "center", { heroScale: 0.54, typeScale: 1, ornamentScale: 0.35, minScale: 0.3, maxScale: 0.7 }, 0.08),
  "diagonal-layout": makeLayout("diagonal-layout", "Diagonal Layout", "asymmetric", "balanced", "asymmetric", { heroScale: 0.48, typeScale: 0.94, ornamentScale: 0.32, minScale: 0.28, maxScale: 0.62 }, 0.08),
  "floating-composition": makeLayout("floating-composition", "Floating Composition", "optical", "symbol-first", "optical", { heroScale: 0.4, typeScale: 0.85, ornamentScale: 0.28, minScale: 0.22, maxScale: 0.55 }, 0.1),
};

export const ALL_LAYOUT_IDS = Object.keys(LAYOUT_REGISTRY) as LayoutId[];

export function getLayout(id: LayoutId): LayoutDefinition {
  return LAYOUT_REGISTRY[id] ?? LAYOUT_REGISTRY["center-chest"];
}
