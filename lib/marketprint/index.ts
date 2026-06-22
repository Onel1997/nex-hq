export { MARKETPRINT_PROFILE, type MarketPrintProfile } from "./marketprint-profile";
export {
  CAMPAIGN_SUITABILITY_THRESHOLD,
  MILAENE_MIN_PREMIUM_SCORE,
  MILAENE_MIN_SUITABILITY,
} from "./marketprint-profile";

export {
  MARKETPRINT_MATERIALS,
  MARKETPRINT_MATERIAL_BY_ID,
  getMaterialByName,
  getMaterialsForCategory,
  type MarketPrintMaterial,
} from "./material-library";

export {
  EXTERNAL_ONLY_KEYWORDS,
  MARKETPRINT_CATEGORIES,
  MARKETPRINT_PRODUCTS,
  MARKETPRINT_PRODUCT_BY_ID,
  formatSuitabilityLabel,
  getCampaignProducts,
  getEmbroideryProducts,
  getPremiumProducts,
  getProductsByCategory,
  matchProductToMarketPrint,
  type MarketPrintCategory,
  type MarketPrintProductCapability,
  type MarketPrintProductMatch,
  type ProductMatchInput,
} from "./product-capabilities";

export {
  MARKETPRINT_DECISION_FRAMEWORK,
  evaluateProductionFit,
  formatAgentMarketPrintRules,
  formatMarketPrintCatalogIntelligence,
  formatMarketPrintPrompt,
  getFacilityMarketPrintSections,
  type FacilityMarketPrintSection,
} from "./production-rules";

export {
  buildMarketPrintIntelligence,
  emptyMarketPrintIntelligence,
  loadMarketPrintContext,
  loadMarketPrintContextAsync,
  safeBuildMarketPrintIntelligence,
  type MarketPrintCatalogMatch,
  type MarketPrintContext,
  type MarketPrintIntelligence,
} from "./load-marketprint-context";
