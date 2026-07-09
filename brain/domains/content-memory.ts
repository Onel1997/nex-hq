/**
 * Content Memory — copy templates, narratives, channel formats, editorial assets.
 */

export type ContentChannel =
  | "instagram"
  | "tiktok"
  | "email"
  | "sms"
  | "site"
  | "shopify"
  | "other";

export type ContentFormat =
  | "product_description"
  | "drop_announcement"
  | "social_caption"
  | "email"
  | "story_arc"
  | "template"
  | "other";

export interface ContentBlock {
  channel?: ContentChannel;
  format: ContentFormat;
  body: string;
  characterLimit?: number;
  approved: boolean;
}

export interface ContentMemoryContent {
  kind: "content_memory";
  format: ContentFormat;
  channel?: ContentChannel;
  blocks: ContentBlock[];
  narrativeArc?: string;
  copyRules?: string[];
  relatedProductIds?: string[];
  relatedDropId?: string;
}
