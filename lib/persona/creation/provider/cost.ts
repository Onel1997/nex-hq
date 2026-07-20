/**
 * Cost estimates for Persona Creator candidate generation.
 * Honest ranges — no fake free generation.
 */

import {
  MAX_CANDIDATE_BATCH_SIZE,
  STAGE_A_ASSET_TYPES,
  STAGE_B_ASSET_TYPES,
  type CandidateGenerationCostEstimate,
  type GenerationStage,
  type ProviderMode,
} from "../../domain/creation-types";
import type { EstimateCandidateGenerationInput } from "./types";

/** gpt-image-1 medium quality rough EUR band per image (OpenAI USD converted). */
export const OPENAI_IMAGE_COST_EUR_MIN = 0.04;
export const OPENAI_IMAGE_COST_EUR_MAX = 0.12;

export function imagesPerCandidateForStage(stage: GenerationStage): number {
  if (stage === "discovery") return STAGE_A_ASSET_TYPES.length;
  if (stage === "shortlist_validation") return STAGE_B_ASSET_TYPES.length;
  return 0;
}

export function assetTypesForStage(stage: GenerationStage) {
  if (stage === "discovery") return STAGE_A_ASSET_TYPES;
  if (stage === "shortlist_validation") return STAGE_B_ASSET_TYPES;
  return [];
}

export function buildCostEstimate(params: {
  providerMode: ProviderMode;
  provider: string;
  stage: GenerationStage;
  candidateCount: number;
  imagesPerCandidate?: number;
  available: boolean;
  note?: string;
  /** Quality mode cost multiplier (default 1). */
  costMultiplier?: number;
}): CandidateGenerationCostEstimate {
  const count = Math.min(
    Math.max(1, params.candidateCount),
    MAX_CANDIDATE_BATCH_SIZE,
  );
  const imagesPer =
    params.imagesPerCandidate ?? imagesPerCandidateForStage(params.stage);
  const totalImages = count * imagesPer;
  const mult = params.costMultiplier ?? 1;

  if (
    !params.available ||
    params.providerMode === "disabled" ||
    params.providerMode === "manual_upload" ||
    totalImages === 0
  ) {
    return {
      currency: "EUR",
      candidateCount: count,
      imagesPerCandidate: imagesPer,
      totalImages,
      provider: params.provider,
      providerMode: params.providerMode,
      estimatedMin: 0,
      estimatedMax: 0,
      estimatedTotal: 0,
      stage: params.stage,
      available: params.available && params.providerMode !== "disabled",
      note:
        params.note ??
        (params.providerMode === "manual_upload"
          ? "Manueller Upload — keine Provider-Kosten."
          : params.providerMode === "disabled"
            ? "Generierung deaktiviert — keine Kosten, keine Fake-Kandidaten."
            : "Kostenschätzung nicht verfügbar."),
    };
  }

  const estimatedMin = Number((totalImages * OPENAI_IMAGE_COST_EUR_MIN * mult).toFixed(4));
  const estimatedMax = Number((totalImages * OPENAI_IMAGE_COST_EUR_MAX * mult).toFixed(4));
  const estimatedTotal = Number(((estimatedMin + estimatedMax) / 2).toFixed(4));

  return {
    currency: "EUR",
    candidateCount: count,
    imagesPerCandidate: imagesPer,
    totalImages,
    provider: params.provider,
    providerMode: params.providerMode,
    estimatedMin,
    estimatedMax,
    estimatedTotal,
    stage: params.stage,
    available: true,
    note:
      params.note ??
      `Stufe ${params.stage}: ${count} Kandidaten × ${imagesPer} Bilder. Schätzung — keine finalen Kosten. Explizite Bestätigung erforderlich.`,
  };
}

export function estimateFromProject(
  input: EstimateCandidateGenerationInput,
  providerMode: ProviderMode,
  provider: string,
  available: boolean,
): CandidateGenerationCostEstimate {
  return buildCostEstimate({
    providerMode,
    provider,
    stage: input.stage,
    candidateCount: input.candidateCount ?? input.project.candidate_count,
    imagesPerCandidate: input.imagesPerCandidate,
    available,
    costMultiplier: input.costMultiplier,
  });
}
