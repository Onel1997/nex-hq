import type { GridDefinition, GridId } from "@/lib/design/design-library/types";
import { DESIGN_TOKENS } from "@/lib/design/vector-engine/tokens";

export const GRID_REGISTRY: Record<GridId, GridDefinition> = {
  baseline: {
    id: "baseline",
    name: "Baseline Grid",
    columns: 12,
    gutter: DESIGN_TOKENS.grid.gutter,
    baseline: DESIGN_TOKENS.grid.baseline,
  },
  modular: {
    id: "modular",
    name: "Modular Grid",
    columns: 12,
    gutter: 8,
    baseline: 4,
  },
  golden: {
    id: "golden",
    name: "Golden Ratio Grid",
    columns: 8,
    gutter: 12,
    baseline: 4,
  },
  editorial: {
    id: "editorial",
    name: "Editorial Grid",
    columns: 6,
    gutter: 16,
    baseline: 6,
  },
  technical: {
    id: "technical",
    name: "Technical Grid",
    columns: 16,
    gutter: 4,
    baseline: 4,
  },
};

export function getGrid(id: GridId): GridDefinition {
  return GRID_REGISTRY[id] ?? GRID_REGISTRY.baseline;
}

export function selectGrid(styleId: string): GridDefinition {
  if (styleId === "technical-streetwear" || styleId === "swiss-typography") return GRID_REGISTRY.technical;
  if (styleId === "editorial-fashion") return GRID_REGISTRY.editorial;
  if (styleId === "architectural") return GRID_REGISTRY.modular;
  return GRID_REGISTRY.baseline;
}
