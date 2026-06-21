import { shopifyGraphQL, type ShopifyGraphQLResponse } from "@/lib/shopify/client";

export interface ShopifyProductVariant {
  id: string;
  title: string;
  price: string;
  currency: string;
  inventory: number;
  options: Array<{ name: string; value: string }>;
}

export interface ShopifyProductDetail {
  id: string;
  title: string;
  handle: string;
  status: string;
  productType: string;
  description: string;
  tags: string[];
  totalInventory: number;
  priceMin: string;
  priceMax: string;
  currency: string;
  imageUrl: string | null;
  images: string[];
  collections: string[];
  variants: ShopifyProductVariant[];
}

const PRODUCT_DETAIL_QUERY = `
  query ShopifyProductDetail($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      productType
      tags
      description
      totalInventory
      featuredImage { url }
      images(first: 12) {
        edges { node { url } }
      }
      priceRangeV2 {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      collections(first: 12) {
        edges { node { title } }
      }
      variants(first: 50) {
        edges {
          node {
            id
            title
            price
            inventoryQuantity
            selectedOptions { name value }
          }
        }
      }
    }
  }
`;

interface ProductDetailData {
  product: {
    id: string;
    title: string;
    handle: string;
    status: string;
    productType: string;
    tags: string[];
    description: string;
    totalInventory: number;
    featuredImage: { url: string } | null;
    images: { edges: Array<{ node: { url: string } }> };
    priceRangeV2: {
      minVariantPrice: { amount: string; currencyCode: string };
      maxVariantPrice: { amount: string; currencyCode: string };
    };
    collections: { edges: Array<{ node: { title: string } }> };
    variants: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          price: string;
          inventoryQuantity: number;
          selectedOptions: Array<{ name: string; value: string }>;
        };
      }>;
    };
  } | null;
}

/** Fetch full product detail including variants for the operations drawer. */
export async function fetchShopifyProductDetail(
  productId: string,
): Promise<ShopifyProductDetail | null> {
  const result: ShopifyGraphQLResponse<ProductDetailData> =
    await shopifyGraphQL<ProductDetailData>(PRODUCT_DETAIL_QUERY, {
      id: productId,
    });

  const node = result.data?.product;
  if (!node) return null;

  const currency = node.priceRangeV2.minVariantPrice.currencyCode;
  const images = node.images.edges.map((e) => e.node.url);
  if (node.featuredImage?.url && !images.includes(node.featuredImage.url)) {
    images.unshift(node.featuredImage.url);
  }

  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    status: node.status,
    productType: node.productType?.trim() || "Uncategorized",
    description: node.description ?? "",
    tags: node.tags ?? [],
    totalInventory: node.totalInventory ?? 0,
    priceMin: node.priceRangeV2.minVariantPrice.amount,
    priceMax: node.priceRangeV2.maxVariantPrice.amount,
    currency,
    imageUrl: node.featuredImage?.url ?? images[0] ?? null,
    images,
    collections: node.collections.edges.map((e) => e.node.title),
    variants: node.variants.edges.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      price: e.node.price,
      currency,
      inventory: e.node.inventoryQuantity ?? 0,
      options: e.node.selectedOptions ?? [],
    })),
  };
}
