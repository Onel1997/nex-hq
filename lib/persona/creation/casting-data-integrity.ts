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

const COMPLETED_GENERATION_RUN_STATUSES = new Set([
  "completed",
  "partially_completed",
]);

function isNoveltyReplacementJob(job: {
  confirmation_payload?: Record<string, unknown> | null;
}): boolean {
  const payload = job.confirmation_payload;
  if (!payload || typeof payload !== "object") return false;
  return (
    payload.noveltyReplacement === true ||
    payload.intent === "novelty_replacement"
  );
}

/**
 * Latest executed generation run for a project.
 * Ignores newer pending_confirmation / queued jobs created by prepare_confirmation.
 * Phase 2.1E — also ignores single-slot novelty replacement jobs so the board
 * stays scoped to the original discovery run.
 */
export function resolveCurrentGenerationRunId(
  jobs: Array<
    Pick<PersonaGenerationJob, "id" | "status" | "created_at"> & {
      confirmation_payload?: Record<string, unknown> | null;
    }
  >,
): string | null {
  const completed = jobs
    .filter(
      (j) =>
        COMPLETED_GENERATION_RUN_STATUSES.has(j.status) &&
        !isNoveltyReplacementJob(j),
    )
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return completed[0]?.id ?? null;
}

export function resolveCurrentGenerationRun(
  jobs: PersonaGenerationJob[],
): PersonaGenerationJob | null {
  const id = resolveCurrentGenerationRunId(jobs);
  if (!id) return null;
  return jobs.find((j) => j.id === id) ?? null;
}

