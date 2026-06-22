import { shopifyGraphQL, type ShopifyGraphQLResponse } from "@/lib/shopify/client";
import type { ShopifyCatalog, ShopifyCatalogCollection, ShopifyCatalogProduct } from "@/lib/shopify/types";

const CATALOG_PAGE_QUERY = `
  query ShopifyCatalogPage($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          status
          productType
          tags
          description
          totalInventory
          featuredImage { url }
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          options {
            name
            values
          }
          variants(first: 20) {
            edges {
              node {
                selectedOptions { name value }
              }
            }
          }
          collections(first: 10) {
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

const COLLECTIONS_QUERY = `
  query ShopifyCollections {
    collections(first: 50) {
      edges {
        node {
          id
          title
          handle
          productsCount { count }
        }
      }
    }
  }
`;

interface CatalogPageData {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{ node: RawProductNode }>;
  };
}

interface CollectionsData {
  collections: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        handle: string;
        productsCount: { count: number };
      };
    }>;
  };
}

interface RawProductNode {
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string;
  tags: string[];
  description: string;
  totalInventory: number;
  featuredImage: { url: string } | null;
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  options: Array<{ name: string; values: string[] }>;
  variants: {
    edges: Array<{
      node: {
        selectedOptions: Array<{ name: string; value: string }>;
      };
    }>;
  };
  collections: {
    edges: Array<{ node: { title: string } }>;
  };
}

const COLOR_OPTION_NAMES = /^(color|colour|farbe|couleur)$/i;

function extractVariantColors(node: RawProductNode): string[] {
  const colors = new Set<string>();

  for (const option of node.options ?? []) {
    if (COLOR_OPTION_NAMES.test(option.name.trim())) {
      for (const value of option.values ?? []) {
        const trimmed = value.trim();
        if (trimmed) colors.add(trimmed);
      }
    }
  }

  for (const edge of node.variants?.edges ?? []) {
    for (const selected of edge.node.selectedOptions ?? []) {
      if (COLOR_OPTION_NAMES.test(selected.name.trim())) {
        const trimmed = selected.value.trim();
        if (trimmed) colors.add(trimmed);
      }
    }
  }

  return [...colors];
}

function mapProductNode(node: RawProductNode): ShopifyCatalogProduct {
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    status: node.status,
    productType: node.productType?.trim() || "Uncategorized",
    tags: node.tags ?? [],
    description: node.description ?? "",
    totalInventory: node.totalInventory ?? 0,
    imageUrl: node.featuredImage?.url ?? null,
    priceMin: node.priceRangeV2.minVariantPrice.amount,
    priceMax: node.priceRangeV2.maxVariantPrice.amount,
    currency: node.priceRangeV2.minVariantPrice.currencyCode,
    collections: node.collections.edges.map((edge) => edge.node.title),
    options: (node.options ?? []).map((o) => ({
      name: o.name,
      values: o.values ?? [],
    })),
    variantColors: extractVariantColors(node),
  };
}

async function fetchAllProducts(): Promise<ShopifyCatalogProduct[]> {
  const products: ShopifyCatalogProduct[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const result: ShopifyGraphQLResponse<CatalogPageData> =
      await shopifyGraphQL<CatalogPageData>(
        CATALOG_PAGE_QUERY,
        cursor ? { cursor } : {},
      );

    const page: CatalogPageData["products"] | undefined = result.data?.products;
    if (!page) break;

    for (const edge of page.edges) {
      products.push(mapProductNode(edge.node));
    }

    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return products;
}

async function fetchCollections(): Promise<ShopifyCatalogCollection[]> {
  const result = await shopifyGraphQL<CollectionsData>(COLLECTIONS_QUERY);
  const edges = result.data?.collections?.edges ?? [];

  return edges
    .map((edge) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      productCount: edge.node.productsCount?.count ?? 0,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Fetch the full live Shopify catalog (products + collections). */
export async function fetchShopifyCatalog(): Promise<ShopifyCatalog> {
  const [products, collections] = await Promise.all([
    fetchAllProducts(),
    fetchCollections(),
  ]);

  return { products, collections };
}
