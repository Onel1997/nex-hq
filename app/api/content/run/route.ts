import { NextResponse } from "next/server";
import { z } from "zod";
import { runContent, ContentKnowledgeError } from "@/agents/content";
import { ContentParseError } from "@/agents/content/parse-output";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveOriginTaskId } from "@/lib/tasks/resolve-origin-task";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

const contentRequestSchema = z.object({
  brief: z.string().min(3).max(4000),
  taskId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    console.info(`[Content Run ${requestId}] Incoming request`);

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.content.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: dict.content.errors.openaiNotConfigured },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = contentRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: dict.content.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { workspace } = await ensureWorkspaceBrainSeeded();
    const originTaskId = await resolveOriginTaskId(parsed.data.taskId);

    const result = await runContent({
      brief: parsed.data.brief,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      originTaskId,
    });

    console.info(`[Content Run ${requestId}] Success`, {
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
    if (error instanceof ContentKnowledgeError) {
      console.error(`[Content Run ${requestId}] Knowledge error`, {
        workspaceId: error.workspaceId,
        missingReportTypes: error.missingReportTypes,
        primaryReportCounts: error.primaryReportCounts,
      });
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          missingReportTypes: error.missingReportTypes,
          primaryReportCounts: error.primaryReportCounts,
          workspaceId: error.workspaceId,
        },
        { status: 422 },
      );
    }

    if (error instanceof ContentParseError) {
      console.error(`[Content Run ${requestId}] Parse error`, error.toLogPayload());
      console.error(
        `[Content Run ${requestId}] Validation issues:`,
        JSON.stringify(error.validationIssues, null, 2),
      );
      console.error(
        `[Content Run ${requestId}] Detailed:\n${error.toDetailedMessage()}`,
      );
      return NextResponse.json(
        {
          error: error.message,
          stage: error.stage,
          missingFields: error.missingFields,
          validationIssues: error.validationIssues,
          receivedKeys: error.receivedKeys,
          rawResponsePreview: error.rawResponse?.slice(0, 4000),
          parsedPreview: error.parsed,
          detailedError: error.toDetailedMessage(),
        },
        { status: 500 },
      );
    }

    const message =
      error instanceof Error ? error.message : dict.content.errors.unexpected;

    console.error(`[Content Run ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
