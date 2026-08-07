/**
 * Phase 2.2A — fal FLUX as a PersonaCandidateGenerator.
 * Four independent per-candidate requests (never "four men in one image").
 * Reuses existing L2/L3 prompt planning from the OpenAI generator path.
 */

import { randomUUID } from "node:crypto";
import { PersonaDomainError } from "../../domain/errors";
import { assertLivePaidProviderInvocationAllowed } from "../paid-generation-guard";
import type { CandidateAssetType } from "../../domain/creation-types";
import {
  buildCandidatePrompt,
  composeProviderPrompt,
  resolveOfficialDiscoveryVariations,
  resolveCandidateVariation,
  type CandidateVariationProfile,
} from "../candidate-intelligence";
import { assertObfCastAnatomyDiversity } from "../candidate-intelligence/obf-l3-integration";
import {
  assetTypesForCastingPhase,
  resolveCastingPhaseForGeneration,
} from "../casting-funnel";
import { getQualityModeProfile } from "../quality-modes";
import { mapPool, resolvePersonaImageConcurrency } from "./concurrency";
import { estimateFromProject } from "./cost";
import { deriveProviderSeed } from "./discovery-provider-seed";
import { resolveFalModel } from "./discovery-provider-config";
import { FalFluxDiscoveryProvider } from "./fal-flux-discovery-provider";
import type {
  CandidateBatchJob,
  CandidateGenerationResult,
  CreateCandidateBatchInput,
  EstimateCandidateGenerationInput,
  PersonaCandidateGenerator,
} from "./types";
import { validatePreProviderCrossSlotDiversity } from "../discovery/preflight-diversity";
import type { DiscoveryIdentityInstance, DiscoverySlot } from "@/lib/persona/identity-blueprints";

type WorkItem = {
  candidateNumber: number;
  assetType: CandidateAssetType;
  variation: CandidateVariationProfile;
};

export class FalFluxCandidateGenerator implements PersonaCandidateGenerator {
  readonly id = "fal_flux";
  readonly providerMode = "image_provider" as const;
  private readonly discovery: FalFluxDiscoveryProvider;

  constructor(discovery?: FalFluxDiscoveryProvider) {
    this.discovery = discovery ?? new FalFluxDiscoveryProvider();
  }

  isConfigured(): boolean {
    return this.discovery.isConfigured();
  }

  async estimateCandidateGeneration(input: EstimateCandidateGenerationInput) {
    return estimateFromProject(input, "image_provider", "fal_flux", this.isConfigured());
  }

