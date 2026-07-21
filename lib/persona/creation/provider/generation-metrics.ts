/**
 * Generation timing instrumentation — no secrets, no full prompts.
 */

export interface ImageGenerationTimingEvent {
  kind: "image_request";
  candidateNumber: number;
  assetType: string;
  concurrencySlot: number;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  retryCount: number;
  ok: boolean;
}

export interface BatchGenerationTimingSummary {
  startedAt: string;
  completedAt: string;
  totalElapsedMs: number;
  concurrencyLimit: number;
  imageEvents: ImageGenerationTimingEvent[];
  averageImageMs: number | null;
  successCount: number;
  failureCount: number;
}

export function createBatchTimingTracker(concurrencyLimit: number) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const imageEvents: ImageGenerationTimingEvent[] = [];

  return {
    recordImage(event: Omit<ImageGenerationTimingEvent, "kind">) {
      imageEvents.push({ kind: "image_request", ...event });
    },
    summarize(): BatchGenerationTimingSummary {
      const completedAt = new Date().toISOString();
      const ok = imageEvents.filter((e) => e.ok);
      const averageImageMs =
        ok.length === 0
          ? null
          : Math.round(ok.reduce((s, e) => s + e.elapsedMs, 0) / ok.length);
      return {
        startedAt,
        completedAt,
        totalElapsedMs: Date.now() - startedMs,
        concurrencyLimit,
        imageEvents,
        averageImageMs,
        successCount: ok.length,
        failureCount: imageEvents.length - ok.length,
      };
    },
  };
}

/** Rolling duration store key in process env-backed memory (tests / metrics). */
const rollingDurations: number[] = [];
const MAX_ROLLING = 40;

export function recordCompletedImageDurationMs(elapsedMs: number): void {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
  rollingDurations.push(Math.round(elapsedMs));
  while (rollingDurations.length > MAX_ROLLING) rollingDurations.shift();
}

export function estimateSecondsFromRollingHistory(
  remainingImages: number,
  concurrency: number,
  fallbackSecondsPerImage = 90,
): number {
  const avg =
    rollingDurations.length > 0
      ? rollingDurations.reduce((a, b) => a + b, 0) / rollingDurations.length / 1000
      : fallbackSecondsPerImage;
  const waves = Math.ceil(Math.max(1, remainingImages) / Math.max(1, concurrency));
  return Math.max(30, Math.round(waves * avg));
}

export function getRollingImageDurationSamples(): readonly number[] {
  return rollingDurations;
}

export function resetRollingImageDurationsForTests(): void {
  rollingDurations.length = 0;
}
