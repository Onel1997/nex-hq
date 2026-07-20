/**
 * Fake Persona candidate generator — never calls OpenAI.
 * Used in automated tests and when PERSONA_USE_FAKE_PROVIDER=true.
 */

import { PersonaDomainError } from "../../domain/errors";
import { estimateFromProject } from "./cost";
import type {
  CandidateBatchJob,
  CreateCandidateBatchInput,
  EstimateCandidateGenerationInput,
  PersonaCandidateGenerator,
} from "./types";

/** Minimal valid 1x1 PNG */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export class FakeCandidateGenerator implements PersonaCandidateGenerator {
  readonly id = "fake";
  readonly providerMode = "image_provider" as const;

  isConfigured(): boolean {
    return true;
  }

  async estimateCandidateGeneration(input: EstimateCandidateGenerationInput) {
    return estimateFromProject(
      input,
      "image_provider",
      "fake",
      true,
    );
  }

  async createCandidateBatch(input: CreateCandidateBatchInput): Promise<CandidateBatchJob> {
    if (!input.costConfirmed) {
      throw new PersonaDomainError(
        "Kostenbestätigung erforderlich vor bezahlter Generierung.",
        "WORKFLOW",
      );
    }

    const assetTypes =
      input.assetTypes ??
      (input.stage === "discovery"
        ? (["portrait_front", "portrait_three_quarter", "half_body"] as const)
        : []);

    const numbers =
      input.candidateNumbers ??
      Array.from({ length: input.project.candidate_count }, (_, i) => i + 1);

    const results = numbers.map((candidateNumber) => ({
      candidateNumber,
      seed: `fake-${candidateNumber}`,
      prompt: "fake-provider-test",
      negativePrompt: "",
      settings: { provider: "fake", costLabel: "estimated" },
      assets: assetTypes.map((assetType) => ({
        assetType,
        imageBytes: TINY_PNG,
        mimeType: "image/png",
        providerOutputId: null,
        metadata: { provider: "fake", fake: true },
        estimatedCostEur: 0,
      })),
      identitySummary: "Fake candidate",
      distinguishingFeatures: "",
      actualCostEur: 0,
      providerJobId: `fake-job-${Date.now()}`,
    }));

    return {
      jobId: `fake-batch-${Date.now()}`,
      status: "completed",
      provider: "fake",
      results,
      actualCostEur: 0,
    };
  }

  async getJobStatus(jobId: string): Promise<CandidateBatchJob> {
    return {
      jobId,
      status: "completed",
      provider: "fake",
      results: [],
      actualCostEur: 0,
    };
  }

  async cancelJob(jobId: string): Promise<CandidateBatchJob> {
    return {
      jobId,
      status: "cancelled",
      provider: "fake",
      results: [],
      actualCostEur: 0,
    };
  }

  async fetchCandidateAssets(): Promise<[]> {
    return [];
  }
}
