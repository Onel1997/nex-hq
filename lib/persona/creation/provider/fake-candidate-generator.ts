/**
 * Fake Persona candidate generator — never calls OpenAI.
 * Used in automated tests and when PERSONA_USE_FAKE_PROVIDER=true.
 * Honors A1 discovery (1 image) and explicit assetTypes / castingPhase.
 */

import { PersonaDomainError } from "../../domain/errors";
import {
  assetTypesForCastingPhase,
  resolveCastingPhaseForGeneration,
} from "../casting-funnel";
import { assetTypesForStage, estimateFromProject } from "./cost";
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

/** Test hook — increments when createCandidateBatch runs (never OpenAI). */
let fakeBatchInvocationCount = 0;

export function getFakeBatchInvocationCount(): number {
  return fakeBatchInvocationCount;
}

export function resetFakeBatchInvocationCount(): void {
  fakeBatchInvocationCount = 0;
}

export class FakeCandidateGenerator implements PersonaCandidateGenerator {
  readonly id = "fake";
  readonly providerMode = "image_provider" as const;

  isConfigured(): boolean {
    return true;
  }

  async estimateCandidateGeneration(input: EstimateCandidateGenerationInput) {
    return estimateFromProject(input, "image_provider", "fake", true);
  }

  async createCandidateBatch(input: CreateCandidateBatchInput): Promise<CandidateBatchJob> {
    fakeBatchInvocationCount += 1;
    if (!input.costConfirmed) {
      throw new PersonaDomainError(
        "Kostenbestätigung erforderlich vor bezahlter Generierung.",
        "WORKFLOW",
      );
    }

    const castingPhase = resolveCastingPhaseForGeneration({
      stage: input.stage,
      castingPhase: input.castingPhase,
    });

    const assetTypes =
      input.assetTypes ??
      (input.castingPhase
        ? assetTypesForCastingPhase(castingPhase)
        : assetTypesForStage(input.stage));

    const numbers =
      input.candidateNumbers ??
      Array.from({ length: input.project.candidate_count }, (_, i) => i + 1);

    const identityAttemptNumber = input.identityAttemptNumber ?? 1;
    const generationRunId = input.generationRunId?.trim() || `fake-run-${Date.now()}`;

    const results = numbers.map((candidateNumber) => ({
      candidateNumber,
      seed: `fake-${candidateNumber}-a${identityAttemptNumber}`,
      prompt: "fake-provider-test",
      negativePrompt: "",
      settings: {
        provider: "fake",
        costLabel: "allocated_estimate",
        castingPhase,
        fake: true,
        generationRunId,
        identityAttemptNumber,
        discoveryIdentity: {
          attemptNumber: identityAttemptNumber,
          generationRunId,
          samplingSeed: `fake-seed-${candidateNumber}-${identityAttemptNumber}`,
          anatomyFingerprint: `fake-anatomy-${candidateNumber}-${identityAttemptNumber}`,
          identityFingerprint: `fake-identity-${candidateNumber}-${identityAttemptNumber}`,
          promptFingerprint: `fake-prompt-${candidateNumber}-${identityAttemptNumber}`,
          slotBlueprintId: `fake-lane-${candidateNumber}`,
          discoveryIdentityInstanceId: `fake-inst-${candidateNumber}-${identityAttemptNumber}`,
          source: "controlled_sampling",
          slot: ["A", "B", "C", "D"][candidateNumber - 1] ?? "A",
        },
        discoveryIdentitySample: {
          faceGeometry: `fake-geometry-${identityAttemptNumber}`,
          eyeSpacing: `fake-eyeSpacing-${identityAttemptNumber}`,
          noseBridge: `fake-noseBridge-${identityAttemptNumber}`,
          noseWidth: `fake-noseWidth-${identityAttemptNumber}`,
          jaw: `fake-jaw-${identityAttemptNumber}`,
          hairline: `fake-hairline-${identityAttemptNumber}`,
          haircut: `fake-haircut-${identityAttemptNumber}`,
          beardPattern: `fake-beard-${identityAttemptNumber}`,
          optionalMicroMarks: identityAttemptNumber === 1 ? "none" : `mark-${identityAttemptNumber}`,
        },
        ...(input.replacementOfCandidateId
          ? {
              replacementOfCandidateId: input.replacementOfCandidateId,
              replacementReason:
                input.replacementReason ?? "face_similarity_duplicate",
            }
          : {}),
      },
      assets: assetTypes.map((assetType) => ({
        assetType,
        imageBytes: TINY_PNG,
        mimeType: "image/png",
        providerOutputId: `fake-out-${candidateNumber}-${identityAttemptNumber}`,
        metadata: {
          provider: "fake",
          fake: true,
          costLabel: "allocated_estimate",
          castingPhase,
        },
        estimatedCostEur: 0.056,
      })),
      identitySummary: "Fake candidate",
      distinguishingFeatures: "",
      actualCostEur: Number((assetTypes.length * 0.056).toFixed(4)),
      providerJobId: `fake-job-${Date.now()}`,
    }));

    return {
      jobId: `fake-batch-${Date.now()}`,
      status: "completed",
      provider: "fake",
      results,
      actualCostEur: results.reduce((s, r) => s + r.actualCostEur, 0),
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
