/**
 * Storefront Memory — Ecommerce HQ industry domain.
 */

export type StorefrontPageType = "home" | "collection" | "product" | "landing" | "other";

export interface StorefrontPage {
  pageId: string;
  type: StorefrontPageType;
  title: string;
  url?: string;
  lastUpdatedAt?: string;
}

export interface StorefrontMemoryContent {
  kind: "storefront_memory";
  platform: string;
  storeUrl?: string;
  theme?: string;
  pages?: StorefrontPage[];
  conversionRate?: number;
  healthNotes?: string[];
}
