/**
 * Phase 2.2A.1 — Live A1 Discovery Completion Orchestrator.
 *
 * Wires runDiscoveryCompletion into Official Brand Face A1 confirm path
 * when discovery provider is fal_flux. OpenAI path stays on createCandidateBatch.
 *
 * No paid calls in unit tests — inject FakeBrandFaceDiscoveryProvider + testMode.
 */

import { randomUUID } from "node:crypto";
import type { WorkspaceScope } from "../../domain/types";
import type { PersonaCreationProject } from "../../domain/creation-types";
import { PersonaDomainError } from "../../domain/errors";
import {
  type DiscoveryIdentityInstance,
  type DiscoverySlot,
} from "@/lib/persona/identity-blueprints";
import {
  buildCandidatePrompt,
  composeProviderPrompt,
  resolveOfficialDiscoveryVariations,
  resolveCandidateVariation,
} from "../candidate-intelligence";
import { assertObfCastAnatomyDiversity } from "../candidate-intelligence/obf-l3-integration";
import { attachUrbanFaceFreshnessToSettings } from "../candidate-intelligence/attach-urban-face-freshness";
import {
  checkAndRegisterCandidate,
  loadDiscoveryHistory,
  markCandidateShown,
  MemoryNoveltyRepository,
  SupabaseNoveltyRepository,
  SupabaseEmbeddingRepository,
} from "../../face-novelty-memory";
import {
  buildLiveFaceEvaluator,
  assertLiveFaceEvaluatorNotNull,
} from "../../face-novelty-memory/live-evaluator";
import { MemoryLiveDiagnosticStore } from "../../face-novelty-memory/diagnostic-store";
import { SupabaseLiveDiagnosticStore } from "../../face-novelty-memory/supabase-diagnostic-store";
import { resolveMatchedSameRunSlot } from "../novelty-replacement";
import {
  uploadPersonaCandidateBytes,
  buildPersonaCandidateAssetMetadata,
} from "../candidate-storage";
import { getCreationRepository } from "../creation-factory";
import type { BrandFaceDiscoveryProvider } from "../provider/brand-face-discovery-provider";
import { getBrandFaceDiscoveryProvider } from "../provider/discovery-provider-registry";
import {
  assertDiscoveryProviderConfiguredForPaid,
  DEFAULT_DISCOVERY_ATTEMPTS_PER_SLOT,
  type DiscoveryProviderId,
} from "../provider/discovery-provider-config";
import { validatePreProviderCrossSlotDiversity } from "./preflight-diversity";
import {
  buildDiscoveryCompletionBudget,
  type DiscoveryCompletionBudget,
} from "./completion-budget";
import {
  runDiscoveryCompletion,
  type CompletionEngineDeps,
  type RunDiscoveryCompletionResult,
  type SlotPlan,
} from "./completion-engine";
import { MemoryDiscoveryAttemptRepository } from "./attempt-repository";
import { SupabaseDiscoveryAttemptRepository } from "./supabase-attempt-repository";
import type { DiscoveryAttemptRepository } from "./attempt-types";
import { selectDiscoveryCandidate } from "./selection-handoff";

const SLOT_TO_NUMBER: Record<DiscoverySlot, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

export type DiscoveryProgressSlot = {
  slot: DiscoverySlot;
  label: string;
  status: "pending" | "checking" | "accepted" | "generating" | "blocked" | "failed";
  attempt: number;
  maxAttempts: number;
};

export type DiscoveryProgressSnapshot = {
  headline: string;
  readyCount: number;
  totalSlots: number;
  slots: DiscoveryProgressSlot[];
  runState: string;
};

