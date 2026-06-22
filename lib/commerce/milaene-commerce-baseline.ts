import "server-only";

/**
 * Milaene Commerce Intelligence System — canonical baseline.
 *
 * Shopify Operations (`/agents/shopify`) is the production brain of Milaene commerce.
 * This module is the single server-side source for catalog, sales, supplier, and
 * recommendation intelligence. Department agents consume slices from here — they must
 * not replace or bypass this layer with KPI dashboards or alternate catalog views.
 *
 * @see docs/milaene-commerce-intelligence.md
 */

import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { loadBusinessContext } from "@/lib/business/load-business-context";
import { loadHistoricalIntelligence } from "@/lib/commerce/historical-intelligence";
import { buildMarketPrintIntelligence, type MarketPrintIntelligence } from "@/lib/marketprint";
import {
  loadCommerceIntelligenceSafe,
  type CommerceIntelligence,
} from "@/lib/shopify/commerce-intelligence";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import {
  buildActivityFeed,
  buildCommerceInsights,
  buildGlobalAgentConnections,
  buildOperationsKpis,
  type AgentConnectionStatus,
  type CommerceActivityEvent,
  type CommerceInsight,
  type ShopifyOperationsKpis,
} from "@/lib/shopify/operations";
import { buildProductKnowledge } from "@/lib/shopify/product-knowledge";
import type { ProductKnowledge, ShopifyKnowledge } from "@/lib/shopify/types";

export const MILAENE_COMMERCE_BASELINE = {
  id: "milaene-commerce-intelligence",
  version: "1.0.0",
  uiRoute: "/agents/shopify",
  uiComponent: "ShopifyOperationsCommerce",
  /** KPI dashboard shells must never replace the catalog intelligence UI. */
  deprecatedUi: "ShopifyOperationsHq",
} as const;

export type CommerceDepartmentId =
  | "ceo"
  | "design"
  | "marketing"
  | "image"
  | "commerce-lab"
  | "research";

export interface MilaeneCommerceBaseline {
  baseline: typeof MILAENE_COMMERCE_BASELINE;
  loadedAt: string;
  storeDomain: string;
  knowledge: ShopifyKnowledge;
  productKnowledge: ProductKnowledge;
  commerceIntelligence: CommerceIntelligence;
  marketPrintIntelligence: MarketPrintIntelligence;
  kpis: ShopifyOperationsKpis;
  insights: CommerceInsight[];
  activity: CommerceActivityEvent[];
  agentConnections: AgentConnectionStatus;
  businessMeta: {
    primarySupplier: string;
    businessModel: string;
    fulfillment: string;
  };
  departmentRoutes: Record<CommerceDepartmentId, string>;
}

function getStoreDomain(): string {
  return (process.env.SHOPIFY_STORE_DOMAIN ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

async function countAgentReports() {
  try {
    const { workspace } = await ensureWorkspaceBrainSeeded();
    const brain = getBrainClient();
    const result = await brain.searchRecords({
      workspaceId: workspace.id,
      domains: ["reports"],
      limit: 200,
    });

    const counts = { design: 0, image: 0, marketing: 0, content: 0, ceo: 0 };

    for (const record of result.records) {
      const tags = (record.tags ?? []).map((t) => t.toLowerCase());
      const agentId = (record.content as { agentId?: string })?.agentId ?? "";

      if (tags.some((t) => t.includes("design")) || agentId === "designer") {
        counts.design++;
      }
      if (tags.some((t) => t.includes("image")) || agentId === "image") {
        counts.image++;
      }
      if (tags.some((t) => t.includes("marketing")) || agentId === "marketing") {
        counts.marketing++;
      }
      if (tags.some((t) => t.includes("content")) || agentId === "content") {
        counts.content++;
      }
      if (tags.some((t) => t.includes("ceo")) || agentId === "ceo") {
        counts.ceo++;
      }
    }

    return counts;
  } catch {
    return { design: 0, image: 0, marketing: 0, content: 0, ceo: 0 };
  }
}

/** Load the full Milaene commerce intelligence baseline (Shopify Operations source of truth). */
export async function loadMilaeneCommerceBaseline(): Promise<MilaeneCommerceBaseline> {
  const knowledge = await fetchShopifyKnowledge();
  const [reportCounts, businessContext, historicalIntelligence, commerceIntelligence] =
    await Promise.all([
      countAgentReports(),
      loadBusinessContext(""),
      loadHistoricalIntelligence(knowledge),
      loadCommerceIntelligenceSafe(knowledge),
    ]);

  const { profile: businessProfile, operationsMeta } = businessContext;
  const productKnowledge = buildProductKnowledge(knowledge);
  const kpis = buildOperationsKpis(knowledge, productKnowledge);
  const insights = buildCommerceInsights(
    knowledge,
    productKnowledge,
    businessProfile,
    historicalIntelligence,
  );
  const activity = buildActivityFeed(knowledge, insights);
  const agentConnections = buildGlobalAgentConnections(reportCounts);
  const marketPrintIntelligence = buildMarketPrintIntelligence(knowledge.products);

  return {
    baseline: MILAENE_COMMERCE_BASELINE,
    loadedAt: new Date().toISOString(),
    storeDomain: getStoreDomain(),
    knowledge,
    productKnowledge,
    commerceIntelligence,
    marketPrintIntelligence,
    kpis,
    insights,
    activity,
    agentConnections,
    businessMeta: operationsMeta,
    departmentRoutes: {
      ceo: "/agents/ceo",
      design: "/agents/design",
      marketing: "/agents/marketing",
      image: "/agents/image",
      "commerce-lab": "/agents/commerce",
      research: "/agents/research",
    },
  };
}
