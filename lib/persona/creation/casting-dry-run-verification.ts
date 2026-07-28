/**
 * Phase 1.8C — Safe dry-run verification for project-scoped candidate isolation.
 * Uses fake provider inside tests / explicit verification only — never OpenAI.
 */

import type { WorkspaceScope } from "../domain/types";
import type { PersonaCandidate } from "../domain/creation-types";
import {
  assertUniqueDiscoveryRunIds,
  filterCandidatesForProject,
} from "./casting-data-integrity";
import {
  confirmAndStartCandidateGeneration,
  createCreationProject,
  listCandidates,
  preparePaidGenerationConfirmation,
} from "./creation-service";
import { UI_CHECKBOX_ATTESTATION } from "./paid-generation-guard";

export type DryRunDiscoveryResult = {
  creationProjectId: string;
  candidateIds: string[];
  candidates: PersonaCandidate[];
};

async function runFakeDiscoveryForProject(
  scope: WorkspaceScope,
  projectName: string,
): Promise<DryRunDiscoveryResult> {
  const project = await createCreationProject(scope, {
    name: projectName,
    description: "dry-run verification",
    gender_presentation: "Male",
    age_range: "24-30",
    height_range: "180 cm",
    body_type: "Lean athletic",
    skin_tone_direction: "Olive",
    face_shape_direction: "Defined",
    hair_direction: "Dark",
    facial_hair_direction: "None",
    eye_direction: "Brown",
    expression_direction: "Calm",
    personality: "Quiet",
    fashion_style: "Street luxury",
    brand_role: "primary_male",
    visual_keywords: "editorial",
    excluded_features: "",
    preferred_brand_looks: "Premium",
    preferred_outfits: "Basics",
    intended_usage: "image_and_video",
    candidate_count: 4,
    provider_mode: "image_provider",
    quality_mode: "premium_editorial",
    additional_description: "",
  });

  const prepared = await preparePaidGenerationConfirmation(scope, project.id, {
    castingPhase: "a1_discovery",
  });
  const token = prepared.confirmation?.confirmation_token;
  if (!token) {
    throw new Error("Dry-run verification requires confirmation token");
  }

  await confirmAndStartCandidateGeneration(scope, project.id, {
    costConfirmed: true,
    confirmationToken: token,
    userConfirmedAt: new Date().toISOString(),
    attestation: UI_CHECKBOX_ATTESTATION,
  });

  const candidates = await listCandidates(scope, project.id);
  return {
    creationProjectId: project.id,
    candidateIds: candidates.map((c) => c.id),
    candidates,
  };
}

/**
 * Proves Run B never displays Run A candidates — fake provider, tests/dev verification only.
 */
export async function verifyDiscoveryProjectIsolation(
  scope: WorkspaceScope,
): Promise<{
  runA: DryRunDiscoveryResult;
  runB: DryRunDiscoveryResult;
  isolated: true;
}> {
  const runA = await runFakeDiscoveryForProject(scope, "Dry Run A");
  const runB = await runFakeDiscoveryForProject(scope, "Dry Run B");

  assertUniqueDiscoveryRunIds({
    runA: {
      selectionProjectId: `dry-a-${runA.creationProjectId}`,
      creationProjectId: runA.creationProjectId,
      candidateIds: runA.candidateIds,
    },
    runB: {
      selectionProjectId: `dry-b-${runB.creationProjectId}`,
      creationProjectId: runB.creationProjectId,
      candidateIds: runB.candidateIds,
    },
  });

  const bOnly = filterCandidatesForProject(runB.candidates, runB.creationProjectId);
  for (const id of runA.candidateIds) {
    if (bOnly.some((c) => c.id === id)) {
      throw new Error(`Run B incorrectly includes Run A candidate ${id}`);
    }
  }

  return { runA, runB, isolated: true };
}
