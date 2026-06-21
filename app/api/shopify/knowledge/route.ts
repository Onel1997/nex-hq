import { NextResponse } from "next/server";
import {
  ShopifyApiError,
  ShopifyConfigError,
} from "@/lib/shopify/client";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import { buildProductKnowledge } from "@/lib/shopify/product-knowledge";

export async function GET() {
  try {
    const knowledge = await fetchShopifyKnowledge();
    const productKnowledge = buildProductKnowledge(knowledge);

    return NextResponse.json({
      ok: true,
      knowledge,
      productKnowledge,
    });
  } catch (error) {
    const message =
      error instanceof ShopifyConfigError || error instanceof ShopifyApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to fetch Shopify knowledge";

    console.error("[Shopify Knowledge]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
