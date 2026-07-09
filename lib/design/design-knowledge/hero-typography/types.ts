import type { DesignStyleId, LayoutId, TemplateId, TypographyPlacement } from "@/lib/design/design-library/types";
import type { WearabilityDirectorDecision } from "@/lib/design/design-knowledge/wearability";

/** One typography direction per artwork — modern premium fashion editorial. */
export type HeroTypographyDirectionId =
  | "silent-luxury"
  | "faith"
  | "statement-piece"
  | "core-essential"
  | "hero-back-print";

export type HeroTypographyConcept =
  | "ghost-typography"
  | "cropped-typography"
  | "oversized-type"
  | "layered-type"
  | "broken-type"
  | "split-headline"
  | "offset-headline"
  | "micro-editorial-caption"
  | "museum-label"
  | "secondary-type-system"
  | "background-letterforms"
  | "typography-depth"
  | "multi-scale-hierarchy";

export type HeroTypographyScale = "micro" | "caption" | "secondary" | "dominant" | "oversized" | "background";

export interface HeroTypographyDirection {
  id: HeroTypographyDirectionId;
  name: string;
  concepts: HeroTypographyConcept[];
  /** Target share of visual composition occupied by typography (0–1). */
  compositionShare: [number, number];
  keywords: string[];
  styleBias: DesignStyleId[];
  layoutBias: LayoutId[];
  templateBias: TemplateId[];
  templateAvoid: TemplateId[];
  hierarchy: "restrained" | "layered" | "dramatic";
}

export interface HeroTypographyDirectorDecision {
  direction: HeroTypographyDirectionId;
  concepts: HeroTypographyConcept[];
  compositionShareTarget: number;
  confidence: number;
  reason: string;
  apparelLens: WearabilityDirectorDecision["apparelLens"];
}

export interface HeroTypographyBuildContext {
  safeZone: { x: number; y: number; width: number; height: number };
  focal: { x: number; y: number };
  heroScale: number;
  seed: number;
  title: string;
  product: string;
  designId: string;
}

export interface HeroTypographyCompositionMatch {
  aligned: boolean;
  score: number;
  compositionShare: number;
  scaleCount: number;
  conceptHits: HeroTypographyConcept[];
  mismatches: string[];
  penalties: string[];
}

export interface HeroTypographyCompositionWeights {
  templates: Partial<Record<TemplateId, number>>;
  layouts: Partial<Record<LayoutId, number>>;
  styles: Partial<Record<DesignStyleId, number>>;
  directionBias: Partial<Record<HeroTypographyDirectionId, number>>;
}

export interface HeroTypographyAudit {
  passed: boolean;
  score: number;
  reasons: string[];
  placements: TypographyPlacement[];
}
