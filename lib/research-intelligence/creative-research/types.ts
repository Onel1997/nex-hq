/**
 * Creative Research — shared types (v1.1 quality + transparency).
 */

export const CREATIVE_RESEARCH_VERSION = "1.1.0";

export type ResearchMode =
  | "trend_intelligence"
  | "weekly_design_ideas"
  | "collection_creator";

export type ProviderMode = "creative_only" | "shopify_assisted" | "full_intelligence";

export type DesignIdeaStatus = "draft" | "shortlisted" | "selected" | "rejected";

export type CollectionStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "archived";

export type FrontBackConfiguration = "front" | "back" | "open" | "front_and_back";

export type ExecutionDifficulty = "low" | "medium" | "high";

export type GeneratorSource = "deterministic_fallback" | "llm_creative" | "hybrid";

export type VisualStructureId =
  | "typography_only"
  | "editorial_archive"
  | "symbolic_emblem"
  | "architectural_line_art"
  | "handwritten_annotation"
  | "technical_diagram"
  | "vertical_typography"
  | "chest_only_minimal"
  | "large_back_graphic"
  | "sleeve_detail"
  | "front_back_narrative"
  | "asymmetric_placement"
  | "badge_or_seal"
  | "halftone_direction"
  | "abstract_geometric";

export type TypographyFamily = "serif" | "sans" | "mono" | "script" | "mixed";

/** Honest note when pattern evidence is absent — never invent performance claims. */
export const NO_PATTERN_EVIDENCE_NOTE =
  "Diese kreative Richtung basiert primär auf Markenpassung und visueller Kohärenz. Es liegen noch keine ausreichenden Performance-Daten zur Bestätigung vor.";

export const CREATIVE_DIRECTION_HANDOFF_MISSION =
  "Die kreative Richtung wurde ausgewählt. Der Nutzer erstellt das finale Artwork selbst. Öffne das Design Studio für den Upload und speichere diese Designidee als Referenz für die anschließende Artwork-Prüfung und Asset-Produktion.";

export const DRAFT_SELECTION_NEXT_STEP =
  "Vier kreative Richtungen wurden erstellt. Wähle eine Idee aus, um sie für den Artwork-Upload im Design Studio vorzubereiten.";

export const PHRASE_QUALITY_THRESHOLD = 62;

export interface OptionalPatternEvidence {
  available: boolean;
  notes: string[];
  colorWorld?: string[];
  placements?: string[];
  printTechniques?: string[];
  materialPreferences?: string[];
  visualStructures?: string[];
  historicalShopifyPatterns?: string[];
  honestyNote?: string;
}

export interface PhraseQualityScores {
  phraseStrengthScore: number;
  originalityScore: number;
  memorabilityScore: number;
  semanticClarityScore: number;
  campaignPotentialScore: number;
  rejectionReasons: string[];
  passed: boolean;
}

export interface DesignIdea {
  id: string;
  designTitle: string;
  primaryPhrase: string;
  alternativePhrases: string[];
  meaning: string;
  /** Why someone would want to wear this. */
  wearReason: string;
  emotionalDirection: string;
  emotionalTheme: string;
  designConcept: string;
  typographyDirection: string;
  typographyFamily: TypographyFamily;
  graphicElements: string[];
  placement: string;
  visualStructure: VisualStructureId;
  printTechniqueSuggestion: string;
  artworkColors: string[];
  recommendedGarmentColors: string[];
  recommendedProductType: string;
  frontBackConfiguration: FrontBackConfiguration;
  originalityNotes: string;
  brandFitScore: number;
  commercialClarityScore: number;
  executionDifficulty: ExecutionDifficulty;
  whyItFitsMilaene: string;
  phraseQuality: PhraseQualityScores;
  optionalPatternEvidence: OptionalPatternEvidence | null;
  status: DesignIdeaStatus;
  createdAt: string;
}

export interface WeeklyDesignIdeasInput {
  count?: number;
  productType?: string;
  style?: string;
  theme?: string;
  audience?: string;
  season?: string;
  phraseLanguage?: "de" | "en";
  frontBack?: FrontBackConfiguration;
  exclusions?: string[];
  freeformDescription?: string;
  catalogProductTitles?: string[];
  providerMode?: ProviderMode;
}

