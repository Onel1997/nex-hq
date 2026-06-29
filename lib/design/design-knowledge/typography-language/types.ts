import type { KnowledgeRecipeMeta } from "@/lib/design/design-knowledge/types";

export type TypographyFamily =
  | "luxury-serif"
  | "modern-grotesk"
  | "editorial-sans"
  | "fashion-condensed"
  | "museum-label"
  | "roman-numeral"
  | "coordinates"
  | "capsule-id"
  | "collection-name"
  | "production-id"
  | "garment-id"
  | "broken-type"
  | "vertical-type"
  | "oversized-type"
  | "split-type"
  | "offset-type"
  | "ghost-type"
  | "multi-scale";

export type TypographyInteraction =
  | "overlaps-symbol"
  | "behind-geometry"
  | "through-geometry"
  | "breaks-frame"
  | "floats-independent"
  | "anchors-edge";

export interface TypographyRecipe {
  id: string;
  meta: KnowledgeRecipeMeta;
  family: TypographyFamily;
  headlineWeight: number;
  subheadWeight: number;
  decorWeight: number;
  headlineScale: number;
  subheadScale: number;
  decorScale: number;
  trackingTight: number;
  trackingWide: number;
  lineHeight: number;
  alignment: "start" | "middle" | "end" | "broken";
  interaction: TypographyInteraction;
  layerPriority: number;
  roles: string[];
  editorialSpacing: number;
}
