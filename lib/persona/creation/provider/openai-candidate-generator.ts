/**
 * OpenAI Images adapter for Persona Creator candidate discovery.
 * Photorealistic identity exploration only — not Image Studio product workflows.
 */

import { randomUUID } from "node:crypto";
import { generateOpenAiImage } from "@/agents/image/providers/openai-images-provider";
import { PersonaDomainError } from "../../domain/errors";
import type { CandidateAssetType, PersonaCreationProject } from "../../domain/creation-types";
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

const jobs = new Map<string, CandidateBatchJob>();

function buildPrompt(
  project: PersonaCreationProject,
  assetType: CandidateAssetType,
  candidateNumber: number,
): { prompt: string; negative: string } {
  const framing =
    assetType === "portrait_front"
      ? "front-facing head-and-shoulders portrait, eyes to camera"
      : assetType === "portrait_three_quarter"
        ? "three-quarter angle head-and-shoulders portrait"
        : assetType === "portrait_profile"
          ? "clean side profile portrait"
          : assetType === "half_body"
            ? "half-body editorial portrait"
            : assetType === "full_body"
              ? "full-body standing editorial portrait"
              : assetType === "expression_variant"
                ? "neutral calm expression close portrait"
                : assetType === "outfit_variant"
                  ? "half-body portrait in preferred outfit styling"
                  : "editorial fashion portrait";

  const prompt = [
    "Photorealistic fashion model identity reference for brand casting.",
    "High-end commercial photography, natural skin texture, realistic anatomy.",
    `Candidate variation ${candidateNumber}.`,
    `Gender presentation: ${project.gender_presentation || "unspecified"}.`,
    `Age range: ${project.age_range || "adult"}.`,
    `Height: ${project.height_range || "average"}.`,
    `Body type: ${project.body_type || "lean"}.`,
    `Skin tone direction: ${project.skin_tone_direction || "natural"}.`,
    `Face: ${project.face_shape_direction || "balanced"}.`,
    `Hair: ${project.hair_direction || "neat"}.`,
    `Facial hair: ${project.facial_hair_direction || "none"}.`,
    `Eyes: ${project.eye_direction || "natural"}.`,
    `Expression: ${project.expression_direction || "calm neutral"}.`,
    `Personality vibe: ${project.personality || "composed"}.`,
    `Fashion style: ${project.fashion_style || "quiet luxury"}.`,
    `Brand role: ${project.brand_role}.`,
    project.visual_keywords ? `Keywords: ${project.visual_keywords}.` : "",
    project.preferred_outfits ? `Outfit direction: ${project.preferred_outfits}.` : "",
    project.preferred_brand_looks ? `Brand look: ${project.preferred_brand_looks}.` : "",
    project.additional_description ? `Notes: ${project.additional_description}.` : "",
    `Shot: ${framing}.`,
    "Neutral studio background, soft key light, no logos, no text, no watermark.",
    "Single person only. Suitable as a locked brand model identity reference.",
  ]
    .filter(Boolean)
    .join(" ");

  const negative = [
    "cartoon, anime, illustration, deformed hands, extra fingers,",
    "watermark, text, logo, collage, multiple people, age shift,",
    project.excluded_features || "",
  ]
    .filter(Boolean)
    .join(" ");

  return { prompt, negative };
}

export class OpenAiCandidateGenerator implements PersonaCandidateGenerator {
  readonly id = PERSONA_CANDIDATE_PROVIDER_ID;
  readonly providerMode = "image_provider" as const;

  isConfigured(): boolean {
    return isPersonaImageProviderConfigured();
  }

  async estimateCandidateGeneration(input: EstimateCandidateGenerationInput) {
    return estimateFromProject(
      input,
      "image_provider",
      PERSONA_CANDIDATE_PROVIDER_ID,
      this.isConfigured(),
    );
  }

  async createCandidateBatch(input: CreateCandidateBatchInput): Promise<CandidateBatchJob> {
    if (!this.isConfigured()) {
      throw new PersonaDomainError(
        "OpenAI Images ist nicht konfiguriert (OPENAI_API_KEY).",
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

    const jobId = randomUUID();
    const count = input.project.candidate_count;
    const assetTypes = assetTypesForStage(input.stage);
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

    for (let i = 1; i <= count; i++) {
      const seed = `${jobId}-${i}`;
      const assets = [];
      let prompt = "";
      let negative = "";

      for (const assetType of assetTypes) {
        const built = buildPrompt(input.project, assetType, i);
        prompt = built.prompt;
        negative = built.negative;
        try {
          const generated = await generateOpenAiImage({
            prompt: `${built.prompt}\nAvoid: ${built.negative}`,
            dimensions: "1024x1024",
            assetType: "persona_candidate",
          });
          if (!generated.imageBytes) {
            throw new Error("OpenAI lieferte keine Bilddaten");
          }
          const cost = OPENAI_IMAGE_COST_EUR_MIN;
          actualCost += cost;
          assets.push({
            assetType,
            imageBytes: generated.imageBytes,
            mimeType: "image/png",
            providerOutputId: null,
            metadata: {
              provider: this.id,
              stage: input.stage,
              seed,
            },
            estimatedCostEur: cost,
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
          settings: { stage: input.stage, provider: this.id },
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

    const job: CandidateBatchJob = {
      jobId,
      status: results.length === 0 ? "failed" : errors.length ? "completed" : "completed",
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
    const job = jobs.get(jobId) ?? {
      jobId,
      status: "cancelled" as const,
      provider: this.id,
      results: [],
      actualCostEur: 0,
    };
    const cancelled = { ...job, status: "cancelled" as const };
    jobs.set(jobId, cancelled);
    return cancelled;
  }

  async fetchCandidateAssets(jobId: string) {
    const job = await this.getJobStatus(jobId);
    return job.results;
  }
}
