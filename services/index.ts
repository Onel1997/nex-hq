export { MILAENE_DNA, formatMilaeneDnaForPrompt, scoreDnaAlignment } from "./milaene-dna";
export type { MilaeneDna } from "./milaene-dna";

export {
  RESEARCH_DATA_SOURCES,
  getActiveSourceLabels,
  getPlannedSourceLabels,
} from "./data-sources";
export type { DataSourceConnector, DataSourceId } from "./data-sources";

export { scanTrends, formatTrendChange } from "./trendScanner";
export type { TrendScore, TrendScannerInput } from "./trendScanner";

export { scanCompetitors, scoreCompetitorThreat } from "./competitorScanner";
export type { CompetitorIntel, CompetitorStatus, CompetitorScannerInput } from "./competitorScanner";

export { analyzeProducts } from "./productAnalyzer";
export type { ProductIntelligence, ProductAnalyzerInput } from "./productAnalyzer";

export { aggregateSignals } from "./signalAggregator";
export type { AggregatedSignals, SignalLayer } from "./signalAggregator";

export { scanExternalSources, flattenExternalSignals } from "./connectors";
export type { ExternalIntelligence, IntelligenceSignal } from "./connectors";

export {
  generateOpportunities,
  generateAiRecommendation,
} from "./opportunityEngine";
export type {
  ResearchOpportunity,
  AiRecommendation,
  OpportunityEngineInput,
  OpportunityScores,
  OpportunityDecisions,
  OpportunityPriority,
} from "./opportunityEngine";

export { loadKnowledgeBase } from "./knowledgeEngine";
export type { KnowledgeSnapshot } from "./knowledgeEngine";

export { loadResearchIntelligence } from "./researchEngine";
export type { ResearchIntelligenceBundle } from "./researchEngine";

export { analyzeTrendIntelligence } from "./trendIntelligence";

export { generateDesignBrief } from "./designBriefEngine";
export type { DesignBriefInput } from "./designBriefEngine";

export {
  buildProductIntelligenceCatalog,
  formatProductIntelligencePrompt,
  findProductByTitle,
  isColorAvailable,
  isProductAvailable,
  resolveAvailableColors,
  resolveAvailableProducts,
} from "./productIntelligenceEngine";
export type {
  ProductIntelligence as CatalogProductIntelligence,
  ProductIntelligenceCatalog,
  ProductCategory,
  ProductIntelligenceEngineInput,
} from "./productIntelligenceEngine";

export { generateLiveSignals, SIGNAL_CATEGORY_LABELS } from "./signalEngine";
export type { LiveSignal, SignalCategory, SignalEngineInput } from "./signalEngine";
