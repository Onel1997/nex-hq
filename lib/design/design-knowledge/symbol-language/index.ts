export type {
  SymbolDepth,
  SymbolInteraction,
  SymbolPriority,
  SymbolSystemRecipe,
} from "@/lib/design/design-knowledge/symbol-language/types";
export {
  buildAllSymbolSystems,
  SYMBOL_ARCHETYPE_COUNT,
  SYMBOL_RECIPE_TARGET,
  SYMBOL_VARIANTS_PER_ARCHETYPE,
} from "@/lib/design/design-knowledge/symbol-language/archetypes";
export {
  getSymbolSystemById,
  getSymbolSystemCount,
  getSymbolSystems,
  selectSymbolSystem,
} from "@/lib/design/design-knowledge/symbol-language/registry";
