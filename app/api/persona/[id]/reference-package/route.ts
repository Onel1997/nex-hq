import {
  confirmAndGenerateReferencePackage,
  confirmAndRegenerateReferencePackageAngle,
  getReferencePackageStatus,
  prepareReferencePackageAngleRegeneration,
  prepareReferencePackageConfirmation,
  reassignReferencePackageAngle,
  recomputeReferencePackageAngleValidation,
} from "@/lib/persona/creation/reference-package";
import { isReferencePackageSlot } from "@/lib/persona/creation/reference-package/slots";
import { dict, jsonError, jsonOk, requirePersonaScope } from "../../_utils";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET — Reference Package status (no provider calls).
 * POST — prepare | confirm | prepare_regenerate | confirm_regenerate | reassign_angle
 */
export async function GET(_request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id: personaId } = await context.params;
    const status = await getReferencePackageStatus(gated.scope, personaId);
    return jsonOk({ success: true, status });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    const { id: personaId } = await context.params;
    const body = (await request.json()) as {
      action?: string;
      confirmationToken?: string;
      costConfirmed?: boolean;
      slot?: string;
      assetId?: string;
      targetSlot?: string;
    };
    const action = body.action ?? "prepare";

    if (action === "status") {
      const status = await getReferencePackageStatus(gated.scope, personaId);
      return jsonOk({ success: true, status });
    }

    if (action === "prepare") {
      const prepared = await prepareReferencePackageConfirmation(
        gated.scope,
        personaId,
      );
      return jsonOk({
        success: true,
        action: "prepare",
        providerCalled: false,
        confirmationToken: prepared.confirmationToken,
        estimate: prepared.estimate,
        slots: prepared.slots,
        masterReferenceId: prepared.masterReferenceId,
        sessionId: prepared.session.id,
      });
    }

    if (action === "confirm") {
      const result = await confirmAndGenerateReferencePackage(
        gated.scope,
        personaId,
        {
          confirmationToken: String(body.confirmationToken ?? ""),
          costConfirmed: body.costConfirmed === true,
        },
      );
      return jsonOk({ success: true, action: "confirm", ...result });
    }

    if (action === "prepare_regenerate") {
      if (!body.slot || !isReferencePackageSlot(body.slot)) {
        return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
      }
      const prepared = await prepareReferencePackageAngleRegeneration(
        gated.scope,
        personaId,
        body.slot,
      );
      return jsonOk({
        success: true,
        action: "prepare_regenerate",
        providerCalled: false,
        confirmationToken: prepared.confirmationToken,
        estimate: prepared.estimate,
        slots: prepared.slots,
        masterReferenceId: prepared.masterReferenceId,
        sessionId: prepared.session.id,
      });
    }

    if (action === "confirm_regenerate") {
      if (!body.slot || !isReferencePackageSlot(body.slot)) {
        return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
      }
      const result = await confirmAndRegenerateReferencePackageAngle(
        gated.scope,
        personaId,
        body.slot,
        {
          confirmationToken: String(body.confirmationToken ?? ""),
          costConfirmed: body.costConfirmed === true,
        },
      );
      return jsonOk({ success: true, action: "confirm_regenerate", ...result });
    }

    if (action === "reassign_angle") {
      if (
        !body.assetId ||
        !body.targetSlot ||
        !isReferencePackageSlot(body.targetSlot)
      ) {
        return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
      }
      const result = await reassignReferencePackageAngle(
        gated.scope,
        personaId,
        {
          assetId: body.assetId,
          targetSlot: body.targetSlot,
        },
      );
      return jsonOk({
        success: true,
        action: "reassign_angle",
        ...result,
      });
    }

    if (action === "recompute_angle") {
      if (!body.assetId) {
        return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
      }
      const result = await recomputeReferencePackageAngleValidation(
        gated.scope,
        personaId,
        { assetId: body.assetId },
      );
      return jsonOk({
        success: true,
        action: "recompute_angle",
        ...result,
      });
    }

    return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
  } catch (error) {
    return jsonError(error);
  }
}
