import { requirePersonaScope, jsonOk, jsonError, dict } from "../../../_utils";
import { PersonaDomainError } from "@/lib/persona";
import { getCreationProject, getCandidate } from "@/lib/persona/creation/creation-service";
import {
  loadProjectNoveltyLiveDebug,
  runProjectNoveltyPreflight,
} from "@/lib/persona/face-novelty-memory/project-live-debug";
import { isPersonaFaceNoveltyDebugEnabled } from "@/lib/persona/face-novelty-memory/live-debug";
import { retryFaceNoveltyEvaluation } from "@/lib/persona/face-novelty-memory/retry-evaluation";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

function resolveArchetypeId(project: {
  brand_role: string;
}): string {
  return project.brand_role || "unknown";
}

/**
 * GET — Face Novelty Live Check debug payload (development-only).
 * POST action=preflight — Run Face Novelty Preflight (no OpenAI).
 * POST action=retry_evaluation — Re-run face eval on existing image (no OpenAI).
 */
export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id: projectId } = await ctx.params;

  if (!isPersonaFaceNoveltyDebugEnabled()) {
    return jsonOk({ enabled: false, reason: "flag_disabled" as const });
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

    if (!isPersonaFaceNoveltyDebugEnabled()) {
      return jsonOk({ enabled: false, reason: "flag_disabled" as const });
    }

    if (body.action === "preflight") {
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
      console.error("[persona.novelty.retry] route_error", {
        message: error.message,
        stack: error.stack,
        lastCheckpoint: (error as Error & { lastCheckpoint?: string }).lastCheckpoint,
      });
    }
    return jsonError(error, dict.persona.errors.unexpected);
  }
}
