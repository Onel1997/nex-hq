import { requirePersonaScope, jsonOk, jsonError, dict } from "../../_utils";
import { assertPaidGenerationHttpRequestAllowed } from "@/lib/persona/creation/paid-generation-guard";
import {
  convertCandidateToPersona,
  getCandidate,
  listCandidateAssetViews,
  requestStageBReferencePackage,
  retrySingleCandidateAsset,
  updateCandidateReview,
  uploadManualCandidateAsset,
} from "@/lib/persona/creation/creation-service";
import type { CandidateAssetType } from "@/lib/persona/domain/creation-types";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const candidate = await getCandidate(gate.scope, id);
    const assets = await listCandidateAssetViews(gate.scope, id);
    // Fail-closed: strip primary preview id from board-facing payload when novelty blocked/failed.
    const safeCandidate =
      candidate.status === "novelty_failed" || candidate.status === "novelty_blocked"
        ? { ...candidate, primary_preview_asset_id: null }
        : candidate;
    return jsonOk({ candidate: safeCandidate, assets });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "convert") {
      const result = await convertCandidateToPersona(gate.scope, id);
      return jsonOk(result);
    }
    if (body.action === "stage_b_package") {
      const result = await requestStageBReferencePackage(gate.scope, id);
      return jsonOk(result);
    }
    if (body.action === "retry_asset") {
      assertPaidGenerationHttpRequestAllowed(request);
      const result = await retrySingleCandidateAsset(
        gate.scope,
        id,
        String(body.asset_type || "portrait_front") as CandidateAssetType,
        {
          costConfirmed: Boolean(body.costConfirmed),
          retryConfirmed: Boolean(body.retryConfirmed),
          confirmationToken:
            typeof body.confirmationToken === "string"
              ? body.confirmationToken
              : undefined,
          userConfirmedAt:
            typeof body.userConfirmedAt === "string"
              ? body.userConfirmedAt
              : undefined,
        },
      );
      return jsonOk(result);
    }
    const candidate = await updateCandidateReview(gate.scope, id, body as never);
    return jsonOk({ candidate });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError(new Error(dict.persona.errors.invalidReference));
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const asset = await uploadManualCandidateAsset(
      gate.scope,
      id,
      {
        bytes,
        mimeType: file.type || "image/jpeg",
        filename: file.name || "upload.jpg",
      },
      {
        asset_type: (String(form.get("asset_type") || "portrait_front") as never),
        is_primary: form.get("is_primary") === "true",
      },
    );
    return jsonOk({ asset }, 201);
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}
