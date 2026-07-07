import "server-only";

import {
  ShopifyApiError,
  ShopifyConfigError,
  shopifyGraphQL,
} from "@/lib/shopify/client";

const CONNECTION_TEST_QUERY = `
  query ShopifyConnectionTest {
    shop {
      name
    }
    products(first: 5) {
      edges {
        node {
          id
          title
          tags
          totalInventory
          featuredImage { url }
        }
      }
    }
    collections(first: 5) {
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
  shop: { name: string };
  products: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        tags: string[];
        totalInventory: number;
        featuredImage?: { url: string } | null;
      };
    }>;
  };
  collections: {
    edges: Array<{
      node: {
        id: string;
        title: string;
      };
    }>;
  };
}

export interface ShopifyConnectionTestResult {
  ok: boolean;
  shopName?: string;
  productSampleCount?: number;
  collectionSampleCount?: number;
  productsWithImages?: number;
  taggedProducts?: number;
  latencyMs?: number;
  sampleProducts?: Array<{ id: string; title: string }>;
  error?: string;
}

/** Lightweight Shopify Admin API connectivity test (shop + sample catalog). */
export async function testShopifyConnection(): Promise<ShopifyConnectionTestResult> {
  const started = Date.now();
  try {
    const result = await shopifyGraphQL<ShopifyConnectionTestData>(
      CONNECTION_TEST_QUERY,
    );
    const products = result.data?.products.edges.map((edge) => edge.node) ?? [];
    const collections = result.data?.collections.edges ?? [];

    return {
      ok: true,
      shopName: result.data?.shop.name ?? "Unknown shop",
      productSampleCount: products.length,
      collectionSampleCount: collections.length,
      productsWithImages: products.filter((p) => Boolean(p.featuredImage?.url))
        .length,
      taggedProducts: products.filter((p) => p.tags.length > 0).length,
      latencyMs: Date.now() - started,
      sampleProducts: products.map((p) => ({ id: p.id, title: p.title })),
    };
  } catch (error) {
    const message =
      error instanceof ShopifyConfigError || error instanceof ShopifyApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Shopify connection test failed";

    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: message,
    };
  }
}