export function buildDiscoveryProgressSnapshot(input: {
  attempts: Array<{ slot: DiscoverySlot; attemptNumber: number; status: string }>;
  maxAttemptsPerSlot: number;
  runState: string;
}): DiscoveryProgressSnapshot {
  const slots: DiscoverySlot[] = ["A", "B", "C", "D"];
  const progressSlots: DiscoveryProgressSlot[] = slots.map((slot) => {
    const slotAttempts = input.attempts
      .filter((a) => a.slot === slot)
      .sort((a, b) => b.attemptNumber - a.attemptNumber);
    const latest = slotAttempts[0];
    const attempt = latest?.attemptNumber ?? 0;
    let status: DiscoveryProgressSlot["status"] = "pending";
    if (!latest) status = "pending";
    else if (latest.status === "allowed") status = "accepted";
    else if (latest.status === "blocked" || latest.status === "superseded")
      status = attempt < input.maxAttemptsPerSlot ? "generating" : "blocked";
    else if (latest.status === "generating") status = "generating";
    else if (latest.status === "evaluating") status = "checking";
    else if (latest.status === "failed" || latest.status === "timeout") status = "failed";
    else status = "checking";

    const label =
      status === "accepted"
        ? `${slot} — accepted`
        : status === "checking"
          ? `${slot} — checking`
          : status === "generating"
            ? `${slot} — generating attempt ${Math.max(1, attempt)}/${input.maxAttemptsPerSlot}`
            : status === "blocked"
              ? `${slot} — exhausted`
              : status === "failed"
                ? `${slot} — failed`
                : `${slot} — pending`;

    return {
      slot,
      label,
      status,
      attempt: Math.max(1, attempt || 1),
      maxAttempts: input.maxAttemptsPerSlot,
    };
  });

  return {
    headline: "Finding 4 distinct Brand Faces",
    readyCount: progressSlots.filter((s) => s.status === "accepted").length,
    totalSlots: 4,
    slots: progressSlots,
    runState: input.runState,
  };
}

export function shouldUseDiscoveryCompletionEngine(input: {
  castingPhase: string;
  officialBrandFace: boolean;
  providerId: string;
}): boolean {
  return (
    input.castingPhase === "a1_discovery" &&
    input.officialBrandFace &&
    input.providerId === "fal_flux"
  );
}

export type LiveA1CompletionInput = {
  scope: WorkspaceScope;
  project: PersonaCreationProject;
  generationRunId: string;
  budget: DiscoveryCompletionBudget;
  maxBudgetConfirmed: boolean;
  resume?: boolean;
  provider?: BrandFaceDiscoveryProvider;
  attemptRepo?: DiscoveryAttemptRepository;
  creationRepoKind?: "memory" | "supabase";
  evaluateNovelty?: CompletionEngineDeps["evaluateNovelty"];
  planSlotAttempt?: CompletionEngineDeps["planSlotAttempt"];
  persistCandidate?: CompletionEngineDeps["persistCandidate"];
  /** Unit tests: skip live evaluator; require evaluateNovelty inject. */
  testMode?: boolean;
};

export type LiveA1CompletionResult = RunDiscoveryCompletionResult & {
  progress: DiscoveryProgressSnapshot;
  providerId: DiscoveryProviderId;
  actualCostEur: number;
  invokedCompletionEngine: true;
};

async function planSlotAttemptForProject(input: {
  project: PersonaCreationProject;
  generationRunId: string;
  slot: DiscoverySlot;
  attemptNumber: number;
  previousIdentity?: DiscoveryIdentityInstance | null;
}): Promise<SlotPlan> {
  const candidateNumber = SLOT_TO_NUMBER[input.slot];
  const official = resolveOfficialDiscoveryVariations({
    project: input.project,
    candidateNumbers: [candidateNumber],
  });
  if (!official.officialBrandFace) {
    throw new PersonaDomainError(
      "Discovery completion engine requires Official Brand Face project.",
      "VALIDATION",
    );
  }
  const variation =
    official.variations[0] ?? resolveCandidateVariation(candidateNumber);
  const previousSample = input.previousIdentity
    ? {
        faceGeometry: input.previousIdentity.faceGeometry,
        jaw: input.previousIdentity.jaw,
        eyeShape: input.previousIdentity.eyeShape,
        eyeSpacing: input.previousIdentity.eyeSpacing,
        noseBridge: input.previousIdentity.noseBridge,
        noseWidth: input.previousIdentity.noseWidth,
        noseTip: input.previousIdentity.noseTip,
        chin: input.previousIdentity.chin,
        hairline: input.previousIdentity.hairline,
        haircut: input.previousIdentity.haircut,
        beardPattern: input.previousIdentity.beardPattern,
      }
    : null;

  const built = buildCandidatePrompt({
    project: input.project,
    assetType: "portrait_front",
    candidateNumber,
    variation,
    discoveryBlueprint: official.blueprints[0],
    generationRunId: input.generationRunId,
    attemptNumber: input.attemptNumber,
    previousAttemptSample: previousSample,
  });
  if (!built.discoveryIdentityInstance) {
    throw new PersonaDomainError(
      "Missing L3 DiscoveryIdentityInstance for completion engine.",
      "CONFIG",
    );
  }
  return {
    slot: input.slot,
    attemptNumber: input.attemptNumber,
    identity: built.discoveryIdentityInstance,
    prompt: composeProviderPrompt(built),
    negativePrompt: built.negativePrompt,
  };
}

