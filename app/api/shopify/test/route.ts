import { NextResponse } from "next/server";
import { testShopifyConnection } from "@/lib/shopify/connection-test";

export async function GET() {
  const test = await testShopifyConnection();

  if (!test.ok) {
    console.error("[Shopify Test]", test.error);
    return NextResponse.json(
      { ok: false, error: test.error ?? "Shopify connection test failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    shopName: test.shopName,
    productCount: test.productSampleCount,
    collectionCount: test.collectionSampleCount,
    productsWithImages: test.productsWithImages,
    taggedProducts: test.taggedProducts,
    latencyMs: test.latencyMs,
    sampleProducts: test.sampleProducts,
  });
}
