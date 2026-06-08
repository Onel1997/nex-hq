/**
 * Domain tiers — core (universal) vs industry (dynamically loaded).
 */

export const BRAIN_CORE_DOMAINS = [
  "company_profile",
  "decisions",
  "tasks",
  "reports",
] as const;

export const BRAIN_INDUSTRY_DOMAINS = [
  // Fashion HQ
  "brand_vision",
  "brand_rules",
  "design_memory",
  "product_memory",
  "content_memory",
  "marketing_memory",
  "competitor_intelligence",
  // Agency HQ
  "client_memory",
  "campaign_memory",
  // Creator HQ
  "audience_memory",
  // Ecommerce HQ
  "catalog_memory",
  "storefront_memory",
  // SaaS HQ
  "product_roadmap",
  "customer_memory",
] as const;

export type CoreBrainDomain = (typeof BRAIN_CORE_DOMAINS)[number];
export type IndustryBrainDomain = (typeof BRAIN_INDUSTRY_DOMAINS)[number];

/** Union of all possible Brain domain IDs. */
export type BrainDomain = CoreBrainDomain | IndustryBrainDomain;

export const BRAIN_ALL_DOMAINS = [
  ...BRAIN_CORE_DOMAINS,
  ...BRAIN_INDUSTRY_DOMAINS,
] as const;

export type DomainTier = "core" | "industry";
