import { requirePersonaScope, jsonOk, jsonError, dict } from "../../../_utils";
import { PersonaDomainError } from "@/lib/persona";
import { getCreationProject, getCandidate } from "@/lib/persona/creation/creation-service";
import {
  loadProjectNoveltyLiveDebug,
  runProjectNoveltyPreflight,
} from "@/lib/persona/face-novelty-memory/project-live-debug";
import { retryFaceNoveltyEvaluation } from "@/lib/persona/face-novelty-memory/retry-evaluation";
import {
  loadHistoricalBackfillPreflight,
  loadHistoricalProtectionSnapshot,
  runHistoricalFaceEmbeddingBackfillUntilDone,
  runHistoricalFaceEmbeddingBackfillBatch,
} from "@/lib/persona/face-novelty-memory/historical-backfill-service";
import { evaluateDiscoveryCoverageGate } from "@/lib/persona/face-novelty-memory/discovery-coverage-gate";
import { runFaceNoveltyPreflight } from "@/lib/persona/face-novelty-memory/preflight";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

function resolveArchetypeId(project: {
  brand_role: string;
}): string {
  return project.brand_role || "unknown";
}

/**
 * GET — Face Novelty Live Check + Historical Face Protection (development-only).
 * Phase 2.0C.1: always enabled in development — does not require PERSONA_FACE_NOVELTY_DEBUG.
 * POST action=preflight — Run Face Novelty Preflight (no OpenAI).
 * POST action=retry_evaluation — Re-run face eval on existing image (no OpenAI).
 * POST action=backfill_preflight — Summary before historical embedding backfill.
 * POST action=backfill_historical_embeddings — Run historical backfill (no OpenAI).
 * POST action=discovery_coverage_gate — Evaluate paid discovery coverage gate.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id: projectId } = await ctx.params;

  if (process.env.NODE_ENV === "production") {
    return jsonOk({ enabled: false, reason: "production" as const });
  }

  try {
    const project = await getCreationProject(gate.scope, projectId);
    const archetypeId = resolveArchetypeId(project);
    const debug = await loadProjectNoveltyLiveDebug(
      gate.scope,
      projectId,
      archetypeId,
    );
    return jsonOk(debug);
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id: projectId } = await ctx.params;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      candidateId?: string;
      confirmed?: boolean;
      retryFailedOnly?: boolean;
      resumeJobId?: string;
      processAll?: boolean;
      acknowledgeUnresolvedFailures?: boolean;
      batchSize?: number;
    };

    // Parse action BEFORE the Live Check panel flag gate.
    // Bug (Phase 2.0B.4): gating retry_evaluation on PERSONA_FACE_NOVELTY_DEBUG
    // returned HTTP 200 { enabled:false } and never executed retry — candidate
    // state never changed, no evaluator ran.
    if (body.action === "retry_evaluation") {
      if (process.env.NODE_ENV === "production") {
        throw new PersonaDomainError(
          "Retry Face Evaluation is development-only.",
          "UNAUTHORIZED_WORKSPACE",
        );
      }
      if (typeof body.candidateId !== "string" || !body.candidateId.trim()) {
        throw new PersonaDomainError(
          "candidateId is required for retry_evaluation",
          "VALIDATION",
        );
      }

      console.info("[persona.novelty.retry] 1.retry_request_received", {
        projectId,
        candidateId: body.candidateId,
      });

      const project = await getCreationProject(gate.scope, projectId);
      const candidate = await getCandidate(gate.scope, body.candidateId);
      if (candidate.creation_project_id !== project.id) {
        throw new PersonaDomainError(
          "Candidate does not belong to this creation project.",
          "VALIDATION",
          {
            candidateProjectId: candidate.creation_project_id,
            routeProjectId: projectId,
          },
        );
      }

      const result = await retryFaceNoveltyEvaluation(
        gate.scope,
        body.candidateId,
      );
      return jsonOk({ projectId, ...result });
    }

    if (
      body.action === "backfill_preflight" ||
      body.action === "backfill_historical_embeddings" ||
      body.action === "discovery_coverage_gate"
    ) {
      if (process.env.NODE_ENV === "production") {
        throw new PersonaDomainError(
          "Historical face embedding backfill is development-only.",
          "UNAUTHORIZED_WORKSPACE",
        );
      }

      const project = await getCreationProject(gate.scope, projectId);
      const archetypeId = resolveArchetypeId(project);

      if (body.action === "backfill_preflight") {
        const summary = await loadHistoricalBackfillPreflight(gate.scope, {
          archetypeId,
        });
        return jsonOk({ projectId, archetypeId, ...summary });
      }

      if (body.action === "discovery_coverage_gate") {
        const snapshot = await loadHistoricalProtectionSnapshot(gate.scope, {
          archetypeId,
        });
        const preflight = await runFaceNoveltyPreflight();
        const gateResult = evaluateDiscoveryCoverageGate({
          evaluatorReady:
            preflight.ready &&
            preflight.verdict === "READY FOR CONTROLLED LIVE TEST",
          coverage: snapshot,
          runningBackfillJob:
            snapshot.lastBackfillJob?.status === "running" ||
            snapshot.lastBackfillJob?.status === "pending"
              ? snapshot.lastBackfillJob
              : null,
          acknowledgeUnresolvedFailures: Boolean(
            body.acknowledgeUnresolvedFailures,
          ),
        });
        return jsonOk({
          projectId,
          archetypeId,
          coverage: snapshot,
          gate: gateResult,
        });
      }

      // backfill_historical_embeddings
      if (!body.confirmed) {
        throw new PersonaDomainError(
          "Explicit confirmation is required for historical face embedding backfill.",
          "VALIDATION",
        );
      }

      const runner = body.processAll === false
        ? runHistoricalFaceEmbeddingBackfillBatch
        : runHistoricalFaceEmbeddingBackfillUntilDone;

      const outcome = await runner(gate.scope, {
        archetypeId,
        confirmed: true,
        retryFailedOnly: Boolean(body.retryFailedOnly),
        resumeJobId:
          typeof body.resumeJobId === "string" ? body.resumeJobId : undefined,
        batchSize:
          typeof body.batchSize === "number" ? body.batchSize : undefined,
        createdBy: "persona-studio-ui",
      });

      const coverage = await loadHistoricalProtectionSnapshot(gate.scope, {
        archetypeId,
      });

      return jsonOk({
        projectId,
        archetypeId,
        ...outcome,
        historicalCoverage: coverage,
      });
    }

    if (body.action === "preflight") {
      if (process.env.NODE_ENV === "production") {
        return jsonOk({ enabled: false, reason: "production" as const });
      }
      const project = await getCreationProject(gate.scope, projectId);
      const archetypeId = resolveArchetypeId(project);
      const report = await runProjectNoveltyPreflight(gate.scope, archetypeId);
      return jsonOk({ projectId, ...report });
    }

    throw new PersonaDomainError("Unsupported action", "VALIDATION", {
      action: body.action,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      console.error("[persona.novelty] route_error", {
        message: error.message,
        stack: error.stack,
        lastCheckpoint: (error as Error & { lastCheckpoint?: string }).lastCheckpoint,
      });
    }
    return jsonError(error, dict.persona.errors.unexpected);
  }
}
