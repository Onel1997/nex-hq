import type { KnowledgeRecipeMeta } from "@/lib/design/design-knowledge/types";
import type { SymbolId } from "@/lib/design/design-library/types";

export type SymbolPriority = "dominant" | "secondary" | "supporting" | "accent";
export type SymbolDepth = "foreground" | "midground" | "background" | "ghost";
export type SymbolInteraction = "frames-type" | "overlaps-type" | "behind-type" | "masks-type" | "independent";

export interface SymbolSystemRecipe {
  id: string;
  meta: KnowledgeRecipeMeta;
  primary: SymbolId;
  secondary: SymbolId;
  nested: SymbolId[];
  priority: SymbolPriority;
  depth: SymbolDepth;
  interaction: SymbolInteraction;
  overlap: number;
  masking: boolean;
  restraint: number;
  relationships: string[];
}
