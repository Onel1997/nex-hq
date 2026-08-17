import { z } from "zod";
import { jsonError, jsonOk, requirePersonaScope } from "../../_utils";
import {
  getReferenceRightsView,
  referenceRightsConfirmationsSchema,
  submitReferenceRightsDecision,
} from "@/lib/persona/creation/reference-rights";

type Ctx = { params: Promise<{ id: string }> };

const requestSchema = z
  .object({
    operationId: z.string().uuid(),
    expectedIdentityLockSnapshotId: z.string().uuid(),
    expectedIdentityLockVersion: z.number().int().positive(),
    expectedIdentityFingerprint: z.string().min(1),
    decision: z.enum(["confirmed", "rejected"]),
    confirmations: referenceRightsConfirmationsSchema,
    rejectionReason: z.string().trim().max(2_000).optional(),
  })
  .strict();

export async function GET(_request: Request, ctx: Ctx) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  const { id } = await ctx.params;
  try {
    return jsonOk({ rights: await getReferenceRightsView(gated.scope, id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  const { id } = await ctx.params;
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonOk(
        {
          success: false,
          code: "VALIDATION",
          error: "Invalid reference-rights decision.",
          details: parsed.error.flatten(),
        },
        400,
      );
    }
    return jsonOk({
      result: await submitReferenceRightsDecision(gated.scope, id, parsed.data),
    });
  } catch (error) {
    return jsonError(error);
  }
}
