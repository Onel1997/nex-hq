import type { ShopifyProduct } from "./types";

/** Simulated Shopify API response for draft product creation. */
export interface ShopifyDraftProductResult {
  simulated: true;
  draftId: string;
  handle: string;
  status: "draft";
  productName: string;
  message: string;
}

/** Simulated Shopify API response for collection update. */
export interface ShopifyCollectionUpdateResult {
  simulated: true;
  collectionId: string;
  handle: string;
  status: "draft";
  collectionName: string;
  message: string;
}

/** Simulated Shopify API response for product publish. */
export interface ShopifyPublishResult {
  simulated: true;
  productId: string;
  handle: string;
  status: "active";
  productName: string;
  message: string;
}

function slugifyHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/**
 * Simulates creating a Shopify product draft.
 * Replace with real Shopify Admin API calls when integration is enabled.
 */
export async function createProductDraft(
  workspaceId: string,
  product: ShopifyProduct,
): Promise<ShopifyDraftProductResult> {
  const draftId = `sim-draft-${crypto.randomUUID().slice(0, 8)}`;
  const handle = slugifyHandle(product.productName);

  console.info("[Shopify Operations] createProductDraft (simulated)", {
    workspaceId,
    draftId,
    handle,
    productName: product.productName,
    variantCount: product.variants.length,
  });

  return {
    simulated: true,
    draftId,
    handle,
    status: "draft",
    productName: product.productName,
    message: `Produkt-Entwurf "${product.productName}" simuliert erstellt. Shopify-API-Integration ausstehend.`,
  };
}

/**
 * Simulates updating or creating a Shopify collection.
 * Replace with real Shopify Admin API calls when integration is enabled.
 */
export async function updateCollection(
  workspaceId: string,
  collectionName: string,
  description: string,
): Promise<ShopifyCollectionUpdateResult> {
  const collectionId = `sim-col-${crypto.randomUUID().slice(0, 8)}`;
  const handle = slugifyHandle(collectionName);

  console.info("[Shopify Operations] updateCollection (simulated)", {
    workspaceId,
    collectionId,
    handle,
    collectionName,
  });

  return {
    simulated: true,
    collectionId,
    handle,
    status: "draft",
    collectionName,
    message: `Kollektion "${collectionName}" simuliert aktualisiert. Shopify-API-Integration ausstehend.`,
  };
}

/**
 * Simulates publishing a Shopify product to the storefront.
 * Replace with real Shopify Admin API calls when integration is enabled.
 */
export async function publishProduct(
  workspaceId: string,
  productName: string,
): Promise<ShopifyPublishResult> {
  const productId = `sim-prod-${crypto.randomUUID().slice(0, 8)}`;
  const handle = slugifyHandle(productName);

  console.info("[Shopify Operations] publishProduct (simulated)", {
    workspaceId,
    productId,
    handle,
    productName,
  });

  return {
    simulated: true,
    productId,
    handle,
    status: "active",
    productName,
    message: `Produkt "${productName}" simuliert veröffentlicht. Shopify-API-Integration ausstehend.`,
  };
}
