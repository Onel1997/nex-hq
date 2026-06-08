import { NextResponse } from "next/server";
import { z } from "zod";
import { runCeoChat } from "@/agents/ceo";
import { ensureMilaeneBrainSeeded } from "@/brain/seed";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local and run the brain migration.",
        },
        { status: 503 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured. Add OPENAI_API_KEY to .env.local." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { workspace } = await ensureMilaeneBrainSeeded();

    const result = await runCeoChat({
      message: parsed.data.message,
      workspaceId: workspace.id,
    });

    return NextResponse.json({
      response: result.response,
      timestamp: new Date().toISOString(),
      contextRecordCount: result.brainContext.sourceRecordIds.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    console.error("[CEO Chat]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
