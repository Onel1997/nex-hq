/**
 * OpenAI Images adapter for Persona Creator candidate discovery.
 * Photorealistic identity exploration only — not Image Studio product workflows.
 * Stage B same-person expansion is NOT claimed as reliable.
 */

import { randomUUID } from "node:crypto";
import { generateOpenAiImage } from "@/agents/image/providers/openai-images-provider";
import { PersonaDomainError } from "../../domain/errors";
import { assertLivePaidProviderInvocationAllowed } from "../paid-generation-guard";
import type { PersonaCreationProject } from "../../domain/creation-types";
import {
  getQualityModeProfile,
  type OpenAiPersonaQuality,
} from "../quality-modes";
import {
  buildCandidatePrompt,
  buildDiversityReport,
  composeProviderPrompt,
  resolveCandidateVariation,
} from "../candidate-intelligence";
import {
  PERSONA_CANDIDATE_PROVIDER_ID,
  isPersonaImageProviderConfigured,
} from "./config";
import { OPENAI_IMAGE_COST_EUR_MIN, assetTypesForStage, estimateFromProject } from "./cost";
import type {
  CandidateBatchJob,
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
    const numbers =
      input.candidateNumbers ??
      Array.from({ length: input.project.candidate_count }, (_, i) => i + 1);
    const assetTypes = input.assetTypes ?? assetTypesForStage(input.stage);
    const results: CandidateGenerationResult[] = [];
    let actualCost = 0;
    const errors: string[] = [];

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

    for (let idx = 0; idx < numbers.length; idx += 1) {
      const i = numbers[idx]!;
      const variation = variations[idx]!;
      const seed = `${jobId}-${i}-${variation.id}`;
      const assets = [];
      let prompt = "";
      let negative = "";
      let identityLock = "";

      for (const assetType of assetTypes) {
        const built = buildCandidatePrompt({
          project: input.project,
          assetType,
          candidateNumber: i,
          variation,
        });
        if (!prompt || assetType === "portrait_front") {
          prompt = built.prompt;
          negative = built.negativePrompt;
          identityLock = built.identityLock;
        }
        try {
          const generated = await generateOpenAiImage({
            prompt: composeProviderPrompt(built),
            dimensions: "1024x1024",
            assetType: "persona_candidate",
            qualityOverride: quality,
          });
          if (!generated.imageBytes) {
            throw new Error("OpenAI lieferte keine Bilddaten");
          }
          actualCost += unitCost;
          assets.push({
            assetType,
            imageBytes: generated.imageBytes,
            mimeType: "image/png",
            providerOutputId: null,
            metadata: {
              provider: this.id,
              stage: input.stage,
              seed,
              quality,
              costLabel: "estimated",
              variationId: variation.id,
              variationLabel: variation.label,
              identityLock,
              promptBlocks: {
                camera: built.blocks.camera,
                variation: variation.id,
              },
            },
            estimatedCostEur: unitCost,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Generierung fehlgeschlagen";
          errors.push(`Kandidat ${i}/${assetType}: ${message}`);
        }
      }

      if (assets.length > 0) {
        results.push({
          candidateNumber: i,
          seed,
          prompt,
          negativePrompt: negative,
          settings: {
            stage: input.stage,
            provider: this.id,
            quality,
            costLabel: "estimated",
            variation: {
              id: variation.id,
              label: variation.label,
              style: variation.style,
              aesthetic: variation.aesthetic,
              identityDescriptor: variation.identityDescriptor,
              skinTone: variation.skinTone,
              wardrobe: variation.wardrobe,
            },
            identityLock,
            identitySeed: variation.identityDescriptor,
            diversity: {
              minPairwiseScore: diversity.minPairwiseScore,
              averagePairwiseScore: diversity.averagePairwiseScore,
              lowDiversity: diversity.lowDiversity,
              warning: diversity.warning,
            },
          },
          assets,
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
          actualCostEur: assets.reduce((s, a) => s + (a.estimatedCostEur ?? 0), 0),
          providerJobId: jobId,
        });
      }
    }

    const status = results.length === 0 ? "failed" : "completed";

    const job: CandidateBatchJob = {
      jobId,
      status,
      provider: this.id,
      results,
      errorMessage: errors.length ? errors.join("; ") : undefined,
      actualCostEur: Number(actualCost.toFixed(4)),
    };
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
