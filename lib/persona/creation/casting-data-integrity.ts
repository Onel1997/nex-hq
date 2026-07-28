/**
 * Phase 1.8C — Casting data integrity (project isolation, provider source, validation).
 * No creative direction changes — runtime safety only.
 */

import { PersonaDomainError } from "../domain/errors";
import type {
  PersonaCandidate,
  PersonaCandidateAsset,
  PersonaGenerationJob,
} from "../domain/creation-types";
import { STAGE_A1_DISCOVERY_ASSET_TYPES } from "./casting-funnel";
import { isAutomatedTestEnvironment } from "./paid-generation-guard";

export type GenerationSource =
  | "openai_live"
  | "manual_upload"
  | "fake_test"
  | "fixture_test"
  | "unknown";

export type CastingFlowTracePayload = {
  selectionProjectId?: string | null;
  creationProjectId: string;
  archetypeId?: string | null;
  workspaceId?: string | null;
  provider?: string | null;
  generationRequestId?: string | null;
  candidateIds?: string[];
  assetIds?: string[];
  createdAt?: string[];
  source?: GenerationSource | "live_openai" | "cached" | "old_project";
};

const LIVE_CASTING_FAKE_PROVIDER_MESSAGE =
  "Test candidate provider was invoked in a live casting workflow.";

export function projectScopedCandidatesCacheKey(
  workspaceId: string,
  creationProjectId: string,
): string {
  return `persona-candidates:${workspaceId}:${creationProjectId}`;
}

export function resolveGenerationSource(
  provider: string | null | undefined,
  settings?: Record<string, unknown> | null,
): GenerationSource {
  const normalized = (provider ?? "").toLowerCase();
  const meta = settings ?? {};
  if (meta.fake === true || normalized === "fake") return "fake_test";
  if (meta.fixture === true || normalized === "fixture") return "fixture_test";
  if (normalized === "openai") return "openai_live";
  if (normalized === "manual_upload" || normalized === "manual") {
    return "manual_upload";
  }
  return "unknown";
}

export function assertLiveCastingGenerationSource(
  source: GenerationSource,
  context: { allowTestSources?: boolean } = {},
): void {
  if (context.allowTestSources) return;
  if (isAutomatedTestEnvironment()) return;
  if (source === "fake_test" || source === "fixture_test") {
    throw new PersonaDomainError(LIVE_CASTING_FAKE_PROVIDER_MESSAGE, "WORKFLOW", {
      generationSource: source,
    });
  }
}

export function assertLiveCastingProviderNotFake(
  generatorId: string,
  context: { liveUiAttestation?: boolean } = {},
): void {
  if (generatorId !== "fake") return;
  if (isAutomatedTestEnvironment()) return;
  if (context.liveUiAttestation !== false) {
    throw new PersonaDomainError(LIVE_CASTING_FAKE_PROVIDER_MESSAGE, "WORKFLOW", {
      generationSource: "fake_test",
      generatorId,
    });
  }
}

export function filterCandidatesForProject(
  candidates: PersonaCandidate[],
  creationProjectId: string,
): PersonaCandidate[] {
  return candidates.filter((c) => c.creation_project_id === creationProjectId);
}

export function assertCandidatesBelongToProject(
  candidates: PersonaCandidate[],
  creationProjectId: string,
): void {
  const mismatched = candidates.filter(
    (c) => c.creation_project_id !== creationProjectId,
  );
  if (mismatched.length === 0) return;
  throw new PersonaDomainError(
    "Kandidaten gehören nicht zum angeforderten Creation-Projekt.",
    "WORKFLOW",
    {
      requestedProjectId: creationProjectId,
      mismatchedCandidateIds: mismatched.map((c) => c.id),
      mismatchedProjectIds: [...new Set(mismatched.map((c) => c.creation_project_id))],
    },
  );
}

