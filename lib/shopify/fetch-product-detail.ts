import { shopifyGraphQL, type ShopifyGraphQLResponse } from "@/lib/shopify/client";

export interface ShopifyProductVariant {
  id: string;
  title: string;
  price: string;
  currency: string;
  inventory: number;
  available: boolean;
  sku?: string | null;
  updatedAt: string;
  options: Array<{ name: string; value: string }>;
}

export interface ShopifyProductImageReference {
  id: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface ShopifyProductDetail {
  id: string;
  title: string;
  handle: string;
  vendor?: string | null;
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
  imageReferences: ShopifyProductImageReference[];
  updatedAt: string;
  collections: string[];
  variants: ShopifyProductVariant[];
}

const PRODUCT_DETAIL_QUERY = `
  query ShopifyProductDetail($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      vendor
      status
      productType
      tags
      description
      totalInventory
      updatedAt
      featuredImage { id url altText width height }
      images(first: 12) {
        edges { node { id url altText width height } }
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
            availableForSale
            sku
            updatedAt
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
    vendor: string | null;
    status: string;
    productType: string;
    tags: string[];
    description: string;
    totalInventory: number;
    updatedAt: string;
    featuredImage: ShopifyProductImageReference | null;
    images: { edges: Array<{ node: ShopifyProductImageReference }> };
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
          availableForSale: boolean;
          sku: string | null;
          updatedAt: string;
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
  const imageReferences = node.images.edges.map((e) => e.node);
  const images = imageReferences.map((image) => image.url);
  if (node.featuredImage?.url && !images.includes(node.featuredImage.url)) {
    images.unshift(node.featuredImage.url);
    imageReferences.unshift(node.featuredImage);
  }

  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    vendor: node.vendor?.trim() || null,
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
    imageReferences,
    updatedAt: node.updatedAt,
    collections: node.collections.edges.map((e) => e.node.title),
    variants: node.variants.edges.map((e) => ({
      id: e.node.id,
      title: e.node.title,
      price: e.node.price,
      currency,
      inventory: e.node.inventoryQuantity ?? 0,
      available: e.node.availableForSale,
      sku: e.node.sku?.trim() || null,
      updatedAt: e.node.updatedAt,
      options: e.node.selectedOptions ?? [],
    })),
  };
}
