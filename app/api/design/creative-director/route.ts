import { NextResponse } from "next/server";
import { z } from "zod";
import { designStudioBriefSchema } from "@/agents/design/studio-brief";
import { runCreativeDirectorChat } from "@/agents/design/creative-director";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  brief: designStudioBriefSchema,
});

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.design.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { workspace } = await ensureWorkspaceBrainSeeded();

    const result = await runCreativeDirectorChat({
      message: parsed.data.message,
      brief: parsed.data.brief,
      workspaceName: workspace.name,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.design.errors.unexpected;
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
