/**
 * Brain domain content union — maps each domain to its typed content shape.
 *
 * Organized by tier:
 *   - Core domains: universal across all HQ OS industries
 *   - Industry domains: loaded dynamically per industry pack
 */

import type { BrainDomain } from "../types";
import type { AudienceMemoryContent } from "./audience-memory";
import type { BrandRulesContent } from "./brand-rules";
import type { BrandVisionContent } from "./brand-vision";
import type { CampaignMemoryContent } from "./campaign-memory";
import type { CatalogMemoryContent } from "./catalog-memory";
import type { ClientMemoryContent } from "./client-memory";
import type { CompanyProfileContent } from "./company-profile";
import type { CompetitorIntelligenceContent } from "./competitor-intelligence";
import type { ContentMemoryContent } from "./content-memory";
import type { CustomerMemoryContent } from "./customer-memory";
import type { DecisionContent } from "./decisions";
import type { DesignMemoryContent } from "./design-memory";
import type { MarketingMemoryContent } from "./marketing-memory";
import type { ProductMemoryContent } from "./product-memory";
import type { ProductRoadmapContent } from "./product-roadmap";
import type { BrainReportContent } from "./reports";
import type { StorefrontMemoryContent } from "./storefront-memory";
import type { BrainTaskContent } from "./tasks";

// Core domains
export type {
  CompanyProfileContent,
  CompanyIntegration,
  CompanyIntegrationStatus,
  CompanyKpi,
} from "./company-profile";
export type {
  DecisionContent,
  DecisionAlternative,
  DecisionStatus,
} from "./decisions";
export type { BrainReportContent } from "./reports";
export type { BrainTaskContent } from "./tasks";

// Fashion HQ
export type {
  BrandVisionContent,
  BrandPillar,
  AudienceSegment,
} from "./brand-vision";
export type { BrandRulesContent, BrandRule, BrandRuleSeverity } from "./brand-rules";
export type {
  DesignMemoryContent,
  ColorSwatch,
  TypographySpec,
  DesignAssetRef,
} from "./design-memory";
export type {
  ProductMemoryContent,
  ProductSku,
  DropInfo,
  ProductStatus,
} from "./product-memory";
export type {
  CompetitorIntelligenceContent,
  CompetitorProfile,
  CompetitorTier,
  MarketSignal,
} from "./competitor-intelligence";

// Shared across multiple industries
export type {
  ContentMemoryContent,
  ContentBlock,
  ContentChannel,
  ContentFormat,
} from "./content-memory";
export type {
  MarketingMemoryContent,
  CampaignKpi,
  CampaignStatus,
  ChannelMixEntry,
} from "./marketing-memory";

// Agency HQ
export type {
  ClientMemoryContent,
  ClientContact,
  ClientStatus,
} from "./client-memory";
export type {
  CampaignMemoryContent,
  AgencyCampaignDeliverable,
  AgencyCampaignStatus,
} from "./campaign-memory";

// Creator HQ
export type {
  AudienceMemoryContent,
  AudiencePlatform,
  AudienceSegmentProfile,
} from "./audience-memory";

// Ecommerce HQ
export type {
  CatalogMemoryContent,
  CatalogItemStatus,
  CatalogVariant,
} from "./catalog-memory";
export type {
  StorefrontMemoryContent,
  StorefrontPage,
  StorefrontPageType,
} from "./storefront-memory";

// SaaS HQ
export type {
  ProductRoadmapContent,
  RoadmapItem,
  RoadmapItemStatus,
  RoadmapPriority,
} from "./product-roadmap";
export type {
  CustomerMemoryContent,
  CustomerSegment,
  CustomerTier,
  CustomerHealth,
} from "./customer-memory";

/** Maps every Brain domain to its content interface. */
export interface BrainDomainContentMap {
  // Core
  company_profile: CompanyProfileContent;
  decisions: DecisionContent;
  tasks: BrainTaskContent;
  reports: BrainReportContent;
  // Fashion HQ
  brand_vision: BrandVisionContent;
  brand_rules: BrandRulesContent;
  design_memory: DesignMemoryContent;
  product_memory: ProductMemoryContent;
  competitor_intelligence: CompetitorIntelligenceContent;
  // Shared industry
  content_memory: ContentMemoryContent;
  marketing_memory: MarketingMemoryContent;
  // Agency HQ
  client_memory: ClientMemoryContent;
  campaign_memory: CampaignMemoryContent;
  // Creator HQ
  audience_memory: AudienceMemoryContent;
  // Ecommerce HQ
  catalog_memory: CatalogMemoryContent;
  storefront_memory: StorefrontMemoryContent;
  // SaaS HQ
  product_roadmap: ProductRoadmapContent;
  customer_memory: CustomerMemoryContent;
}

/** Discriminated union of all domain content types. */
export type BrainDomainContent = BrainDomainContentMap[BrainDomain];

/** Type guard: narrow content by domain kind field. */
export function isBrainContentForDomain<D extends BrainDomain>(
  domain: D,
  content: BrainDomainContent,
): content is BrainDomainContentMap[D] {
  return content.kind === domain;
}
