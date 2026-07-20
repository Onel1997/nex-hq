/**
 * OpenAI Images adapter for Persona Creator candidate discovery.
 * Photorealistic identity exploration only — not Image Studio product workflows.
 * Stage B same-person expansion is NOT claimed as reliable.
 */

import { randomUUID } from "node:crypto";
import { generateOpenAiImage } from "@/agents/image/providers/openai-images-provider";
import { PersonaDomainError } from "../../domain/errors";
import type { CandidateAssetType, PersonaCreationProject } from "../../domain/creation-types";
import {
  getQualityModeProfile,
  type OpenAiPersonaQuality,
} from "../quality-modes";
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

function buildPremiumPrompt(
  project: PersonaCreationProject,
  assetType: CandidateAssetType,
  candidateNumber: number,
): { prompt: string; negative: string } {
  const framing =
    assetType === "portrait_front"
      ? "front-facing head-and-shoulders portrait, eyes to camera, locked framing"
      : assetType === "portrait_three_quarter"
        ? "three-quarter angle head-and-shoulders portrait, clear facial structure"
        : assetType === "portrait_profile"
          ? "clean true side profile portrait, ear visible, no head tilt"
          : assetType === "half_body"
            ? "half-body editorial portrait, waist-up, natural posture"
            : assetType === "full_body"
              ? "full-body standing editorial portrait, head to toe visible, natural stance"
              : assetType === "expression_variant"
                ? "close portrait with subtle approved calm expression, same person"
                : assetType === "outfit_variant"
                  ? "half-body portrait in preferred Milaene styling look"
                  : "editorial fashion portrait";

  const prompt = [
    "Photorealistic adult fashion casting photograph for a luxury brand identity lock.",
    "Premium fashion-editorial photography, commercial usable, natural light falloff.",
    "Clearly an adult human. Natural facial asymmetry. Realistic skin texture with subtle pores.",
    "Realistic hair strands. Natural eyes and teeth. Correct anatomy. No plastic skin.",
    "No over-retouching, no beauty filter, no uncanny perfect symmetry.",
    `Distinct candidate variation ${candidateNumber} — different person from other candidates, same brand direction.`,
    `Adult age range: ${project.age_range || "28-35"}.`,
    `Gender presentation: ${project.gender_presentation || "unspecified"}.`,
    `Height: ${project.height_range || "average"}.`,
    `Body type: ${project.body_type || "athletic lean"}.`,
    `Skin tone: ${project.skin_tone_direction || "natural"}.`,
    `Face: ${project.face_shape_direction || "balanced, defined"}.`,
    `Hair: ${project.hair_direction || "neat natural"}.`,
    `Facial hair: ${project.facial_hair_direction || "none"}.`,
    `Eyes: ${project.eye_direction || "natural"}.`,
    `Expression: ${project.expression_direction || "quiet confidence, neutral calm"}.`,
    `Personality presence: ${project.personality || "composed"}.`,
    `Fashion direction: ${project.fashion_style || "quiet luxury"}.`,
    `Brand role: ${project.brand_role}.`,
    project.visual_keywords ? `Visual keywords: ${project.visual_keywords}.` : "",
    project.preferred_outfits ? `Outfit direction: ${project.preferred_outfits}.` : "",
    project.preferred_brand_looks ? `Brand look: ${project.preferred_brand_looks}.` : "",
    project.additional_description ? `Creative notes: ${project.additional_description}.` : "",
    `Shot: ${framing}.`,
    "Neutral clean studio background, soft key light, premium casting look.",
    "No brand logos, no copyrighted characters, no text, no watermark.",
    "Single adult person only. Suitable as an official brand face reference.",
  ]
    .filter(Boolean)
    .join(" ");

  const negative = [
    "cartoon, anime, illustration, 3d render, plastic skin, over-smoothed,",
    "deformed hands, extra fingers, bad anatomy, watermark, text, logo,",
    "collage, multiple people, child, minor, underage, age-ambiguous,",
    "sexualized pose, exaggerated beauty filter, uncanny symmetry,",
    project.excluded_features || "",
  ]
    .filter(Boolean)
    .join(" ");

  return { prompt, negative };
}

function resolveQuality(input: CreateCandidateBatchInput): OpenAiPersonaQuality {
  const mode = input.qualityMode ?? input.project.quality_mode ?? "premium_editorial";
  return getQualityModeProfile(mode).openaiQuality;
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

    const quality = resolveQuality(input);
    const jobId = randomUUID();
    const numbers =
      input.candidateNumbers ??
      Array.from({ length: input.project.candidate_count }, (_, i) => i + 1);
    const assetTypes = input.assetTypes ?? assetTypesForStage(input.stage);
    const results: CandidateGenerationResult[] = [];
    let actualCost = 0;
    const errors: string[] = [];

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

    for (const i of numbers) {
      const seed = `${jobId}-${i}`;
      const assets = [];
      let prompt = "";
      let negative = "";

      for (const assetType of assetTypes) {
        const built = buildPremiumPrompt(input.project, assetType, i);
        prompt = built.prompt;
        negative = built.negative;
        try {
          const generated = await generateOpenAiImage({
            prompt: `${built.prompt}\nAvoid: ${built.negative}`,
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
          },
          assets,
          identitySummary: [
            input.project.gender_presentation,
            input.project.age_range,
            input.project.hair_direction,
            input.project.fashion_style,
          ]
            .filter(Boolean)
            .join(" · "),
          distinguishingFeatures: input.project.visual_keywords || "",
          actualCostEur: assets.reduce((s, a) => s + (a.estimatedCostEur ?? 0), 0),
          providerJobId: jobId,
        });
      }
    }

    const status =
      results.length === 0
        ? "failed"
        : errors.length
          ? "completed"
          : "completed";

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