export interface RunProviderUsage {
  providerMode: ProviderMode;
  providerSyncCount: number;
  usedProviders: string[];
  connectedButUnused: string[];
  notes: string[];
}

export interface ProviderCostEstimate {
  providerMode: ProviderMode;
  currency: "EUR";
  estimatedMin: number;
  estimatedMax: number;
  creativeGenerationMin: number;
  creativeGenerationMax: number;
  externalProvidersMin: number;
  externalProvidersMax: number;
  llmCalled: boolean;
  breakdown: Array<{
    item: string;
    category: "creative_generation" | "external_providers";
    estimatedCostMin: number;
    estimatedCostMax: number;
    optional: boolean;
    skipped: boolean;
  }>;
  note: string;
}

export interface WeeklyDesignIdeasResult {
  mode: "weekly_design_ideas";
  providerMode: ProviderMode;
  generatorSource: GeneratorSource;
  creativeDirectionSummary: string;
  designIdeas: DesignIdea[];
  nextStep: string;
  diversityScore: number;
  estimatedProviderCost: ProviderCostEstimate;
  providerUsage: RunProviderUsage;
  selectedIdeaId: string | null;
}

export interface CollectionCreatorInput {
  designCount?: number;
  collectionTheme: string;
  season?: string;
  desiredProducts?: string[];
  styleDirection?: string;
  audience?: string;
  inspiration?: string;
  excludedDirections?: string[];
  phraseLanguage?: "de" | "en";
  catalogProductTitles?: string[];
  providerMode?: ProviderMode;
}

export interface CollectionPlan {
  collectionName: string;
  collectionTagline: string;
  collectionStory: string;
  emotionalWorld: string;
  visualLanguage: string;
  colorSystem: string[];
  typographySystem: string[];
  recurringSymbols: string[];
  recommendedProductMix: string[];
  designIdeas: DesignIdea[];
  campaignDirection: string;
  photographyDirection: string;
  videoDirection: string;
  launchNarrative: string;
  socialContentThemes: string[];
  consistencyRules: string[];
  forbiddenElements: string[];
  collectionStatus: CollectionStatus;
}

export interface CollectionCreatorResult {
  mode: "collection_creator";
  providerMode: ProviderMode;
  generatorSource: GeneratorSource;
  creativeDirectionSummary: string;
  collection: CollectionPlan;
  nextStep: string;
  diversityScore: number;
  estimatedProviderCost: ProviderCostEstimate;
  providerUsage: RunProviderUsage;
  selectedIdeaId: string | null;
}

export interface CreativeDirectionHandoff {
  selectedIdeaId: string;
  selectedPhrase: string;
  designConcept: string;
  typographyDirection: string;
  placement: string;
  colorDirection: string[];
  recommendedProductType: string;
  guardrails: string[];
  forbiddenElements: string[];
  sourceResearchRunId: string;
  missionStatement: typeof CREATIVE_DIRECTION_HANDOFF_MISSION;
  status: "awaiting_artwork_upload";
}

export interface CreativeQualityVerdict {
  passed: boolean;
  originality: number;
  wearability: number;
  clarity: number;
  emotionalImpact: number;
  brandFit: number;
  visualFeasibility: number;
  languageQuality: number;
  genericPhraseHit: boolean;
  catalogCopyHit: boolean;
  phraseQuality: PhraseQualityScores;
  reasons: string[];
  failures: string[];
}

export interface CreativeResearchReportSection {
  creativeDirectionSummary: string;
  designIdeas: DesignIdea[];
  collection: CollectionPlan | null;
  supportingIntelligenceCollapsed: true;
  nextStep: string;
  researchMode: ResearchMode;
  providerMode: ProviderMode;
  generatorSource: GeneratorSource;
  diversityScore: number;
  handoff: CreativeDirectionHandoff | null;
  selectedIdeaId: string | null;
  estimatedProviderCost: ProviderCostEstimate | null;
  providerUsage: RunProviderUsage | null;
}
