/**
 * Product Memory — products, drops, capsules, SKUs, commerce metadata.
 */

export type ProductStatus = "concept" | "design" | "production" | "live" | "sold_out" | "archived";

export interface ProductSku {
  sku: string;
  size?: string;
  color?: string;
  price: number;
  currency: string;
  inventoryCount?: number;
}

export interface DropInfo {
  dropId: string;
  name: string;
  launchDate?: string;
  narrative?: string;
  capsuleTheme?: string;
}

export interface ProductMemoryContent {
  kind: "product_memory";
  productId?: string;
  name: string;
  description?: string;
  status: ProductStatus;
  category?: string;
  skus?: ProductSku[];
  drop?: DropInfo;
  shopifyProductId?: string;
  shopifyHandle?: string;
  tags?: string[];
  mediaUrls?: string[];
}
