import { NextResponse } from "next/server";
import {
  ShopifyApiError,
  ShopifyConfigError,
} from "@/lib/shopify/client";
import { fetchShopifyKnowledge } from "@/lib/shopify/knowledge";
import { buildProductKnowledge } from "@/lib/shopify/product-knowledge";

function buildProductTypeSummary(
  products: Array<{ productType: string }>,
): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();

  for (const product of products) {
    counts.set(product.productType, (counts.get(product.productType) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

export async function GET() {
  try {
    const knowledge = await fetchShopifyKnowledge();
    const productKnowledge = buildProductKnowledge(knowledge);
    const productTypes = buildProductTypeSummary(knowledge.products);

    const products = knowledge.products.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      inventory: p.inventory,
      imageUrl: p.imageUrl ?? null,
      price: p.price,
      currency: p.currency,
      productType: p.productType,
      collections: p.collections,
      tags: p.tags,
      colors: p.colors,
    }));

    return NextResponse.json({
      ok: true,
      total: products.length,
      products,
      productTypes,
      knowledge,
      productKnowledge,
    });
  } catch (error) {
    const message =
      error instanceof ShopifyConfigError || error instanceof ShopifyApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to fetch Shopify products";

    console.error("[Shopify Products]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
