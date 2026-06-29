import {
  getLayoutRecipeCount,
} from "@/lib/design/design-knowledge/layout-language";
import {
  getTypographyRecipeCount,
} from "@/lib/design/design-knowledge/typography-language";
import {
  getSymbolSystemCount,
} from "@/lib/design/design-knowledge/symbol-language";
import {
  getOrnamentSystemCount,
} from "@/lib/design/design-knowledge/ornament-language";
import {
  COMPOSITION_PATTERN_COUNT,
} from "@/lib/design/design-knowledge/composition-language";
import {
  getCollectionLanguages,
} from "@/lib/design/design-knowledge/collection-language";
import {
  getFashionPrinciples,
} from "@/lib/design/design-knowledge/fashion-language";

export type {
  AnchorProfile,
  BalanceStyle,
  CroppingStyle,
  DensityLevel,
  KnowledgeBlueprint,
  KnowledgeQuery,
  KnowledgeRecipeMeta,
  KnowledgeTier,
  LayerOrder,
  MovementStyle,
} from "@/lib/design/design-knowledge/types";

export * from "@/lib/design/design-knowledge/layout-language";
export * from "@/lib/design/design-knowledge/typography-language";
export * from "@/lib/design/design-knowledge/symbol-language";
export * from "@/lib/design/design-knowledge/ornament-language";
export * from "@/lib/design/design-knowledge/fashion-language";
export * from "@/lib/design/design-knowledge/composition-language";
export * from "@/lib/design/design-knowledge/collection-language";
export * from "@/lib/design/design-knowledge/emotional-language";
export * from "@/lib/design/design-knowledge/wearability";
export * from "@/lib/design/design-knowledge/art-direction";
export * from "@/lib/design/design-knowledge/visual-systems";
export * from "@/lib/design/design-knowledge/knowledge-score";

export {
  applyKnowledgeToRecipe,
  applyKnowledgeTypography,
  evaluateKnowledgeGate,
  passesKnowledgeGateForDecision,
  type KnowledgeAppliedRecipe,
} from "@/lib/design/design-knowledge/apply";

export function getKnowledgeBaseStats(): {
  layouts: number;
  typography: number;
  symbols: number;
  ornaments: number;
  compositions: number;
  collections: number;
  fashionPrinciples: number;
  totalRecipes: number;
} {
  const layouts = getLayoutRecipeCount();
  const typography = getTypographyRecipeCount();
  const symbols = getSymbolSystemCount();
  const ornaments = getOrnamentSystemCount();
  const compositions = COMPOSITION_PATTERN_COUNT;
  const collections = getCollectionLanguages().length;
  const fashionPrinciples = getFashionPrinciples().length;

  return {
    layouts,
    typography,
    symbols,
    ornaments,
    compositions,
    collections,
    fashionPrinciples,
    totalRecipes: layouts + typography + symbols + ornaments + compositions,
  };
}
