import type { KnowledgeRecipeMeta } from "@/lib/design/design-knowledge/types";
import type { OrnamentId } from "@/lib/design/design-library/types";

export type OrnamentZone = "edge" | "flank" | "caption" | "micro" | "stamp" | "frame" | "never-center";

export interface OrnamentSystemRecipe {
  id: string;
  meta: KnowledgeRecipeMeta;
  primary: OrnamentId[];
  secondary: OrnamentId[];
  belongs: OrnamentZone[];
  never: OrnamentZone[];
  visualWeight: number;
  density: "sparse" | "moderate" | "dense";
  purpose: string;
}
