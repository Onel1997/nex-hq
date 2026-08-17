import { NextResponse } from "next/server";
import { z } from "zod";
import { saveImageToBrain } from "@/agents/image/save";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveOriginTaskId } from "@/lib/tasks/resolve-origin-task";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { brandModelTraceSchema } from "@/lib/persona/domain/brand-model-contract";
import { buildImageStudioPersonaHandoff } from "@/lib/persona/future/image-studio-hooks";
import {
  createImageBrandModelProductionContext,
  type ImageBrandModelProductionContext,
} from "@/lib/image/brand-model-production-context";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import { jsonError, requirePersonaScope } from "@/app/api/persona/_utils";
import { createDeterministicImageProductionPlan } from "@/lib/image/deterministic-production-plan";

const dict = getDictionary(DEFAULT_LOCALE);

const imageRequestSchema = z
  .object({
    brief: z.string().min(3).max(4000),
    taskId: z.string().uuid().optional(),
    brandModelSelection: brandModelTraceSchema.optional(),
    productName: z.string().min(1).max(300).optional(),
    collectionName: z.string().min(1).max(300).optional(),
    color: z.string().min(1).max(200).optional(),
    material: z.string().min(1).max(200).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    console.info(`[Image Run ${requestId}] Incoming request`);

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.image.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = imageRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: dict.image.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const gated = await requirePersonaScope();
    if (!gated.ok) return gated.response;
    let brandModelContext: ImageBrandModelProductionContext | undefined;
    if (parsed.data.brandModelSelection) {
      const selection = parsed.data.brandModelSelection;
      const handoff = await buildImageStudioPersonaHandoff(
        gated.scope,
        selection.personaId,
        {
          expectedIdentity: {
            identityLockSnapshotId: selection.identityLockSnapshotId,
            identityLockVersion: selection.identityLockVersion,
            identityFingerprint: selection.identityFingerprint,
          },
          resolveAssetAccess: false,
        },
      );
      brandModelContext = createImageBrandModelProductionContext(handoff);
    }

    const { workspace } = await ensureWorkspaceBrainSeeded();
    if (
      brandModelContext &&
      brandModelContext.contract.workspaceId !== workspace.id
    ) {
      throw new PersonaDomainError(
        "Brand Model and Image project workspaces do not match.",
        "UNAUTHORIZED_WORKSPACE",
      );
    }
    const originTaskId = await resolveOriginTaskId(parsed.data.taskId);

    const output = createDeterministicImageProductionPlan({
      brief: parsed.data.brief,
      workspaceName: workspace.name,
      productName: parsed.data.productName,
      collectionName: parsed.data.collectionName,
      color: parsed.data.color,
      material: parsed.data.material,
      brandModelContext,
    });
    const saved = await saveImageToBrain({
      workspaceId: workspace.id,
      brief: parsed.data.brief,
      output,
      originTaskId,
      brandModelContext,
    });
    const result = {
      ...saved,
      ...output,
      contextRecordCount: 0,
      primaryReportCounts: {
        "ceo-report": 0,
        "design-report": 0,
        "content-report": 0,
        "marketing-report": 0,
      },
      brandModelContext,
    };

    console.info(`[Image Run ${requestId}] Success`, {
      reportId: result.reportId,
      contextRecordCount: result.contextRecordCount,
    });

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    });
  } catch (error) {
    if (error instanceof PersonaDomainError) return jsonError(error);

    const message =
      error instanceof Error ? error.message : dict.image.errors.unexpected;

    console.error(`[Image Run ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
