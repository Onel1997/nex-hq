import { NextResponse } from "next/server";
import {
  ShopifyApiError,
  ShopifyConfigError,
  shopifyGraphQL,
} from "@/lib/shopify/client";

const SHOP_PRODUCTS_QUERY = `
  query ShopifyConnectionTest {
    shop {
      name
    }
    products(first: 5) {
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;

interface ShopifyConnectionTestData {
  shop: {
    name: string;
  };
  products: {
    edges: Array<{
      node: {
        id: string;
        title: string;
      };
    }>;
  };
}

export async function GET() {
  try {
    const result = await shopifyGraphQL<ShopifyConnectionTestData>(
      SHOP_PRODUCTS_QUERY,
    );

    const shopName = result.data?.shop?.name ?? "Unknown shop";
    const sampleProducts =
      result.data?.products.edges.map((edge) => ({
        id: edge.node.id,
        title: edge.node.title,
      })) ?? [];

    return NextResponse.json({
      ok: true,
      shopName,
      productCount: sampleProducts.length,
      sampleProducts,
    });
  } catch (error) {
    const message =
      error instanceof ShopifyConfigError || error instanceof ShopifyApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Shopify connection test failed";

    console.error("[Shopify Test]", message, error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
