import type { KnowledgeBlueprint, KnowledgeQuery } from "@/lib/design/design-knowledge/types";
import { selectLayoutRecipe } from "@/lib/design/design-knowledge/layout-language";
import { selectTypographyRecipe } from "@/lib/design/design-knowledge/typography-language";
import { selectSymbolSystem } from "@/lib/design/design-knowledge/symbol-language";
import { selectOrnamentSystem } from "@/lib/design/design-knowledge/ornament-language";
import { selectCompositionPattern } from "@/lib/design/design-knowledge/composition-language";
import { resolveCollection } from "@/lib/design/design-knowledge/collection-language";
import { getTopFashionPrinciples } from "@/lib/design/design-knowledge/fashion-language";
import { evaluateArtDirection } from "@/lib/design/design-knowledge/art-direction/verdict";
import type { ArtDirectionVerdict } from "@/lib/design/design-knowledge/art-direction/verdict";

export interface CreativeDirectorDecision {
  blueprint: KnowledgeBlueprint;
  layout: ReturnType<typeof selectLayoutRecipe>;
  typography: ReturnType<typeof selectTypographyRecipe>;
  symbol: ReturnType<typeof selectSymbolSystem>;
  ornament: ReturnType<typeof selectOrnamentSystem>;
  composition: ReturnType<typeof selectCompositionPattern>;
  collection: ReturnType<typeof resolveCollection>;
  fashionPrinciples: ReturnType<typeof getTopFashionPrinciples>;
  artDirection: ArtDirectionVerdict;
}

/**
 * Creative Director brain — selects proven knowledge instead of inventing compositions.
 * Answers: what layout language, typography language, fashion system, and collection
 * best express this garment?
 */
export function decideFromKnowledge(query: KnowledgeQuery): CreativeDirectorDecision {
  const text = `${query.visualConcept} ${query.product} ${query.placement}`;
  const collection = resolveCollection(text);
  const collectionQuery = { ...query, collectionHint: collection.id };

  const layout = selectLayoutRecipe(collectionQuery);
  const typography = selectTypographyRecipe(collectionQuery, layout.meta.family);
  const symbol = selectSymbolSystem(collectionQuery, layout.meta.family);
  const ornament = selectOrnamentSystem(collectionQuery, layout.meta.family);
  const composition = selectCompositionPattern(collectionQuery, collection.id);
  const fashionPrinciples = getTopFashionPrinciples(text);

  const blueprint: KnowledgeBlueprint = {
    layoutId: layout.id,
    typographyId: typography.id,
    symbolSystemId: symbol.id,
    ornamentSystemId: ornament.id,
    compositionId: composition.id,
    collectionId: collection.id,
    fashionPrincipleIds: fashionPrinciples.map((p) => p.id),
    meta: {
      layout: layout.meta,
      typography: typography.meta,
      symbol: symbol.meta,
      ornament: ornament.meta,
      composition: composition.meta,
      collection: {
        id: collection.id,
        name: collection.name,
        family: collection.name,
        variant: 0,
        tags: collection.tags,
        collections: [collection.id],
        garmentFit: layout.meta.garmentFit,
      },
    },
  };

  const artDirection = evaluateArtDirection(
    blueprint,
    layout,
    typography,
    symbol,
    ornament,
    composition,
    collection,
  );

  console.log(`[DESIGN KNOWLEDGE] Collection: ${collection.name}`);
  console.log(`[DESIGN KNOWLEDGE] Layout: ${layout.meta.family} (${layout.id})`);
  console.log(`[DESIGN KNOWLEDGE] Typography: ${typography.meta.family} (${typography.id})`);
  console.log(`[DESIGN KNOWLEDGE] Symbol System: ${symbol.meta.family}`);
  console.log(`[DESIGN KNOWLEDGE] Ornament System: ${ornament.meta.family}`);
  console.log(
    `[DESIGN KNOWLEDGE] Art Direction — luxury=${artDirection.feelsLuxury} oversized=${artDirection.belongsOnOversizedTee} scroll-stop=${artDirection.wouldStopScrolling}`,
  );

  return {
    blueprint,
    layout,
    typography,
    symbol,
    ornament,
    composition,
    collection,
    fashionPrinciples,
    artDirection,
  };
}

export function queryFromBrief(brief: {
  visualConcept: string;
  role: string;
  product: string;
  placement: string;
  printArea: string;
  title?: string;
}, seed: number): KnowledgeQuery {
  return {
    visualConcept: `${brief.visualConcept} ${brief.title ?? ""}`,
    role: brief.role,
    product: brief.product,
    placement: brief.placement,
    printArea: brief.printArea,
    seed,
  };
}
