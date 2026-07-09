import type { CreativeDirectorDecision } from "@/lib/design/design-knowledge/art-direction/creative-director";
import type { LayoutRecipe } from "@/lib/design/design-knowledge/layout-language/types";
import type { TypographyRecipe } from "@/lib/design/design-knowledge/typography-language/types";
import type { SymbolSystemRecipe } from "@/lib/design/design-knowledge/symbol-language/types";
import type { OrnamentSystemRecipe } from "@/lib/design/design-knowledge/ornament-language/types";
import type { CompositionPattern } from "@/lib/design/design-knowledge/composition-language/patterns";
import type { CollectionLanguage } from "@/lib/design/design-knowledge/collection-language/collections";
import type { FashionPrinciple } from "@/lib/design/design-knowledge/fashion-language/principles";

export interface VisualSystemStack {
  layout: LayoutRecipe;
  typography: TypographyRecipe;
  symbol: SymbolSystemRecipe;
  ornament: OrnamentSystemRecipe;
  composition: CompositionPattern;
  collection: CollectionLanguage;
  fashion: FashionPrinciple[];
}

/** A composition is built from systems — not primitives. */
export function buildVisualSystemStack(decision: CreativeDirectorDecision): VisualSystemStack {
  return {
    layout: decision.layout,
    typography: decision.typography,
    symbol: decision.symbol,
    ornament: decision.ornament,
    composition: decision.composition,
    collection: decision.collection,
    fashion: decision.fashionPrinciples,
  };
}

export const VISUAL_SYSTEM_NAMES = [
  "Layout System",
  "Typography System",
  "Symbol System",
  "Ornament System",
  "Editorial System",
  "Negative Space System",
  "Movement System",
  "Depth System",
  "Fashion System",
] as const;

export function describeVisualSystems(stack: VisualSystemStack): Record<string, string> {
  return {
    "Layout System": `${stack.layout.meta.family} — ${stack.layout.balance} balance, ${stack.layout.density} density`,
    "Typography System": `${stack.typography.meta.family} — ${stack.typography.interaction}, priority ${stack.typography.layerPriority}`,
    "Symbol System": `${stack.symbol.meta.family} — ${stack.symbol.interaction}, restraint ${stack.symbol.restraint.toFixed(2)}`,
    "Ornament System": `${stack.ornament.meta.family} — ${stack.ornament.density}, weight ${stack.ornament.visualWeight.toFixed(2)}`,
    "Editorial System": `${stack.composition.meta.family} — ${stack.composition.focalStrategy}`,
    "Negative Space System": `min void ${stack.composition.negativeSpaceMin.toFixed(2)}, layout void ${stack.layout.negativeSpace.toFixed(2)}`,
    "Movement System": stack.composition.movementRequired ? "active flow required" : "static restraint",
    "Depth System": `${stack.composition.depthLayers} layers, overlap=${stack.composition.overlapRequired}`,
    "Fashion System": stack.fashion.map((f) => f.name).join(", "),
  };
}
