import type { KnowledgeBlueprint } from "@/lib/design/design-knowledge/types";
import type { LayoutRecipe } from "@/lib/design/design-knowledge/layout-language/types";
import type { TypographyRecipe } from "@/lib/design/design-knowledge/typography-language/types";
import type { SymbolSystemRecipe } from "@/lib/design/design-knowledge/symbol-language/types";
import type { OrnamentSystemRecipe } from "@/lib/design/design-knowledge/ornament-language/types";
import type { CompositionPattern } from "@/lib/design/design-knowledge/composition-language/patterns";
import type { CollectionLanguage } from "@/lib/design/design-knowledge/collection-language/collections";

export interface ArtDirectionVerdict {
  feelsLuxury: boolean;
  feelsTooBusy: boolean;
  feelsCommercial: boolean;
  belongsOnOversizedTee: boolean;
  belongsInFashionCampaign: boolean;
  wouldStopScrolling: boolean;
  confidence: number;
  notes: string[];
}

export function evaluateArtDirection(
  blueprint: KnowledgeBlueprint,
  layout: LayoutRecipe,
  typography: TypographyRecipe,
  symbol: SymbolSystemRecipe,
  ornament: OrnamentSystemRecipe,
  composition: CompositionPattern,
  collection: CollectionLanguage,
): ArtDirectionVerdict {
  const notes: string[] = [];
  let luxury = 0;
  let busy = 0;
  let commercial = 0;
  let oversized = 0;
  let campaign = 0;
  let scroll = 0;

  if (layout.negativeSpace >= 0.45) { luxury += 20; notes.push("generous negative space reads luxury"); }
  if (layout.density === "dense") { busy += 25; notes.push("high density risks busyness"); }
  if (layout.density === "sparse") { luxury += 12; }
  if (typography.headlineScale >= 1.2) { campaign += 15; scroll += 12; oversized += 10; }
  if (typography.family === "museum-label" || typography.family === "ghost-type") { luxury += 14; }
  if (symbol.restraint >= 0.7) { luxury += 16; notes.push("symbol restraint signals premium"); }
  if (symbol.restraint < 0.5) { commercial += 10; busy += 8; }
  if (ornament.density === "dense") { busy += 15; }
  if (ornament.visualWeight < 0.3) { luxury += 8; }
  if (layout.meta.garmentFit.includes("oversized-front")) { oversized += 22; }
  if (composition.movementRequired) { campaign += 12; scroll += 10; }
  if (composition.overlapRequired) { scroll += 8; campaign += 8; }
  if (collection.negativeSpace >= 0.5) { luxury += 10; }
  if (typography.layerPriority >= 90) { scroll += 10; }

  const feelsLuxury = luxury >= 35;
  const feelsTooBusy = busy >= 30;
  const feelsCommercial = commercial >= 20 && luxury < 30;
  const belongsOnOversizedTee = oversized >= 20 || layout.spread >= 0.7;
  const belongsInFashionCampaign = campaign >= 25;
  const wouldStopScrolling = scroll >= 20 && !feelsTooBusy;

  const confidence = Math.min(
    100,
    Math.round((luxury + campaign + scroll + oversized) / 4),
  );

  return {
    feelsLuxury,
    feelsTooBusy,
    feelsCommercial,
    belongsOnOversizedTee,
    belongsInFashionCampaign,
    wouldStopScrolling,
    confidence,
    notes,
  };
}
