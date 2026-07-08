import { amazonAdapter } from "./amazon";
import { depopAdapter } from "./depop";
import { etsyAdapter } from "./etsy";
import { fashionNewsAdapter } from "./fashion-news";
import { googleTrendsAdapter } from "./google-trends";
import { grailedAdapter } from "./grailed";
import { instagramAdapter } from "./instagram";
import { pinterestAdapter } from "./pinterest";
import { redditAdapter } from "./reddit";
import { shopifyAdapter } from "./shopify";
import { stockxAdapter } from "./stockx";
import { tiktokAdapter } from "./tiktok";
import { youtubeAdapter } from "./youtube";
import type { DataProviderAdapter, ProviderId } from "../types";

export const PROVIDER_ADAPTERS: DataProviderAdapter[] = [
  shopifyAdapter,
  tiktokAdapter,
  pinterestAdapter,
  googleTrendsAdapter,
  amazonAdapter,
  etsyAdapter,
  redditAdapter,
  youtubeAdapter,
  depopAdapter,
  stockxAdapter,
  grailedAdapter,
  instagramAdapter,
  fashionNewsAdapter,
];

export const PROVIDER_ADAPTER_MAP: Record<ProviderId, DataProviderAdapter> =
  Object.fromEntries(
    PROVIDER_ADAPTERS.map((adapter) => [adapter.id, adapter]),
  ) as Record<ProviderId, DataProviderAdapter>;

export function getProviderAdapter(id: ProviderId): DataProviderAdapter | null {
  return PROVIDER_ADAPTER_MAP[id] ?? null;
}

export {
  shopifyAdapter,
  tiktokAdapter,
  pinterestAdapter,
  googleTrendsAdapter,
  amazonAdapter,
  etsyAdapter,
  redditAdapter,
  youtubeAdapter,
  depopAdapter,
  stockxAdapter,
  grailedAdapter,
  instagramAdapter,
  fashionNewsAdapter,
};
