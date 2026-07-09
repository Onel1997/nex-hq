/**
 * HQ OS industry packs — each industry loads a distinct set of Brain domains.
 *
 * Core domains are always available. Industry domains are provisioned
 * dynamically when a workspace selects an industry pack.
 */

import type { IndustryBrainDomain } from "../registry/tiers";
import type { HqModuleId } from "./modules";

export const HQ_INDUSTRY_IDS = [
  "fashion_hq",
  "agency_hq",
  "creator_hq",
  "ecommerce_hq",
  "saas_hq",
] as const;

export type HqIndustryId = (typeof HQ_INDUSTRY_IDS)[number];

export interface HqIndustryPack {
  id: HqIndustryId;
  label: string;
  description: string;
  /** Industry-specific domains loaded when this pack is active. */
  domains: IndustryBrainDomain[];
  /** HQ OS modules available in this industry. */
  availableModules: HqModuleId[];
}

/**
 * Industry pack registry — declarative mapping of industries to domains.
 * A workspace's enabled domains = core domains + its industry's domains.
 */
export const HQ_INDUSTRY_PACKS: Record<HqIndustryId, HqIndustryPack> = {
  fashion_hq: {
    id: "fashion_hq",
    label: "Fashion HQ",
    description: "Apparel, streetwear, and lifestyle brands.",
    domains: [
      "brand_vision",
      "brand_rules",
      "design_memory",
      "product_memory",
      "content_memory",
      "marketing_memory",
      "competitor_intelligence",
    ],
    availableModules: [
      "brain",
      "agents",
      "tasks",
      "reports",
      "integrations",
      "commerce",
      "design_studio",
      "content_studio",
    ],
  },
  agency_hq: {
    id: "agency_hq",
    label: "Agency HQ",
    description: "Creative, marketing, and client-service agencies.",
    domains: [
      "client_memory",
      "campaign_memory",
      "content_memory",
      "marketing_memory",
    ],
    availableModules: [
      "brain",
      "agents",
      "tasks",
      "reports",
      "integrations",
      "content_studio",
      "analytics",
    ],
  },
  creator_hq: {
    id: "creator_hq",
    label: "Creator HQ",
    description: "Creators, influencers, and personal media brands.",
    domains: ["audience_memory", "content_memory", "marketing_memory"],
    availableModules: [
      "brain",
      "agents",
      "tasks",
      "reports",
      "integrations",
      "content_studio",
      "analytics",
    ],
  },
  ecommerce_hq: {
    id: "ecommerce_hq",
    label: "Ecommerce HQ",
    description: "Direct-to-consumer and multi-channel retail.",
    domains: [
      "catalog_memory",
      "storefront_memory",
      "product_memory",
      "marketing_memory",
      "competitor_intelligence",
    ],
    availableModules: [
      "brain",
      "agents",
      "tasks",
      "reports",
      "integrations",
      "commerce",
      "analytics",
    ],
  },
  saas_hq: {
    id: "saas_hq",
    label: "SaaS HQ",
    description: "Software products and subscription businesses.",
    domains: [
      "product_roadmap",
      "customer_memory",
      "marketing_memory",
      "competitor_intelligence",
    ],
    availableModules: [
      "brain",
      "agents",
      "tasks",
      "reports",
      "integrations",
      "analytics",
    ],
  },
};

/** Maps each industry to its domain union — for industry-scoped type narrowing. */
export interface IndustryDomainMap {
  fashion_hq: (typeof HQ_INDUSTRY_PACKS.fashion_hq.domains)[number];
  agency_hq: (typeof HQ_INDUSTRY_PACKS.agency_hq.domains)[number];
  creator_hq: (typeof HQ_INDUSTRY_PACKS.creator_hq.domains)[number];
  ecommerce_hq: (typeof HQ_INDUSTRY_PACKS.ecommerce_hq.domains)[number];
  saas_hq: (typeof HQ_INDUSTRY_PACKS.saas_hq.domains)[number];
}

/** All domains enabled for a given industry (core + industry pack). */
export type WorkspaceDomainForIndustry<I extends HqIndustryId> =
  | import("../registry/tiers").CoreBrainDomain
  | IndustryDomainMap[I];
