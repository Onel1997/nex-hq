/**
 * Bounded concurrency pool for independent provider image requests.
 * Never launches uncontrolled Promise.all for entire batches.
 */

export function resolvePersonaImageConcurrency(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): number {
  const raw = env.PERSONA_IMAGE_CONCURRENCY;
  const parsed = raw != null ? Number.parseInt(String(raw), 10) : 2;
  if (!Number.isFinite(parsed) || parsed < 1) return 2;
  return Math.min(4, parsed);
}

export interface MapPoolOptions {
  concurrency: number;
  /** Optional abort — remaining tasks skip when true. */
  shouldAbort?: () => boolean;
}

/**
 * Map items with a hard concurrency ceiling.
 * Order of results matches input order.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  options: MapPoolOptions,
): Promise<R[]> {
  const concurrency = Math.max(1, Math.min(options.concurrency, items.length || 1));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      if (options.shouldAbort?.()) return;
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await fn(items[current]!, current);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

export interface TransientRetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  isTransient: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Retry only transient failures with capped exponential backoff.
 * Successful results are never re-executed.
 */
export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  options: TransientRetryOptions,
): Promise<{ value: T; attempts: number }> {
  const sleep = options.sleep ?? defaultSleep;
  let attempts = 0;
  let lastError: unknown;

  while (attempts < options.maxAttempts) {
    attempts += 1;
    try {
      const value = await fn();
      return { value, attempts };
    } catch (error) {
      lastError = error;
      if (attempts >= options.maxAttempts || !options.isTransient(error)) {
        throw error;
      }
      const delay = options.baseDelayMs * 2 ** (attempts - 1);
      await sleep(Math.min(delay, options.baseDelayMs * 8));
    }
  }

  throw lastError;
}

export function isLikelyTransientProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|temporar|rate limit|429|503|502|ECONNRESET|ETIMEDOUT|overloaded/i.test(
    message,
  );
}
