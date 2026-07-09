import type { ProviderId, ProviderSyncResult } from "./types";

interface CacheEntry<T = unknown> {
  result: ProviderSyncResult<T>;
  cachedAt: number;
}

const store = new Map<ProviderId, CacheEntry>();

export function getCachedProviderResult<T>(
  id: ProviderId,
  ttlMs: number,
): ProviderSyncResult<T> | null {
  const entry = store.get(id);
  if (!entry) return null;
  const age = Date.now() - entry.cachedAt;
  if (age > ttlMs) return null;
  return {
    ...entry.result,
    fromCache: true,
    cacheAgeMs: age,
  } as ProviderSyncResult<T>;
}

export function setCachedProviderResult<T>(
  id: ProviderId,
  result: ProviderSyncResult<T>,
): void {
  store.set(id, {
    result: { ...result, fromCache: false, cacheAgeMs: 0 },
    cachedAt: Date.now(),
  });
}

export function clearProviderCache(id?: ProviderId): void {
  if (id) {
    store.delete(id);
    return;
  }
  store.clear();
}

export function getCacheAgeMs(id: ProviderId): number | null {
  const entry = store.get(id);
  if (!entry) return null;
  return Date.now() - entry.cachedAt;
}
