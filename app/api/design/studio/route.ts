import { NextResponse } from "next/server";
import { buildDesignStudioIntelligence } from "@/lib/design/studio-intelligence";
import {
  ShopifyApiError,
  ShopifyConfigError,
} from "@/lib/shopify/client";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import { loadCommerceIntelligenceSafe } from "@/lib/shopify/commerce-intelligence";
import {
  buildShopifyPerformanceIntelligence,
} from "@/lib/shopify/performance";
import { buildProductKnowledge } from "@/lib/shopify/product-knowledge";
import { loadBusinessContext } from "@/lib/business/load-business-context";
import { loadMarketPrintContext } from "@/lib/marketprint/load-marketprint-context";

export async function GET() {
  try {
    const [knowledge, businessContext] = await Promise.all([
      fetchShopifyKnowledge(),
      loadBusinessContext(""),
    ]);

    const commerceIntelligence = await loadCommerceIntelligenceSafe(knowledge);
    const performanceIntelligence = buildShopifyPerformanceIntelligence(
      knowledge,
      commerceIntelligence,
    );
    const productKnowledge = buildProductKnowledge(knowledge);
    const studio = buildDesignStudioIntelligence(
      knowledge,
      performanceIntelligence,
      commerceIntelligence,
    );
    const marketPrint = loadMarketPrintContext(knowledge.products);

    return NextResponse.json({
      ok: true,
      studio,
      productKnowledge,
      performanceIntelligence,
      commerceIntelligence,
      businessMeta: businessContext.operationsMeta,
      marketPrintSummary: marketPrint.intelligence.summary,
    });
  } catch (error) {
    const message =
      error instanceof ShopifyConfigError || error instanceof ShopifyApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load Design Studio";

    console.error("[Design Studio]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