  async createCandidateBatch(input: CreateCandidateBatchInput): Promise<CandidateBatchJob> {
    if (!input.costConfirmed) {
      throw new PersonaDomainError("Cost confirmation required.", "VALIDATION");
    }
    assertLivePaidProviderInvocationAllowed();
    if (!this.isConfigured()) {
      throw new PersonaDomainError(
        "Brand Face Discovery provider fal_flux is not configured (FAL_KEY missing).",
        "CONFIG",
        { code: "discovery_provider_not_configured" },
      );
    }

    const project = input.project;
    const castingPhase = resolveCastingPhaseForGeneration({
      castingPhase: input.castingPhase,
      stage: input.stage,
    });
    const assetTypes =
      input.assetTypes ?? assetTypesForCastingPhase(castingPhase);
    const numbers =
      input.candidateNumbers ??
      Array.from({ length: project.candidate_count }, (_, i) => i + 1);
    const generationRunId = input.generationRunId ?? randomUUID();
    const attemptNumber = input.identityAttemptNumber ?? 1;
    const jobId = randomUUID();

    const resolved = resolveOfficialDiscoveryVariations({
      project,
      candidateNumbers: numbers,
    });
    const variations: CandidateVariationProfile[] = resolved.variations.length
      ? resolved.variations
      : numbers.map((n) => resolveCandidateVariation(n));

    if (castingPhase === "a1_discovery" && numbers.length === 4 && attemptNumber === 1) {
      const instances: DiscoveryIdentityInstance[] = [];
      for (let i = 0; i < numbers.length; i++) {
        const built = buildCandidatePrompt({
          project,
          assetType: "portrait_front",
          candidateNumber: numbers[i]!,
          variation: variations[i]!,
          discoveryBlueprint: resolved.blueprints[i],
          generationRunId,
          attemptNumber,
          previousAttemptSample: input.previousAttemptSample,
          avoidSameRunSample: input.avoidSameRunSample,
        });
        if (built.discoveryIdentityInstance) {
          instances.push(built.discoveryIdentityInstance);
        }
      }
      if (instances.length === 4) {
        assertObfCastAnatomyDiversity(instances);
        const pre = validatePreProviderCrossSlotDiversity(instances);
        if (!pre.ok) {
          throw new PersonaDomainError(
            `Pre-provider diversity validation failed: ${pre.issues.map((i) => i.code).join(", ")}`,
            "VALIDATION",
            { issues: pre.issues },
          );
        }
      }
    }

    const work: WorkItem[] = [];
    for (let i = 0; i < numbers.length; i++) {
      for (const assetType of assetTypes) {
        work.push({
          candidateNumber: numbers[i]!,
          assetType,
          variation: variations[i]!,
        });
      }
    }

    const quality = getQualityModeProfile(project.quality_mode ?? "premium_editorial");
    const concurrency = resolvePersonaImageConcurrency();
    const byCandidate = new Map<number, CandidateGenerationResult>();

    await mapPool(
      work,
      async (item) => {
        const built = buildCandidatePrompt({
          project,
          assetType: item.assetType,
          candidateNumber: item.candidateNumber,
          variation: item.variation,
          generationRunId,
          attemptNumber,
          previousAttemptSample: input.previousAttemptSample,
          avoidSameRunSample: input.avoidSameRunSample,
        });
        const slot: DiscoverySlot =
          built.discoveryIdentityInstance?.slot ??
          ((["A", "B", "C", "D"] as const)[item.candidateNumber - 1] ?? "A");
        const providerSeed = deriveProviderSeed({
          generationRunId,
          slot,
          attemptNumber,
          provider: "fal_flux",
          creationProjectId: project.id,
        });
        const prompt = composeProviderPrompt(built);
        const generated = await this.discovery.generateDiscoveryCandidate({
          creationProjectId: project.id,
          generationRunId,
          workspaceId: project.workspace_id,
          slot,
          attemptNumber,
          prompt,
          providerSeed,
          abortSignal: input.abortSignal,
        });

        const existing = byCandidate.get(item.candidateNumber);
        const asset = {
          assetType: item.assetType,
          imageBytes: generated.imageBytes,
          mimeType: generated.mimeType,
          providerOutputId: generated.providerResultId,
          metadata: {
            providerSeed: generated.providerSeed,
            providerRequestId: generated.providerRequestId,
            providerModel: generated.providerModel,
          },
          estimatedCostEur: generated.estimatedCostEur,
        };

        if (existing) {
          existing.assets.push(asset);
          existing.actualCostEur += generated.estimatedCostEur;
        } else {
          byCandidate.set(item.candidateNumber, {
            candidateNumber: item.candidateNumber,
            seed: String(generated.providerSeed),
            prompt,
            negativePrompt: built.negativePrompt ?? "",
            settings: {
              provider: "fal_flux",
              providerModel: resolveFalModel(),
              providerSeed: generated.providerSeed,
              providerRequestId: generated.providerRequestId,
              discoveryIdentity: built.discoveryIdentityMetadata ?? null,
              discoveryIdentitySample: built.discoveryIdentityInstance ?? null,
              qualityMode: quality.id,
            },
            assets: [asset],
            identitySummary: `Candidate ${slot}`,
            distinguishingFeatures: built.variation?.id ?? "",
            actualCostEur: generated.estimatedCostEur,
            providerJobId: generated.providerRequestId,
          });
        }
      },
      { concurrency: input.concurrency ?? concurrency },
    );

    const results = [...byCandidate.values()].sort(
      (a, b) => a.candidateNumber - b.candidateNumber,
    );
    return {
      jobId,
      status: "completed",
      provider: "fal_flux",
      results,
      actualCostEur: results.reduce((s, r) => s + r.actualCostEur, 0),
    };
  }

  async getJobStatus(jobId: string): Promise<CandidateBatchJob> {
    return {
      jobId,
      status: "completed",
      provider: "fal_flux",
      results: [],
      actualCostEur: 0,
    };
  }

  async cancelJob(jobId: string): Promise<CandidateBatchJob> {
    return {
      jobId,
      status: "cancelled",
      provider: "fal_flux",
      results: [],
      actualCostEur: 0,
    };
  }

  async fetchCandidateAssets(jobId: string): Promise<CandidateGenerationResult[]> {
    void jobId;
    return [];
  }
}
