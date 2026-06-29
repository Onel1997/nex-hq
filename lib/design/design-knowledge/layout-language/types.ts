import type {
  AnchorProfile,
  BalanceStyle,
  CroppingStyle,
  DensityLevel,
  KnowledgeRecipeMeta,
  LayerOrder,
  MovementStyle,
} from "@/lib/design/design-knowledge/types";

export interface LayoutRecipe {
  id: string;
  meta: KnowledgeRecipeMeta;
  hierarchy: "type-first" | "geometry-first" | "balanced";
  negativeSpace: number;
  anchors: AnchorProfile;
  balance: BalanceStyle;
  density: DensityLevel;
  movement: MovementStyle;
  cropping: CroppingStyle;
  layerOrder: LayerOrder;
  /** 0–1 visual tension */
  tension: number;
  /** Safe zone margin ratio */
  marginRatio: number;
  /** Element spread across canvas */
  spread: number;
}
