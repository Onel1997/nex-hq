/**
 * OpenAI Images adapter for Persona Creator Stage-A casting.
 * A1 discovery: 1 portrait per candidate (default).
 * A2 validation: missing angles for selected candidates only.
 * Controlled concurrency — never uncontrolled Promise.all for all assets.
 */

import { randomUUID } from "node:crypto";
import { generateOpenAiImage } from "@/agents/image/providers/openai-images-provider";
import { PersonaDomainError } from "../../domain/errors";
import { assertLivePaidProviderInvocationAllowed } from "../paid-generation-guard";
import type { CandidateAssetType, PersonaCreationProject } from "../../domain/creation-types";
import {
  getQualityModeProfile,
  type OpenAiPersonaQuality,
} from "../quality-modes";
import {
  buildCandidatePrompt,
  buildDiversityReport,
  composeProviderPrompt,
  resolveCandidateVariation,
  type CandidateVariationProfile,
} from "../candidate-intelligence";
import {
  assetTypesForCastingPhase,
  resolveCastingPhaseForGeneration,
  type CastingFunnelPhase,
} from "../casting-funnel";
import {
  PERSONA_CANDIDATE_PROVIDER_ID,
  isPersonaImageProviderConfigured,
} from "./config";
import { OPENAI_IMAGE_COST_EUR_MIN, assetTypesForStage, estimateFromProject } from "./cost";
import {
  isLikelyTransientProviderError,
  mapPool,
  resolvePersonaImageConcurrency,
  withTransientRetry,
} from "./concurrency";
import {
  createBatchTimingTracker,
  recordCompletedImageDurationMs,
} from "./generation-metrics";
import type {
  CandidateBatchJob,
  CandidateGenerationAssetResult,
  CandidateGenerationResult,
  CreateCandidateBatchInput,
  EstimateCandidateGenerationInput,
  PersonaCandidateGenerator,
} from "./types";

/** In-process cache only — durable status lives in persona_generation_jobs. */
const jobs = new Map<string, CandidateBatchJob>();

function resolveQuality(input: CreateCandidateBatchInput): OpenAiPersonaQuality {
  const mode = input.qualityMode ?? input.project.quality_mode ?? "premium_editorial";
  return getQualityModeProfile(mode).openaiQuality;
}

function identitySummaryFor(
  project: PersonaCreationProject,
  variationLabel: string,
): string {
  return [
    variationLabel,
    project.gender_presentation,
    project.age_range,
    project.hair_direction,
    project.fashion_style,
  ]
    .filter(Boolean)
    .join(" · ");
}

type WorkItem = {
  candidateNumber: number;
  assetType: CandidateAssetType;
  variation: CandidateVariationProfile;
  seed: string;
};

export class OpenAiCandidateGenerator implements PersonaCandidateGenerator {
  readonly id = PERSONA_CANDIDATE_PROVIDER_ID;
  readonly providerMode = "image_provider" as const;

  isConfigured(): boolean {
    return isPersonaImageProviderConfigured();
  }

  async estimateCandidateGeneration(input: EstimateCandidateGenerationInput) {
    const profile = getQualityModeProfile(
      input.qualityMode ?? input.project.quality_mode ?? "premium_editorial",
    );
    return estimateFromProject(
      {
        ...input,
        costMultiplier: profile.costMultiplier,
      },
      "image_provider",
      PERSONA_CANDIDATE_PROVIDER_ID,
      this.isConfigured(),
    );
  }

