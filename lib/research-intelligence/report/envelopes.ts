import type { ProviderSyncResult } from "@/lib/data-source-platform/types";
import type { ProviderIntelligenceEnvelope } from "../normalization/envelope";
import { asProviderSourceKey } from "../types";

const SUPPORTED_PROVIDERS = new Set([
  "shopify",
  "tiktok",
  "pinterest",
  "google_trends",
  "amazon",
  "etsy",
  "reddit",
  "youtube",
  "depop",
  "stockx",
  "grailed",
  "fashion_news",
]);

export function syncResultToEnvelope(
  result: ProviderSyncResult,
): ProviderIntelligenceEnvelope | null {
  if (!SUPPORTED_PROVIDERS.has(result.id)) return null;
  if (result.data == null) return null;

  return {
    sourceKey: asProviderSourceKey(result.id),
    mode: result.mode,
    syncedAt: result.lastSync ?? new Date().toISOString(),
    apiVersion: result.apiVersion,
    payload: result.data,
    summary: result.summary,
    trending: result.trending,
    error: result.error,
  };
}

export function syncResultsToEnvelopes(
  results: ProviderSyncResult[],
): ProviderIntelligenceEnvelope[] {
  return results
    .map(syncResultToEnvelope)
    .filter((envelope): envelope is ProviderIntelligenceEnvelope => envelope != null);
}
