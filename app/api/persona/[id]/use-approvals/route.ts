import { requirePersonaScope, jsonOk, jsonError, dict } from "../../_utils";
import {
  approveBrandCast,
  approveImageUse,
  approveVideoUse,
  getBrandModelApprovalsView,
  UseApprovalError,
} from "@/lib/persona/creation/use-approvals";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const approvals = await getBrandModelApprovalsView(gate.scope, id);
    return jsonOk({ approvals });
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
      confirmImageUseApproval?: boolean;
      confirmVideoUseApproval?: boolean;
      confirmBrandCastApproval?: boolean;
    };

    if (body.action === "approve_image_use") {
      const result = await approveImageUse(gate.scope, id, {
        confirmImageUseApproval: body.confirmImageUseApproval === true,
      });
      return jsonOk(result);
    }

    if (body.action === "approve_video_use") {
      const result = await approveVideoUse(gate.scope, id, {
        confirmVideoUseApproval: body.confirmVideoUseApproval === true,
      });
      return jsonOk(result);
    }

    if (body.action === "approve_brand_cast") {
      const result = await approveBrandCast(gate.scope, id, {
        confirmBrandCastApproval: body.confirmBrandCastApproval === true,
      });
      return jsonOk(result);
    }

    return jsonError(
      new Error(
        "Unsupported action — use approve_image_use | approve_video_use | approve_brand_cast",
      ),
    );
  } catch (error) {
    if (error instanceof UseApprovalError) {
      return Response.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: 409 },
      );
    }
    return jsonError(error, dict.persona.errors.unexpected);
  }
}
