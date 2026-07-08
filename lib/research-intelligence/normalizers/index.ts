import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { AmazonIntelligenceData } from "@/services/connectors/amazon";
import type { DepopIntelligenceData } from "@/services/connectors/depop";
import type { EtsyIntelligenceData } from "@/services/connectors/etsy";
import type { FashionNewsIntelligenceData } from "@/services/connectors/fashion-news";
import type { GoogleTrendsData } from "@/services/connectors/google-trends";
import type { GrailedIntelligenceData } from "@/services/connectors/grailed";
import type { PinterestIntelligenceData } from "@/services/connectors/pinterest";
import type { RedditIntelligenceData } from "@/services/connectors/reddit";
import type { StockXIntelligenceData } from "@/services/connectors/stockx";
import type { TikTokIntelligenceData } from "@/services/connectors/tiktok";
import type { YouTubeIntelligenceData } from "@/services/connectors/youtube";
import { envelopeProvenance } from "../normalization/envelope";
import type { ProviderIntelligenceEnvelope } from "../normalization/envelope";
import type { NormalizedProviderIntelligence } from "../normalization/interfaces";
import { asProviderSourceKey } from "../types";
import { amazonNormalizer } from "./amazon";
import { depopNormalizer } from "./depop";
import { etsyNormalizer } from "./etsy";
import { fashionNewsNormalizer } from "./fashion-news";
import { googleTrendsNormalizer } from "./google-trends";
import { grailedNormalizer } from "./grailed";
import { pinterestNormalizer } from "./pinterest";
import { redditNormalizer } from "./reddit";
import { shopifyNormalizer } from "./shopify";
import { stockxNormalizer } from "./stockx";
import { tiktokNormalizer } from "./tiktok";
import { youtubeNormalizer } from "./youtube";
import {
  createNormalizerRegistry,
  type NormalizerRegistry,
} from "../normalization/registry";

export const ALL_RESEARCH_NORMALIZERS = [
  shopifyNormalizer,
  googleTrendsNormalizer,
  pinterestNormalizer,
  tiktokNormalizer,
  etsyNormalizer,
  amazonNormalizer,
  redditNormalizer,
  fashionNewsNormalizer,
  youtubeNormalizer,
  depopNormalizer,
  stockxNormalizer,
  grailedNormalizer,
] as const;

export function createDefaultResearchNormalizerRegistry(): NormalizerRegistry {
  return createNormalizerRegistry(
    ALL_RESEARCH_NORMALIZERS.map((normalizer) => ({ normalizer })),
  );
}

/** Lightweight fixture helper for unit-style normalization checks. */
export function createTestEnvelope<T>(
  sourceKey: string,
  payload: T,
  options: Partial<ProviderIntelligenceEnvelope> = {},
): ProviderIntelligenceEnvelope {
  return {
    sourceKey: asProviderSourceKey(sourceKey),
    mode: options.mode ?? "live",
    syncedAt: options.syncedAt ?? new Date().toISOString(),
    apiVersion: options.apiVersion,
    payload,
    summary: options.summary,
    trending: options.trending,
    error: options.error,
  };
}

export function normalizeFixture(
  normalizer: (typeof ALL_RESEARCH_NORMALIZERS)[number],
  payload: unknown,
  sourceKey?: string,
): NormalizedProviderIntelligence {
  const key = sourceKey ?? String(normalizer.sourceKey);
  return normalizer.normalize(
    createTestEnvelope(key, payload),
    { generatedAt: new Date().toISOString() },
  );
}

export type ResearchNormalizerFixturePayload =
  | MilaeneCommerceBaseline
  | GoogleTrendsData
  | PinterestIntelligenceData
  | TikTokIntelligenceData
  | EtsyIntelligenceData
  | AmazonIntelligenceData
  | RedditIntelligenceData
  | FashionNewsIntelligenceData
  | YouTubeIntelligenceData
  | DepopIntelligenceData
  | StockXIntelligenceData
  | GrailedIntelligenceData;

export {
  shopifyNormalizer,
  googleTrendsNormalizer,
  pinterestNormalizer,
  tiktokNormalizer,
  etsyNormalizer,
  amazonNormalizer,
  redditNormalizer,
  fashionNewsNormalizer,
  youtubeNormalizer,
  depopNormalizer,
  stockxNormalizer,
  grailedNormalizer,
};

export { envelopeProvenance };
