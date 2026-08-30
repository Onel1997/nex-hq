import { z } from "zod";
import { jsonError, jsonOk, requirePersonaScope } from "../../_utils";
import {
  getVideoIdentityReadinessView,
  submitVideoIdentityReview,
  videoIdentityReviewChecklistSchema,
} from "@/lib/persona/creation/video-readiness";

type Ctx = { params: Promise<{ id: string }> };

const requestSchema = z
  .object({
    operationId: z.string().uuid(),
    expectedIdentityLockSnapshotId: z.string().uuid(),
    expectedIdentityLockVersion: z.number().int().positive(),
    expectedIdentityFingerprint: z.string().min(1),
    expectedReferencePackageFingerprint: z.string().min(1),
    checklist: videoIdentityReviewChecklistSchema,
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().trim().max(2_000).optional(),
  })
  .strict();

export async function GET(_request: Request, ctx: Ctx) {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  const { id } = await ctx.params;
  try {
    return jsonOk({
      readiness: await getVideoIdentityReadinessView(gated.scope, id),
    });
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
          error: "Ungültige Video-Identitätsprüfung.",
          details: parsed.error.flatten(),
        },
        400,
      );
    }
    return jsonOk({
      result: await submitVideoIdentityReview(gated.scope, id, parsed.data),
    });
  } catch (error) {
    return jsonError(error);
  }
}