export async function runOfficialBrandFaceA1DiscoveryCompletion(
  input: LiveA1CompletionInput,
): Promise<LiveA1CompletionResult> {
  if (!input.maxBudgetConfirmed) {
    throw new PersonaDomainError(
      "Maximum discovery budget must be confirmed before provider calls.",
      "VALIDATION",
      { code: "discovery_max_budget_not_confirmed" },
    );
  }

  const providerId = input.budget.providerId;
  if (providerId === "fal_flux" && !input.testMode) {
    assertDiscoveryProviderConfiguredForPaid("fal_flux");
  }

  const provider = input.provider ?? getBrandFaceDiscoveryProvider(providerId);
  const repoKind =
    input.creationRepoKind ??
    (getCreationRepository().kind === "memory" ? "memory" : "supabase");
  const attemptRepo =
    input.attemptRepo ??
    (repoKind === "memory"
      ? new MemoryDiscoveryAttemptRepository()
      : new SupabaseDiscoveryAttemptRepository());
  const creationRepo = getCreationRepository();

  const official = resolveOfficialDiscoveryVariations({
    project: input.project,
    candidateNumbers: [1, 2, 3, 4],
  });
  if (!official.officialBrandFace || !official.archetype) {
    throw new PersonaDomainError(
      "Official Brand Face archetype required for discovery completion.",
      "VALIDATION",
    );
  }
  const archetypeId = official.archetype.id;

  const planSlotAttempt: CompletionEngineDeps["planSlotAttempt"] =
    input.planSlotAttempt ??
    (async ({ slot, attemptNumber, previousIdentity }) =>
      planSlotAttemptForProject({
        project: input.project,
        generationRunId: input.generationRunId,
        slot,
        attemptNumber,
        previousIdentity,
      }));

  // Phase 2.2E — every attempt (including attempt 1) uses the same L3 planner.
  const initialPlans: SlotPlan[] = [];
  for (const slot of ["A", "B", "C", "D"] as DiscoverySlot[]) {
    initialPlans.push(
      await planSlotAttempt({
        slot,
        attemptNumber: 1,
        previousIdentity: null,
      }),
    );
  }
  assertObfCastAnatomyDiversity(initialPlans.map((p) => p.identity));
  const pre = validatePreProviderCrossSlotDiversity(initialPlans.map((p) => p.identity));
  if (!pre.ok) {
    throw new PersonaDomainError(
      `Pre-provider diversity validation failed: ${pre.issues.map((i) => i.code).join(", ")}`,
      "VALIDATION",
      { issues: pre.issues },
    );
  }

  let evaluateNovelty = input.evaluateNovelty;
  if (!evaluateNovelty) {
    if (input.testMode) {
      throw new PersonaDomainError("testMode requires injected evaluateNovelty", "CONFIG");
    }
    const noveltyRepo =
      repoKind === "memory"
        ? new MemoryNoveltyRepository()
        : new SupabaseNoveltyRepository();
    const embeddingRepo =
      repoKind === "memory" ? null : new SupabaseEmbeddingRepository();
    const diagnosticStore =
      repoKind === "memory"
        ? new MemoryLiveDiagnosticStore()
        : new SupabaseLiveDiagnosticStore();
    let noveltyHistory = await loadDiscoveryHistory(
      noveltyRepo,
      input.scope.workspaceId,
      archetypeId,
    );
    let priorEmbeddingsLoaded = embeddingRepo
      ? (
          await embeddingRepo.loadEmbeddingsForWorkspace(
            input.scope.workspaceId,
            archetypeId,
            { currentCreationProjectId: input.project.id },
          )
        ).length
      : 0;
    let liveEvaluator = await buildLiveFaceEvaluator({
      workspaceId: input.scope.workspaceId,
      archetypeId,
      currentCreationProjectId: input.project.id,
    });
    assertLiveFaceEvaluatorNotNull(
      liveEvaluator,
      `a1_discovery_completion project=${input.project.id}`,
    );

    evaluateNovelty = async ({
      slot,
      attemptNumber: _attemptNumber,
      candidateId,
      assetId,
      identity,
      imageBytes,
    }) => {
      // Phase 2.2E — use the actual sampled L3 identity fingerprint for this
      // attempt. Never rebuild from static blueprint/variation (retries would
      // collide on identity_fingerprint_already_consumed).
      const identityFingerprint = identity.identityFingerprint;
      if (!identityFingerprint.trim()) {
        throw new PersonaDomainError(
          "Missing L3 identityFingerprint for novelty evaluation.",
          "CONFIG",
        );
      }
      const check = await checkAndRegisterCandidate(
        noveltyRepo,
        noveltyHistory,
        {
          workspaceId: input.scope.workspaceId,
          archetypeId,
          creationProjectId: input.project.id,
          candidateId,
          assetId,
          identityFingerprint,
          signedUrl: `data:image/png;base64,${imageBytes.toString("base64")}`,
          sourceProvider: provider.providerName,
          sourceModel: provider.modelName,
        },
        {
          evaluator: liveEvaluator,
          embeddingRepo: embeddingRepo ?? undefined,
          diagnosticStore,
          priorEmbeddingsLoaded,
          slot: SLOT_TO_NUMBER[slot],
          evaluatorActive: true,
          // Each paid attempt must persist a fresh embedding even if a prior
          // novelty row for this candidate_id somehow still exists.
          forceFreshEmbedding: true,
        },
      );
      noveltyHistory = await loadDiscoveryHistory(
        noveltyRepo,
        input.scope.workspaceId,
        archetypeId,
      );
      if (embeddingRepo) {
        priorEmbeddingsLoaded = (
          await embeddingRepo.loadEmbeddingsForWorkspace(
            input.scope.workspaceId,
            archetypeId,
            { currentCreationProjectId: input.project.id },
          )
        ).length;
      }
      const decision =
        check.candidateStatus === "ready" || check.finalDecision === "allowed"
          ? "allowed"
          : check.candidateStatus === "novelty_blocked" ||
              check.finalDecision === "blocked"
            ? "blocked"
            : "failed";
      const existingCand = await creationRepo.getCandidate(
        input.scope,
        candidateId,
      );
      const { settings: settingsWithFreshness } =
        await attachUrbanFaceFreshnessToSettings({
          settings: {
            ...(existingCand?.generation_settings ?? {}),
            discoveryNovelty: {
              classification:
                check.hardRejectReason === "face_similarity_duplicate"
                  ? "HARD_DUPLICATE"
                  : check.softWarningReason === "face_similarity_warning"
                    ? "WARNING"
                    : "PASS",
              closestPriorCandidateId: check.closestPriorCandidateId ?? null,
              distance: check.euclideanDistance ?? null,
            },
          },
          workspaceId: input.scope.workspaceId,
          creationProjectId: input.project.id,
          candidateId,
          archetypeId,
          archetypeSlug:
            archetypeId === "arch-urban-community-hero"
              ? "urban-community-hero"
              : null,
        });
      await creationRepo.updateCandidate(input.scope, candidateId, {
        status:
          decision === "allowed"
            ? "ready"
            : decision === "blocked"
              ? "novelty_blocked"
              : "novelty_failed",
        rejection_reason:
          decision === "allowed"
            ? ""
            : check.hardRejectReason ?? String(check.finalDecision),
        generation_settings: settingsWithFreshness,
      });
      if (decision === "allowed") {
        const record = await noveltyRepo.findByCandidateId(
          candidateId,
          input.scope.workspaceId,
        );
        if (record) {
          await markCandidateShown(noveltyRepo, record.id, input.scope.workspaceId);
        }
        // Phase 2.2G — rebuild evaluator so later slots see same-run allowed faces.
        if (embeddingRepo) {
          const imgMap = new Map<string, string>();
          imgMap.set(assetId, `data:image/png;base64,${imageBytes.toString("base64")}`);
          liveEvaluator = await buildLiveFaceEvaluator({
            workspaceId: input.scope.workspaceId,
            archetypeId,
            currentCreationProjectId: input.project.id,
            imageSourceMap: imgMap,
          });
          priorEmbeddingsLoaded = (
            await embeddingRepo.loadEmbeddingsForWorkspace(
              input.scope.workspaceId,
              archetypeId,
              { currentCreationProjectId: input.project.id },
            )
          ).length;
        }
      }

      let matchedProjectId: string | null = null;
      const matchedCandidateId =
        check.liveDebug?.closestPriorCandidateId ??
        check.closestPriorCandidateId ??
        null;
      if (matchedCandidateId) {
        const matched = await creationRepo.getCandidate(
          input.scope,
          matchedCandidateId,
        );
        matchedProjectId = matched?.creation_project_id ?? null;
      }
      const { matchedSameRun } = resolveMatchedSameRunSlot({
        matchedCandidateId,
        matchedProjectId,
        currentProjectId: input.project.id,
        matchedCandidateNumber: null,
      });

      return {
        decision,
        reason: check.hardRejectReason ?? String(check.finalDecision),
        highestSimilarity:
          check.similarity ?? check.liveDebug?.similarity ?? null,
        matchedCandidateId,
        embeddingStatus: check.embeddingStatus ?? null,
        euclideanDistance: check.euclideanDistance ?? null,
        matchedProjectId,
        matchedSameRun,
      };
    };
  }

  const persistCandidate: CompletionEngineDeps["persistCandidate"] =
    input.persistCandidate ??
    (async ({ slot, attemptNumber, identity, providerResult }) => {
      const candidateNumber = SLOT_TO_NUMBER[slot];
      // Phase 2.2E.2 — ONE logical candidate per board slot (unique
      // creation_project_id + candidate_number). Retries update that row and
      // attach a new asset; attempt history lives on persona_discovery_attempts.
      const existing = (
        await creationRepo.listCandidates(input.scope, input.project.id)
      ).find((c) => c.candidate_number === candidateNumber);

      const settings = {
        ...(existing?.generation_settings ?? {}),
        provider: providerResult.providerName,
        providerModel: providerResult.providerModel,
        providerSeed: providerResult.providerSeed,
        providerRequestId: providerResult.providerRequestId,
        discoveryAttemptNumber: attemptNumber,
        discoveryIdentity: {
          slot,
          attemptNumber,
          identityFingerprint: identity.identityFingerprint,
          anatomyFingerprint: identity.anatomyFingerprint,
          promptFingerprint: identity.promptFingerprint,
          samplingSeed: identity.samplingSeed,
          discoveryIdentityInstanceId: identity.id,
          generationRunId: input.generationRunId,
        },
        discoveryIdentitySample: identity,
        discoveryCompletionEngine: true,
        // Clear any prior supersede flags — this row remains the slot's candidate.
        boardSupersededByReplacement: undefined,
        replacedByCandidateId: undefined,
      };

      let candidate = existing;
      if (!candidate) {
        candidate = await creationRepo.createCandidate(input.scope, {
          creation_project_id: input.project.id,
          candidate_number: candidateNumber,
          candidate_name: `Candidate ${slot}`,
          status: "generating",
          provider: providerResult.providerName,
          provider_job_id: input.generationRunId,
          generation_seed: String(providerResult.providerSeed),
          generation_prompt: "",
          negative_prompt: "",
          generation_settings: settings,
          identity_summary: `Candidate ${slot}`,
          distinguishing_features: identity.anatomyFingerprint,
          visual_strengths: "",
          visual_risks: "",
          brand_fit_score: null,
          identity_consistency_score: null,
          realism_score: null,
          video_suitability_score: null,
          user_rating: null,
          user_notes: "",
          rejection_reason: "",
          actual_generation_cost: providerResult.estimatedCostEur,
        });
      } else {
        candidate = await creationRepo.updateCandidate(input.scope, candidate.id, {
          status: "generating",
          provider: providerResult.providerName,
          provider_job_id: input.generationRunId,
          generation_seed: String(providerResult.providerSeed),
          generation_settings: settings,
          distinguishing_features: identity.anatomyFingerprint,
          rejection_reason: "",
          actual_generation_cost: Number(
            (
              (candidate.actual_generation_cost ?? 0) +
              providerResult.estimatedCostEur
            ).toFixed(4),
          ),
        });
      }

      // Demote prior primary portrait so the latest attempt asset is primary.
      const priorAssets = await creationRepo.listCandidateAssets(
        input.scope,
        candidate.id,
      );
      for (const prior of priorAssets) {
        if (prior.is_primary) {
          await creationRepo.updateCandidateAsset(input.scope, prior.id, {
            is_primary: false,
          });
        }
      }

      const assetId = randomUUID();
      const uploaded =
        repoKind === "memory"
          ? buildPersonaCandidateAssetMetadata({
              workspaceId: input.scope.workspaceId,
              projectId: input.project.id,
              candidateId: candidate.id,
              assetId,
              filename: `portrait_front-${attemptNumber}.png`,
              bytes: providerResult.imageBytes,
              mimeType: providerResult.mimeType,
            })
          : await uploadPersonaCandidateBytes({
              workspaceId: input.scope.workspaceId,
              projectId: input.project.id,
              candidateId: candidate.id,
              assetId,
              filename: `portrait_front-${attemptNumber}.png`,
              bytes: providerResult.imageBytes,
              mimeType: providerResult.mimeType,
            });
      const asset = await creationRepo.createCandidateAsset(input.scope, {
        candidate_id: candidate.id,
        asset_type: "portrait_front",
        storage_path: uploaded.storagePath,
        mime_type: providerResult.mimeType,
        width: uploaded.width,
        height: uploaded.height,
        file_size_bytes: providerResult.imageBytes.length,
        checksum: uploaded.checksum,
        provider_output_id: providerResult.providerResultId,
        generation_metadata: {
          providerSeed: providerResult.providerSeed,
          providerRequestId: providerResult.providerRequestId,
          attemptNumber,
          slot,
          costLabel: "estimated",
        },
        status: "ready",
        is_primary: true,
      });
      await creationRepo.updateCandidate(input.scope, candidate.id, {
        primary_preview_asset_id: asset.id,
      });
      return { candidateId: candidate.id, assetId: asset.id };
    });

  const result = await runDiscoveryCompletion(
    {
      provider,
      attemptRepo,
      planSlotAttempt,
      persistCandidate,
      evaluateNovelty,
    },
    {
      workspaceId: input.scope.workspaceId,
      creationProjectId: input.project.id,
      generationRunId: input.generationRunId,
      budget: input.budget,
      maxBudgetConfirmed: true,
      initialPlans,
      resume: input.resume === true,
    },
  );

  return {
    ...result,
    progress: buildDiscoveryProgressSnapshot({
      attempts: result.attempts,
      maxAttemptsPerSlot: input.budget.maxAttemptsPerSlot,
      runState: result.runState,
    }),
    providerId,
    actualCostEur: result.ledger.actualProviderCostEur,
    invokedCompletionEngine: true,
  };
}

