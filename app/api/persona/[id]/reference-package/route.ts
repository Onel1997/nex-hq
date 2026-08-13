import {
  confirmAndGenerateReferencePackage,
  confirmAndRegenerateReferencePackageAngle,
  getReferencePackageStatus,
  prepareReferencePackageAngleRegeneration,
  prepareReferencePackageConfirmation,
  reassignReferencePackageAngle,
  recomputeReferencePackageAngleValidation,
  approveHumanIdentityOverride,
  createMirroredReferenceVersion,
  prepareAcceptedAngleReplacement,
  confirmAcceptedAngleReplacement,
  approveAndReplaceAcceptedReference,
  rejectAcceptedReplacement,
  keepCurrentAcceptedReplacement,
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
      invertedFallbackConfirmed?: boolean;
      slot?: string;
      assetId?: string;
      targetSlot?: string;
      masterCompared?: boolean;
      overrideConfirmed?: boolean;
      reason?: string;
      confirmed?: boolean;
      replaceConfirmed?: boolean;
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
        directionPlan: prepared.directionPlan,
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
          invertedFallbackConfirmed:
            body.invertedFallbackConfirmed === undefined
              ? undefined
              : body.invertedFallbackConfirmed === true,
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

    if (action === "approve_identity_override") {
      if (!body.assetId) {
        return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
      }
      const result = await approveHumanIdentityOverride(
        gated.scope,
        personaId,
        {
          assetId: body.assetId,
          masterCompared: body.masterCompared === true,
          overrideConfirmed: body.overrideConfirmed === true,
          reason:
            typeof body.reason === "string" ? body.reason : undefined,
        },
      );
      return jsonOk({
        success: true,
        action: "approve_identity_override",
        ...result,
      });
    }

    if (action === "create_mirrored_version") {
      if (!body.assetId) {
        return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
      }
      const result = await createMirroredReferenceVersion(
        gated.scope,
        personaId,
        {
          assetId: body.assetId,
          confirmed: body.confirmed !== false,
        },
      );
      return jsonOk({
        success: true,
        action: "create_mirrored_version",
        ...result,
      });
    }

    if (action === "prepare_regenerate_accepted") {
      if (!body.assetId) {
        return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
      }
      const result = await prepareAcceptedAngleReplacement(
        gated.scope,
        personaId,
        { assetId: body.assetId },
      );
      return jsonOk({ success: true, ...result });
    }

    if (action === "confirm_regenerate_accepted") {
      if (!body.assetId || !body.confirmationToken) {
        return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
      }
      const result = await confirmAcceptedAngleReplacement(
        gated.scope,
        personaId,
        {
          assetId: body.assetId,
          confirmationToken: body.confirmationToken,
          costConfirmed: body.costConfirmed === true,
        },
      );
      return jsonOk({ success: true, ...result });
    }

    if (action === "approve_replacement") {
      if (!body.assetId) {
        return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
      }
      const result = await approveAndReplaceAcceptedReference(
        gated.scope,
        personaId,
        {
          assetId: body.assetId,
          replaceConfirmed: body.replaceConfirmed !== false,
        },
      );
      return jsonOk({ success: true, action: "approve_replacement", ...result });
    }

    if (action === "reject_replacement") {
      if (!body.assetId) {
        return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
      }
      const result = await rejectAcceptedReplacement(gated.scope, personaId, {
        assetId: body.assetId,
      });
      return jsonOk({ success: true, action: "reject_replacement", ...result });
    }

    if (action === "keep_current_replacement") {
      if (!body.assetId) {
        return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
      }
      const result = await keepCurrentAcceptedReplacement(
        gated.scope,
        personaId,
        { assetId: body.assetId },
      );
      return jsonOk({ success: true, action: "keep_current_replacement", ...result });
    }

    return jsonOk({ error: dict.persona.errors.invalidRequest }, 400);
  } catch (error) {
    return jsonError(error);
  }
}
