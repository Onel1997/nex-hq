/**
 * Stage-A casting funnel — A1 face discovery then A2 angle validation.
 *
 * A1: 4 candidates × 1 discovery portrait (cost-efficient face judgment).
 * A2: selected candidates × missing Stage-A angles (explicit re-confirmation).
 *
 * STAGE_A_ASSET_TYPES remains the full validation set (front / 3/4 / half).
 */

import {
  STAGE_A_ASSET_TYPES,
  type CandidateAssetType,
  type GenerationStage,
  type PersonaCandidate,
} from "../domain/creation-types";

export type CastingFunnelPhase = "a1_discovery" | "a2_validation";

/** A1 — one hero portrait per candidate for face casting judgment. */
export const STAGE_A1_DISCOVERY_ASSET_TYPES: readonly CandidateAssetType[] = [
  "portrait_front",
] as const;

/** A2 — full Stage-A identity validation angles. */
export const STAGE_A2_VALIDATION_ASSET_TYPES: readonly CandidateAssetType[] =
  STAGE_A_ASSET_TYPES;

/** Default max candidates a user may expand in A2 without extra product review. */
export const DEFAULT_A2_MAX_SELECTED = 2;

export const CASTING_FUNNEL_SETTINGS_KEY = "castingFunnel" as const;

export interface CastingFunnelState {
  phase: CastingFunnelPhase;
  /** Candidate IDs selected for A2 expansion (empty during/after A1). */
  selectedForValidation: string[];
  a1CompletedAt?: string | null;
  a2CompletedAt?: string | null;
}

export function defaultCastingFunnelState(): CastingFunnelState {
  return {
    phase: "a1_discovery",
    selectedForValidation: [],
    a1CompletedAt: null,
    a2CompletedAt: null,
  };
}

export function readCastingFunnelState(
  settings: Record<string, unknown> | null | undefined,
): CastingFunnelState {
  const raw = settings?.[CASTING_FUNNEL_SETTINGS_KEY];
  if (!raw || typeof raw !== "object") return defaultCastingFunnelState();
  const row = raw as Record<string, unknown>;
  const phase: CastingFunnelPhase =
    row.phase === "a2_validation" ? "a2_validation" : "a1_discovery";
  const selected = Array.isArray(row.selectedForValidation)
    ? row.selectedForValidation.filter((id): id is string => typeof id === "string")
    : [];
  return {
    phase,
    selectedForValidation: selected,
    a1CompletedAt: typeof row.a1CompletedAt === "string" ? row.a1CompletedAt : null,
    a2CompletedAt: typeof row.a2CompletedAt === "string" ? row.a2CompletedAt : null,
  };
}

export function writeCastingFunnelState(
  settings: Record<string, unknown>,
  next: CastingFunnelState,
): Record<string, unknown> {
  return {
    ...settings,
    [CASTING_FUNNEL_SETTINGS_KEY]: next,
  };
}

export function assetTypesForCastingPhase(
  phase: CastingFunnelPhase,
): CandidateAssetType[] {
  if (phase === "a1_discovery") return [...STAGE_A1_DISCOVERY_ASSET_TYPES];
  return [...STAGE_A2_VALIDATION_ASSET_TYPES];
}

export function imagesPerCandidateForCastingPhase(
  phase: CastingFunnelPhase,
): number {
  return assetTypesForCastingPhase(phase).length;
}

/**
 * Resolve which Stage-A angles are still missing for a candidate.
 * Reuses existing valid assets instead of regenerating duplicates.
 */
export function missingValidationAssetTypes(
  existingAssetTypes: CandidateAssetType[],
): CandidateAssetType[] {
  const have = new Set(existingAssetTypes);
  return STAGE_A2_VALIDATION_ASSET_TYPES.filter((t) => !have.has(t));
}

export function clampA2Selection(
  candidateIds: string[],
  maxSelected: number = DEFAULT_A2_MAX_SELECTED,
): string[] {
  const unique = [...new Set(candidateIds.filter(Boolean))];
  return unique.slice(0, Math.max(1, maxSelected));
}

export function resolveCastingPhaseForGeneration(input: {
  stage: GenerationStage;
  castingPhase?: CastingFunnelPhase | null;
  /** Explicit override from confirmation payload. */
  confirmationPhase?: CastingFunnelPhase | null;
}): CastingFunnelPhase {
  if (input.confirmationPhase) return input.confirmationPhase;
  if (input.castingPhase) return input.castingPhase;
  // Discovery defaults to A1 face discovery (not full 3-angle burn).
  if (input.stage === "discovery") return "a1_discovery";
  return "a2_validation";
}

export function castingPhaseLabel(phase: CastingFunnelPhase): string {
  return phase === "a1_discovery" ? "Discovery casting" : "Expand selected candidates";
}

export function candidateHasDiscoveryPortrait(
  candidate: Pick<PersonaCandidate, "primary_preview_asset_id"> & {
    assetTypes?: CandidateAssetType[];
  },
): boolean {
  if (candidate.primary_preview_asset_id) return true;
  return Boolean(candidate.assetTypes?.includes("portrait_front"));
}
