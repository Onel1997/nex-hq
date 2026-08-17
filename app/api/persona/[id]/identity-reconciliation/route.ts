import { z } from "zod";
import { requirePersonaScope, jsonError, jsonOk, dict } from "../../_utils";
import {
  getLegacyIdentityReconciliationView,
  submitLegacyIdentityReconciliation,
} from "@/lib/persona/creation/identity-lock";

type Ctx = { params: Promise<{ id: string }> };

const checklistSchema = z
  .object({
    same_person_across_references: z.boolean(),
    stable_face_structure: z.boolean(),
    stable_skin_tone: z.boolean(),
    stable_body_proportions: z.boolean(),
    no_ai_anatomy_defects: z.boolean(),
    no_inconsistent_age: z.boolean(),
    no_changing_eye_color: z.boolean(),
    no_unapproved_hairline_change: z.boolean(),
    no_text_watermark_artifacts: z.boolean(),
    realistic_hands_where_visible: z.boolean(),
    suitable_for_image_generation: z.boolean(),
    suitable_for_video_generation: z.boolean(),
  })
  .strict();

const confirmationsSchema = z
  .object({
    masterIdentityReferenceCorrect: z.boolean(),
    requiredReferenceCoverageReviewed: z.boolean(),
    samePersonAcrossReferences: z.boolean(),
    noObviousIdentityMismatch: z.boolean(),
    acceptableForImageUse: z.boolean(),
    remainOfficialBrandModelIdentity: z.boolean(),
  })
  .strict();

const reconciliationRequestSchema = z
  .object({
    operationId: z.string().uuid(),
    expectedSnapshotId: z.string().uuid(),
    expectedLockVersion: z.number().int().positive(),
    decision: z.enum(["approved", "rejected"]),
    acknowledgeHistoricalProvenanceMissing: z.literal(true),
    checklist: checklistSchema,
    confirmations: confirmationsSchema,
    reviewerNotes: z.string().trim().max(2_000).optional(),
  })
  .strict();

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const reconciliation = await getLegacyIdentityReconciliationView(
      gate.scope,
      id,
    );
    return jsonOk({ reconciliation });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const parsed = reconciliationRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: "Invalid legacy reconciliation request.",
          code: "VALIDATION",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const result = await submitLegacyIdentityReconciliation(
      gate.scope,
      id,
      parsed.data,
    );
    return jsonOk({ reconciliation: result });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}
