import type { DesignStyleId, LayoutId, SymbolDefinition, SymbolId } from "@/lib/design/design-library/types";

function sym(
  id: SymbolId,
  name: string,
  proportion: number,
  variant: SymbolDefinition["construction"]["variant"],
  styles: DesignStyleId[],
  layouts: LayoutId[],
  gapDegrees?: number,
): SymbolDefinition {
  return {
    id,
    name,
    construction: { strokeWeight: 1, proportion, variant, gapDegrees },
    recommendedStyles: styles,
    recommendedLayouts: layouts,
  };
}

export const SYMBOL_REGISTRY: Record<SymbolId, SymbolDefinition> = {
  "broken-circle": sym("broken-circle", "Broken Circle", 0.38, "outline", ["vintage-washed", "modern-gothic"], ["center-chest", "gallery-layout"], 28),
  "interrupted-arc": sym("interrupted-arc", "Interrupted Arc", 0.4, "dual-stroke", ["minimal-luxury", "silent-luxury", "monochrome-luxury"], ["center-chest", "symbol-above-type"], 34),
  halo: sym("halo", "Halo", 0.36, "outline", ["silent-luxury", "faith", "japanese-minimal"], ["micro-chest", "floating-composition"]),
  cross: sym("cross", "Cross", 0.12, "outline", ["faith", "modern-gothic"], ["center-chest", "vertical-print"]),
  compass: sym("compass", "Compass", 0.32, "outline", ["technical-streetwear"], ["vertical-print", "split-layout"]),
  frame: sym("frame", "Frame", 0.55, "outline", ["architectural", "editorial-fashion", "minimal-luxury"], ["editorial-layout", "gallery-layout"]),
  "minimal-star": sym("minimal-star", "Minimal Star", 0.14, "outline", ["minimal-luxury", "scandinavian-minimal"], ["center-chest", "micro-chest"]),
  diamond: sym("diamond", "Diamond", 0.16, "outline", ["monochrome-luxury", "modern-gothic"], ["center-chest", "floating-composition"]),
  "architectural-line": sym("architectural-line", "Architectural Line", 0.48, "outline", ["architectural", "swiss-typography"], ["split-layout", "editorial-layout"]),
  "sacred-geometry": sym("sacred-geometry", "Sacred Geometry", 0.32, "outline", ["faith"], ["center-chest", "vertical-print"]),
  grid: sym("grid", "Grid", 0.35, "outline", ["technical-streetwear", "swiss-typography", "architectural"], ["split-layout", "vertical-print"]),
  "half-circle": sym("half-circle", "Half Circle", 0.34, "outline", ["japanese-minimal", "scandinavian-minimal"], ["micro-chest", "floating-composition"]),
  "split-circle": sym("split-circle", "Split Circle", 0.38, "outline", ["vintage-washed", "modern-gothic"], ["oversized-front", "gallery-layout"], 28),
  orbit: sym("orbit", "Orbit", 0.42, "dual-stroke", ["vintage-washed", "silent-luxury"], ["center-chest", "wrap-composition"]),
  "minimal-eye": sym("minimal-eye", "Minimal Eye", 0.18, "outline", ["japanese-minimal"], ["micro-chest", "floating-composition"]),
  "directional-marker": sym("directional-marker", "Directional Marker", 0.1, "filled", ["technical-streetwear"], ["vertical-print", "dual-print"]),
  "missing-center-void": sym("missing-center-void", "Missing Center Void", 0.4, "outline", ["silent-luxury", "minimal-luxury"], ["center-chest", "symbol-above-type"]),
};

export const ALL_SYMBOL_IDS = Object.keys(SYMBOL_REGISTRY) as SymbolId[];

export function getSymbol(id: SymbolId): SymbolDefinition {
  return SYMBOL_REGISTRY[id] ?? SYMBOL_REGISTRY["interrupted-arc"];
}
