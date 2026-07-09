/** Shared types for the Premium Design Knowledge Base. */

export type KnowledgeTier = "hero" | "statement" | "core" | "supporting" | "micro";

export type DensityLevel = "sparse" | "moderate" | "rich" | "dense";

export type MovementStyle =
  | "static"
  | "diagonal"
  | "cascade"
  | "sweep"
  | "radial"
  | "editorial-flow";

export type BalanceStyle = "symmetric" | "asymmetric" | "optical" | "radial" | "broken";

export type CroppingStyle = "none" | "edge-bleed" | "partial-frame" | "circle-crop" | "hard-crop";

export type LayerOrder =
  | "geometry-first"
  | "type-first"
  | "depth-interleaved"
  | "ornament-accent"
  | "negative-space-dominant";

export interface AnchorProfile {
  focal: { rx: number; ry: number };
  type: { rx: number; ry: number };
  symbol: { rx: number; ry: number };
  secondary?: { rx: number; ry: number };
}

export interface KnowledgeRecipeMeta {
  id: string;
  name: string;
  family: string;
  variant: number;
  tags: string[];
  collections: string[];
  garmentFit: ("oversized-front" | "oversized-back" | "center-chest" | "sleeve" | "corner")[];
}

export interface KnowledgeBlueprint {
  layoutId: string;
  typographyId: string;
  symbolSystemId: string;
  ornamentSystemId: string;
  compositionId: string;
  collectionId: string;
  fashionPrincipleIds: string[];
  meta: {
    layout: KnowledgeRecipeMeta;
    typography: KnowledgeRecipeMeta;
    symbol: KnowledgeRecipeMeta;
    ornament: KnowledgeRecipeMeta;
    composition: KnowledgeRecipeMeta;
    collection: KnowledgeRecipeMeta;
  };
}

export interface KnowledgeQuery {
  visualConcept: string;
  role: string;
  product: string;
  placement: string;
  printArea: string;
  collectionHint?: string;
  seed: number;
}
