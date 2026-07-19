/**
 * Disabled / manual-upload generators — never fabricate image bytes.
 */

import { PersonaDomainError } from "../../domain/errors";
import { estimateFromProject } from "./cost";
import type {
  CandidateBatchJob,
  CreateCandidateBatchInput,
  EstimateCandidateGenerationInput,
  PersonaCandidateGenerator,
} from "./types";

function emptyJob(
  status: CandidateBatchJob["status"],
  provider: string,
  errorMessage?: string,
): CandidateBatchJob {
  return {
    jobId: `noop-${Date.now()}`,
    status,
    provider,
    results: [],
    errorMessage,
    actualCostEur: 0,
  };
}

export class DisabledCandidateGenerator implements PersonaCandidateGenerator {
  readonly id = "disabled";
  readonly providerMode = "disabled" as const;

  isConfigured(): boolean {
    return false;
  }

  async estimateCandidateGeneration(input: EstimateCandidateGenerationInput) {
    return estimateFromProject(input, "disabled", "none", false);
  }

  async createCandidateBatch(_input: CreateCandidateBatchInput): Promise<CandidateBatchJob> {
    throw new PersonaDomainError(
      "Generierung ist deaktiviert. Keine Fake-Kandidaten. Bitte manuellen Upload verwenden oder OPENAI_API_KEY konfigurieren.",
      "CONFIG",
    );
  }

  async getJobStatus(jobId: string): Promise<CandidateBatchJob> {
    return emptyJob("failed", "none", `Job ${jobId} nicht verfügbar (disabled).`);
  }

  async cancelJob(jobId: string): Promise<CandidateBatchJob> {
    return emptyJob("cancelled", "none");
  }

  async fetchCandidateAssets(): Promise<[]> {
    return [];
  }
}

export class ManualUploadCandidateGenerator implements PersonaCandidateGenerator {
  readonly id = "manual_upload";
  readonly providerMode = "manual_upload" as const;

  isConfigured(): boolean {
    return true;
  }

  async estimateCandidateGeneration(input: EstimateCandidateGenerationInput) {
    return estimateFromProject(input, "manual_upload", "manual_upload", true);
  }

  async createCandidateBatch(_input: CreateCandidateBatchInput): Promise<CandidateBatchJob> {
    throw new PersonaDomainError(
      "Manueller Upload-Modus: keine Provider-Generierung. Bitte Kandidatenbilder hochladen.",
      "WORKFLOW",
      { providerMode: "manual_upload" },
    );
  }

  async getJobStatus(jobId: string): Promise<CandidateBatchJob> {
    return emptyJob("completed", "manual_upload");
  }

  async cancelJob(jobId: string): Promise<CandidateBatchJob> {
    return emptyJob("cancelled", "manual_upload");
  }

  async fetchCandidateAssets(): Promise<[]> {
    return [];
  }
}
