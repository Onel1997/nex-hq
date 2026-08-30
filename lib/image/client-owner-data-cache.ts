"use client";

type CacheEntry<T> = {
  value: T | null;
  expiresAt: number;
  promise: Promise<T> | null;
};

const entries = new Map<string, CacheEntry<unknown>>();

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Small owner-data cache for stable read models only. Production jobs and
 * approvals deliberately never use it. Concurrent mounts share one request;
 * an expired value is replaced by canonical server truth.
 */
export function loadCachedOwnerData<T>(input: {
  key: string;
  ttlMs: number;
  load: () => Promise<T>;
}): Promise<T> {
  const current = entries.get(input.key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (current?.value != null && current.expiresAt > now) {
    return Promise.resolve(current.value);
  }
  if (current?.promise) return current.promise;

  const startedAt = nowMs();
  const promise = input.load().then(
    (value) => {
      entries.set(input.key, {
        value,
        expiresAt: Date.now() + input.ttlMs,
        promise: null,
      });
      if (process.env.NODE_ENV !== "production") {
        console.info("[Image Studio performance] owner data ready", {
          key: input.key,
          durationMs: Math.round(nowMs() - startedAt),
          cache: "miss",
        });
      }
      return value;
    },
    (error) => {
      entries.delete(input.key);
      throw error;
    },
  );
  entries.set(input.key, {
    value: current?.value ?? null,
    expiresAt: current?.expiresAt ?? 0,
    promise,
  });
  return promise;
}

export function invalidateCachedOwnerData(keyPrefix: string): void {
  for (const key of entries.keys()) {
    if (key.startsWith(keyPrefix)) entries.delete(key);
  }
}

/** Test-only reset; not used by production job state. */
export function resetCachedOwnerDataForTests(): void {
  entries.clear();
}
