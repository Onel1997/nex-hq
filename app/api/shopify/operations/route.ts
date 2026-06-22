import { NextResponse } from "next/server";
import { loadMilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import {
  ShopifyApiError,
  ShopifyConfigError,
} from "@/lib/shopify/client";

/** Shopify Operations UI data — served from the Milaene commerce intelligence baseline. */
export async function GET() {
  try {
    const baseline = await loadMilaeneCommerceBaseline();

    return NextResponse.json({
      ok: true,
      storeDomain: baseline.storeDomain,
      knowledge: baseline.knowledge,
      productKnowledge: baseline.productKnowledge,
      kpis: baseline.kpis,
      insights: baseline.insights,
      activity: baseline.activity,
      agentConnections: baseline.agentConnections,
      businessMeta: baseline.businessMeta,
      marketPrintIntelligence: baseline.marketPrintIntelligence,
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
