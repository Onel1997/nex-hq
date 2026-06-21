import { NextResponse } from "next/server";
import { loadCommerceHistoryResponse } from "@/lib/commerce/historical-intelligence";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import {
  ShopifyApiError,
  ShopifyConfigError,
} from "@/lib/shopify/client";

export async function GET() {
  try {
    const knowledge = await fetchShopifyKnowledge();
    const history = await loadCommerceHistoryResponse(knowledge);

    if (!history) {
      return NextResponse.json({
        revenue: 0,
        orders: 0,
        units: 0,
        currency: knowledge.products[0]?.currency ?? "EUR",
        averageOrderValue: 0,
        topProducts: [],
        topCategories: [],
        firstSale: null,
        lastSale: null,
        diagnostics: {
          rows: 0,
          uniqueOrders: 0,
          paidOrders: 0,
          refundedOrders: 0,
          partiallyRefundedOrders: 0,
          units: 0,
          revenue: 0,
        },
      });
    }

    return NextResponse.json(history);
  } catch (error) {
    const message =
      error instanceof ShopifyConfigError || error instanceof ShopifyApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load commerce history";

    console.error("[Commerce History]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
