import { NextResponse } from "next/server";
import { z } from "zod";
import { designStudioBriefSchema } from "@/agents/design/studio-brief";
import { runAiDesigner } from "@/lib/design/ai-designer";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

const requestSchema = z.object({
  brief: designStudioBriefSchema,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: dict.design.errors.invalidRequest,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = runAiDesigner({ brief: parsed.data.brief });

    return NextResponse.json({
      ok: true,
      concept: result.concept,
      renderPlan: result.renderPlan,
      review: result.review,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.design.errors.unexpected;

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
