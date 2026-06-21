import { NextResponse } from "next/server";
import { getBrainClient } from "@/brain/client";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import {
  ShopifyApiError,
  ShopifyConfigError,
} from "@/lib/shopify/client";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import { buildProductKnowledge } from "@/lib/shopify/product-knowledge";
import { loadBusinessContext } from "@/lib/business/load-business-context";
import { buildMarketPrintIntelligence } from "@/lib/marketprint";
import {
  buildActivityFeed,
  buildCommerceInsights,
  buildGlobalAgentConnections,
  buildOperationsKpis,
} from "@/lib/shopify/operations";

function getStoreDomain(): string {
  return (process.env.SHOPIFY_STORE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
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

export async function GET() {
  try {
    const [knowledge, reportCounts, businessContext] = await Promise.all([
      fetchShopifyKnowledge(),
      countAgentReports(),
      loadBusinessContext(""),
    ]);

    const { profile: businessProfile, operationsMeta } = businessContext;

    const productKnowledge = buildProductKnowledge(knowledge);
    const kpis = buildOperationsKpis(knowledge, productKnowledge);
    const insights = buildCommerceInsights(
      knowledge,
      productKnowledge,
      businessProfile,
    );
    const activity = buildActivityFeed(knowledge, insights);
    const agentConnections = buildGlobalAgentConnections(reportCounts);
    const marketPrintIntelligence = buildMarketPrintIntelligence(knowledge.products);

    return NextResponse.json({
      ok: true,
      storeDomain: getStoreDomain(),
      knowledge,
      productKnowledge,
      kpis,
      insights,
      activity,
      agentConnections,
      reportCounts,
      businessMeta: operationsMeta,
      marketPrintIntelligence,
    });
  } catch (error) {
    const message =
      error instanceof ShopifyConfigError || error instanceof ShopifyApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load Shopify operations";

    console.error("[Shopify Operations]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
