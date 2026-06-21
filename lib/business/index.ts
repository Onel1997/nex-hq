export {
  BUSINESS_PROFILE_BY_SLUG,
  DEFAULT_BUSINESS_PROFILE_SLUG,
  KNOWN_PLATFORMS,
  KNOWN_SALES_CHANNELS,
  KNOWN_SUPPLIERS,
  MILAENE_BUSINESS_PROFILE,
  getBusinessProfileForSlug,
  isPrintOnDemand,
  type BusinessProfile,
  type KnownSupplier,
} from "./profile";

export {
  loadBusinessProfile,
  loadBusinessProfileBySlug,
} from "./load-profile";

export {
  formatAgentBusinessRules,
  formatBusinessProfilePrompt,
} from "./prompt";
