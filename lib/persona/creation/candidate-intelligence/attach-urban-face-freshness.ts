/**
 * Phase 2.5B.8 — Attach advisory faceFreshness to candidate settings.
 * Soft-fails. Never blocks selection. No provider calls.
 */

import {
  computeUrbanFaceFreshness,
  type UrbanFaceFreshnessResult,
} from "./urban-face-freshness";
import { loadUrbanFreshFaceBiasSamples } from "./urban-fresh-face-bias-loader";
import { loadCandidateFaceEmbedding } from "./urban-face-freshness-loader";

export async function attachUrbanFaceFreshnessToSettings(input: {
  settings: Record<string, unknown>;
  workspaceId: string;
  creationProjectId: string;
  candidateId: string;
  archetypeId?: string | null;
  archetypeSlug?: string | null;
}): Promise<{
  settings: Record<string, unknown>;
  faceFreshness: UrbanFaceFreshnessResult | null;
}> {
  const isUrban =
    input.archetypeSlug === "urban-community-hero" ||
    input.archetypeId === "arch-urban-community-hero";
  if (!isUrban) {
    return { settings: input.settings, faceFreshness: null };
  }

  try {
    const [embedding, recent] = await Promise.all([
      loadCandidateFaceEmbedding({
        workspaceId: input.workspaceId,
        candidateId: input.candidateId,
      }),
      loadUrbanFreshFaceBiasSamples({
        workspaceId: input.workspaceId,
        archetypeId: input.archetypeId ?? "arch-urban-community-hero",
        currentCreationProjectId: input.creationProjectId,
      }),
    ]);

    const faceFreshness = computeUrbanFaceFreshness({
      candidateEmbedding: embedding,
      recentFaceSamples: recent,
      currentCreationProjectId: input.creationProjectId,
    });

    return {
      settings: {
        ...input.settings,
        faceFreshness: {
          score: faceFreshness.faceFreshnessScore,
          classification: faceFreshness.classification,
          label: faceFreshness.label,
          closestRecentCandidateId: faceFreshness.closestRecentCandidateId,
          closestDistance: faceFreshness.closestDistance,
          projectsCompared: faceFreshness.projectsCompared,
          samplesCompared: faceFreshness.samplesCompared,
          version: faceFreshness.version,
        },
      },
      faceFreshness,
    };
  } catch {
    return { settings: input.settings, faceFreshness: null };
  }
}
