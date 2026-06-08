import { NextResponse } from "next/server";
import { z } from "zod";
import { runImage, ImageKnowledgeError } from "@/agents/image";
import { ImageParseError } from "@/agents/image/parse-output";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

const imageRequestSchema = z.object({
  brief: z.string().min(3).max(4000),
});

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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: dict.image.errors.openaiNotConfigured },
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

    const { workspace } = await ensureWorkspaceBrainSeeded();

    const result = await runImage({
      brief: parsed.data.brief,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    });

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
    if (error instanceof ImageKnowledgeError) {
      console.error(`[Image Run ${requestId}] Knowledge error`, {
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

    if (error instanceof ImageParseError) {
      console.error(`[Image Run ${requestId}] Parse error`, error.toLogPayload());
      console.error(
        `[Image Run ${requestId}] Validation issues:`,
        JSON.stringify(error.validationIssues, null, 2),
      );
      console.error(
        `[Image Run ${requestId}] Detailed:\n${error.toDetailedMessage()}`,
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
      error instanceof Error ? error.message : dict.image.errors.unexpected;

    console.error(`[Image Run ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
