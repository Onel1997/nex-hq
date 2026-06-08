import { NextResponse } from "next/server";
import { z } from "zod";
import {
  runCeoDelegation,
  CeoDelegationParseError,
  CeoKnowledgeError,
} from "@/agents/ceo/delegate";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

const delegateRequestSchema = z.object({
  goal: z.string().min(3).max(4000),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    console.info(`[CEO Delegate ${requestId}] Incoming request`);

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
    const parsed = delegateRequestSchema.safeParse(body);

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

    const result = await runCeoDelegation({
      goal: parsed.data.goal,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    });

    console.info(`[CEO Delegate ${requestId}] Success`, {
      parentTaskId: result.parentTaskId,
      taskCount: result.tasks.length,
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

    if (error instanceof CeoDelegationParseError) {
      console.error(
        `[CEO Delegate ${requestId}] Parse error`,
        error.toLogPayload(),
      );
      return NextResponse.json(
        {
          error: error.message,
          stage: error.stage,
          validationIssues: error.validationIssues,
        },
        { status: 500 },
      );
    }

    const message =
      error instanceof Error ? error.message : dict.ceo.errors.unexpected;

    console.error(`[CEO Delegate ${requestId}] Failed`, { message });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
