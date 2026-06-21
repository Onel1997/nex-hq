import { NextResponse } from "next/server";
import {
  ShopifyApiError,
  ShopifyConfigError,
  shopifyGraphQL,
} from "@/lib/shopify/client";

const PRODUCTS_PAGE_QUERY = `
  query ShopifyProductsPage($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          status
          productType
          totalInventory
          featuredImage { url }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
          collections(first: 5) {
            edges {
              node {
                title
              }
            }
          }
        }
      }
    }
  }
`;

interface ShopifyProductNode {
  id: string;
  title: string;
  status: string;
  productType: string;
  totalInventory: number;
  featuredImage: { url: string } | null;
  priceRangeV2: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  collections: {
    edges: Array<{
      node: {
        title: string;
      };
    }>;
  };
}

interface ShopifyProductsPageData {
  products: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    edges: Array<{
      node: ShopifyProductNode;
    }>;
  };
}

interface MappedProduct {
  id: string;
  title: string;
  status: string;
  inventory: number;
  imageUrl: string | null;
  price: string;
  currency: string;
  productType: string;
  collections: string[];
}

function mapProductNode(node: ShopifyProductNode): MappedProduct {
  return {
    id: node.id,
    title: node.title,
    status: node.status,
    inventory: node.totalInventory,
    imageUrl: node.featuredImage?.url ?? null,
    price: node.priceRangeV2.minVariantPrice.amount,
    currency: node.priceRangeV2.minVariantPrice.currencyCode,
    productType: node.productType?.trim() || "Uncategorized",
    collections: node.collections.edges.map((edge) => edge.node.title),
  };
}

function buildProductTypeSummary(
  products: MappedProduct[],
): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();

  for (const product of products) {
    counts.set(product.productType, (counts.get(product.productType) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

async function fetchAllProducts(): Promise<MappedProduct[]> {
  const products: MappedProduct[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const result = await shopifyGraphQL<ShopifyProductsPageData>(
      PRODUCTS_PAGE_QUERY,
      cursor ? { cursor } : {},
    );

    const page = result.data?.products;
    if (!page) break;

    for (const edge of page.edges) {
      products.push(mapProductNode(edge.node));
    }

    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return products;
}

export async function GET() {
  try {
    const products = await fetchAllProducts();
    const productTypes = buildProductTypeSummary(products);

    return NextResponse.json({
      ok: true,
      total: products.length,
      products,
      productTypes,
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
