/**
 * Phase 2.2A — Fake Brand Face Discovery provider.
 * Never calls fal/OpenAI/Replicate. Used in unit tests.
 */

import {
  type BrandFaceDiscoveryGenerateInput,
  type BrandFaceDiscoveryGenerateResult,
  type BrandFaceDiscoveryProvider,
  DiscoveryProviderError,
} from "./brand-face-discovery-provider";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let fakeDiscoveryInvocationCount = 0;
let fakeDiscoveryDelayMs = 0;
let fakeDiscoveryError: Error | null = null;
let lastFakeDiscoverySeed: number | null = null;
let lastFakeDiscoveryAbort: AbortSignal | null = null;

export function getFakeDiscoveryInvocationCount(): number {
  return fakeDiscoveryInvocationCount;
}

export function resetFakeDiscoveryInvocationCount(): void {
  fakeDiscoveryInvocationCount = 0;
}

export function setFakeDiscoveryDelayMsForTests(ms: number): void {
  fakeDiscoveryDelayMs = Math.max(0, ms);
}

export function setFakeDiscoveryErrorForTests(error: Error | null): void {
  fakeDiscoveryError = error;
}

export function getLastFakeDiscoverySeed(): number | null {
  return lastFakeDiscoverySeed;
}

export function getLastFakeDiscoveryAbortSignal(): AbortSignal | null {
  return lastFakeDiscoveryAbort;
}

export function resetFakeDiscoveryTestHooks(): void {
  fakeDiscoveryDelayMs = 0;
  fakeDiscoveryError = null;
  lastFakeDiscoverySeed = null;
  lastFakeDiscoveryAbort = null;
  fakeDiscoveryInvocationCount = 0;
}

export class FakeBrandFaceDiscoveryProvider implements BrandFaceDiscoveryProvider {
  readonly providerName = "fake" as const;
  readonly modelName = "fake-discovery-v1";
  readonly supportsSeed = true;
  readonly supportsDeterministicGeneration = true;
  readonly supportsAbortSignal = true;

  isConfigured(): boolean {
    return true;
  }

  estimateUnitCostEur(): { min: number; max: number; status: "estimated" } {
    return { min: 0.01, max: 0.02, status: "estimated" };
  }

  async generateDiscoveryCandidate(
    input: BrandFaceDiscoveryGenerateInput,
  ): Promise<BrandFaceDiscoveryGenerateResult> {
    fakeDiscoveryInvocationCount += 1;
    lastFakeDiscoverySeed = input.providerSeed;
    lastFakeDiscoveryAbort = input.abortSignal ?? null;
    const started = new Date().toISOString();

    if (input.abortSignal?.aborted) {
      throw new DiscoveryProviderError({
        message: "aborted",
        code: "provider_timeout",
        providerName: "fake",
      });
    }

    if (fakeDiscoveryDelayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          resolve();
        }, fakeDiscoveryDelayMs);
        const onAbort = () => {
          cleanup();
          reject(
            new DiscoveryProviderError({
              message: "aborted",
              code: "provider_timeout",
              providerName: "fake",
            }),
          );
        };
        const cleanup = () => {
          clearTimeout(timer);
          input.abortSignal?.removeEventListener("abort", onAbort);
        };
        input.abortSignal?.addEventListener("abort", onAbort, { once: true });
      });
    }

    if (fakeDiscoveryError) {
      throw fakeDiscoveryError;
    }

    const band = this.estimateUnitCostEur();
    return {
      providerName: "fake",
      providerModel: this.modelName,
      providerSeed: input.providerSeed,
      providerRequestId: `fake-req-${input.slot}-${input.attemptNumber}`,
      providerResultId: `fake-res-${input.slot}-${input.attemptNumber}`,
      imageBytes: TINY_PNG,
      mimeType: "image/png",
      estimatedCostEur: Number(((band.min + band.max) / 2).toFixed(4)),
      costStatus: "estimated",
      providerStartedAt: started,
      providerCompletedAt: new Date().toISOString(),
      metadata: { fake: true },
    };
  }
}
