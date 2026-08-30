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
import { sanitizeOptionalProjectContextString } from "@/lib/image/optional-project-context";
import { logImageStudioTimings, timeImageStudioPhase, type ImageStudioTiming } from "@/lib/image/performance-diagnostics";

const dict = getDictionary(DEFAULT_LOCALE);

const optionalProjectHintSchema = (maxLength: number) =>
  z.preprocess(
    (value) =>
      sanitizeOptionalProjectContextString(value, { maxLength }),
    z.string().min(2).max(maxLength).optional(),
  );

const imageRequestSchema = z
  .object({
    brief: z.string().min(3).max(4000),
    taskId: z.string().uuid().optional(),
    brandModelSelection: brandModelTraceSchema.optional(),
    productName: optionalProjectHintSchema(300),
    collectionName: optionalProjectHintSchema(300),
    color: optionalProjectHintSchema(200),
    material: optionalProjectHintSchema(200),
  })
  .strict();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const timings: ImageStudioTiming[] = [];

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

    const gated = await timeImageStudioPhase("owner-auth", requirePersonaScope, timings);
    if (!gated.ok) return gated.response;
    let brandModelContext: ImageBrandModelProductionContext | undefined;
    if (parsed.data.brandModelSelection) {
      const selection = parsed.data.brandModelSelection;
      const handoff = await timeImageStudioPhase(
        "brand-model-authority",
        () => buildImageStudioPersonaHandoff(
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
        ),
        timings,
      );
      brandModelContext = createImageBrandModelProductionContext(handoff);
    }

    const { workspace } = await timeImageStudioPhase(
      "workspace-brain",
      ensureWorkspaceBrainSeeded,
      timings,
    );
    if (
      brandModelContext &&
      brandModelContext.contract.workspaceId !== workspace.id
    ) {
      throw new PersonaDomainError(
        "Brand Model and Image project workspaces do not match.",
        "UNAUTHORIZED_WORKSPACE",
      );
    }
    const originTaskId = await timeImageStudioPhase(
      "origin-task",
      () => resolveOriginTaskId(parsed.data.taskId),
      timings,
    );

    const output = createDeterministicImageProductionPlan({
      brief: parsed.data.brief,
      workspaceName: workspace.name,
      productName: parsed.data.productName,
      collectionName: parsed.data.collectionName,
      color: parsed.data.color,
      material: parsed.data.material,
      brandModelContext,
    });
    const saved = await timeImageStudioPhase(
      "persist-production-plan",
      () => saveImageToBrain({
        workspaceId: workspace.id,
        brief: parsed.data.brief,
        output,
        originTaskId,
        brandModelContext,
      }),
      timings,
    );
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
    logImageStudioTimings("image-production-plan", timings);

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    });
  } catch (error) {
    if (error instanceof PersonaDomainError) return jsonError(error);

    if (error instanceof z.ZodError) {
      console.error(`[Image Run ${requestId}] Planning validation failed`, {
        issues: error.issues,
      });
      return NextResponse.json(
        {
          error:
            "Die Bildplanung konnte nicht vollständig vorbereitet werden. Bitte prüfe die aktuelle Auswahl.",
        },
        { status: 422 },
      );
    }

    const message =
      error instanceof Error ? error.message : dict.image.errors.unexpected;

    console.error(`[Image Run ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