export function resolveBudgetFromConfirmationPayload(
  payload: Record<string, unknown> | null | undefined,
  fallbackProviderId: DiscoveryProviderId,
  fallbackModel: string,
): DiscoveryCompletionBudget {
  const raw = payload?.discoveryCompletionBudget;
  if (raw && typeof raw === "object") {
    const b = raw as Record<string, unknown>;
    const providerId = (
      typeof b.providerId === "string" ? b.providerId : fallbackProviderId
    ) as DiscoveryProviderId;
    const model = typeof b.model === "string" ? b.model : fallbackModel;
    const maxAttempts =
      typeof b.maxAttemptsPerSlot === "number"
        ? b.maxAttemptsPerSlot
        : DEFAULT_DISCOVERY_ATTEMPTS_PER_SLOT;
    const built = buildDiscoveryCompletionBudget({
      providerId,
      providerModel: model,
      maxAttemptsPerSlot: maxAttempts,
    });
    return {
      ...built,
      estimatedInitialCostEur:
        typeof b.estimatedInitialCostEur === "number"
          ? b.estimatedInitialCostEur
          : built.estimatedInitialCostEur,
      authorizedMaxCostEur:
        typeof b.authorizedMaxCostEur === "number"
          ? b.authorizedMaxCostEur
          : built.authorizedMaxCostEur,
    };
  }
  return buildDiscoveryCompletionBudget({
    providerId: fallbackProviderId,
    providerModel: fallbackModel,
  });
}

export { selectDiscoveryCandidate };
