/**
 * Phase 2.5B.8 — Urban face freshness score (post-generation, advisory only).
 *
 * Compares a new discovery face embedding against recent unprotected Urban
 * discovery faces (last N projects). Separate from novelty PASS/WARNING/
 * HARD_DUPLICATE — never blocks or auto-regenerates.
 * No provider calls.
 */

import { euclideanDistance } from "@/lib/persona/face-novelty-memory/similarity-threshold";
import {
  filterDiscoveryOnlyFaceSamples,
  URBAN_RECENT_PROJECTS_FOR_FACE_BIAS,
  type UrbanFaceEmbeddingSample,
} from "./urban-fresh-face-dna";

export const URBAN_FACE_FRESHNESS_VERSION = "2.5B.8" as const;

/** Distance at which freshness score saturates at 100. */
export const URBAN_FACE_FRESHNESS_DISTANCE_SATURATION = 0.8;

export type UrbanFaceFreshnessClassification =
  | "VERY_FRESH"
  | "FRESH"
  | "FAMILIAR"
  | "VERY_FAMILIAR";

export type UrbanFaceFreshnessResult = {
  version: typeof URBAN_FACE_FRESHNESS_VERSION;
  faceFreshnessScore: number;
  classification: UrbanFaceFreshnessClassification;
  label: string;
  closestRecentCandidateId: string | null;
  closestDistance: number | null;
  projectsCompared: string[];
  samplesCompared: number;
};

/**
 * Map Euclidean face distance → 0–100 freshness (higher = more distinct).
 */
export function faceFreshnessScoreFromDistance(
  distance: number | null | undefined,
): number {
  if (distance == null || !Number.isFinite(distance)) {
    // No recent peers → treat as maximally fresh.
    return 100;
  }
  const clamped = Math.max(0, distance);
  const score = Math.round(
    (clamped / URBAN_FACE_FRESHNESS_DISTANCE_SATURATION) * 100,
  );
  return Math.max(0, Math.min(100, score));
}

export function classifyFaceFreshnessScore(
  score: number,
): UrbanFaceFreshnessClassification {
  if (score >= 80) return "VERY_FRESH";
  if (score >= 60) return "FRESH";
  if (score >= 40) return "FAMILIAR";
  return "VERY_FAMILIAR";
}

export function formatFaceFreshnessLabel(
  score: number,
  classification: UrbanFaceFreshnessClassification,
): string {
  const pretty =
    classification === "VERY_FRESH"
      ? "Very Fresh"
      : classification === "VERY_FAMILIAR"
        ? "Very Familiar"
        : classification.charAt(0) + classification.slice(1).toLowerCase();
  return `Face Freshness: ${score} / 100 · ${pretty}`;
}

/**
 * Compute advisory face freshness vs recent unprotected Urban discovery faces.
 * Does not change novelty thresholds or selection eligibility.
 */
export function computeUrbanFaceFreshness(input: {
  candidateEmbedding: number[] | null | undefined;
  recentFaceSamples: readonly UrbanFaceEmbeddingSample[] | null | undefined;
  currentCreationProjectId: string;
  recentProjectLimit?: number;
}): UrbanFaceFreshnessResult {
  const discoveryOnly = filterDiscoveryOnlyFaceSamples(
    input.recentFaceSamples ?? [],
    input.currentCreationProjectId,
  );

  // Prefer last N projects (same window as 2.5B.6 cluster bias).
  const limit = input.recentProjectLimit ?? URBAN_RECENT_PROJECTS_FOR_FACE_BIAS;
  const latestByProject = new Map<string, number>();
  for (const s of discoveryOnly) {
    const ts = s.createdAt ? Date.parse(s.createdAt) : 0;
    const prev = latestByProject.get(s.creationProjectId) ?? -1;
    if (Number.isFinite(ts) && ts > prev) {
      latestByProject.set(s.creationProjectId, ts);
    } else if (!latestByProject.has(s.creationProjectId)) {
      latestByProject.set(s.creationProjectId, 0);
    }
  }
  const recentProjectIds = [...latestByProject.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id]) => id);
  const recentSet = new Set(recentProjectIds);
  const peers = discoveryOnly.filter((s) =>
    recentSet.has(s.creationProjectId),
  );

  const embedding = input.candidateEmbedding;
  let closestDistance: number | null = null;
  let closestRecentCandidateId: string | null = null;

  if (
    Array.isArray(embedding) &&
    embedding.length > 0 &&
    peers.length > 0
  ) {
    for (const peer of peers) {
      const dist = euclideanDistance(embedding, peer.embedding);
      if (!Number.isFinite(dist)) continue;
      if (closestDistance == null || dist < closestDistance) {
        closestDistance = dist;
        closestRecentCandidateId = peer.candidateId || null;
      }
    }
  }

  const faceFreshnessScore = faceFreshnessScoreFromDistance(closestDistance);
  const classification = classifyFaceFreshnessScore(faceFreshnessScore);

  return {
    version: URBAN_FACE_FRESHNESS_VERSION,
    faceFreshnessScore,
    classification,
    label: formatFaceFreshnessLabel(faceFreshnessScore, classification),
    closestRecentCandidateId,
    closestDistance,
    projectsCompared: recentProjectIds,
    samplesCompared: peers.length,
  };
}

/** Familiar / very familiar faces remain selectable — never a hard block. */
export function faceFreshnessBlocksSelection(
  _result: UrbanFaceFreshnessResult | null | undefined,
): boolean {
  return false;
}
