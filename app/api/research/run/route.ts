import { NextResponse } from "next/server";
import { z } from "zod";
import { runResearch } from "@/agents/research";
import { ResearchParseError } from "@/agents/research/parse-output";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { resolveOriginTaskId } from "@/lib/tasks/resolve-origin-task";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

const researchRequestSchema = z.object({
  request: z.string().min(3).max(4000),
  taskId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    console.info(`[Research Run ${requestId}] Incoming request`);

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.research.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: dict.research.errors.openaiNotConfigured },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = researchRequestSchema.safeParse(body);

    if (!parsed.success) {
      console.warn(`[Research Run ${requestId}] Invalid request body`, {
        issues: parsed.error.flatten(),
      });
      return NextResponse.json(
        {
          error: dict.research.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    console.info(`[Research Run ${requestId}] Request accepted`, {
      requestPreview: parsed.data.request.slice(0, 200),
    });

    const { workspace } = await ensureWorkspaceBrainSeeded();

    let originTaskId: string | undefined;
    if (parsed.data.taskId) {
      originTaskId = await resolveOriginTaskId(parsed.data.taskId);
    }

    console.info(`[Research Run ${requestId}] Workspace resolved`, {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    });

    const result = await runResearch({
      request: parsed.data.request,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      originTaskId,
    });

    console.info(`[Research Run ${requestId}] Success`, {
      reportId: result.reportId,
      savedDomains: result.savedDomains,
    });

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    });
  } catch (error) {
    if (error instanceof ResearchParseError) {
      const detailedError = error.toDetailedMessage();
      console.error(`[Research Run ${requestId}] Parse error`, error.toLogPayload());
      console.error(`[Research Run ${requestId}] Detailed:\n${detailedError}`);
      if (error.validationIssues?.length) {
        console.error(
          `[Research Run ${requestId}] Validation issues (${error.validationIssues.length})`,
          JSON.stringify(error.validationIssues, null, 2),
        );
      }

      return NextResponse.json(
        {
          error: error.message,
          stage: error.stage,
          expectedSchema: error.expectedSchema,
          receivedKeys: error.receivedKeys,
          missingFields: error.missingFields,
          validationIssues: error.validationIssues,
          received: error.parsed,
          rawResponsePreview: error.rawResponse?.slice(0, 2000),
          detailedError,
        },
        { status: 500 },
      );
    }

    const message =
      error instanceof Error ? error.message : dict.research.errors.unexpected;

    console.error(`[Research Run ${requestId}] Failed`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    console.error("[Research API] UNHANDLED ROUTE ERROR", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown research error",
        stage: "route_unhandled",
        details:
          process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      { status: 500 },
    );
  }
}
