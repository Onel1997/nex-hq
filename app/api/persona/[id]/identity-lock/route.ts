import { randomUUID } from "node:crypto";
import { requirePersonaScope, jsonOk, jsonError, dict } from "../../_utils";
import {
  getIdentityLockEligibility,
  getIdentityLockSnapshot,
  IdentityLockError,
  lockBrandIdentity,
  resolveLockedBrandIdentity,
} from "@/lib/persona/creation/identity-lock";

type Ctx = { params: Promise<{ id: string }> };

function identityLockErrorResponse(error: unknown) {
  const requestId =
    error instanceof IdentityLockError
      ? error.requestId
      : randomUUID();
  const stage =
    error instanceof IdentityLockError
      ? error.stage
      : typeof error === "object" &&
          error &&
          "details" in error &&
          typeof (error as { details?: { stage?: unknown } }).details?.stage ===
            "string"
        ? String((error as { details: { stage: string } }).details.stage)
        : "unknown";

  console.error("[identity-lock] POST failed", {
    requestId,
    stage,
    error,
  });

  if (error instanceof IdentityLockError) {
    return Response.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        stage: error.stage,
        requestId: error.requestId,
        details: error.details,
      },
      { status: 409 },
    );
  }

  // Preserve PostgREST / Error message in structured body for diagnosis.
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : dict.persona.errors.unexpected;
  const dbCode =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: unknown }).code ?? "")
      : undefined;

  return Response.json(
    {
      success: false,
      error: message,
      code: dbCode || "IDENTITY_LOCK_FAILED",
      stage,
      requestId,
    },
    { status: 500 },
  );
}

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const [eligibility, snapshot, lockedIdentity] = await Promise.all([
      getIdentityLockEligibility(gate.scope, id),
      getIdentityLockSnapshot(gate.scope, id),
      resolveLockedBrandIdentity(gate.scope, id),
    ]);
    return jsonOk({
      eligibility,
      snapshot,
      lockedIdentity,
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
      confirmIdentityLock?: boolean;
    };
    if (body.action !== "lock") {
      return jsonError(new Error("Unsupported action — use action: lock"));
    }
    const result = await lockBrandIdentity(gate.scope, id, {
      confirmIdentityLock: body.confirmIdentityLock === true,
    });
    return jsonOk({
      persona: result.persona,
      snapshot: result.snapshot,
      providerCalled: result.providerCalled,
      recovered: result.recovered,
      alreadyLocked: result.alreadyLocked,
      requestId: result.requestId,
      historicalProtectionPromotion: result.historicalProtectionPromotion,
    });
  } catch (error) {
    return identityLockErrorResponse(error);
  }
}