export function assertAssetsBelongToCandidateProject(
  assets: PersonaCandidateAsset[],
  candidate: Pick<PersonaCandidate, "id" | "creation_project_id">,
  creationProjectId: string,
): void {
  if (candidate.creation_project_id !== creationProjectId) {
    throw new PersonaDomainError(
      "Kandidat gehört nicht zum aktiven Creation-Projekt.",
      "WORKFLOW",
      {
        requestedProjectId: creationProjectId,
        candidateId: candidate.id,
        candidateProjectId: candidate.creation_project_id,
      },
    );
  }
  const mismatched = assets.filter((a) => a.candidate_id !== candidate.id);
  if (mismatched.length === 0) return;
  throw new PersonaDomainError(
    "Assets gehören nicht zum angeforderten Kandidaten.",
    "WORKFLOW",
    {
      candidateId: candidate.id,
      creationProjectId,
      mismatchedAssetIds: mismatched.map((a) => a.id),
    },
  );
}

export type DiscoveryCompletionVerdict = {
  complete: boolean;
  reasons: string[];
};

export function validateA1DiscoveryCompletion(input: {
  projectId: string;
  candidates: PersonaCandidate[];
  jobs: PersonaGenerationJob[];
  expectedCount: number;
  generationSource?: GenerationSource;
  requireProviderExecution?: boolean;
}): DiscoveryCompletionVerdict {
  const reasons: string[] = [];
  const projectCandidates = filterCandidatesForProject(
    input.candidates,
    input.projectId,
  );

  if (projectCandidates.length !== input.expectedCount) {
    reasons.push(
      `Expected ${input.expectedCount} candidates for project, found ${projectCandidates.length}`,
    );
  }

  for (const candidate of projectCandidates) {
    if (candidate.creation_project_id !== input.projectId) {
      reasons.push(`Candidate ${candidate.id} belongs to another project`);
    }
  }

  const completedJobs = input.jobs.filter(
    (j) =>
      j.creation_project_id === input.projectId &&
      (j.status === "completed" || j.status === "partially_completed"),
  );

  if (input.requireProviderExecution !== false && completedJobs.length === 0) {
    reasons.push("No provider execution record for this project");
  }

  if (
    input.generationSource &&
    (input.generationSource === "fake_test" ||
      input.generationSource === "fixture_test") &&
    !isAutomatedTestEnvironment()
  ) {
    reasons.push(`Invalid generation source for live workflow: ${input.generationSource}`);
  }

  const requiredPortrait = STAGE_A1_DISCOVERY_ASSET_TYPES.includes("portrait_front");
  if (requiredPortrait) {
    for (const candidate of projectCandidates) {
      if (!candidate.primary_preview_asset_id && candidate.status !== "queued") {
        reasons.push(
          `Candidate ${candidate.id} missing portrait_front primary asset`,
        );
      }
    }
  }

  return { complete: reasons.length === 0, reasons };
}

export function assertUniqueDiscoveryRunIds(input: {
  runA: { selectionProjectId: string; creationProjectId: string; candidateIds: string[] };
  runB: { selectionProjectId: string; creationProjectId: string; candidateIds: string[] };
}): void {
  if (input.runA.selectionProjectId === input.runB.selectionProjectId) {
    throw new PersonaDomainError(
      "Discovery runs reused selection project IDs.",
      "WORKFLOW",
    );
  }
  if (input.runA.creationProjectId === input.runB.creationProjectId) {
    throw new PersonaDomainError(
      "Discovery runs reused creation project IDs.",
      "WORKFLOW",
    );
  }
  for (const id of input.runB.candidateIds) {
    if (input.runA.candidateIds.includes(id)) {
      throw new PersonaDomainError(
        "Discovery runs reused candidate IDs — data integrity violation.",
        "WORKFLOW",
        { reusedCandidateId: id },
      );
    }
  }
}

/** Safe structured trace — never log API keys or full prompts. */
export function logCastingFlowTrace(
  stage: string,
  payload: CastingFlowTracePayload,
): void {
  if (typeof console === "undefined") return;
  console.info(`[persona-casting] ${stage}`, {
    selectionProjectId: payload.selectionProjectId ?? null,
    creationProjectId: payload.creationProjectId,
    archetypeId: payload.archetypeId ?? null,
    workspaceId: payload.workspaceId ?? null,
    provider: payload.provider ?? null,
    generationRequestId: payload.generationRequestId ?? null,
    candidateIds: payload.candidateIds ?? [],
    assetIds: payload.assetIds ?? [],
    createdAt: payload.createdAt ?? [],
    source: payload.source ?? null,
  });
}
