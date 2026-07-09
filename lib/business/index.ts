export {
  BUSINESS_PROFILE_BY_SLUG,
  DEFAULT_BUSINESS_PROFILE_SLUG,
  KNOWN_BUSINESS_APPS,
  MILAENE_PROFILE,
  MILAENE_PROFILE as MILAENE_BUSINESS_PROFILE,
  getAllSuppliers,
  getBusinessProfileForSlug,
  hasWarehouse,
  isPrintOnDemand,
  type BusinessProfile,
  type KnownBusinessApp,
} from "./business-profile";

export {
  BRAND_CANYON_SUPPLIER,
  BRANDSKY_SUPPLIER,
  MARKETPRINT_SUPPLIER,
  PRINTFUL_SUPPLIER,
  SHIRTEE_SUPPLIER,
  SUPPLIER_PROFILES,
  SUPPLIER_PROFILE_BY_ID,
  getPrimarySupplier,
  getSecondarySuppliers,
  getSupplierByName,
  type SupplierApiId,
  type SupplierProfile,
  type SupplierRole,
} from "./supplier-profile";

export {
  SUPPLIER_STATUS_LABELS,
  buildSupplierIntelligence,
  formatAgentSupplierRules,
  formatSupplierCheckMessage,
  formatSupplierIntelligencePrompt,
  formatSupplierStatusMessage,
  formatSupplierUnavailableMessage,
  getFacilitySupplierSections,
  getOperationsBusinessMeta,
  resolveSupplierAvailabilityStatus,
  type FacilitySupplierSection,
  type SupplierAvailabilityStatus,
  type SupplierIntelligence,
} from "./supplier-intelligence";

export {
  loadBusinessContext,
  loadBusinessContextBySlug,
  loadBusinessProfile,
  loadBusinessProfileBySlug,
} from "./load-business-context";

export {
  formatAgentBusinessRules,
  formatBusinessProfilePrompt,
} from "./prompt";

/** @deprecated Use supplier profiles — kept for legacy imports. */
export {
  KNOWN_PLATFORMS,
  KNOWN_SALES_CHANNELS,
  KNOWN_SUPPLIERS,
  type KnownSupplier,
} from "./profile";
