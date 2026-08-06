/**
 * Phase 2.1E — Novelty replacement helpers (no OpenAI at import time).
 *
 * Extracts attempt / replacement metadata from candidate generation_settings
 * and builds auditable persistence payloads.
 */

import { slotForCandidateNumber } from "@/lib/brand-archetypes/discovery-blueprints";
import type { ControlledPoolKey, DiscoverySlot } from "@/lib/persona/identity-blueprints";
import { CONTROLLED_POOL_KEYS } from "@/lib/persona/identity-blueprints";
import { MAX_DISCOVERY_IDENTITY_ATTEMPTS } from "./candidate-intelligence/obf-l3-integration";

export { MAX_DISCOVERY_IDENTITY_ATTEMPTS };

export const NOVELTY_REPLACEMENT_REASON = "face_similarity_duplicate" as const;

export const SLOT_EXHAUSTED_MESSAGE =
  "Slot exhausted — start a new discovery" as const;

export type NoveltyReplacementAttemptRecord = {
  attemptNumber: number;
  replacementOfCandidateId: string | null;
  replacementReason: string | null;
  matchedCandidateId: string | null;
  matchedProjectId: string | null;
  matchedSlot: DiscoverySlot | null;
  matchedSameRun: boolean;
  anatomyFingerprint: string;
  identityFingerprint: string;
  promptFingerprint: string;
  samplingSeed: string;
  providerRequestId: string | null;
  providerOutputId: string | null;
  noveltyDecision: string | null;
  similarityScore: number | null;
  createdAt: string;
  slotBlueprintId: string;
  generationRunId: string;
  slotExhausted?: boolean;
};

export function readDiscoveryIdentitySettings(
  settings: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const di = settings?.discoveryIdentity;
  if (!di || typeof di !== "object") return null;
  return di as Record<string, unknown>;
}

export function readIdentityAttemptNumber(
  settings: Record<string, unknown> | null | undefined,
): number {
  const di = readDiscoveryIdentitySettings(settings);
  const fromDi = di?.attemptNumber;
  if (typeof fromDi === "number" && Number.isInteger(fromDi) && fromDi >= 1) {
    return fromDi;
  }
  const top = settings?.identityAttemptNumber;
  if (typeof top === "number" && Number.isInteger(top) && top >= 1) {
    return top;
  }
  return 1;
}

export function readGenerationRunIdFromSettings(
  settings: Record<string, unknown> | null | undefined,
  fallback: string,
): string {
  const di = readDiscoveryIdentitySettings(settings);
  if (typeof di?.generationRunId === "string" && di.generationRunId.trim()) {
    return di.generationRunId.trim();
  }
  if (
    typeof settings?.generationRunId === "string" &&
    settings.generationRunId.trim()
  ) {
    return settings.generationRunId.trim();
  }
  return fallback;
}

export function extractAnatomySampleFromSettings(
  settings: Record<string, unknown> | null | undefined,
): Partial<Record<ControlledPoolKey, string>> | null {
  const sample = settings?.discoveryIdentitySample;
  if (!sample || typeof sample !== "object") return null;
  const out: Partial<Record<ControlledPoolKey, string>> = {};
  for (const key of CONTROLLED_POOL_KEYS) {
    const v = (sample as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function anatomySampleFromInstance(instance: {
  [K in ControlledPoolKey]?: string;
}): Partial<Record<ControlledPoolKey, string>> {
  const out: Partial<Record<ControlledPoolKey, string>> = {};
  for (const key of CONTROLLED_POOL_KEYS) {
    const v = instance[key];
    if (typeof v === "string" && v.trim()) out[key] = v;
  }
  return out;
}

/** Resolve whether matched prior is same-run (same creation project). */
export function resolveMatchedSameRunSlot(input: {
  matchedCandidateId: string | null | undefined;
  matchedProjectId: string | null | undefined;
  currentProjectId: string;
  matchedCandidateNumber: number | null | undefined;
}): { matchedSameRun: boolean; matchedSlot: DiscoverySlot | null } {
  if (!input.matchedCandidateId) {
    return { matchedSameRun: false, matchedSlot: null };
  }
  const matchedSameRun =
    Boolean(input.matchedProjectId) &&
    input.matchedProjectId === input.currentProjectId;
  if (!matchedSameRun || input.matchedCandidateNumber == null) {
    return { matchedSameRun, matchedSlot: null };
  }
  try {
    return {
      matchedSameRun: true,
      matchedSlot: slotForCandidateNumber(input.matchedCandidateNumber),
    };
  } catch {
    return { matchedSameRun: true, matchedSlot: null };
  }
}

export function isSlotExhaustedAfterAttempt(attemptNumber: number): boolean {
  return attemptNumber >= MAX_DISCOVERY_IDENTITY_ATTEMPTS;
}

export function canRequestNoveltyReplacement(attemptNumber: number): boolean {
  return attemptNumber < MAX_DISCOVERY_IDENTITY_ATTEMPTS;
}

export function buildNoveltyReplacementAttemptRecord(input: {
  attemptNumber: number;
  replacementOfCandidateId: string | null;
  replacementReason: string | null;
  matchedCandidateId: string | null;
  matchedProjectId: string | null;
  matchedSlot: DiscoverySlot | null;
  matchedSameRun: boolean;
  anatomyFingerprint: string;
  identityFingerprint: string;
  promptFingerprint: string;
  samplingSeed: string;
  providerRequestId: string | null;
  providerOutputId: string | null;
  noveltyDecision: string | null;
  similarityScore: number | null;
  slotBlueprintId: string;
  generationRunId: string;
  slotExhausted?: boolean;
  createdAt?: string;
}): NoveltyReplacementAttemptRecord {
  return {
    attemptNumber: input.attemptNumber,
    replacementOfCandidateId: input.replacementOfCandidateId,
    replacementReason: input.replacementReason,
    matchedCandidateId: input.matchedCandidateId,
    matchedProjectId: input.matchedProjectId,
    matchedSlot: input.matchedSlot,
    matchedSameRun: input.matchedSameRun,
    anatomyFingerprint: input.anatomyFingerprint,
    identityFingerprint: input.identityFingerprint,
    promptFingerprint: input.promptFingerprint,
    samplingSeed: input.samplingSeed,
    providerRequestId: input.providerRequestId,
    providerOutputId: input.providerOutputId,
    noveltyDecision: input.noveltyDecision,
    similarityScore: input.similarityScore,
    createdAt: input.createdAt ?? new Date().toISOString(),
    slotBlueprintId: input.slotBlueprintId,
    generationRunId: input.generationRunId,
    slotExhausted: input.slotExhausted,
  };
}

/** Board: hide candidates superseded by a novelty replacement. */
export function isBoardSupersededByReplacement(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  return settings?.boardSupersededByReplacement === true;
}
