import { requirePersonaScope, jsonOk, jsonError, dict } from "../../_utils";
import {
  emptyIdentityChecklist,
  lockPersonaIdentity,
  submitIdentityReview,
} from "@/lib/persona/creation/creation-service";
import { getCreationRepository } from "@/lib/persona/creation/creation-factory";
import type { IdentityReviewChecklist } from "@/lib/persona/domain/creation-types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const reviews = await getCreationRepository().listIdentityReviews(
      gate.scope,
      id,
    );
    return jsonOk({
      reviews,
      emptyChecklist: emptyIdentityChecklist(),
      note: "Manuelle Prüfung — keine KI-Verifikation in V1.",
    });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const body = (await request.json()) as {
      action?: string;
      checklist?: IdentityReviewChecklist;
      reviewer_notes?: string;
    };
    if (body.action === "lock") {
      const persona = await lockPersonaIdentity(gate.scope, id);
      return jsonOk({ persona });
    }
    if (!body.checklist) {
      return jsonError(new Error("Checklist erforderlich"));
    }
    const review = await submitIdentityReview(gate.scope, id, {
      checklist: body.checklist,
      reviewer_notes: body.reviewer_notes,
    });
    return jsonOk({ review }, 201);
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}
