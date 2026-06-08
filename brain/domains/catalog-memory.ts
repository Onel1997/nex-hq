/**
 * Catalog Memory — Ecommerce HQ industry domain.
 */

export type CatalogItemStatus = "draft" | "active" | "out_of_stock" | "discontinued";

export interface CatalogVariant {
  sku: string;
  name: string;
  price: number;
  currency: string;
  inventoryCount?: number;
}

export interface CatalogMemoryContent {
  kind: "catalog_memory";
  productId: string;
  name: string;
  status: CatalogItemStatus;
  category?: string;
  variants?: CatalogVariant[];
  description?: string;
  tags?: string[];
}
