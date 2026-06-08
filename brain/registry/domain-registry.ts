import type { AgentId } from "@/lib/constants/agents";
import type { BrainWriterId } from "../constants";
import type { HqIndustryId } from "../platform/industries";
import type {
  BrainDomain,
  CoreBrainDomain,
  DomainTier,
  IndustryBrainDomain,
} from "./tiers";

export interface BrainDomainDefinition {
  id: BrainDomain;
  tier: DomainTier;
  title: string;
  description: string;
  /** Industry packs that load this domain. Empty for core domains (always on). */
  industryPacks: HqIndustryId[];
  primaryReaders: AgentId[];
  primaryWriters: BrainWriterId[];
  vectorSearchEnabled: boolean;
}

/**
 * Full domain registry — single source of truth for domain metadata.
 * Core domains are universal. Industry domains are loaded per workspace.
 */
export const BRAIN_DOMAIN_REGISTRY: Record<BrainDomain, BrainDomainDefinition> = {
  // -------------------------------------------------------------------------
  // Core domains — shared by all HQ OS industries
  // -------------------------------------------------------------------------
  company_profile: {
    id: "company_profile",
    tier: "core",
    title: "Company Profile",
    description:
      "Workspace identity — company name, industry, goals, KPIs, integrations, and active modules.",
    industryPacks: [],
    primaryReaders: ["ceo", "research", "designer", "content", "marketing", "shopify"],
    primaryWriters: ["human", "ceo"],
    vectorSearchEnabled: false,
  },
  decisions: {
    id: "decisions",
    tier: "core",
    title: "Decisions",
    description: "Decision log with rationale, alternatives, owners, and outcomes.",
    industryPacks: [],
    primaryReaders: ["ceo", "research", "designer", "content", "marketing", "shopify"],
    primaryWriters: ["ceo", "human"],
    vectorSearchEnabled: true,
  },
  tasks: {
    id: "tasks",
    tier: "core",
    title: "Tasks",
    description: "Work unit memory — delegation history, status, and context snapshots.",
    industryPacks: [],
    primaryReaders: ["ceo", "research", "designer", "content", "marketing", "shopify"],
    primaryWriters: ["ceo", "human"],
    vectorSearchEnabled: false,
  },
  reports: {
    id: "reports",
    tier: "core",
    title: "Reports",
    description: "Agent report archive linked to tasks — structured outputs for review.",
    industryPacks: [],
    primaryReaders: ["ceo", "research", "designer", "content", "marketing", "shopify"],
    primaryWriters: [
      "ceo",
      "research",
      "designer",
      "content",
      "marketing",
      "shopify",
    ],
    vectorSearchEnabled: true,
  },

  // -------------------------------------------------------------------------
  // Fashion HQ
  // -------------------------------------------------------------------------
  brand_vision: {
    id: "brand_vision",
    tier: "industry",
    title: "Brand Vision",
    description: "North star, positioning, cultural identity, and audience definition.",
    industryPacks: ["fashion_hq"],
    primaryReaders: ["ceo", "research", "designer", "content", "marketing"],
    primaryWriters: ["ceo", "research"],
    vectorSearchEnabled: true,
  },
  brand_rules: {
    id: "brand_rules",
    tier: "industry",
    title: "Brand Rules",
    description: "Voice, copy, naming, and compliance guardrails.",
    industryPacks: ["fashion_hq"],
    primaryReaders: ["ceo", "designer", "content", "marketing", "shopify"],
    primaryWriters: ["ceo", "content"],
    vectorSearchEnabled: true,
  },
  design_memory: {
    id: "design_memory",
    tier: "industry",
    title: "Design Memory",
    description: "Visual system, palettes, typography, silhouettes, and design history.",
    industryPacks: ["fashion_hq"],
    primaryReaders: ["ceo", "designer", "content", "marketing", "shopify"],
    primaryWriters: ["designer", "ceo"],
    vectorSearchEnabled: true,
  },
  product_memory: {
    id: "product_memory",
    tier: "industry",
    title: "Product Memory",
    description: "Products, drops, capsules, SKUs, and commerce metadata.",
    industryPacks: ["fashion_hq", "ecommerce_hq"],
    primaryReaders: ["ceo", "designer", "content", "marketing", "shopify"],
    primaryWriters: ["shopify", "ceo", "designer"],
    vectorSearchEnabled: true,
  },
  content_memory: {
    id: "content_memory",
    tier: "industry",
    title: "Content Memory",
    description: "Copy templates, narratives, channel formats, and editorial assets.",
    industryPacks: ["fashion_hq", "agency_hq", "creator_hq"],
    primaryReaders: ["ceo", "content", "marketing", "shopify"],
    primaryWriters: ["content", "ceo"],
    vectorSearchEnabled: true,
  },
  marketing_memory: {
    id: "marketing_memory",
    tier: "industry",
    title: "Marketing Memory",
    description: "Campaigns, calendars, channel mix, KPIs, and growth playbooks.",
    industryPacks: [
      "fashion_hq",
      "agency_hq",
      "creator_hq",
      "ecommerce_hq",
      "saas_hq",
    ],
    primaryReaders: ["ceo", "research", "content", "marketing"],
    primaryWriters: ["marketing", "ceo", "research"],
    vectorSearchEnabled: true,
  },
  competitor_intelligence: {
    id: "competitor_intelligence",
    tier: "industry",
    title: "Competitor Intelligence",
    description: "Competitive landscape, watchlist, differentiation, and market signals.",
    industryPacks: ["fashion_hq", "ecommerce_hq", "saas_hq"],
    primaryReaders: ["ceo", "research", "marketing", "designer"],
    primaryWriters: ["research", "ceo"],
    vectorSearchEnabled: true,
  },

  // -------------------------------------------------------------------------
  // Agency HQ
  // -------------------------------------------------------------------------
  client_memory: {
    id: "client_memory",
    tier: "industry",
    title: "Client Memory",
    description: "Client profiles, contacts, scope, and relationship history.",
    industryPacks: ["agency_hq"],
    primaryReaders: ["ceo", "marketing", "content"],
    primaryWriters: ["ceo", "human"],
    vectorSearchEnabled: true,
  },
  campaign_memory: {
    id: "campaign_memory",
    tier: "industry",
    title: "Campaign Memory",
    description: "Agency campaign briefs, deliverables, budgets, and timelines.",
    industryPacks: ["agency_hq"],
    primaryReaders: ["ceo", "marketing", "content"],
    primaryWriters: ["marketing", "ceo"],
    vectorSearchEnabled: true,
  },

  // -------------------------------------------------------------------------
  // Creator HQ
  // -------------------------------------------------------------------------
  audience_memory: {
    id: "audience_memory",
    tier: "industry",
    title: "Audience Memory",
    description: "Creator audience segments, platforms, and engagement profiles.",
    industryPacks: ["creator_hq"],
    primaryReaders: ["ceo", "content", "marketing"],
    primaryWriters: ["ceo", "content"],
    vectorSearchEnabled: true,
  },

  // -------------------------------------------------------------------------
  // Ecommerce HQ
  // -------------------------------------------------------------------------
  catalog_memory: {
    id: "catalog_memory",
    tier: "industry",
    title: "Catalog Memory",
    description: "Product catalog, variants, pricing, and inventory metadata.",
    industryPacks: ["ecommerce_hq"],
    primaryReaders: ["ceo", "shopify", "marketing", "content"],
    primaryWriters: ["shopify", "ceo"],
    vectorSearchEnabled: true,
  },
  storefront_memory: {
    id: "storefront_memory",
    tier: "industry",
    title: "Storefront Memory",
    description: "Store configuration, pages, theme, and conversion health.",
    industryPacks: ["ecommerce_hq"],
    primaryReaders: ["ceo", "shopify", "marketing"],
    primaryWriters: ["shopify", "ceo"],
    vectorSearchEnabled: true,
  },

  // -------------------------------------------------------------------------
  // SaaS HQ
  // -------------------------------------------------------------------------
  product_roadmap: {
    id: "product_roadmap",
    tier: "industry",
    title: "Product Roadmap",
    description: "Feature roadmap, release cadence, and prioritization.",
    industryPacks: ["saas_hq"],
    primaryReaders: ["ceo", "research", "marketing"],
    primaryWriters: ["ceo", "human"],
    vectorSearchEnabled: true,
  },
  customer_memory: {
    id: "customer_memory",
    tier: "industry",
    title: "Customer Memory",
    description: "Customer segments, ICP, health signals, and feature requests.",
    industryPacks: ["saas_hq"],
    primaryReaders: ["ceo", "research", "marketing"],
    primaryWriters: ["ceo", "research"],
    vectorSearchEnabled: true,
  },
} as Record<BrainDomain, BrainDomainDefinition>;
