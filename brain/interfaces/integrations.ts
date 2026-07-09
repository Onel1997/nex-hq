/**
 * Integration hooks — how external APIs sync with the Brain.
 *
 * Shopify, social platforms, and future HQ OS systems read approved
 * Brain state and write inbound signals back through typed hooks.
 */

import type { BrainDomain } from "../types";
import type { BrainWriteInput } from "../types";

export type IntegrationId =
  | "openai"
  | "shopify"
  | "instagram"
  | "tiktok"
  | "email"
  | "slack"
  | "linear";

export type IntegrationDirection = "inbound" | "outbound" | "bidirectional";

export interface BrainIntegrationDefinition {
  id: IntegrationId;
  name: string;
  direction: IntegrationDirection;
  /** Domains this integration may read (outbound) or write (inbound). */
  domains: BrainDomain[];
  description: string;
}

/**
 * Inbound: external system → Brain write.
 * Outbound: approved Brain records → external system publish.
 */
export interface BrainIntegrationHook {
  integrationId: IntegrationId;
  domain: BrainDomain;

  /** Pull data from external API and produce Brain write inputs. */
  syncInbound?(): Promise<BrainWriteInput[]>;

  /** Push approved Brain records to external system. */
  syncOutbound?(recordIds: string[]): Promise<IntegrationSyncResult>;
}

export interface IntegrationSyncResult {
  integrationId: IntegrationId;
  succeeded: string[];
  failed: Array<{ recordId: string; error: string }>;
  syncedAt: string;
}

/** Registry of planned integrations and their Brain domain access. */
export const BRAIN_INTEGRATION_REGISTRY: BrainIntegrationDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    direction: "bidirectional",
    domains: [
      "brand_vision",
      "brand_rules",
      "design_memory",
      "content_memory",
      "competitor_intelligence",
    ],
    description: "LLM inference and embedding generation for agents and vector search.",
  },
  {
    id: "shopify",
    name: "Shopify",
    direction: "bidirectional",
    domains: ["product_memory", "content_memory", "design_memory"],
    description: "Product listings, collections, and storefront sync.",
  },
  {
    id: "instagram",
    name: "Instagram",
    direction: "inbound",
    domains: ["marketing_memory", "competitor_intelligence", "content_memory"],
    description: "Social performance signals and content inspiration.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    direction: "inbound",
    domains: ["marketing_memory", "competitor_intelligence"],
    description: "Culture and trend signals from short-form video.",
  },
  {
    id: "email",
    name: "Email",
    direction: "outbound",
    domains: ["content_memory", "marketing_memory"],
    description: "VIP list and campaign email deployment.",
  },
];
