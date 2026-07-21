/**
 * Cost estimates for Persona Creator candidate generation.
 * Honest ranges — no fake free generation.
 *
 * Discovery (A1) defaults to 1 image per candidate.
 * Full Stage-A validation angles are estimated only for A2 expansion.
 */

import {
  MAX_CANDIDATE_BATCH_SIZE,
  STAGE_A_ASSET_TYPES,
  STAGE_B_ASSET_TYPES,
  type CandidateAssetType,
  type CandidateGenerationCostEstimate,
  type GenerationStage,
  type ProviderMode,
} from "../../domain/creation-types";
import {
  assetTypesForCastingPhase,
  imagesPerCandidateForCastingPhase,
  type CastingFunnelPhase,
} from "../casting-funnel";
import type { EstimateCandidateGenerationInput } from "./types";

/** gpt-image-1 medium quality rough EUR band per image (OpenAI USD converted). */
export const OPENAI_IMAGE_COST_EUR_MIN = 0.04;
export const OPENAI_IMAGE_COST_EUR_MAX = 0.12;

export function imagesPerCandidateForStage(stage: GenerationStage): number {
  if (stage === "discovery") {
    return imagesPerCandidateForCastingPhase("a1_discovery");
  }
  if (stage === "shortlist_validation") return STAGE_B_ASSET_TYPES.length;
  return 0;
}

export function assetTypesForStage(stage: GenerationStage): CandidateAssetType[] {
  if (stage === "discovery") {
    return assetTypesForCastingPhase("a1_discovery");
  }
  if (stage === "shortlist_validation") return [...STAGE_B_ASSET_TYPES];
  return [];
}

export function assetTypesForStageOrPhase(params: {
  stage: GenerationStage;
  castingPhase?: CastingFunnelPhase | null;
}): CandidateAssetType[] {
  if (params.castingPhase) {
    return assetTypesForCastingPhase(params.castingPhase);
  }
  return assetTypesForStage(params.stage);
}

/** Full Stage-A validation set (front / 3/4 / half) — used for completeness checks. */
export function stageAValidationAssetTypes(): CandidateAssetType[] {
  return [...STAGE_A_ASSET_TYPES];
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
  castingPhase?: CastingFunnelPhase;
  costStatus?: "estimated" | "provider_confirmed" | "unknown" | "allocated_estimate";
}): CandidateGenerationCostEstimate {
  const count = Math.min(
    Math.max(1, params.candidateCount),
    MAX_CANDIDATE_BATCH_SIZE,
  );
  const phase =
    params.castingPhase ??
    (params.stage === "discovery" ? "a1_discovery" : undefined);
  const imagesPer =
    params.imagesPerCandidate ??
    (phase
      ? imagesPerCandidateForCastingPhase(phase)
      : imagesPerCandidateForStage(params.stage));
  const totalImages = count * imagesPer;
  const mult = params.costMultiplier ?? 1;
  const costStatus = params.costStatus ?? "estimated";

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
      castingPhase: phase,
      costStatus,
    };
  }

  const estimatedMin = Number((totalImages * OPENAI_IMAGE_COST_EUR_MIN * mult).toFixed(4));
  const estimatedMax = Number((totalImages * OPENAI_IMAGE_COST_EUR_MAX * mult).toFixed(4));
  const estimatedTotal = Number(((estimatedMin + estimatedMax) / 2).toFixed(4));
  const phaseNote =
    phase === "a1_discovery"
      ? `Discovery casting (A1): ${count} Kandidaten × ${imagesPer} Gesichtsportrait. Explizite Bestätigung erforderlich.`
      : phase === "a2_validation"
        ? `Angle validation (A2): ${count} selected × ${imagesPer} fehlende Winkel. Separate Bestätigung erforderlich.`
        : `Stufe ${params.stage}: ${count} Kandidaten × ${imagesPer} Bilder. Schätzung — keine finalen Kosten. Explizite Bestätigung erforderlich.`;

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
    note: params.note ?? phaseNote,
    castingPhase: phase,
    costStatus,
    allocatedPerCandidate:
      count > 0
        ? {
            estimatedMin: Number((estimatedMin / count).toFixed(4)),
            estimatedMax: Number((estimatedMax / count).toFixed(4)),
            label: "allocated_estimate" as const,
          }
        : undefined,
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
    castingPhase: input.castingPhase,
  });
}