/** Board freshness — only candidates produced by the current generation run. */
export function filterCandidatesForGenerationRun(
  candidates: PersonaCandidate[],
  generationRunId: string,
): PersonaCandidate[] {
  return candidates.filter((c) => {
    if (c.provider_job_id !== generationRunId) return false;
    // Phase 2.2E — superseded retry parents stay in history, not on the board.
    if (c.generation_settings?.boardSupersededByReplacement === true) {
      return false;
    }
    return true;
  });
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

export const DISCOVERY_NO_NEW_CANDIDATES_MESSAGE =
  "Discovery generation did not create new project-owned candidates.";

/** Preview map key — never candidate_number / variation alone. */
export function projectScopedPreviewKey(
  creationProjectId: string,
  candidateId: string,
  assetId: string,
): string {
  return `${creationProjectId}:${candidateId}:${assetId}`;
}

export function appendAssetCacheBust(url: string, assetId: string): string {
  if (!url || !assetId) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}asset=${encodeURIComponent(assetId)}`;
}

export function storagePathContainsProjectId(
  storagePath: string,
  creationProjectId: string,
): boolean {
  if (!storagePath || !creationProjectId) return false;
  return (
    storagePath.includes(`/${creationProjectId}/`) ||
    storagePath.includes(`persona-creation/${creationProjectId}/`)
  );
}

export type CandidateRenderForensics = {
  activeCreationProjectId: string | null;
  candidateId: string;
  candidateCreationProjectId: string;
  candidateNumber: number;
  assetId: string | null;
  assetCreationProjectId: string | null;
  assetStoragePath: string | null;
  assetPublicUrl: string | null;
  createdAt: string | null;
  generationJobId: string | null;
  generationSource: string | null;
};

export function logCandidateRenderForensics(
  stage: string,
  rows: CandidateRenderForensics[],
): void {
  if (process.env.NODE_ENV === "production") return;
  if (typeof console === "undefined") return;
  for (const row of rows) {
    console.info(`[persona-casting-forensics] ${stage}`, row);
  }
}

export function validateProjectCandidateBoardState(input: {
  activeCreationProjectId: string | null;
  stateProjectId: string | null;
  candidates: PersonaCandidate[];
  assets?: Array<
    Pick<PersonaCandidateAsset, "id" | "candidate_id" | "storage_path">
  >;
  generationRunProjectId?: string | null;
}): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const active = input.activeCreationProjectId;
  if (!active) {
    reasons.push("No active creation project");
    return { ok: false, reasons };
  }
  if (input.stateProjectId !== active) {
    reasons.push(
      `State project ${input.stateProjectId ?? "null"} !== active ${active}`,
    );
  }
  for (const c of input.candidates) {
    if (c.creation_project_id !== active) {
      reasons.push(`Candidate ${c.id} belongs to ${c.creation_project_id}`);
    }
  }
  if (input.assets) {
    const candidateIds = new Set(input.candidates.map((c) => c.id));
    for (const asset of input.assets) {
      if (!candidateIds.has(asset.candidate_id)) {
        reasons.push(`Asset ${asset.id} candidate mismatch`);
      }
      if (
        !storagePathContainsProjectId(asset.storage_path, active) &&
        !asset.storage_path.includes(asset.id)
      ) {
        reasons.push(`Asset ${asset.id} storage path not project-scoped`);
      }
    }
  }
  if (
    input.generationRunProjectId != null &&
    input.generationRunProjectId !== active
  ) {
    reasons.push("Generation run does not belong to active project");
  }
  return { ok: reasons.length === 0, reasons };
}

export function validateA1DiscoveryCompletion(input: {
  projectId: string;
  candidates: PersonaCandidate[];
  jobs: PersonaGenerationJob[];
  expectedCount: number;
  generationSource?: GenerationSource;
  requireProviderExecution?: boolean;
  generationStartedAt?: string | null;
  assets?: PersonaCandidateAsset[];
  priorCandidateIds?: string[];
  priorAssetIds?: string[];
  priorStoragePaths?: string[];
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

  if (input.generationStartedAt && input.assets) {
    const startedMs = Date.parse(input.generationStartedAt);
    const candidateIds = new Set(projectCandidates.map((c) => c.id));
    for (const asset of input.assets) {
      if (!candidateIds.has(asset.candidate_id)) continue;
      if (asset.asset_type !== "portrait_front") continue;
      const createdMs = Date.parse(asset.created_at);
      if (!Number.isNaN(startedMs) && !Number.isNaN(createdMs) && createdMs < startedMs - 2000) {
        reasons.push(
          `Asset ${asset.id} createdAt predates generation startedAt`,
        );
      }
    }
  }

  const priorCandidateIds = new Set(input.priorCandidateIds ?? []);
  for (const candidate of projectCandidates) {
    if (priorCandidateIds.has(candidate.id)) {
      reasons.push(`Candidate ID reused from a prior run: ${candidate.id}`);
    }
  }

  if (input.assets) {
    const candidateIds = new Set(projectCandidates.map((c) => c.id));
    const portraitAssets = input.assets.filter(
      (a) =>
        candidateIds.has(a.candidate_id) && a.asset_type === "portrait_front",
    );
    if (portraitAssets.length < input.expectedCount) {
      reasons.push(
        `Expected ${input.expectedCount} portrait assets, found ${portraitAssets.length}`,
      );
    }
    const priorAssetIds = new Set(input.priorAssetIds ?? []);
    const priorPaths = new Set(input.priorStoragePaths ?? []);
    const seenPaths = new Set<string>();
    for (const asset of portraitAssets) {
      if (priorAssetIds.has(asset.id)) {
        reasons.push(`Asset ID reused from a prior run: ${asset.id}`);
      }
      if (priorPaths.has(asset.storage_path)) {
        reasons.push(`Storage path reused from a prior run: ${asset.storage_path}`);
      }
      if (seenPaths.has(asset.storage_path)) {
        reasons.push(`Duplicate storage path in run: ${asset.storage_path}`);
      }
      seenPaths.add(asset.storage_path);
      if (!storagePathContainsProjectId(asset.storage_path, input.projectId)) {
        reasons.push(
          `Storage path missing creationProjectId: ${asset.storage_path}`,
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
