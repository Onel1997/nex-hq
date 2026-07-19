/**
 * Persona candidate generation provider abstraction.
 * Domain logic must not couple to a single vendor.
 */

import type {
  CandidateAssetType,
  CandidateGenerationCostEstimate,
  GenerationStage,
  PersonaCreationProject,
  ProviderMode,
} from "../../domain/creation-types";

export type CandidateGeneratorJobStatus =
  | "queued"
  | "generating"
  | "completed"
  | "failed"
  | "cancelled";

export interface CandidateGenerationAssetResult {
  assetType: CandidateAssetType;
  imageBytes: Buffer;
  mimeType: string;
  providerOutputId?: string | null;
  metadata?: Record<string, unknown>;
  estimatedCostEur?: number;
}

export interface CandidateGenerationResult {
  candidateNumber: number;
  seed: string;
  prompt: string;
  negativePrompt: string;
  settings: Record<string, unknown>;
  assets: CandidateGenerationAssetResult[];
  identitySummary: string;
  distinguishingFeatures: string;
  actualCostEur: number;
  providerJobId: string | null;
}

export interface CandidateBatchJob {
  jobId: string;
  status: CandidateGeneratorJobStatus;
  provider: string;
  results: CandidateGenerationResult[];
  errorMessage?: string;
  actualCostEur: number;
}

export interface EstimateCandidateGenerationInput {
  project: PersonaCreationProject;
  stage: GenerationStage;
  candidateCount?: number;
  imagesPerCandidate?: number;
}

export interface CreateCandidateBatchInput {
  project: PersonaCreationProject;
  stage: GenerationStage;
  /** Must be true for paid generation — no silent starts. */
  costConfirmed: boolean;
  /** Required when re-running paid generation. */
  retryConfirmed?: boolean;
  candidateIds?: string[];
}

export interface PersonaCandidateGenerator {
  readonly id: string;
  readonly providerMode: ProviderMode;
  isConfigured(): boolean;
  estimateCandidateGeneration(
    input: EstimateCandidateGenerationInput,
  ): Promise<CandidateGenerationCostEstimate>;
  createCandidateBatch(input: CreateCandidateBatchInput): Promise<CandidateBatchJob>;
  getJobStatus(jobId: string): Promise<CandidateBatchJob>;
  cancelJob(jobId: string): Promise<CandidateBatchJob>;
  fetchCandidateAssets(jobId: string): Promise<CandidateGenerationResult[]>;
}
