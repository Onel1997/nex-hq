import { NextResponse } from "next/server";
import { z } from "zod";
import { runCeoChat } from "@/agents/ceo";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  try {
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
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: dict.ceo.errors.invalidRequest, details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { workspace } = await ensureWorkspaceBrainSeeded();

    const result = await runCeoChat({
      message: parsed.data.message,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      locale: DEFAULT_LOCALE,
    });

    return NextResponse.json({
      response: result.response,
      timestamp: new Date().toISOString(),
      contextRecordCount: result.brainContext.sourceRecordIds.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.ceo.errors.unexpected;

    console.error("[CEO Chat]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
