import { NextResponse } from "next/server";
import { buildCommerceLabPayload } from "@/lib/commerce/commerce-lab-intelligence";
import { loadHistoricalIntelligence } from "@/lib/commerce/historical-intelligence";
import { loadCommerceIntelligenceSafe } from "@/lib/shopify/commerce-intelligence";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import {
  ShopifyApiError,
  ShopifyConfigError,
} from "@/lib/shopify/client";

export async function GET() {
  try {
    const knowledge = await fetchShopifyKnowledge();
    const [commerce, historical] = await Promise.all([
      loadCommerceIntelligenceSafe(knowledge),
      loadHistoricalIntelligence(knowledge).catch(() => null),
    ]);

    const payload = buildCommerceLabPayload(
      commerce,
      historical?.summary.totalOrders ? historical : commerce.import,
    );

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof ShopifyConfigError || error instanceof ShopifyApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to load Commerce Lab intelligence";

    console.error("[Commerce Lab]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
