import { NextResponse } from "next/server";
import { z } from "zod";
import { runCeo, CeoKnowledgeError, CeoParseError } from "@/agents/ceo";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveOriginTaskId } from "@/lib/tasks/resolve-origin-task";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

const ceoRequestSchema = z.object({
  question: z.string().min(3).max(4000),
  taskId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    console.info(`[CEO Run ${requestId}] Incoming request`);

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.ceo.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: dict.ceo.errors.openaiNotConfigured },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = ceoRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: dict.ceo.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { workspace } = await ensureWorkspaceBrainSeeded();
    const originTaskId = await resolveOriginTaskId(parsed.data.taskId);

    const result = await runCeo({
      question: parsed.data.question,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      originTaskId,
    });

    console.info(`[CEO Run ${requestId}] Success`, {
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
    if (error instanceof CeoKnowledgeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }

    if (error instanceof CeoParseError) {
      console.error(`[CEO Run ${requestId}] Parse error`, error.toLogPayload());
      return NextResponse.json(
        {
          error: error.message,
          stage: error.stage,
          validationIssues: error.validationIssues,
          rawResponsePreview: error.rawResponse?.slice(0, 2000),
          detailedError: error.toDetailedMessage(),
        },
        { status: 500 },
      );
    }

    const message =
      error instanceof Error ? error.message : dict.ceo.errors.unexpected;

    console.error(`[CEO Run ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
