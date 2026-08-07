/**
 * Phase 2.2A — BrandFaceDiscoveryProvider abstraction.
 * Provider-agnostic A1 discovery. OpenAI remains available; fal FLUX is default when configured.
 */

import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";
import type { DiscoveryProviderId } from "./discovery-provider-config";

export type BrandFaceDiscoveryGenerateInput = {
  creationProjectId: string;
  generationRunId: string;
  workspaceId: string;
  slot: DiscoverySlot;
  attemptNumber: number;
  /** Full casting prompt already composed from L2/L3 + fashion direction. */
  prompt: string;
  negativePrompt?: string;
  /** Explicit integer seed — required for every attempt. */
  providerSeed: number;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
};

export type BrandFaceDiscoveryGenerateResult = {
  providerName: DiscoveryProviderId;
  providerModel: string;
  providerSeed: number;
  providerRequestId: string | null;
  providerResultId: string | null;
  imageBytes: Buffer;
  mimeType: string;
  estimatedCostEur: number;
  costStatus: "estimated" | "provider_confirmed" | "unknown" | "allocated_estimate";
  providerStartedAt: string;
  providerCompletedAt: string;
  /** Extra safe metadata — never includes API keys. */
  metadata?: Record<string, unknown>;
};

export interface BrandFaceDiscoveryProvider {
  readonly providerName: DiscoveryProviderId;
  readonly modelName: string;
  readonly supportsSeed: boolean;
  readonly supportsDeterministicGeneration: boolean;
  readonly supportsAbortSignal: boolean;
  isConfigured(): boolean;
  generateDiscoveryCandidate(
    input: BrandFaceDiscoveryGenerateInput,
  ): Promise<BrandFaceDiscoveryGenerateResult>;
  estimateUnitCostEur(): { min: number; max: number; status: "estimated" };
}

export class DiscoveryProviderError extends Error {
  readonly code: string;
  readonly providerName: DiscoveryProviderId;
  readonly providerRequestId: string | null;

  constructor(params: {
    message: string;
    code: string;
    providerName: DiscoveryProviderId;
    providerRequestId?: string | null;
  }) {
    super(params.message);
    this.name = "DiscoveryProviderError";
    this.code = params.code;
    this.providerName = params.providerName;
    this.providerRequestId = params.providerRequestId ?? null;
  }
}