  async createCandidateBatch(input: CreateCandidateBatchInput): Promise<CandidateBatchJob> {
    if (!this.isConfigured()) {
      throw new PersonaDomainError(
        "Provider nicht eingerichtet (OPENAI_API_KEY).",
        "CONFIG",
      );
    }
    if (!input.costConfirmed) {
      throw new PersonaDomainError(
        "Kostenbestätigung erforderlich vor bezahlter Generierung.",
        "WORKFLOW",
        { requiresCostConfirmation: true },
      );
    }

    assertLivePaidProviderInvocationAllowed({
      estimatedMaxEur: undefined,
    });

    const quality = resolveQuality(input);
    const jobId = randomUUID();
    const castingPhase: CastingFunnelPhase = resolveCastingPhaseForGeneration({
      stage: input.stage,
      castingPhase: input.castingPhase,
    });
    const numbers =
      input.candidateNumbers ??
      Array.from({ length: input.project.candidate_count }, (_, i) => i + 1);
    const assetTypes =
      input.assetTypes ??
      (input.castingPhase
        ? assetTypesForCastingPhase(castingPhase)
        : assetTypesForStage(input.stage));
    const concurrency = input.concurrency ?? resolvePersonaImageConcurrency();
    const timing = createBatchTimingTracker(concurrency);

    const variations = numbers.map((n) => resolveCandidateVariation(n));
    const diversity = buildDiversityReport({
      candidateNumbers: numbers,
      variations,
    });

    jobs.set(jobId, {
      jobId,
      status: "generating",
      provider: this.id,
      results: [],
      actualCostEur: 0,
    });

    const unitCost = Number(
      (OPENAI_IMAGE_COST_EUR_MIN * getQualityModeProfile(
        input.qualityMode ?? input.project.quality_mode ?? "premium_editorial",
      ).costMultiplier).toFixed(4),
    );

    const work: WorkItem[] = [];
    for (let idx = 0; idx < numbers.length; idx += 1) {
      const candidateNumber = numbers[idx]!;
      const variation = variations[idx]!;
      const seed = `${jobId}-${candidateNumber}-${variation.id}`;
      for (const assetType of assetTypes) {
        work.push({ candidateNumber, assetType, variation, seed });
      }
    }

    // Slot counter for instrumentation (approximate concurrency slot).
    let activeSlots = 0;
    const errors: string[] = [];
    const assetsByCandidate = new Map<
      number,
      {
        variation: CandidateVariationProfile;
        seed: string;
        assets: CandidateGenerationAssetResult[];
        prompt: string;
        negative: string;
        identityLock: string;
      }
    >();

    for (const n of numbers) {
      const idx = numbers.indexOf(n);
      assetsByCandidate.set(n, {
        variation: variations[idx]!,
        seed: `${jobId}-${n}-${variations[idx]!.id}`,
        assets: [],
        prompt: "",
        negative: "",
        identityLock: "",
      });
    }

    await mapPool(
      work,
      async (item) => {
        activeSlots += 1;
        const slot = activeSlots;
        const startedMs = Date.now();
        const startedAt = new Date().toISOString();
        let retryCount = 0;
        let ok = false;

        try {
          const built = buildCandidatePrompt({
            project: input.project,
            assetType: item.assetType,
            candidateNumber: item.candidateNumber,
            variation: item.variation,
          });
          const bucket = assetsByCandidate.get(item.candidateNumber)!;
          if (!bucket.prompt || item.assetType === "portrait_front") {
            bucket.prompt = built.prompt;
            bucket.negative = built.negativePrompt;
            bucket.identityLock = built.identityLock;
          }

          const { value: generated, attempts } = await withTransientRetry(
            () =>
              generateOpenAiImage({
                prompt: composeProviderPrompt(built),
                dimensions: "1024x1024",
                assetType: "persona_candidate",
                qualityOverride: quality,
              }),
            {
              maxAttempts: 3,
              baseDelayMs: 800,
              isTransient: isLikelyTransientProviderError,
            },
          );
          retryCount = Math.max(0, attempts - 1);

          if (!generated.imageBytes) {
            throw new Error("OpenAI lieferte keine Bilddaten");
          }

          bucket.assets.push({
            assetType: item.assetType,
            imageBytes: generated.imageBytes,
            mimeType: "image/png",
            providerOutputId: null,
            metadata: {
              provider: this.id,
              stage: input.stage,
              castingPhase,
              seed: item.seed,
              quality,
              costLabel: "allocated_estimate",
              variationId: item.variation.id,
              variationLabel: item.variation.label,
              identityLock: built.identityLock,
              promptBlocks: {
                camera: built.blocks.camera,
                variation: item.variation.id,
              },
            },
            estimatedCostEur: unitCost,
          });
          ok = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Generierung fehlgeschlagen";
          errors.push(`Kandidat ${item.candidateNumber}/${item.assetType}: ${message}`);
        } finally {
          const elapsedMs = Date.now() - startedMs;
          timing.recordImage({
            candidateNumber: item.candidateNumber,
            assetType: item.assetType,
            concurrencySlot: slot,
            startedAt,
            completedAt: new Date().toISOString(),
            elapsedMs,
            retryCount,
            ok,
          });
          if (ok) recordCompletedImageDurationMs(elapsedMs);
          activeSlots -= 1;
        }
      },
      { concurrency },
    );

    const results: CandidateGenerationResult[] = [];
    let actualCost = 0;

    for (const candidateNumber of numbers) {
      const bucket = assetsByCandidate.get(candidateNumber)!;
      if (bucket.assets.length === 0) continue;
      const variation = bucket.variation;
      const candidateCost = bucket.assets.reduce((s, a) => s + (a.estimatedCostEur ?? 0), 0);
      actualCost += candidateCost;
      results.push({
        candidateNumber,
        seed: bucket.seed,
        prompt: bucket.prompt,
        negativePrompt: bucket.negative,
        settings: {
          stage: input.stage,
          castingPhase,
          provider: this.id,
          quality,
          costLabel: "allocated_estimate",
          variation: {
            id: variation.id,
            label: variation.label,
            style: variation.style,
            aesthetic: variation.aesthetic,
            identityDescriptor: variation.identityDescriptor,
            skinTone: variation.skinTone,
            wardrobe: variation.wardrobe,
          },
          identityLock: bucket.identityLock,
          identitySeed: variation.identityDescriptor,
          diversity: {
            minPairwiseScore: diversity.minPairwiseScore,
            averagePairwiseScore: diversity.averagePairwiseScore,
            lowDiversity: diversity.lowDiversity,
            warning: diversity.warning,
          },
          timingSummary: timing.summarize(),
        },
        assets: bucket.assets,
        identitySummary: identitySummaryFor(input.project, variation.label),
        distinguishingFeatures: [
          variation.label,
          variation.faceStructure,
          variation.jawline,
          variation.eyeShape,
          variation.hair,
          variation.stubble,
          variation.skinTone,
          variation.presence,
          input.project.visual_keywords || "",
        ]
          .filter(Boolean)
          .join(" · "),
        actualCostEur: Number(candidateCost.toFixed(4)),
        providerJobId: jobId,
      });
    }

    const status = results.length === 0 ? "failed" : "completed";
    const summary = timing.summarize();

    const job: CandidateBatchJob = {
      jobId,
      status,
      provider: this.id,
      results,
      errorMessage: errors.length ? errors.join("; ") : undefined,
      actualCostEur: Number(actualCost.toFixed(4)),
    };
    // Attach timing without changing CandidateBatchJob type — via first result settings already.
    void summary;
    jobs.set(jobId, job);
    return job;
  }

  async getJobStatus(jobId: string): Promise<CandidateBatchJob> {
    const job = jobs.get(jobId);
    if (!job) {
      throw new PersonaDomainError(`Job nicht gefunden: ${jobId}`, "NOT_FOUND");
    }
    return job;
  }

  async cancelJob(jobId: string): Promise<CandidateBatchJob> {
    const job = await this.getJobStatus(jobId);
    if (job.status === "generating") {
      const cancelled = { ...job, status: "cancelled" as const };
      jobs.set(jobId, cancelled);
      return cancelled;
    }
    return job;
  }

  async fetchCandidateAssets(jobId: string): Promise<CandidateGenerationResult[]> {
    const job = await this.getJobStatus(jobId);
    return job.results;
  }
}
