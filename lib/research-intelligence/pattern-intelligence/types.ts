/**
 * Pattern Intelligence — Phase 4 types.
 * Extracts design language from successful Milaene products without recommending product recreation.
 */

export const PATTERN_INTELLIGENCE_VERSION = "4.2.0";

export type PatternDimension =
  | "typography"
  | "placement"
  | "colorWorld"
  | "graphicStyle"
  | "symbolism"
  | "complexity"
  | "negativeSpace"
  | "lineWork"
  | "printTechnique"
  | "material"
  | "silhouette"
  | "premiumLevel";

export const PATTERN_DIMENSION_LABELS: Record<PatternDimension, string> = {
  typography: "Typografie",
  placement: "Platzierung",
  colorWorld: "Farbwelt",
  graphicStyle: "Grafikstil",
  symbolism: "Symbolik",
  complexity: "Komplexität",
  negativeSpace: "Negativraum",
  lineWork: "Linienführung",
  printTechnique: "Druck",
  material: "Material",
  silhouette: "Silhouette",
  premiumLevel: "Premium-Level",
};

/** Performance fields — only populated from real Shopify commerce data. */
export interface HistoricalPerformance {
  sales?: number;
  conversion?: number;
  roas?: number;
  returns?: number;
  favorites?: number;
  ctr?: number;
  watchTime?: number;
  ugcPerformance?: number;
}

export interface ExtractedProductPattern {
  /** Internal reference only — never surfaced in UI or handoff. */
  sourceProductId: string;
  patterns: Partial<Record<PatternDimension, string[]>>;
  dimensionEvidence?: Partial<Record<PatternDimension, string[]>>;
  whySuccessful: string[];
  historicalPerformance: HistoricalPerformance;
  unitsSold: number;
  revenue: number;
}

export interface AggregatedDesignPattern {
  dimension: PatternDimension;
  dimensionLabel: string;
  traits: string[];
  frequency: number;
  evidence: string[];
}

export interface DesignLanguage {
  typography: string[];
  placement: string[];
  colorWorld: string[];
  graphicStyle: string[];
  symbolism: string[];
  complexity: string[];
  negativeSpace: string[];
  lineWork: string[];
  printTechnique: string[];
  material: string[];
  silhouette: string[];
  premiumLevel: string[];
  palette: string[];
  guardrails: string[];
  risks: string[];
  prohibitions: string[];
  patternSummary: string;
}

export interface BrandLearningInsight {
  id: string;
  statement: string;
  evidence: string;
  /** True only when backed by measurable Shopify data with comparison groups. */
  supported: boolean;
  status: "confirmed" | "provisional" | "unconfirmed";
  evidenceLevel: "low" | "medium" | "high";
  evidenceLevelLabel: string;
}

export interface PatternIntelligenceSection {
  version: typeof PATTERN_INTELLIGENCE_VERSION;
  generatedAt: string;
  loaded: boolean;
  analyzedProductCount: number;
  patterns: AggregatedDesignPattern[];
  designLanguage: DesignLanguage;
  brandLearning: BrandLearningInsight[];
  successReasons: string[];
  recommendedSilhouette: string;
  alternativeSilhouettes: string[];
  /** Internal catalog titles used for filtering — not shown in report UI. */
  catalogProductTitles: string[];
}

export interface PatternIntelligenceInput {
  generatedAt?: string;
  userRequest?: string;
}

/** @deprecated Use CREATIVE_DIRECTION_HANDOFF_MISSION — Design Studio does not generate designs. */
export const DESIGN_STUDIO_MISSION =
  "Die kreative Richtung wurde ausgewählt. Der Nutzer erstellt das finale Artwork selbst. Öffne das Design Studio für den Upload und speichere diese Designidee als Referenz für die anschließende Artwork-Prüfung und Asset-Produktion.";

export type IntelligenceEntityKind =
  | "trend"
  | "design_pattern"
  | "product"
  | "category"
  | "catalog_metadata"
  | "noise"
  | "recommendation";
