import { NextResponse } from "next/server";
import { z } from "zod";
import {
  runDesign,
  DesignKnowledgeError,
} from "@/agents/design";
import { DesignParseError } from "@/agents/design/parse-output";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

const designRequestSchema = z.object({
  brief: z.string().min(3).max(4000),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    console.info(`[Design Run ${requestId}] Incoming request`);

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.design.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: dict.design.errors.openaiNotConfigured },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = designRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: dict.design.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { workspace } = await ensureWorkspaceBrainSeeded();

    const result = await runDesign({
      brief: parsed.data.brief,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    });

    console.info(`[Design Run ${requestId}] Success`, {
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
    if (error instanceof DesignKnowledgeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }

    if (error instanceof DesignParseError) {
      console.error(`[Design Run ${requestId}] Parse error`, error.toLogPayload());
      console.error(
        `[Design Run ${requestId}] Validation issues:`,
        JSON.stringify(error.validationIssues, null, 2),
      );
      console.error(
        `[Design Run ${requestId}] Detailed:\n${error.toDetailedMessage()}`,
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
      error instanceof Error ? error.message : dict.design.errors.unexpected;

    console.error(`[Design Run ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
